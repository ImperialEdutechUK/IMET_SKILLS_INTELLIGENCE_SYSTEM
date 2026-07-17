/**
 * sync:all — one manual command to refresh the whole course catalogue.
 *
 * Runs every source end-to-end, then cleans up, so the catalogue stays
 * English-only, deduplicated, and recommendable:
 *
 *   1. Coursera   (public API, English only)        → import, approve, publish
 *   2. edX        (site scrape, English Courses)     → import (no AI), approve
 *   3. LinkedIn   (Wayback + topics)                 → import (draft)
 *   4. prune      (remove any non-English that slipped in, all sources)
 *   5. cleanup    (dedupe skills, approve English LinkedIn)
 *
 * NOTHING here runs automatically. It is a plain script invoked only when you
 * type `npm run sync:all` — it is not wired into build/start/postinstall, so a
 * redeploy never triggers it.
 *
 * Speed: the FIRST run of each scraper is slow (it fetches the whole catalogue).
 * After that, each scraper records every URL/slug it has tried in a `*-seen`
 * cache, so a re-run only fetches courses that are genuinely NEW on the platform
 * — usually minutes, not hours. The AI skill normaliser (the real time sink last
 * time) is OFF here; skills are deduped deterministically in step 5 instead.
 *
 * Usage:
 *   npm run sync:all            # incremental: only new courses (fast)
 *   npm run sync:all -- --full  # re-enumerate everything (LinkedIn Wayback too)
 *   npm run sync:all -- --dry-run
 */
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

const argv = process.argv.slice(2);
const FULL = argv.includes("--full");
const DRY = argv.includes("--dry-run");

interface Step {
  label: string;
  script: string;
  args: string[];
  /** Cache files to delete first (forces fresh discovery of new courses). */
  refresh?: string[];
}

const steps: Step[] = [
  {
    label: "Coursera (English, approve + publish)",
    script: "scripts/coursera-sync.ts",
    args: ["--languages", "en", "--approve", "--publish", ...(DRY ? ["--dry-run"] : [])],
  },
  {
    label: "edX (English Courses, no AI, approve + publish)",
    script: "scripts/edx-sync.ts",
    args: ["--no-ai", ...(DRY ? ["--dry-run"] : [])],
  },
  {
    label: "LinkedIn Learning (import as draft)",
    script: "scripts/linkedin-learning-sync.ts",
    // Refresh the slug list each run so enumeration finds newly-added courses;
    // the seen-cache still skips slugs already tried, so only new ones scrape.
    // Incremental uses topics only (fast); --full adds the Wayback archive scan.
    args: [...(FULL ? [] : ["--no-wayback"]), ...(DRY ? ["--dry-run"] : [])],
    refresh: [".cache/linkedin-slugs.txt"],
  },
  // Post-processing writes to the DB, so it is skipped on a dry run.
  ...(DRY
    ? []
    : [
        {
          label: "Prune non-English courses (all sources)",
          script: "scripts/prune-non-english-courses.ts",
          args: ["--commit"],
        },
        {
          label: "Dedupe skills + approve English LinkedIn",
          script: "scripts/linkedin-cleanup.ts",
          args: ["--commit"],
        },
      ]),
];

/** Run one step as a child `tsx` process, inheriting stdio for live output. */
function run(step: Step): { ok: boolean; secs: number } {
  const started = Date.now();
  const res = spawnSync(
    "npx",
    ["tsx", "--env-file=.env", step.script, ...step.args],
    { stdio: "inherit", shell: true }
  );
  return { ok: res.status === 0, secs: Math.round((Date.now() - started) / 1000) };
}

async function main() {
  console.log(`\n═══ sync:all (${FULL ? "full" : "incremental"}${DRY ? ", dry-run" : ""}) ═══\n`);
  const results: { label: string; ok: boolean; secs: number }[] = [];

  for (const step of steps) {
    if (FULL) {
      // A full run re-discovers everything: forget which URLs/slugs were tried.
      for (const f of [step.refresh ?? [], [".cache/edx-seen.txt", ".cache/linkedin-seen.txt"]].flat()) {
        await rm(f, { force: true }).catch(() => {});
      }
    } else {
      for (const f of step.refresh ?? []) await rm(f, { force: true }).catch(() => {});
    }

    console.log(`\n──▶ ${step.label}\n`);
    const { ok, secs } = run(step);
    results.push({ label: step.label, ok, secs });
    if (!ok) console.warn(`\n⚠ step failed (${step.label}) — continuing with the rest.\n`);
  }

  console.log("\n═══ Summary ═══");
  for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"}  ${r.label}  (${r.secs}s)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} step(s) failed — see logs above.` : "\nAll steps completed.");
  process.exitCode = failed ? 1 : 0;
}

main();
