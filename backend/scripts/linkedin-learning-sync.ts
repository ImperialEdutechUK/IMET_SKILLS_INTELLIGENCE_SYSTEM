/**
 * LinkedIn Learning catalogue sync (CLI).
 *
 * A full sync (1) enumerates course slugs from the Wayback CDX index and the
 * guest topic tree, then (2) scrapes each `/learning/{slug}` page for its
 * schema.org/Course JSON-LD (title, description, workload, language, cost),
 * skill pills, difficulty, and topic. ~11k+ live courses take a while at a
 * polite request rate, so this lives in a script, not an HTTP route.
 *
 * Usage:
 *   npm run sync:linkedin -- --dry-run                 # enumerate + scrape a sample, no DB
 *   npm run sync:linkedin -- --limit 200 --publish     # small real import
 *   npm run sync:linkedin -- --approve --publish       # full catalogue, live
 *
 * Flags:
 *   --dry-run          enumerate + scrape; summarise; never touch the database
 *   --limit N          stop after N slugs (default: the whole enumerated set)
 *   --no-wayback       skip the Wayback CDX source
 *   --no-topics        skip the guest topic-tree source
 *   --concurrency N    parallel page fetches (default 4 — keep this low)
 *   --delay MS         pause before each page fetch (default 300)
 *   --no-resume        ignore the scrape cache and re-fetch every page
 *   --approve          mark imported courses approved (default: false)
 *   --publish          status=published (default: draft)
 *   --slugs PATH       slug cache file    (default .cache/linkedin-slugs.txt)
 *   --cache PATH       scrape cache file  (default .cache/linkedin-scrape.jsonl)
 *
 * Both the slug list and the scraped details are checkpointed to disk, so an
 * interrupted run resumes instead of re-enumerating and re-scraping.
 */
import { appendFileSync } from "node:fs";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { enumerateSlugs } from "../src/server/connectors/linkedinLearningEnumerate";
import { scrapeCourses, type ScrapedLinkedInCourse } from "../src/server/connectors/linkedinLearningScraper";
import { LinkedInLearningCatalogConnector } from "../src/server/connectors/linkedinLearningCatalog";

interface Args {
  dryRun: boolean;
  limit?: number;
  wayback: boolean;
  topics: boolean;
  concurrency: number;
  delay: number;
  resume: boolean;
  approve: boolean;
  publish: boolean;
  slugs: string;
  cache: string;
  seen: string;
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
    wayback: !has("--no-wayback"),
    topics: !has("--no-topics"),
    concurrency: num("--concurrency", 4)!,
    delay: num("--delay", 300)!,
    resume: !has("--no-resume"),
    approve: has("--approve"),
    publish: has("--publish"),
    slugs: val("--slugs") ?? ".cache/linkedin-slugs.txt",
    cache: val("--cache") ?? ".cache/linkedin-scrape.jsonl",
    seen: val("--seen") ?? ".cache/linkedin-seen.txt",
  };
}

/** Slugs attempted in prior runs (kept, dead, or non-English), so a re-run
 *  only scrapes slugs it has never tried. */
async function loadSeen(path: string): Promise<Set<string>> {
  try {
    return new Set((await readFile(path, "utf8")).split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

const pct = (n: number, d: number) => (d === 0 ? "0" : ((100 * n) / d).toFixed(1));

/** Reload a previously-enumerated slug list, if one exists. */
async function loadSlugs(path: string): Promise<string[]> {
  try {
    const text = await readFile(path, "utf8");
    return text.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Previously-scraped courses, so an interrupted scrape can resume. */
async function loadCache(path: string): Promise<Map<string, ScrapedLinkedInCourse>> {
  const cached = new Map<string, ScrapedLinkedInCourse>();
  try {
    const text = await readFile(path, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const c = JSON.parse(line) as ScrapedLinkedInCourse;
        if (c.slug) cached.set(c.slug, c);
      } catch {
        // A torn final line from a killed run — ignore it.
      }
    }
  } catch {
    // No cache yet.
  }
  return cached;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run with --env-file=.env, or use --dry-run.");
  }

  await mkdir(dirname(args.slugs), { recursive: true });

  // ── 1. Enumerate slugs (resume from cache when present) ──────────────────
  let slugs = args.resume ? await loadSlugs(args.slugs) : [];
  if (slugs.length === 0) {
    console.log("→ Enumerating course slugs (Wayback CDX + guest topics)…");
    const set = await enumerateSlugs({
      wayback: args.wayback,
      topics: args.topics,
      limit: args.limit,
      onProgress: (source, found) =>
        process.stdout.write(`\r  ${source}: ${found} slugs   `),
    });
    slugs = set;
    process.stdout.write("\n");
    await writeFile(args.slugs, slugs.join("\n"), "utf8");
  } else {
    console.log(`→ Reusing ${slugs.length} cached slugs (${args.slugs}).`);
  }
  if (args.limit) slugs = slugs.slice(0, args.limit);
  console.log(`✓ ${slugs.length} candidate slugs.`);

  // ── 2. Scrape each course page (checkpointed, resumable) ─────────────────
  await mkdir(dirname(args.cache), { recursive: true });
  const cached = args.resume ? await loadCache(args.cache) : new Map<string, ScrapedLinkedInCourse>();
  // Skip slugs already tried before (kept OR dead/non-English): without this the
  // ~20% retired + non-English slugs are re-fetched on every run. A re-run then
  // only scrapes slugs newly discovered by enumeration.
  const seen = args.resume ? await loadSeen(args.seen) : new Set<string>();
  const todo = slugs.filter((s) => !cached.has(s) && !seen.has(s));
  console.log(`→ Scraping ${todo.length} new course pages (${cached.size} cached, ${seen.size} seen)…`);

  let failures = 0;
  let dead = 0;
  await scrapeCourses(todo, {
    concurrency: args.concurrency,
    delayMs: args.delay,
    onProgress: (done, total, detail) => {
      if (detail) appendFileSync(args.cache, `${JSON.stringify(detail)}\n`, "utf8");
      else dead++;
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total} (${pct(done, total)}%) · ${dead} retired · ${failures} failed   `);
      }
    },
    onError: (slug, err) => {
      failures++;
      if (failures <= 5) console.warn(`\n  ! ${slug}: ${err.message}`);
    },
  });
  process.stdout.write("\n");
  // Only after a completed pass; an interrupted run re-attempts (safe).
  if (todo.length) await appendFile(args.seen, todo.join("\n") + "\n", "utf8");

  const courses = [...cached.values(), ...(await loadCache(args.cache)).values()];
  // De-dupe: the freshly-scraped rows were also just appended to the cache.
  const bySlug = new Map(courses.map((c) => [c.slug, c]));
  const scraped = [...bySlug.values()].filter((c) => slugs.includes(c.slug));
  console.log(`✓ ${scraped.length} live courses scraped (${dead} retired, ${failures} errors).`);

  const connector = LinkedInLearningCatalogConnector.fromScraped(scraped);
  const external = await connector.fetchCourses();
  const normalized = external.map((c) => connector.normalizeCourse(c));

  if (args.dryRun) {
    const withSkills = normalized.filter((c) => c.skills.length > 0).length;
    const withHours = normalized.filter((c) => c.durationHours != null).length;
    const withLevel = normalized.filter((c) => c.level).length;
    const skills = new Set(normalized.flatMap((c) => c.skills));
    const categories = new Set(normalized.map((c) => c.category).filter(Boolean));
    const titles = new Set(normalized.map((c) => c.title));

    console.log("\n── Dry run — nothing was written ──");
    console.log(`  courses          ${normalized.length}`);
    console.log(`  duplicate titles ${normalized.length - titles.size}`);
    console.log(`  with skills      ${withSkills} (${pct(withSkills, normalized.length)}%)`);
    console.log(`  with duration    ${withHours} (${pct(withHours, normalized.length)}%)`);
    console.log(`  with level       ${withLevel} (${pct(withLevel, normalized.length)}%)`);
    console.log(`  distinct skills  ${skills.size}`);
    console.log(`  categories       ${categories.size}`);
    if (normalized[0]) console.log("\n  sample:", JSON.stringify(normalized[0], null, 2).slice(0, 700));
    return;
  }

  // Imported lazily: the first module to open a database connection.
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
