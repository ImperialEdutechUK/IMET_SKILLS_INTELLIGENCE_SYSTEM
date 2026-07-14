/**
 * CourseraCatalogConnector — the public Coursera Catalog API.
 *
 *   GET https://api.coursera.org/api/courses.v1?start=&limit=&fields=
 *   GET https://api.coursera.org/api/partners.v1   (id → partner name)
 *
 * No credentials required. The whole catalogue (~22.7k courses) paginates in a
 * couple of dozen requests, which is why this is an API client and not an HTML
 * crawler: it is faster, stabler, and returns structured fields.
 *
 * What the API does NOT return: skill tags, difficulty level, or rating. Those
 * live on the course page and are filled in by `courseraScraper.ts`, an opt-in
 * enrichment pass over `/learn/{slug}`.
 *
 * Env (all optional):
 *   COURSERA_API_BASE   default "https://api.coursera.org/api"
 *   SCRAPER_USER_AGENT  identify yourself; see net.ts
 */
import { fetchJson, sleep } from "./net";
import { parseWorkload } from "./duration";
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";

const DEFAULT_BASE = "https://api.coursera.org/api";

/** Fields the catalogue endpoint honours. Unknown names are silently ignored. */
const FIELDS = [
  "slug",
  "name",
  "description",
  "workload",
  "primaryLanguages",
  "domainTypes",
  "partnerIds",
  "photoUrl",
  "certificates",
].join(",");

/** The API caps a page at 1000; 500 keeps individual responses modest. */
const MAX_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 500;

export interface CourseraFetchOptions {
  /** Stop after this many courses (default: the entire catalogue). */
  limit?: number;
  /** Keep only these primary language codes, e.g. ["en"] (default: all). */
  languages?: string[];
  /** Case-insensitive substring filter on title/description (client-side). */
  query?: string;
  pageSize?: number;
  /** Pause between pages, ms (default 250). */
  delayMs?: number;
  signal?: AbortSignal;
  onProgress?: (scanned: number, total: number, kept: number) => void;
}

interface CourseraCourse {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  workload?: string;
  primaryLanguages?: string[];
  domainTypes?: { domainId?: string; subdomainId?: string }[];
  partnerIds?: string[];
  photoUrl?: string;
  certificates?: string[];
}

interface Paged<T> {
  elements: T[];
  paging?: { next?: string; total?: number };
}

/** Slug tokens that should not be naively title-cased. */
const ACRONYMS = new Set(["ai", "it", "ui", "ux", "api", "sql", "hr", "seo", "crm", "erp", "iot", "ml"]);

/** "machine-learning" → "Machine Learning"; "it-support" → "IT Support". */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * "en" → "English", "pt-BR" → "Brazilian Portuguese". Falls back to the code.
 * `fallback: "none"` matters: the default would render an unknown-but-wellformed
 * code as "zz (Unknown Region)" and store that as a language name.
 */
export function languageName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames(["en"], { type: "language", fallback: "none" }).of(code) ?? code;
  } catch {
    return code; // malformed tag: RangeError
  }
}

/** Public shape of one catalogue row, before normalisation. Exported for tests. */
export function toExternalCourse(raw: CourseraCourse, partners: Map<string, string>): ExternalCourse {
  const domainTypes = raw.domainTypes ?? [];
  // Sub-domains ("machine-learning", "marketing") read as skills; the broad
  // domain ("business") is a category, not a skill.
  const skills = [...new Set(domainTypes.map((d) => d.subdomainId).filter((s): s is string => !!s))].map(humanizeSlug);
  const category = domainTypes[0]?.domainId ? humanizeSlug(domainTypes[0].domainId) : undefined;
  const provider = raw.partnerIds?.map((id) => partners.get(id)).find(Boolean);

  return {
    title: (raw.name ?? "").trim(),
    // The partner is the real teaching provider; Coursera is only the platform.
    provider: provider ?? "Coursera",
    // /learn/{slug} 302-redirects to /projects/{slug} etc. where appropriate.
    url: `https://www.coursera.org/learn/${raw.slug}`,
    description: raw.description?.trim() || undefined,
    skills,
    level: undefined, // page-only; supplied by the enrichment pass
    durationHours: parseWorkload(raw.workload),
    // Coursera courses are typically free to audit and paid to certify. The API
    // exposes no price, so assert nothing rather than guess.
    costType: undefined,
    language: languageName(raw.primaryLanguages?.[0]) ?? "English",
    externalId: raw.id,
    raw: { ...raw, category },
  };
}

export class CourseraCatalogConnector implements CourseSourceConnector {
  sourceName = "coursera";

  constructor(private opts: CourseraFetchOptions = {}) {}

  /** The catalogue API is public — there is no key to check. */
  isConfigured(): boolean {
    return true;
  }

  private base(): string {
    return (process.env.COURSERA_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
  }

  /** partnerId → display name, for the `provider` column. Fetched once per sync. */
  private async fetchPartners(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let start = 0;
    for (;;) {
      const url = `${this.base()}/partners.v1?start=${start}&limit=${DEFAULT_PAGE_SIZE}&fields=name,shortName`;
      const page = await fetchJson<Paged<{ id: string; name?: string }>>(url, { signal: this.opts.signal });
      for (const p of page.elements) if (p.name) map.set(p.id, p.name);

      const next = Number(page.paging?.next);
      if (!page.paging?.next || !Number.isFinite(next) || page.elements.length === 0) break;
      start = next;
      await sleep(this.opts.delayMs ?? 250);
    }
    return map;
  }

  async fetchCourses(query?: string): Promise<ExternalCourse[]> {
    const pageSize = Math.min(this.opts.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const delayMs = this.opts.delayMs ?? 250;
    const wanted = this.opts.limit ?? Infinity;
    const needle = (query ?? this.opts.query)?.toLowerCase().trim();
    const languages = this.opts.languages?.map((l) => l.toLowerCase());

    const partners = await this.fetchPartners();

    const out: ExternalCourse[] = [];
    let start = 0;
    let total = 0;
    let scanned = 0;

    for (;;) {
      if (this.opts.signal?.aborted) break;

      const url = `${this.base()}/courses.v1?start=${start}&limit=${pageSize}&fields=${FIELDS}`;
      const page = await fetchJson<Paged<CourseraCourse>>(url, { signal: this.opts.signal });
      total = page.paging?.total ?? total;
      if (page.elements.length === 0) break;

      for (const raw of page.elements) {
        scanned++;
        if (!raw.name?.trim() || !raw.slug) continue;

        if (languages) {
          const lang = raw.primaryLanguages?.[0]?.toLowerCase();
          // Match "en" against both "en" and "en-GB".
          if (!lang || !languages.some((l) => lang === l || lang.startsWith(`${l}-`))) continue;
        }
        if (needle) {
          const haystack = `${raw.name} ${raw.description ?? ""}`.toLowerCase();
          if (!haystack.includes(needle)) continue;
        }

        out.push(toExternalCourse(raw, partners));
        if (out.length >= wanted) break;
      }

      this.opts.onProgress?.(scanned, total, out.length);
      if (out.length >= wanted) break;

      const next = Number(page.paging?.next);
      if (!page.paging?.next || !Number.isFinite(next) || next >= total) break;
      start = next;
      await sleep(delayMs);
    }

    return out;
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    const category = (course.raw as { category?: string } | undefined)?.category;
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider ?? "Coursera",
      source: "coursera",
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.durationHours ?? 0,
      costType: course.costType,
      language: course.language ?? "English",
      rating: course.rating,
      approved: false, // externally sourced: a human approves before it is recommended
      preferredProvider: false,
      availableToOrg: false,
      category,
      skills: course.skills ?? [],
    };
  }
}

/** Back-compat alias for the previous placeholder class name. */
export { CourseraCatalogConnector as CourseraBusinessConnector };
