/**
 * LinkedIn Learning catalogue cleanup + approval (CLI).
 *
 * The whole-catalogue scrape (`linkedin-learning-sync.ts`) is deliberately
 * greedy: it imports every live course as draft/unapproved and creates a Skill
 * row for every skill pill it has never seen. That leaves three things to tidy
 * before the courses can be recommended, which this script does in order:
 *
 *   P1  Remove non-English courses. The scrape caught localized course pages
 *       (Spanish, German, Japanese…); for an English catalogue they are noise.
 *       Deleting a course cascades its CourseSkill links.
 *
 *   P2  Consolidate duplicate skills. Two dupe classes, both from the import
 *       running without the AI normaliser:
 *         a) parenthetical  "Python (Programming Language)"  → "Python"
 *         b) cleanKey clash  "3D Graphic"/"3d Graphic", plurals, casing
 *       Each dupe is merged onto a canonical Skill: every reference (courses,
 *       users, role requirements, gaps, JDs, aliases) is re-pointed with a
 *       uniqueness guard, an alias is recorded so future imports resolve, and
 *       the dupe row is deleted.
 *
 *   P2b Delete skills the import created that are now orphaned (0 references) —
 *       chiefly the localized skills left behind by P1.
 *
 *   P3  Approve + publish the surviving English courses that are real (title +
 *       at least one linked skill + a duration), so the recommender — which
 *       requires `approved:true, status:"published"` — can surface them.
 *
 * Safe by default: runs as a DRY-RUN that only reports. Pass --commit to write.
 *
 *   npm run cleanup:linkedin              # dry run, nothing written
 *   npm run cleanup:linkedin -- --commit  # apply
 */
import type { Skill } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { cleanKey } from "../src/server/skills/normalize";

const SRC = "linkedin-learning";
/** Everything created at/after the scrape is a candidate for cleanup. */
const IMPORT_CUTOFF = new Date("2026-07-14T00:00:00Z");
const COMMIT = process.argv.includes("--commit");
const TAG = COMMIT ? "COMMIT" : "DRY-RUN";

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

/** Re-point every row of `table` from the dupe skill onto the canonical one,
 *  skipping rows that would violate the table's [otherCol, skillId] uniqueness
 *  (the canonical already links that owner) — those duplicates are dropped. */
async function repoint(table: string, otherCol: string, canonId: string, dupeId: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "skillId" = $1
       WHERE "skillId" = $2
         AND "${otherCol}" NOT IN (SELECT "${otherCol}" FROM "${table}" WHERE "skillId" = $1)`,
    canonId,
    dupeId
  );
  await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "skillId" = $1`, dupeId);
}

// ── P1 ───────────────────────────────────────────────────────────────────────
async function removeNonEnglish(): Promise<number> {
  const rows = await prisma.course.findMany({
    where: { externalSource: SRC, language: { not: "English" } },
    select: { id: true },
  });
  console.log(`[P1] ${TAG}  non-English courses to delete: ${rows.length}`);
  if (COMMIT) {
    for (const batch of chunk(rows.map((r) => r.id), 500)) {
      await prisma.course.deleteMany({ where: { id: { in: batch } } }); // cascades CourseSkill
    }
  }
  return rows.length;
}

// ── P2 ───────────────────────────────────────────────────────────────────────
/** Choose which skill in a duplicate set survives: an established (pre-import)
 *  row first, then the most-linked, then the oldest, then the shortest name. */
function preferCanonical(a: Skill, b: Skill, links: Map<string, number>): number {
  // Prefer the fuller surface form first: a cleanKey collision is a normalisation
  // artifact (plural/case/whitespace), and the longer name is almost always the
  // real skill ("Economics" not "Economic", "React.js" not "React.j"). Then the
  // more-linked/established skill, then the older row.
  if (a.name.length !== b.name.length) return b.name.length - a.name.length;
  const al = links.get(a.id) ?? 0;
  const bl = links.get(b.id) ?? 0;
  if (al !== bl) return bl - al;
  const ai = a.createdAt >= IMPORT_CUTOFF ? 1 : 0;
  const bi = b.createdAt >= IMPORT_CUTOFF ? 1 : 0;
  if (ai !== bi) return ai - bi;
  return +a.createdAt - +b.createdAt;
}

async function buildMerges(): Promise<{ merges: Map<string, string>; skills: Skill[] }> {
  const skills = await prisma.skill.findMany();
  const links = new Map<string, number>();
  for (const g of await prisma.courseSkill.groupBy({ by: ["skillId"], _count: true })) {
    links.set(g.skillId, g._count);
  }

  const byLcName = new Map<string, Skill>();
  for (const s of skills) {
    const k = s.name.toLowerCase().trim();
    if (!byLcName.has(k)) byLcName.set(k, s);
  }

  const merges = new Map<string, string>(); // dupeId → canonicalId

  // a) parenthetical: "Base (qualifier)" folds into an existing "Base"
  for (const s of skills) {
    const m = /^(.+?)\s*\([^()]*\)\s*$/.exec(s.name);
    if (!m) continue;
    const canon = byLcName.get(m[1].trim().toLowerCase());
    if (canon && canon.id !== s.id) merges.set(s.id, canon.id);
  }

  // b) cleanKey collisions (casing / plural / whitespace variants)
  const byKey = new Map<string, Skill[]>();
  for (const s of skills) {
    const k = cleanKey(s.name);
    if (!k) continue;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(s);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const [canon, ...rest] = [...group].sort((a, b) => preferCanonical(a, b, links));
    for (const s of rest) if (!merges.has(s.id)) merges.set(s.id, canon.id);
  }

  // Collapse any A→B→C chains, then drop self-references.
  const resolve = (id: string): string => {
    let c = id;
    for (let i = 0; i < 10 && merges.has(c); i++) c = merges.get(c)!;
    return c;
  };
  for (const d of [...merges.keys()]) merges.set(d, resolve(merges.get(d)!));
  for (const [d, c] of [...merges]) if (d === c) merges.delete(d);

  return { merges, skills };
}

async function consolidateSkills(): Promise<number> {
  const { merges, skills } = await buildMerges();
  const byId = new Map(skills.map((s) => [s.id, s]));
  console.log(`[P2] ${TAG}  duplicate skills to merge: ${merges.size}`);
  let shown = 0;
  for (const [d, c] of merges) {
    if (shown++ >= 12) break;
    console.log(`       "${byId.get(d)?.name}"  ->  "${byId.get(c)?.name}"`);
  }

  if (COMMIT) {
    let done = 0;
    for (const [dupeId, canonId] of merges) {
      await repoint("CourseSkill", "courseId", canonId, dupeId);
      await repoint("UserSkill", "userId", canonId, dupeId);
      await repoint("RoleSkillRequirement", "roleProfileId", canonId, dupeId);
      await repoint("SkillGap", "userId", canonId, dupeId);
      await repoint("JobDescriptionSkill", "jdId", canonId, dupeId);
      // Aliases carry no composite unique; re-point them, then teach the dupe's
      // cleaned name as an alias so a future import resolves it straight away.
      await prisma.$executeRawUnsafe(`UPDATE "SkillAlias" SET "skillId" = $1 WHERE "skillId" = $2`, canonId, dupeId);
      const key = cleanKey(byId.get(dupeId)?.name ?? "");
      if (key) {
        await prisma.skillAlias.upsert({ where: { alias: key }, update: { skillId: canonId }, create: { alias: key, skillId: canonId } });
      }
      await prisma.skill.delete({ where: { id: dupeId } });
      if (++done % 100 === 0) process.stdout.write(`\r       merged ${done}/${merges.size}   `);
    }
    if (done) process.stdout.write("\n");
  }
  return merges.size;
}

// ── P2b ──────────────────────────────────────────────────────────────────────
async function deleteOrphanSkills(): Promise<number> {
  const orphans = await prisma.skill.findMany({
    where: {
      createdAt: { gte: IMPORT_CUTOFF },
      courseSkills: { none: {} },
      userSkills: { none: {} },
      jdSkills: { none: {} },
      roleRequirements: { none: {} },
      skillGaps: { none: {} },
    },
    select: { id: true },
  });
  console.log(`[P2b] ${TAG}  orphaned import skills to delete: ${orphans.length}`);
  if (COMMIT) {
    for (const batch of chunk(orphans.map((o) => o.id), 500)) {
      await prisma.skill.deleteMany({ where: { id: { in: batch } } }); // cascades aliases
    }
  }
  return orphans.length;
}

// ── P3 ───────────────────────────────────────────────────────────────────────
async function approveRealCourses(): Promise<{ approved: number; rejected: number }> {
  const eng = await prisma.course.findMany({
    where: { externalSource: SRC, language: "English" },
    select: { id: true, title: true, durationHours: true, _count: { select: { courseSkills: true } } },
  });
  const isReal = (c: (typeof eng)[number]) =>
    !!c.title?.trim() && c._count.courseSkills > 0 && (c.durationHours ?? 0) > 0;

  const real = eng.filter(isReal);
  const rejected = eng.length - real.length;
  console.log(`[P3] ${TAG}  English courses: ${eng.length}  ·  real→approve: ${real.length}  ·  not-real (left draft): ${rejected}`);

  if (COMMIT) {
    for (const batch of chunk(real.map((c) => c.id), 500)) {
      await prisma.course.updateMany({ where: { id: { in: batch } }, data: { approved: true, status: "published" } });
    }
  }
  return { approved: real.length, rejected };
}

async function main() {
  console.log(`── LinkedIn Learning cleanup (${TAG}) ──`);
  await removeNonEnglish();
  await consolidateSkills();
  await deleteOrphanSkills();
  await approveRealCourses();

  // End-state snapshot (reflects writes only in --commit).
  const [recommendable, totalSkills, recCoursera] = await Promise.all([
    prisma.course.count({ where: { externalSource: SRC, approved: true, status: "published" } }),
    prisma.skill.count(),
    prisma.course.count({ where: { source: "coursera", approved: true, status: "published" } }),
  ]);
  console.log("\n── End state ──");
  console.log(`  recommendable LinkedIn courses : ${recommendable}`);
  console.log(`  recommendable Coursera courses : ${recCoursera}`);
  console.log(`  total skills in taxonomy       : ${totalSkills}`);
  if (!COMMIT) console.log("\n(DRY-RUN — nothing was written. Re-run with --commit to apply.)");
}

main()
  .catch((err) => {
    console.error("\n✗ Cleanup failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
