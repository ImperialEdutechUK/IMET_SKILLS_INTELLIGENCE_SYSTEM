import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { applyEnrollmentCompletion } from "@/lib/enrollment-complete";
import { packCpd } from "@/lib/cpd-activity";
import { deriveProgress, MAX_HOURS_PER_ENTRY, MAX_TARGET_HOURS } from "@/lib/enrollment-progress";

// Update the signed-in employee's own enrollment: start it, log hours, or complete it.
//
// Progress is NOT an input. It is derived from hours logged against the course's
// duration (see lib/enrollment-progress.ts) and persisted so downstream manager and
// report queries can keep reading Enrollment.progress. A client that sends `progress`
// is rejected outright rather than silently ignored, so stale callers surface loudly.
//
// Every state change appends an EnrollmentEvent. That trail is the accountability
// story: hours remain self-reported (no external provider exposes a completion API),
// but they are now timestamped, unit-bearing and append-only instead of a drag.
//
// Completing a course auto-creates a CPD record and certificate. Only touches
// user-owned rows; never writes to the Course catalog.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { progress, status, addHours, targetHours } = body ?? {};

  if (progress !== undefined) {
    return NextResponse.json(
      { error: "Progress is calculated from the hours you log — it can't be set directly." },
      { status: 400 }
    );
  }

  // targetHours corrects the course LENGTH for this learner only. null clears the
  // correction and falls back to the catalogue. The scraped Course row is never
  // written — see the note on Enrollment.targetHoursOverride.
  const settingTarget = targetHours !== undefined;
  if (settingTarget && targetHours !== null) {
    if (typeof targetHours !== "number" || !Number.isFinite(targetHours) || targetHours <= 0) {
      return NextResponse.json({ error: "Enter the total hours for this course." }, { status: 400 });
    }
    if (targetHours > MAX_TARGET_HOURS) {
      return NextResponse.json(
        { error: `Total hours must be ${MAX_TARGET_HOURS} or less.` },
        { status: 400 }
      );
    }
  }

  const loggingHours = addHours !== undefined;
  if (loggingHours) {
    if (typeof addHours !== "number" || !Number.isFinite(addHours) || addHours <= 0) {
      return NextResponse.json({ error: "Enter how many hours you spent." }, { status: 400 });
    }
    if (addHours > MAX_HOURS_PER_ENTRY) {
      return NextResponse.json(
        { error: `Log at most ${MAX_HOURS_PER_ENTRY} hours at a time.` },
        { status: 400 }
      );
    }
  }

  if (status !== undefined && !["not_started", "in_progress", "completed"].includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  if (!loggingHours && status === undefined && !settingTarget) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { course: { include: { category: true } } },
  });
  if (!enrollment || enrollment.userId !== authUser.id) {
    return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
  }

  // ── Resolve the target state ───────────────────────────────────────────────
  const hours = loggingHours ? (addHours as number) : 0;
  const nextHoursLogged = Math.round((enrollment.hoursLogged + hours) * 100) / 100;
  let nextStatus = enrollment.status;

  if (status) nextStatus = status;
  // Logging hours implies the course is under way — move it out of "not started".
  if (loggingHours && nextStatus === "not_started") nextStatus = "in_progress";

  const nextTargetOverride = settingTarget
    ? (targetHours as number | null)
    : enrollment.targetHoursOverride;

  const { progress: nextProgress } = deriveProgress({
    hoursLogged: nextHoursLogged,
    status: nextStatus,
    durationHours: enrollment.course.durationHours,
    cpdHours: enrollment.course.cpdHours,
    targetHoursOverride: nextTargetOverride,
  });

  const justCompleted = nextStatus === "completed" && enrollment.status !== "completed";
  const justStarted = nextStatus === "in_progress" && !enrollment.startedAt;
  const justReopened = enrollment.status === "completed" && nextStatus !== "completed";
  const now = new Date();

  // ── Build the append-only activity trail for this request ──────────────────
  const events: { type: "started" | "hours_logged" | "completed" | "reopened" | "target_adjusted"; hours?: number; note?: string }[] = [];
  if (justStarted) events.push({ type: "started", note: "Started the course" });
  if (settingTarget && nextTargetOverride !== enrollment.targetHoursOverride) {
    const catalogue = enrollment.course.durationHours ?? enrollment.course.cpdHours;
    events.push({
      type: "target_adjusted",
      note:
        nextTargetOverride === null
          ? `Course length reset to the catalogue's ${catalogue}h`
          : `Course length set to ${nextTargetOverride}h (catalogue says ${catalogue}h)`,
    });
  }
  if (loggingHours) {
    events.push({
      type: "hours_logged",
      hours,
      note: `Logged ${hours}h (${nextHoursLogged}h total)`,
    });
  }
  if (justCompleted) {
    // Recording the hours behind a completion is the whole point of the trail: a
    // course marked complete with nothing logged is visible rather than invisible.
    events.push({
      type: "completed",
      note:
        nextHoursLogged > 0
          ? `Marked complete after ${nextHoursLogged}h logged`
          : "Marked complete with no hours logged",
    });
  }
  if (justReopened) events.push({ type: "reopened", note: "Reopened the course" });

  const updated = await prisma.enrollment.update({
    where: { id },
    data: {
      progress: nextProgress,
      status: nextStatus,
      hoursLogged: nextHoursLogged,
      targetHoursOverride: nextTargetOverride,
      lastActivityAt: events.length ? now : enrollment.lastActivityAt,
      startedAt: justStarted ? now : enrollment.startedAt,
      completedAt: justCompleted ? now : nextStatus === "completed" ? enrollment.completedAt : null,
      ...(events.length
        ? { events: { create: events.map((e) => ({ ...e, createdAt: now })) } }
        : {}),
    },
  });

  // Manual hours logging — accumulate into the enrollment's single CPD record. Doing
  // this before the completion block means completion won't double-count (it only
  // creates a CPD record when none exists yet).
  if (loggingHours) {
    const today = now.toISOString().slice(0, 10);
    const existing = await prisma.cpdRecord.findUnique({ where: { enrollmentId: id } });
    if (existing) {
      await prisma.cpdRecord.update({
        where: { enrollmentId: id },
        data: { hours: existing.hours + hours },
      });
    } else {
      await prisma.cpdRecord.create({
        data: {
          userId: authUser.id,
          enrollmentId: id,
          hours,
          source: "course",
          description: packCpd({
            title: enrollment.course.title,
            type: "Learning",
            provider: enrollment.course.provider ?? null,
            category: "Technical Skills",
            dateCompleted: today,
            note: "Time logged",
          }),
        },
      });
    }
  }

  // Completion side-effects (idempotent) — course completion earns CPD + a certificate.
  if (justCompleted) {
    await applyEnrollmentCompletion({
      userId: authUser.id,
      enrollmentId: id,
      courseTitle: enrollment.course.title,
      provider: enrollment.course.provider ?? null,
      cpdHours: enrollment.course.cpdHours,
    });
  }

  return NextResponse.json({
    ok: true,
    enrollment: {
      id: updated.id,
      status: updated.status,
      progress: updated.progress,
      hoursLogged: updated.hoursLogged,
    },
    completed: justCompleted,
  });
}
