/**
 * POST /api/courses/sync/coursera
 *
 * Pulls courses from the public Coursera Catalog API into the catalogue.
 *
 * Body (all optional):
 *   { limit?: number, query?: string, languages?: string[],
 *     enrich?: boolean, approveAll?: boolean, publish?: boolean }
 *
 * Deliberately bounded. The full catalogue is ~22.7k courses, and page
 * enrichment adds hours of scraping — that belongs in the CLI:
 *   npm run sync:coursera -- --languages en --enrich
 */
import { route, requireAuth, ok, badRequest, readJson } from "@/server/http";
import { CourseraCatalogConnector } from "@/server/connectors/coursera";
import { scrapeCourses, slugFromUrl } from "@/server/connectors/courseraScraper";
import { importCoursesBulk } from "@/server/connectors/bulkImporter";

const WRITE_ROLES = ["manager", "admin", "author"];

/** Keeps a single HTTP request well inside any gateway timeout. */
const MAX_LIMIT = 2_000;
const MAX_ENRICH = 200;
const DEFAULT_LIMIT = 200;

interface Body {
  limit?: number;
  query?: string;
  languages?: string[];
  enrich?: boolean;
  approveAll?: boolean;
  publish?: boolean;
}

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);
  const body = await readJson<Body | null>(req).catch(() => null);

  const limit = Math.min(body?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  if (!Number.isFinite(limit) || limit < 1) throw badRequest("`limit` must be a positive number.");

  const enrich = body?.enrich ?? false;
  if (enrich && limit > MAX_ENRICH) {
    throw badRequest(
      `Enrichment scrapes one page per course; cap \`limit\` at ${MAX_ENRICH} here, or run a full sync from the CLI: npm run sync:coursera -- --enrich`
    );
  }

  const connector = new CourseraCatalogConnector({
    limit,
    query: body?.query,
    languages: body?.languages,
  });

  const courses = await connector.fetchCourses();

  let enriched = 0;
  if (enrich && courses.length > 0) {
    const slugs = courses.map((c) => slugFromUrl(c.url)).filter((s): s is string => !!s);
    const details = await scrapeCourses(slugs, { concurrency: 4, delayMs: 300 });

    for (const course of courses) {
      const slug = slugFromUrl(course.url);
      const detail = slug ? details.get(slug) : undefined;
      if (!detail) continue;
      enriched++;
      if (detail.skills.length > 0) course.skills = [...new Set([...(course.skills ?? []), ...detail.skills])];
      if (detail.level) course.level = detail.level;
      if (detail.rating !== undefined) course.rating = detail.rating;
    }
  }

  const normalized = courses.map((c) => connector.normalizeCourse(c));
  const result = await importCoursesBulk(normalized, {
    approveAll: body?.approveAll,
    publish: body?.publish,
  });

  return ok({ source: "coursera", fetched: courses.length, enriched, ...result }, 201);
});
