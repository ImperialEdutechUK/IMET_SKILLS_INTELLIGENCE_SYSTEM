/**
 * LinkedInLearningConnector — ingests LinkedIn Learning's official course
 * export (CSV / XLSX), which an admin downloads from the LinkedIn Learning
 * admin console (Content → Library → Export).
 *
 * Why an export and not a scraper. LinkedIn Learning cannot be crawled:
 *   - `/learning/{course}` answers HTTP 404 with an auth wall to any client
 *     that is not signed in, browser User-Agent or not.
 *   - there is no public learning sitemap.
 *   - robots.txt disallows `/learning/search?`, the only catalogue-enumeration
 *     endpoint.
 * Scraping it would mean driving a logged-in session past bot detection: it
 * breaks LinkedIn's terms, risks the account, and still cannot enumerate the
 * full catalogue. The admin export is complete, supported, and current.
 *
 * If you later obtain a LinkedIn Learning API agreement, `fetchCourses()` is
 * the single place to swap in the API call — nothing downstream changes.
 *
 * Column names differ between export versions and locales, so matching is
 * tolerant: see COLUMNS below.
 */
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";

/** Accepted header spellings, in priority order, per logical field. */
const COLUMNS = {
  title: ["course title", "content title", "title", "name"],
  url: ["course url", "content url", "url", "link", "web link"],
  description: ["course description", "description", "short description", "summary"],
  skills: ["skills", "skill", "topics", "categories", "tags"],
  level: ["difficulty", "difficulty level", "level"],
  duration: ["duration (seconds)", "duration in seconds", "duration", "length", "runtime"],
  language: ["locale", "language"],
  externalId: ["content id", "course id", "urn", "id"],
  provider: ["author", "authors", "instructor", "provider"],
  released: ["release date", "released", "published date"],
} as const;

function pick(row: Record<string, unknown>, keys: readonly string[]): unknown {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const key of keys) {
    const v = lower.get(key);
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function toSkills(v: unknown): string[] {
  if (!v) return [];
  const parts = Array.isArray(v) ? v.map(String) : String(v).split(/[,;|]/);
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

/**
 * LinkedIn exports course length in seconds. Anything under 60 is far more
 * likely to already be hours than a one-minute course, so treat the raw number
 * as hours only when the column name does not say "second".
 */
export function parseLinkedInDuration(row: Record<string, unknown>): number | undefined {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));

  // Find which duration column actually supplied the value — its own name tells
  // us the unit, so "Duration" and "Duration (seconds)" cannot be confused.
  const header = COLUMNS.duration.find((k) => {
    const v = lower.get(k);
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
  if (!header) return undefined;

  const raw = lower.get(header);
  const inSeconds = header.includes("second");

  // "01:23:45" — h:mm:ss
  const clock = String(raw).match(/^(\d+):([0-5]\d):([0-5]\d)$/);
  if (clock) {
    const hours = Number(clock[1]) + Number(clock[2]) / 60 + Number(clock[3]) / 3600;
    return Math.round(hours * 100) / 100;
  }

  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const hours = inSeconds ? n / 3600 : n;
  return Math.round(hours * 100) / 100;
}

/** Map one exported row onto an ExternalCourse. Returns null without a title. */
export function rowToExternalCourse(row: Record<string, unknown>): ExternalCourse | null {
  const title = toStr(pick(row, COLUMNS.title));
  if (!title) return null;

  return {
    title,
    provider: toStr(pick(row, COLUMNS.provider)) ?? "LinkedIn Learning",
    url: toStr(pick(row, COLUMNS.url)),
    description: toStr(pick(row, COLUMNS.description)),
    skills: toSkills(pick(row, COLUMNS.skills)),
    level: toStr(pick(row, COLUMNS.level)),
    durationHours: parseLinkedInDuration(row),
    costType: "subscription", // LinkedIn Learning is seat-licensed
    language: toStr(pick(row, COLUMNS.language)) ?? "English",
    externalId: toStr(pick(row, COLUMNS.externalId)) ?? toStr(pick(row, COLUMNS.url)),
    raw: row,
  };
}

export class LinkedInLearningConnector implements CourseSourceConnector {
  sourceName = "linkedin";

  constructor(private items: ExternalCourse[] = []) {}

  /** Build from the parsed rows of an uploaded LinkedIn Learning export. */
  static fromRows(rows: Record<string, unknown>[]): LinkedInLearningConnector {
    return new LinkedInLearningConnector(
      rows.map(rowToExternalCourse).filter((c): c is ExternalCourse => c !== null)
    );
  }

  /** Nothing to configure: the catalogue arrives as an uploaded export. */
  isConfigured(): boolean {
    return true;
  }

  async fetchCourses(): Promise<ExternalCourse[]> {
    return this.items;
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider ?? "LinkedIn Learning",
      source: "linkedin",
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.cpdHours ?? course.durationHours ?? 0,
      costType: course.costType ?? "subscription",
      language: course.language ?? "English",
      rating: course.rating,
      // An admin exported this from the org's own licensed library.
      approved: true,
      preferredProvider: false,
      availableToOrg: true,
      skills: course.skills ?? [],
    };
  }
}
