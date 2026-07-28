/**
 * Backfill for the derived-progress change.
 *
 * Progress used to be a free 0–100 slider the learner dragged; it is now DERIVED
 * from hours logged against the course duration (see lib/enrollment-progress.ts).
 * Existing rows have a `progress` number but `hoursLogged = 0`, so without this
 * script every in-progress bar would collapse to 1% and every activity trail
 * would be empty. This reconstructs both, as faithfully as the old data allows.
 *
 * Hours are reconstructed in priority order:
 *   1. The enrollment's CpdRecord  — real logged/awarded hours. Exact.
 *   2. Completed with no CpdRecord — the course's CPD hours (what completion
 *      would have granted).
 *   3. In progress with no CpdRecord — ESTIMATED as (old progress % × duration),
 *      which preserves the bar the learner already saw. Flagged as an estimate in
 *      the trail so it is never mistaken for a real entry.
 *   4. Not started — zero.
 *
 * Seeded events are marked "(backfilled)" and dated from the timestamps that do
 * exist (createdAt / startedAt / completedAt), so the trail never claims more
 * precision than the old schema captured.
 *
 * Idempotent and additive: only fills hoursLogged where it is still 0, and only
 * seeds events for enrollments that have none. Never touches the Course catalogue.
 *
 *   npx tsx --env-file=.env scripts/backfill-enrollment-progress.ts            # report only
 *   npx tsx --env-file=.env scripts/backfill-enrollment-progress.ts --commit   # write
 */
import { prisma } from "../src/lib/db";
import { deriveProgress, resolveTargetHours } from "../src/lib/enrollment-progress";

const COMMIT = process.argv.includes("--commit");
const TAG = COMMIT ? "COMMIT" : "DRY-RUN";

type HoursSource = "cpd-record" | "course-cpd-hours" | "estimated-from-progress" | "skipped";

async function main() {
  console.log(`── Backfill enrollment progress (${TAG}) ──`);

  const enrollments = await prisma.enrollment.findMany({
    include: {
      course: { select: { title: true, durationHours: true, cpdHours: true } },
      cpdRecord: { select: { hours: true } },
      _count: { select: { events: true } },
    },
  });
  console.log(`Enrollments: ${enrollments.length}`);

  const bySource: Record<HoursSource, number> = {
    "cpd-record": 0,
    "course-cpd-hours": 0,
    "estimated-from-progress": 0,
    skipped: 0,
  };
  let hoursWritten = 0;
  let eventsSeeded = 0;
  let progressChanged = 0;

  for (const e of enrollments) {
    const target = resolveTargetHours(e.course.durationHours, e.course.cpdHours);

    // ── Reconstruct hours ────────────────────────────────────────────────────
    let hours = e.hoursLogged;
    let source: HoursSource = "skipped";
    if (e.hoursLogged > 0) {
      source = "skipped"; // already backfilled or genuinely logged — leave alone
    } else if (e.cpdRecord && e.cpdRecord.hours > 0) {
      hours = e.cpdRecord.hours;
      source = "cpd-record";
    } else if (e.status === "completed") {
      hours = e.course.cpdHours > 0 ? e.course.cpdHours : (target ?? 1);
      source = "course-cpd-hours";
    } else if (e.status === "in_progress" && target && e.progress > 0 && e._count.events === 0) {
      // Only ever estimate for a LEGACY row (no event trail). A row created after the
      // change tracks its own hours, so a 0h course must stay 0h — estimating from its
      // progress would invent time the learner never claimed.
      hours = Math.round((e.progress / 100) * target * 10) / 10;
      source = "estimated-from-progress";
    }
    bySource[source]++;
    hours = Math.round(hours * 100) / 100;

    const { progress } = deriveProgress({
      hoursLogged: hours,
      status: e.status,
      durationHours: e.course.durationHours,
      cpdHours: e.course.cpdHours,
    });
    if (progress !== e.progress) progressChanged++;
    if (hours !== e.hoursLogged) hoursWritten++;

    // ── Seed the activity trail from the timestamps we actually have ─────────
    const events: { type: "enrolled" | "started" | "hours_logged" | "completed"; hours?: number; note: string; createdAt: Date }[] = [];
    if (e._count.events === 0) {
      events.push({ type: "enrolled", note: "Enrolled (backfilled)", createdAt: e.createdAt });
      if (e.startedAt) {
        events.push({ type: "started", note: "Started the course (backfilled)", createdAt: e.startedAt });
      }
      if (hours > 0) {
        events.push({
          type: "hours_logged",
          hours,
          note:
            source === "estimated-from-progress"
              ? `${hours}h estimated from the previous progress bar (backfilled)`
              : `${hours}h carried over from CPD records (backfilled)`,
          createdAt: e.startedAt ?? e.createdAt,
        });
      }
      if (e.completedAt) {
        events.push({ type: "completed", note: "Marked complete (backfilled)", createdAt: e.completedAt });
      }
      eventsSeeded += events.length;
    }

    if (COMMIT) {
      await prisma.enrollment.update({
        where: { id: e.id },
        data: {
          hoursLogged: hours,
          progress,
          lastActivityAt: e.lastActivityAt ?? e.completedAt ?? e.startedAt ?? e.updatedAt,
          ...(events.length ? { events: { create: events } } : {}),
        },
      });
    }
  }

  console.log(`\nHours reconstructed from:`);
  console.log(`  CpdRecord (exact)            ${bySource["cpd-record"]}`);
  console.log(`  Course CPD hours (completed) ${bySource["course-cpd-hours"]}`);
  console.log(`  Estimated from old progress  ${bySource["estimated-from-progress"]}`);
  console.log(`  Already had hours (skipped)  ${bySource.skipped}`);
  console.log(`\nWould write: ${hoursWritten} hoursLogged · ${progressChanged} progress · ${eventsSeeded} events`);
  if (!COMMIT) console.log(`\nDRY-RUN — nothing written. Re-run with --commit to apply.`);
  else console.log(`\nDone.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
