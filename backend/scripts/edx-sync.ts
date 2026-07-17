/**
 * edX catalogue sync (CLI).
 *
 * Enumerates every course URL from edX's public sitemap, scrapes the course
 * object embedded in each page, keeps only English `Course` products that carry
 * skills, then bulk-imports them. Unlike the earlier LinkedIn run, this one is
 * correct end-to-end from the start:
 *
 *   - English-only filter lives in the scraper (`language` must include English),
 *     so no non-English rows ever enter the DB.
 *   - the AI skill normaliser is ON (`useAIForSkills`), so skill pills fold onto
 *     canonical skills instead of spawning duplicates.
 *   - courses are approved + published on import, so they are immediately
 *     recommendable (every kept course has >=1 skill to match a gap).
 *
 * Usage:
 *   npm run sync:edx -- --dry-run              # enumerate + scrape, no DB
 *   npm run sync:edx -- --limit 100 --dry-run  # quick sample
 *   npm run sync:edx                           # full run → import + approve
 *
 * Flags:
 *   --dry-run        scrape + summarise, never touch the DB
 *   --limit N        stop after N course URLs
 *   --concurrency N  parallel page fetches (default 5)
 *   --delay MS       pause before each fetch (default 250)
 *   --no-resume      ignore the scrape cache and re-fetch
 *   --no-approve     import as draft/unapproved instead of approved+published
 *   --no-ai          skip the AI skill normaliser (zero AI credits); resolve
 *                    skills by exact-match/alias/built-in and create the rest
 *   --from-cache     skip scraping entirely; import the existing scrape cache
 *                    (e.g. to re-run the import after a DB drop)
 *   --cache PATH     scrape cache (default .cache/edx-scrape.jsonl)
 */
import { appendFileSync } from "node:fs";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  enumerateCourseUrls,
  scrapeCourses,
  toCatalogueInput,
  type EdxScrapedCourse,
} from "../src/server/connectors/edxCatalogScraper";

interface Args {
  dryRun: boolean;
  limit?: number;
  concurrency: number;
  delay: number;
  resume: boolean;
  approve: boolean;
  useAI: boolean;
  fromCache: boolean;
  cache: string;
  seen: string;
}

function parseArgs(argv: string[]): Args {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
  };
  const num = (f: string, d?: number) => {
    const v = val(f);
    return v === undefined ? d : Number(v);
  };
  return {
    dryRun: has("--dry-run"),
    limit: num("--limit"),
    concurrency: num("--concurrency", 5)!,
    delay: num("--delay", 250)!,
    resume: !has("--no-resume"),
    approve: !has("--no-approve"),
    useAI: !has("--no-ai"),
    fromCache: has("--from-cache"),
    cache: val("--cache") ?? ".cache/edx-scrape.jsonl",
    seen: val("--seen") ?? ".cache/edx-seen.txt",
  };
}

/** URLs attempted in prior runs (kept or not), so a re-run only fetches new ones. */
async function loadSeen(path: string): Promise<Set<string>> {
  try {
    return new Set((await readFile(path, "utf8")).split("\n").map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

const pct = (n: number, d: number) => (d === 0 ? "0" : ((100 * n) / d).toFixed(1));

async function loadCache(path: string): Promise<Map<string, EdxScrapedCourse>> {
  const cached = new Map<string, EdxScrapedCourse>();
  try {
    for (const line of (await readFile(path, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const c = JSON.parse(line) as EdxScrapedCourse;
        if (c.externalId) cached.set(c.externalId, c);
      } catch {
        /* torn final line */
      }
    }
  } catch {
    /* no cache yet */
  }
  return cached;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Run with --env-file=.env, or use --dry-run.");
  }

  await mkdir(dirname(args.cache), { recursive: true });

  // `--from-cache` skips the network entirely and imports the existing scrape —
  // used to re-run the import (e.g. after a DB drop) without re-scraping or AI.
  if (!args.fromCache) {
    console.log("→ Enumerating edX course URLs from the sitemap…");
    let urls = await enumerateCourseUrls();
    if (args.limit) urls = urls.slice(0, args.limit);
    console.log(`✓ ${urls.length} course URLs.`);

    // Skip URLs attempted in a previous run — the scrape cache only holds *kept*
    // courses, so without this the ~60% that are non-English/archived/skill-less
    // would be re-fetched every time. A re-run then only scrapes URLs newly added
    // to the sitemap (i.e. genuinely new courses).
    const seen = args.resume ? await loadSeen(args.seen) : new Set<string>();
    const todo = urls.filter((u) => !seen.has(u));
    console.log(`→ Scraping ${todo.length} new pages (${urls.length - todo.length} already seen)…`);

    let failures = 0;
    let dropped = 0;
    await scrapeCourses(todo, {
      concurrency: args.concurrency,
      delayMs: args.delay,
      onProgress: (done, total, detail) => {
        if (detail) appendFileSync(args.cache, `${JSON.stringify(detail)}\n`, "utf8");
        else dropped++;
        if (done % 25 === 0 || done === total) {
          process.stdout.write(`\r  ${done}/${total} (${pct(done, total)}%) · ${dropped} skipped · ${failures} failed   `);
        }
      },
      onError: (url, err) => {
        failures++;
        if (failures <= 5) console.warn(`\n  ! ${url}: ${err.message}`);
      },
    });
    process.stdout.write("\n");
    // Only mark seen after a completed pass; an interrupted run re-attempts (safe).
    if (todo.length) await appendFile(args.seen, todo.join("\n") + "\n", "utf8");
  } else {
    console.log("→ Skipping scrape (--from-cache): importing the existing cache only.");
  }

  const courses = [...(await loadCache(args.cache)).values()];
  console.log(`✓ ${courses.length} English courses with skills in cache.`);

  const normalized = courses.map(toCatalogueInput);

  if (args.dryRun) {
    const skills = new Set(normalized.flatMap((c) => c.skills));
    const withHours = normalized.filter((c) => c.durationHours != null).length;
    const withLevel = normalized.filter((c) => c.level).length;
    console.log("\n── Dry run — nothing was written ──");
    console.log(`  courses         ${normalized.length}`);
    console.log(`  with duration   ${withHours} (${pct(withHours, normalized.length)}%)`);
    console.log(`  with level      ${withLevel} (${pct(withLevel, normalized.length)}%)`);
    console.log(`  distinct skills ${skills.size}`);
    if (normalized[0]) console.log("\n  sample:", JSON.stringify(normalized[0], null, 2).slice(0, 700));
    return;
  }

  const { importCoursesBulk } = await import("../src/server/connectors/bulkImporter");
  console.log(
    `→ Importing ${normalized.length} courses (AI normaliser ${args.useAI ? "ON" : "OFF"}${args.approve ? ", approving" : ""})…`
  );
  const result = await importCoursesBulk(normalized, {
    // AI folds skill names onto canonical skills; --no-ai skips it (zero credits),
    // resolving via exact-match + existing aliases + built-ins and creating the rest.
    useAIForSkills: args.useAI,
    approveAll: args.approve,
    publish: args.approve,
    onProgress: (written, total) => process.stdout.write(`\r  ${written}/${total} (${pct(written, total)}%)   `),
  });
  process.stdout.write("\n");

  console.log("── Import complete ──");
  console.log(`  created ${result.created} · updated ${result.updated} · skipped ${result.skipped}`);
  console.log(`  skills linked ${result.skillsLinked} across ${result.distinctSkills} distinct skills`);
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
