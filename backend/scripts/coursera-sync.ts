/**
 * Coursera catalogue sync (CLI).
 *
 * A full sync fetches ~22.7k courses and, with --enrich, scrapes each course
 * page for skill tags, difficulty, and rating. That takes hours and would blow
 * any HTTP request timeout, so it lives here rather than in a route.
 *
 * Usage:
 *   npm run sync:coursera -- --dry-run                 # fetch + report, no DB, no writes
 *   npm run sync:coursera -- --limit 200 --publish     # small real import
 *   npm run sync:coursera -- --languages en --enrich   # full English catalogue + page skills
 *
 * Flags:
 *   --dry-run              fetch and summarise; never touches the database
 *   --limit N              stop after N courses (default: whole catalogue)
 *   --languages en,es      keep only these primary languages (default: all)
 *   --query python         substring filter on title/description
 *   --enrich               scrape /learn/{slug} for skills, level, rating
 *   --concurrency N        parallel page fetches while enriching (default 4)
 *   --delay MS             pause before each page fetch (default 400)
 *   --no-resume            ignore the enrichment cache and re-scrape
 *   --approve              mark imported courses approved (default: false)
 *   --publish              status=published (default: draft)
 *   --cache PATH           enrichment cache file (default .cache/coursera-enrich.jsonl)
 *
 * Enrichment is checkpointed to a JSONL cache, so an interrupted run resumes
 * where it stopped instead of re-fetching thousands of pages.
 */
import { appendFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CourseraCatalogConnector } from "../src/server/connectors/coursera";
import { scrapeCourses, slugFromUrl, type ScrapedCourseDetail } from "../src/server/connectors/courseraScraper";
import type { ExternalCourse } from "../src/server/connectors/types";

interface Args {
  dryRun: boolean;
  limit?: number;
  languages?: string[];
  query?: string;
  enrich: boolean;
  concurrency: number;
  delay: number;
  resume: boolean;
  approve: boolean;
  publish: boolean;
  cache: string;
}

function parseArgs(argv: string[]): Args {
  const has = (f: string) => argv.includes(f);
  const val = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
  };
  const num = (f: string, d?: number): number | undefined => {
    const v = val(f);
    return v === undefined ? d : Number(v);
  };

  return {
    dryRun: has("--dry-run"),
    limit: num("--limit"),
    languages: val("--languages")?.split(",").map((s) => s.trim()).filter(Boolean),
    query: val("--query"),
    enrich: has("--enrich"),
    concurrency: num("--concurrency", 4)!,
    delay: num("--delay", 400)!,
    resume: !has("--no-resume"),
    approve: has("--approve"),
    publish: has("--publish"),
    cache: val("--cache") ?? ".cache/coursera-enrich.jsonl",
  };
}

const pct = (n: number, d: number) => (d === 0 ? "0" : ((100 * n) / d).toFixed(1));

/** Previously-scraped details, so an interrupted enrichment can resume. */
async function loadCache(path: string): Promise<Map<string, ScrapedCourseDetail>> {
  const cached = new Map<string, ScrapedCourseDetail>();
  try {
    const text = await readFile(path, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const detail = JSON.parse(line) as ScrapedCourseDetail;
        if (detail.slug) cached.set(detail.slug, detail);
      } catch {
        // A torn final line from a killed run — ignore it.
      }
    }
  } catch {
    // No cache yet.
  }
  return cached;
}

/** Fold scraped page data onto the courses fetched from the API. */
function applyEnrichment(courses: ExternalCourse[], details: Map<string, ScrapedCourseDetail>): number {
  let enriched = 0;
  for (const course of courses) {
    const slug = slugFromUrl(course.url);
    const detail = slug ? details.get(slug) : undefined;
    if (!detail) continue;
    enriched++;
    // Page skills are precise ("NumPy"); API skills are coarse ("Machine
    // Learning"). Keep both — the coarse ones still match broad gaps.
    if (detail.skills.length > 0) course.skills = [...new Set([...(course.skills ?? []), ...detail.skills])];
    if (detail.level) course.level = detail.level;
    if (detail.rating !== undefined) course.rating = detail.rating;
  }
  return enriched;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run with --env-file=.env, or use --dry-run.");
  }

  console.log("→ Fetching Coursera catalogue…");
  const connector = new CourseraCatalogConnector({
    limit: args.limit,
    languages: args.languages,
    query: args.query,
    onProgress: (scanned, total, kept) =>
      process.stdout.write(`\r  scanned ${scanned}/${total} (${pct(scanned, total)}%) · kept ${kept}   `),
  });

  const courses = await connector.fetchCourses();
  process.stdout.write("\n");
  console.log(`✓ ${courses.length} courses fetched.`);

  if (args.enrich && courses.length > 0) {
    await mkdir(dirname(args.cache), { recursive: true });
    const cached = args.resume ? await loadCache(args.cache) : new Map<string, ScrapedCourseDetail>();

    const slugs = courses.map((c) => slugFromUrl(c.url)).filter((s): s is string => !!s);
    const todo = slugs.filter((s) => !cached.has(s));
    console.log(`→ Enriching ${todo.length} course pages (${cached.size} already cached)…`);

    let failures = 0;
    const scraped = await scrapeCourses(todo, {
      concurrency: args.concurrency,
      delayMs: args.delay,
      onProgress: (done, total, detail) => {
        // Synchronous: the callback is fired from concurrent lanes and its
        // return value is not awaited, so a promise here could reject unhandled.
        if (detail) appendFileSync(args.cache, `${JSON.stringify(detail)}\n`, "utf8");
        if (done % 25 === 0 || done === total) {
          process.stdout.write(`\r  ${done}/${total} (${pct(done, total)}%) · ${failures} failed   `);
        }
      },
      onError: (slug, err) => {
        failures++;
        if (failures <= 5) console.warn(`\n  ! ${slug}: ${err.message}`);
      },
    });
    process.stdout.write("\n");

    for (const [slug, detail] of scraped) cached.set(slug, detail);
    const enriched = applyEnrichment(courses, cached);
    console.log(`✓ Enriched ${enriched}/${courses.length} courses (${failures} pages failed).`);
  }

  const normalized = courses.map((c) => connector.normalizeCourse(c));

  if (args.dryRun) {
    const withSkills = normalized.filter((c) => c.skills.length > 0).length;
    const withHours = normalized.filter((c) => c.durationHours != null).length;
    const withLevel = normalized.filter((c) => c.level).length;
    const withRating = normalized.filter((c) => c.rating != null).length;
    const skills = new Set(normalized.flatMap((c) => c.skills));
    const categories = new Set(normalized.map((c) => c.category).filter(Boolean));
    const providers = new Set(normalized.map((c) => c.provider).filter(Boolean));
    const titles = new Set(normalized.map((c) => c.title));

    console.log("\n── Dry run — nothing was written ──");
    console.log(`  courses          ${normalized.length}`);
    console.log(`  duplicate titles ${normalized.length - titles.size}`);
    console.log(`  with skills      ${withSkills} (${pct(withSkills, normalized.length)}%)`);
    console.log(`  with duration    ${withHours} (${pct(withHours, normalized.length)}%)`);
    console.log(`  with level       ${withLevel} (${pct(withLevel, normalized.length)}%)`);
    console.log(`  with rating      ${withRating} (${pct(withRating, normalized.length)}%)`);
    console.log(`  distinct skills  ${skills.size}`);
    console.log(`  categories       ${categories.size} · providers ${providers.size}`);
    console.log("\n  sample:", JSON.stringify(normalized[0], null, 2).slice(0, 700));
    return;
  }

  // Imported lazily: this is the first module that opens a database connection.
  const { importCoursesBulk } = await import("../src/server/connectors/bulkImporter");

  console.log(`→ Importing ${normalized.length} courses…`);
  const result = await importCoursesBulk(normalized, {
    approveAll: args.approve,
    publish: args.publish,
    onProgress: (written, total) =>
      process.stdout.write(`\r  ${written}/${total} (${pct(written, total)}%)   `),
  });
  process.stdout.write("\n");

  console.log("── Import complete ──");
  console.log(`  created ${result.created} · updated ${result.updated} · skipped ${result.skipped}`);
  console.log(`  skills linked ${result.skillsLinked} across ${result.distinctSkills} distinct skills`);
  console.log(`  categories ${result.distinctCategories}`);
  if (result.errors.length > 0) {
    console.log(`  ${result.errors.length} errors, first few:`);
    for (const e of result.errors.slice(0, 5)) console.log(`    - ${e.title}: ${e.error}`);
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Sync failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
