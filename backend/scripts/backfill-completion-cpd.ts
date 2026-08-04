/**
 * Backfill for the completion-CPD change.
 *
 * Completing a course used to bank only the hours the learner happened to journal:
 * 4h logged against an 8h course they finished credited 4h, so their CPD total read
 * far lower than the learning they had actually done. Completion now credits the
 * course's FULL length — the learner's own corrected figure ahead of the scraped
 * catalogue value (see completionCpdHours in lib/enrollment-progress.ts).
 *
 * Rows written before that change still hold the old, low figure. This restates them:
 *
 *   1. Every COMPLETED enrollment's CpdRecord is raised to completionCpdHours().
 *      Never lowered — hours already banked are never taken away from anyone.
 *   2. A completed enrollment with no CpdRecord at all gets one created.
 *   3. The matching Certificate's cpdHours is synced to the same figure, so the
 *      "+Xh CPD" on the certificate card can no longer disagree with the ledger.
 *
 * Touches only user-owned rows (CpdRecord, Certificate). Never writes to the Course
 * catalogue. Idempotent: a second run reports no changes.
 *
 *   npx tsx --env-file=.env scripts/backfill-completion-cpd.ts            # report only
 *   npx tsx --env-file=.env scripts/backfill-completion-cpd.ts --commit   # write
 */
import { prisma } from "../src/lib/db";
import { completionCpdHours } from "../src/lib/enrollment-progress";
import { packCpd } from "../src/lib/cpd-activity";

const COMMIT = process.argv.includes("--commit");
const TAG = COMMIT ? "COMMIT" : "DRY-RUN";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  console.log(`── Backfill completion CPD (${TAG}) ──\n`);

  const enrollments = await prisma.enrollment.findMany({
    where: { status: "completed" },
    include: {
      course: { select: { title: true, provider: true, durationHours: true, cpdHours: true } },
      cpdRecord: true,
      user: { select: { id: true, fullName: true } },
    },
  });

  let recordsRaised = 0;
  let recordsCreated = 0;
  let certsSynced = 0;
  let hoursAdded = 0;
  const perUser = new Map<string, { name: string; added: number }>();

  for (const e of enrollments) {
    const credit = completionCpdHours({
      hoursLogged: e.hoursLogged,
      durationHours: e.course.durationHours,
      cpdHours: e.course.cpdHours,
      targetHoursOverride: e.targetHoursOverride,
    });
    if (credit <= 0) continue;

    const banked = e.cpdRecord?.hours ?? 0;
    const delta = round2(credit - banked);

    if (delta > 0) {
      const entry = perUser.get(e.user.id) ?? { name: e.user.fullName, added: 0 };
      entry.added = round2(entry.added + delta);
      perUser.set(e.user.id, entry);
      hoursAdded = round2(hoursAdded + delta);

      console.log(
        `  ${e.user.fullName.padEnd(20)} ${e.course.title.slice(0, 44).padEnd(46)} ` +
          `${banked}h → ${credit}h  (+${delta}h)` +
          (e.targetHoursOverride ? `  [learner set ${e.targetHoursOverride}h]` : "")
      );

      if (e.cpdRecord) {
        recordsRaised++;
        if (COMMIT) {
          await prisma.cpdRecord.update({ where: { id: e.cpdRecord.id }, data: { hours: credit } });
        }
      } else {
        recordsCreated++;
        if (COMMIT) {
          await prisma.cpdRecord.create({
            data: {
              userId: e.userId,
              enrollmentId: e.id,
              hours: credit,
              source: "course",
              // Dated to the completion, not to today — this credit was earned then.
              loggedAt: e.completedAt ?? e.updatedAt,
              description: packCpd({
                title: e.course.title,
                type: "Learning",
                provider: e.course.provider,
                category: "Technical Skills",
                dateCompleted: (e.completedAt ?? e.updatedAt).toISOString().slice(0, 10),
                note: "Completed course (backfilled)",
              }),
            },
          });
        }
      }
    }

    // The certificate must state the same hours as the ledger, whichever way it drifted.
    const cert = await prisma.certificate.findUnique({
      where: { userId_title: { userId: e.userId, title: e.course.title } },
    });
    if (cert && cert.cpdHours !== credit) {
      certsSynced++;
      console.log(
        `  ${"".padEnd(20)} └─ certificate "${cert.title.slice(0, 34)}" ${cert.cpdHours}h → ${credit}h`
      );
      if (COMMIT) {
        await prisma.certificate.update({ where: { id: cert.id }, data: { cpdHours: credit } });
      }
    }
  }

  console.log(`\n── Summary (${TAG}) ──`);
  console.log(`  completed enrollments scanned : ${enrollments.length}`);
  console.log(`  CPD records raised            : ${recordsRaised}`);
  console.log(`  CPD records created           : ${recordsCreated}`);
  console.log(`  certificates synced           : ${certsSynced}`);
  console.log(`  total CPD hours restored      : ${hoursAdded}h`);
  if (perUser.size) {
    console.log(`\n  per employee:`);
    for (const { name, added } of perUser.values()) console.log(`    ${name.padEnd(24)} +${added}h`);
  }
  if (!COMMIT) console.log(`\n  Nothing was written. Re-run with --commit to apply.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
