/**
 * LinkedIn Learning course-page scraper.
 *
 * The premise that LinkedIn Learning "cannot be crawled" holds only for its
 * *search* endpoint (`/learning/search?`, which robots.txt disallows and which
 * powers Apify-style crawls). Individual course pages are a different surface:
 *
 *   GET https://www.linkedin.com/learning/{slug}
 *
 * answers HTTP 200 to an anonymous client and server-renders a complete
 * `schema.org/Course` JSON-LD block — name, description, workload, language,
 * offer/price, difficulty (`educationalLevel`) — plus a "Skills you'll gain"
 * pill list and a topic breadcrumb. No login, no bot-detection wall. robots.txt
 * permits `/learning/{slug}`; only `/learning/search`, `/me`, `/settings` etc.
 * are disallowed, none of which this scraper touches.
 *
 * So the catalogue is assembled in two halves, mirroring the Coursera sync:
 *   1. enumerate slugs           (linkedinLearningEnumerate.ts)
 *   2. scrape each course page    (this file)
 *
 * Parsing is JSON-LD-first (a stable, documented contract) with two regex
 * fallbacks over the rendered HTML for the skill pills and difficulty, which
 * live outside the JSON-LD block.
 */
import { fetchWithRetry, mapLimit } from "./net";
import { parseIsoDuration } from "./duration";

/** Everything a course page yields. */
export interface ScrapedLinkedInCourse {
  slug: string;
  title: string;
  description?: string;
  provider?: string; // instructor(s), falling back to "LinkedIn Learning"
  skills: string[];
  level?: string; // Beginner | Intermediate | Advanced
  durationHours?: number;
  language?: string; // e.g. "English"
  costType?: string; // subscription | free
  category?: string; // top-level topic from the breadcrumb
  url: string;
}

export interface ScrapeOptions {
  concurrency?: number;
  delayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, detail?: ScrapedLinkedInCourse) => void;
  onError?: (slug: string, err: Error) => void;
}

const BASE = "https://www.linkedin.com/learning";

/** `en` → "English", `pt-BR` → "Brazilian Portuguese"; falls back to the code. */
function languageName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames(["en"], { type: "language", fallback: "none" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** LinkedIn's difficulty vocabulary → the schema's Beginner/Intermediate/Advanced. */
function normaliseLevel(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes("begin")) return "Beginner";
  if (v.includes("inter")) return "Intermediate";
  if (v.includes("adv")) return "Advanced";
  return undefined; // "General"/"All levels" → no defensible single level
}

/** The Offer.category ("Subscription") → our cost vocabulary. */
function costFromOffers(offers: unknown): string | undefined {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    const cat = (o as { category?: string })?.category?.toLowerCase();
    if (cat?.includes("free")) return "free";
    if (cat) return "subscription"; // LinkedIn Learning is seat-licensed
  }
  return undefined;
}

interface CourseLd {
  "@type"?: string;
  name?: string;
  description?: string;
  inLanguage?: string;
  offers?: unknown;
  educationalLevel?: string;
  hasCourseInstance?: { courseWorkload?: string; instructor?: unknown };
  creator?: unknown;
}

/** All `<script type="application/ld+json">` payloads on the page, parsed. */
function readJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      // A malformed block must not sink the whole page.
    }
  }
  return out;
}

/** First `name` found among a Person / Person[] value. */
function personNames(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((p) => (p as { name?: string })?.name?.trim()).filter((n): n is string => !!n);
}

/** Skill-pill anchors: `<a class="… skill-pill">Python (Programming Language)</a>`. */
function readSkills(html: string): string[] {
  const skills: string[] = [];
  const re = /class="[^"]*skill-pill[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const s = m[1].replace(/\s+/g, " ").trim();
    if (s) skills.push(s);
  }
  return [...new Set(skills)];
}

/** The top-level topic from the breadcrumb (position 2: "Technology", "Business"…). */
function readCategory(lds: unknown[]): string | undefined {
  const crumb = lds.find(
    (d) => (d as { "@type"?: string })?.["@type"] === "BreadcrumbList"
  ) as { itemListElement?: { position?: number; name?: string }[] } | undefined;
  const items = crumb?.itemListElement ?? [];
  // position 1 is "All topics"; position 2 is the top domain we treat as category.
  const domain = items.find((i) => i.position === 2)?.name?.trim();
  return domain && domain.toLowerCase() !== "all topics" ? domain : undefined;
}

/** Turn a fetched course page into a structured course. Exported for tests. */
export function parseCoursePage(slug: string, html: string): ScrapedLinkedInCourse | null {
  const lds = readJsonLd(html);
  const course = lds.find((d) => {
    const t = (d as CourseLd)["@type"];
    return t === "Course" || (Array.isArray(t) && t.includes("Course"));
  }) as CourseLd | undefined;

  // No Course JSON-LD means this was not a live course page (404 shell, path,
  // or a retired course). Skip rather than store an empty row.
  const title = course?.name?.trim();
  if (!course || !title) return null;

  const instructors = personNames(course.hasCourseInstance?.instructor ?? course.creator);

  return {
    slug,
    title,
    description: course.description?.trim() || undefined,
    provider: instructors.length ? instructors.join(", ") : "LinkedIn Learning",
    skills: readSkills(html),
    level:
      normaliseLevel(course.educationalLevel) ??
      normaliseLevel(/"educationalLevel":"([^"]+)"/.exec(html)?.[1]),
    durationHours: parseIsoDuration(course.hasCourseInstance?.courseWorkload),
    language: languageName(course.inLanguage) ?? "English",
    costType: costFromOffers(course.offers),
    category: readCategory(lds),
    url: `${BASE}/${slug}`,
  };
}

/** Fetch and parse one course page. `null` when the course is gone or gated. */
export async function scrapeCourse(
  slug: string,
  opts: ScrapeOptions = {}
): Promise<ScrapedLinkedInCourse | null> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(slug)}`, {
    timeoutMs: opts.timeoutMs ?? 30_000,
    signal: opts.signal,
    // A course page is HTML; ask for it explicitly.
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  if (res.status === 404 || res.status === 410) return null; // retired course
  if (!res.ok) throw new Error(`GET /learning/${slug} failed (${res.status})`);

  return parseCoursePage(slug, await res.text());
}

/**
 * Scrape many courses with bounded concurrency. A dead or gated page is
 * reported and skipped — one bad slug must not sink an 11k-course run.
 */
export async function scrapeCourses(
  slugs: readonly string[],
  opts: ScrapeOptions = {}
): Promise<Map<string, ScrapedLinkedInCourse>> {
  const out = new Map<string, ScrapedLinkedInCourse>();
  let done = 0;

  await mapLimit(
    slugs,
    opts.concurrency ?? 4,
    opts.delayMs ?? 300,
    async (slug) => {
      const detail = await scrapeCourse(slug, opts);
      done++;
      if (detail) out.set(slug, detail);
      opts.onProgress?.(done, slugs.length, detail ?? undefined);
      return detail;
    },
    (slug, _i, err) => {
      done++;
      opts.onError?.(slug, err);
    }
  );

  return out;
}

/** Recover the course slug from a stored LinkedIn Learning URL. */
export function slugFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const m = /linkedin\.com\/learning\/([A-Za-z0-9][A-Za-z0-9-]{2,150})(?:[/?#]|$)/i.exec(url);
  return m?.[1]?.toLowerCase();
}
