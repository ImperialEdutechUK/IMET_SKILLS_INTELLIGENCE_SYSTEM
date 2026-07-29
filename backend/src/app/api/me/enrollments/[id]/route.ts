import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import {
  issueCompletionCertificate,
  logCompletionCpd,
  type CompletionProof,
} from "@/lib/enrollment-complete";
import { parseCertificateProof } from "@/lib/certificate-proof";
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
// Completing a course REQUIRES proof: the uploaded certificate (PDF/image) plus the
// issuer's verification link, sent as `certificate`. Without valid proof the request
// is rejected and the enrollment is left exactly as it was — same status, same hours,
// same progress bar — so an abandoned or cancelled upload can never silently promote a
// course to "completed". A valid one auto-creates the CPD record and the certificate.
// Only touches user-owned rows; never writes to the Course catalog.
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
  const { progress, status, addHours, targetHours, certificate } = body ?? {};

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

  // ── Proof gate ─────────────────────────────────────────────────────────────
  // Nothing has been written yet. Bailing out here is what guarantees the course
  // stays in its current tab with its current progress when the learner cancels
  // the upload or sends an incomplete certificate.
  let proof: CompletionProof | undefined;
  if (justCompleted) {
    const parsed = parseCertificateProof(certificate);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    proof = parsed.proof;
  }

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
          ? `Completed after ${nextHoursLogged}h logged · certificate uploaded`
          : "Completed with no hours logged · certificate uploaded",
    });
  }
  if (justReopened) events.push({ type: "reopened", note: "Reopened the course" });

  // Bank the certificate BEFORE the status flips. If this write fails the request
  // throws with the enrollment still In Progress — a completed course can never end
  // up without the evidence that justified it. Retrying is safe (idempotent).
  if (justCompleted) {
    await issueCompletionCertificate({
      userId: authUser.id,
      courseTitle: enrollment.course.title,
      provider: enrollment.course.provider ?? null,
      cpdHours: enrollment.course.cpdHours,
      // The certificate records the hours the learner actually logged, not the
      // catalogue's estimate, so its "+Xh CPD" matches their real CPD ledger.
      creditHours: nextHoursLogged,
      proof,
    });
  }

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

  // The CPD half of completion. Completing a course NEVER credits the catalogue's CPD
  // figure here — only the hours the learner logged count, so finishing a 10h course
  // after logging 3h banks 3h, not 13h. In practice the hours block above has already
  // written that record and this is a no-op; it only creates one for an enrollment
  // whose logged hours were never turned into CPD, and creditHours 0 means a course
  // marked complete with no time logged earns no CPD at all.
  if (justCompleted) {
    await logCompletionCpd({
      userId: authUser.id,
      enrollmentId: id,
      courseTitle: enrollment.course.title,
      provider: enrollment.course.provider ?? null,
      cpdHours: enrollment.course.cpdHours,
      creditHours: nextHoursLogged,
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
