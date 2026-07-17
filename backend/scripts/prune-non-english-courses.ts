/**
 * Remove non-English-*taught* courses from the whole catalogue (any source).
 *
 * The signal is the `language` column — the language of *instruction*, taken
 * from the source (Coursera `primaryLanguages`, LinkedIn `inLanguage`, …) —
 * never the title. That distinction matters: "Spanish Grammar and Conversation"
 * is taught in English (`language: "English"`) and must be KEPT, while a course
 * whose lessons are in Spanish (`language: "Spanish"`) is removed. Filtering on
 * the title would get this exactly backwards.
 *
 * A course counts as English (kept) when its language:
 *   - contains "English"  → "English", "American English", "British English",
 *                            "English (India)" …
 *   - is an en* code      → "en", "en-US", "en_GB"
 *   - is null             → unknown; kept rather than risk deleting an English one
 * Everything else is non-English and is deleted (cascading its CourseSkill links).
 *
 * Safe by default: DRY-RUN unless --commit is passed.
 *
 *   npm run prune:non-english              # report only
 *   npm run prune:non-english -- --commit  # delete
 */
import { prisma } from "../src/lib/db";

const COMMIT = process.argv.includes("--commit");
const TAG = COMMIT ? "COMMIT" : "DRY-RUN";

/** Is this a language of instruction we keep? Null/unknown is kept, not deleted. */
export function isEnglishInstruction(language: string | null | undefined): boolean {
  if (language == null) return true; // unknown → don't risk removing an English course
  const l = language.trim();
  return /english/i.test(l) || /^en([-_]|$)/i.test(l);
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

async function main() {
  console.log(`── Prune non-English courses (${TAG}) ──`);

  const all = await prisma.course.findMany({ select: { id: true, language: true, source: true } });
  const remove = all.filter((c) => !isEnglishInstruction(c.language));

  // Report what will go, grouped by language, so the classification is auditable.
  const byLang = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const c of remove) {
    byLang.set(c.language ?? "null", (byLang.get(c.language ?? "null") ?? 0) + 1);
    bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  }
  console.log(`\ntotal courses: ${all.length}  ·  keep: ${all.length - remove.length}  ·  remove: ${remove.length}`);
  console.log("\nremoving, by language:");
  for (const [l, n] of [...byLang].sort((a, b) => b[1] - a[1])) console.log(`  ${l.padEnd(24)} ${n}`);
  console.log("\nremoving, by source:");
  for (const [s, n] of [...bySource].sort((a, b) => b[1] - a[1])) console.log(`  ${s.padEnd(20)} ${n}`);

  if (COMMIT) {
    let done = 0;
    for (const batch of chunk(remove.map((c) => c.id), 500)) {
      const res = await prisma.course.deleteMany({ where: { id: { in: batch } } }); // cascades CourseSkill
      done += res.count;
      process.stdout.write(`\r  deleted ${done}/${remove.length}   `);
    }
    if (done) process.stdout.write("\n");
  }

  // End-state snapshot.
  const langsLeft = await prisma.course.groupBy({ by: ["language"], _count: true });
  const nonEngLeft = langsLeft.filter((r) => !isEnglishInstruction(r.language));
  const [liRec, coRec] = await Promise.all([
    prisma.course.count({ where: { source: "linkedin", approved: true, status: "published" } }),
    prisma.course.count({ where: { source: "coursera", approved: true, status: "published" } }),
  ]);
  console.log("\n── End state ──");
  console.log(`  recommendable LinkedIn courses : ${liRec}`);
  console.log(`  recommendable Coursera courses : ${coRec}`);
  console.log(`  non-English courses remaining  : ${nonEngLeft.reduce((s, r) => s + r._count, 0)}`);
  if (!COMMIT) console.log("\n(DRY-RUN — nothing was written. Re-run with --commit to apply.)");
}

main()
  .catch((err) => {
    console.error("\n✗ Prune failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
