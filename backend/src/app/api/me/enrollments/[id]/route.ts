import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import {
  issueCompletionCertificate,
  setEnrollmentCpd,
  type CompletionProof,
} from "@/lib/enrollment-complete";
import { parseCertificateProof } from "@/lib/certificate-proof";
import {
  completionCpdHours,
  deriveProgress,
  MAX_HOURS_PER_ENTRY,
  MAX_TARGET_HOURS,
} from "@/lib/enrollment-progress";

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
    // cpdRecord comes along so the activity trail can state the exact CPD delta this
    // request causes, rather than reconstructing what was banked earlier.
    include: { course: { include: { category: true } }, cpdRecord: { select: { hours: true } } },
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

  // What finishing this course is worth: its FULL length — the learner's own
  // correction if they made one, otherwise the catalogue's — never merely the slice
  // of time they happened to journal. See completionCpdHours().
  const completionHours = completionCpdHours({
    hoursLogged: nextHoursLogged,
    durationHours: enrollment.course.durationHours,
    cpdHours: enrollment.course.cpdHours,
    targetHoursOverride: nextTargetOverride,
  });

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
    // Re-measuring a course that is already complete moves CPD, so the trail records
    // the delta (either sign) — the same "hours this event added" invariant as above.
    const reCredit =
      nextStatus === "completed" && !justCompleted
        ? Math.round((completionHours - (enrollment.cpdRecord?.hours ?? 0)) * 100) / 100
        : 0;
    const base =
      nextTargetOverride === null
        ? `Course length reset to the catalogue's ${catalogue}h`
        : `Course length set to ${nextTargetOverride}h (catalogue says ${catalogue}h)`;
    events.push({
      type: "target_adjusted",
      hours: reCredit !== 0 ? reCredit : undefined,
      note: reCredit !== 0 ? `${base} · CPD now ${completionHours}h` : base,
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
    // `hours` on an event always means "CPD hours this event ADDED to the ledger" —
    // here the top-up only, since the logged portion was already counted by its own
    // hours_logged events. That invariant is what lets the month-scoped "Hours Spent"
    // figure be a plain sum over the trail without double-counting.
    const topUp = Math.round((completionHours - nextHoursLogged) * 100) / 100;
    events.push({
      type: "completed",
      hours: topUp > 0 ? topUp : undefined,
      note:
        topUp > 0
          ? `Completed · ${completionHours}h CPD credited (${nextHoursLogged}h logged + ${topUp}h on completion)`
          : `Completed after ${nextHoursLogged}h logged · ${completionHours}h CPD credited`,
    });
  }
  if (justReopened) {
    // Negative hours: reopening REMOVES the completion credit from the ledger, and the
    // trail has to carry that so a complete-then-reopen in the same month nets to zero.
    const givenBack = Math.round(((enrollment.cpdRecord?.hours ?? 0) - nextHoursLogged) * 100) / 100;
    events.push({
      type: "reopened",
      hours: givenBack > 0 ? -givenBack : undefined,
      note: `Reopened the course · CPD back to the ${nextHoursLogged}h logged`,
    });
  }

  // Bank the certificate BEFORE the status flips. If this write fails the request
  // throws with the enrollment still In Progress — a completed course can never end
  // up without the evidence that justified it. Retrying is safe (idempotent).
  if (justCompleted) {
    await issueCompletionCertificate({
      userId: authUser.id,
      courseTitle: enrollment.course.title,
      provider: enrollment.course.provider ?? null,
      cpdHours: enrollment.course.cpdHours,
      // The certificate carries exactly what the CPD ledger banks, so the "+Xh CPD"
      // on the certificate card can never disagree with the learner's CPD total.
      creditHours: completionHours,
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

  // ── Reconcile the CPD ledger ───────────────────────────────────────────────
  // ONE write, stating what this course is worth right now rather than nudging the
  // figure by a delta per branch. It covers every path through this route: logging
  // hours, completing (full course value), reopening (credit handed back), and
  // re-measuring a finished course (re-credited up or down).
  await setEnrollmentCpd({
    userId: authUser.id,
    enrollmentId: id,
    courseTitle: enrollment.course.title,
    provider: enrollment.course.provider ?? null,
    hours: nextStatus === "completed" ? completionHours : nextHoursLogged,
  });

  // Re-measuring a course that was ALREADY complete also restates its certificate, so
  // the card can't keep advertising a scraped figure the learner has since corrected.
  const targetChangedOnCompleted =
    settingTarget &&
    !justCompleted &&
    nextStatus === "completed" &&
    nextTargetOverride !== enrollment.targetHoursOverride;

  if (targetChangedOnCompleted) {
    await issueCompletionCertificate({
      userId: authUser.id,
      courseTitle: enrollment.course.title,
      provider: enrollment.course.provider ?? null,
      cpdHours: enrollment.course.cpdHours,
      creditHours: completionHours,
    });
  }

  const banked = await prisma.cpdRecord.findUnique({
    where: { enrollmentId: id },
    select: { hours: true },
  });

  return NextResponse.json({
    ok: true,
    enrollment: {
      id: updated.id,
      status: updated.status,
      progress: updated.progress,
      hoursLogged: updated.hoursLogged,
      // What this course contributes to the CPD ledger right now. Distinct from
      // hoursLogged for a completed course, which earns its full length.
      cpdCredited: Math.round((banked?.hours ?? 0) * 10) / 10,
    },
    completed: justCompleted,
  });
}
