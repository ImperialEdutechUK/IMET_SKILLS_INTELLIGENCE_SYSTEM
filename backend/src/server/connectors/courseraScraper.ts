/**
 * Coursera course-page scraper — the enrichment half of the Coursera sync.
 *
 * The Catalog API gives us every course but no skill tags, difficulty, or
 * rating. Each `/learn/{slug}` page embeds those in its server-rendered JSON
 * state, so we fetch the page and pull them out.
 *
 * Politeness, by construction:
 *   - `/learn/` is permitted by https://www.coursera.org/robots.txt for `*`;
 *     `/lecture/` (disallowed for AI crawlers) is never requested.
 *   - honest, contactable User-Agent (see net.ts)
 *   - bounded concurrency + a delay between requests, both tunable
 *   - exponential backoff that honours `Retry-After` on 429/5xx
 *
 * It parses HTML with regexes over an embedded JSON blob rather than a DOM
 * library because the targets are three well-delimited JSON keys, not markup.
 */
import { fetchWithRetry, mapLimit } from "./net";

/** What a course page can tell us that the API cannot. */
export interface ScrapedCourseDetail {
  slug: string;
  skills: string[];
  level?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ScrapeOptions {
  /** Pages in flight at once (default 4). Keep this low. */
  concurrency?: number;
  /** Delay before each request, ms (default 400). */
  delayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, detail?: ScrapedCourseDetail) => void;
  onError?: (slug: string, err: Error) => void;
}

/** Coursera's difficulty vocabulary → the strings `courseLevelToNumber` reads. */
const LEVELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

// Exactly one `"skills":[...]` array is emitted per course page.
const SKILLS_RE = /"skills":\s*(\[[^\]]*\])/;
const LEVEL_RE = /"(?:product)?[Dd]ifficultyLevel":\s*"([A-Z]+)"/;
// `averageFiveStarRating` is the course's own rating. Bare `ratingValue` keys
// also appear inside FAQ/Review JSON-LD and are not the course score.
const RATING_RE = /"(?:averageFiveStarRating|avgProductRating)":\s*([0-9.]+)/;
const REVIEWS_RE = /"(?:reviewCount|ratingCount)":\s*(\d+)/;

/** Pull the four enrichment fields out of a rendered course page. */
export function parseCoursePage(slug: string, html: string): ScrapedCourseDetail {
  const detail: ScrapedCourseDetail = { slug, skills: [] };

  const skillsMatch = html.match(SKILLS_RE);
  if (skillsMatch) {
    try {
      const parsed = JSON.parse(skillsMatch[1]) as unknown[];
      detail.skills = [
        ...new Set(parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())),
      ];
    } catch {
      // Malformed blob: fall through with no skills rather than fail the course.
    }
  }

  const levelMatch = html.match(LEVEL_RE);
  if (levelMatch) detail.level = LEVELS[levelMatch[1]]; // MIXED → undefined

  const ratingMatch = html.match(RATING_RE);
  if (ratingMatch) {
    const value = parseFloat(ratingMatch[1]);
    // Round to the precision a 1–5 star score actually carries.
    if (value > 0 && value <= 5) detail.rating = Math.round(value * 100) / 100;
  }

  const reviewsMatch = html.match(REVIEWS_RE);
  if (reviewsMatch) detail.reviewCount = Number(reviewsMatch[1]);

  return detail;
}

/** Fetch and parse a single course page. Returns null when the page is gone. */
export async function scrapeCourse(slug: string, opts: ScrapeOptions = {}): Promise<ScrapedCourseDetail | null> {
  const res = await fetchWithRetry(`https://www.coursera.org/learn/${encodeURIComponent(slug)}`, {
    timeoutMs: opts.timeoutMs ?? 30_000,
    signal: opts.signal,
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  if (res.status === 404 || res.status === 410) return null; // retired course
  if (!res.ok) throw new Error(`GET /learn/${slug} failed (${res.status})`);

  return parseCoursePage(slug, await res.text());
}

/**
 * Enrich many courses. Failures are reported per-slug and skipped — one dead
 * page must not sink a 22k-course run.
 */
export async function scrapeCourses(
  slugs: readonly string[],
  opts: ScrapeOptions = {}
): Promise<Map<string, ScrapedCourseDetail>> {
  const out = new Map<string, ScrapedCourseDetail>();
  let done = 0;

  await mapLimit(
    slugs,
    opts.concurrency ?? 4,
    opts.delayMs ?? 400,
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

/** Recover the slug from a stored `externalUrl`. */
export function slugFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const match = url.match(/coursera\.org\/(?:learn|projects|specializations)\/([^/?#]+)/);
  return match?.[1];
}
