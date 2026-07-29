import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import {
  issueCompletionCertificate,
  logCompletionCpd,
  type CompletionProof,
} from "@/lib/enrollment-complete";
import { parseCertificateProof } from "@/lib/certificate-proof";
import { deriveProgress, MAX_TARGET_HOURS } from "@/lib/enrollment-progress";

// Enrol the signed-in employee into a course.
//  • Catalog course: pass { courseId } — reads the Course catalog, never writes it.
//  • Manual (self-reported) course the employee did outside the recommended
//    catalogue: pass { manual:true, title, externalUrl, provider, ... }. We create a
//    SEGREGATED course row (source:internal, externalSource:"manual-self",
//    approved:false) so it can be tracked/completed like any course but never enters
//    recommendations (the engine filters approved:true) and the scraped catalogue
//    is never touched.
//
// status:"completed" logs an already-done course, and carries the same evidence bar
// as completing one from My Learning: the uploaded certificate AND its link, in
// `certificate`. It additionally requires `cpdHours` — the learner types the hours
// themselves because a self-reported course has no logged time to draw on. Those
// hours are what gets credited; no catalogue figure is ever added on top. Nothing is
// written unless all of it validates, so a cancelled or incomplete upload leaves no
// course, no enrollment and no certificate behind.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    courseId, manual, title, provider, externalUrl, level, durationHours, cpdHours, status,
    certificate,
  } = body ?? {};
  const wantCompleted = status === "completed";
  const wantInProgress = status === "in_progress";

  // ── Manual / self-reported course ──────────────────────────────────────────
  if (manual || (!courseId && typeof title === "string")) {
    const cleanTitle = (title ?? "").trim();
    if (!cleanTitle) return NextResponse.json({ error: "Course name is required." }, { status: 400 });
    const url = typeof externalUrl === "string" && externalUrl.trim() ? externalUrl.trim() : null;

    // ── Proof gate (completed only) ──────────────────────────────────────────
    // Runs before ANY write, so an invalid submission can't leave an orphan Course
    // row behind. "In progress" is untouched by all of this.
    let proof: CompletionProof | undefined;
    let creditHours = 0;
    if (wantCompleted) {
      const parsed = parseCertificateProof(certificate);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      proof = parsed.proof;

      if (typeof cpdHours !== "number" || !Number.isFinite(cpdHours) || cpdHours <= 0) {
        return NextResponse.json(
          { error: "Enter the CPD hours for this course." },
          { status: 400 }
        );
      }
      if (cpdHours > MAX_TARGET_HOURS) {
        return NextResponse.json(
          { error: `CPD hours must be ${MAX_TARGET_HOURS} or less.` },
          { status: 400 }
        );
      }
      creditHours = Math.round(cpdHours * 100) / 100;
    }

    // Reuse an existing course with the same title (titles are unique) — this lets a
    // self-reported course match a real catalogue course; otherwise create a new one.
    let course = await prisma.course.findUnique({
      where: { title: cleanTitle },
      select: { id: true, title: true, provider: true, cpdHours: true },
    });
    if (!course) {
      // For a completed course the learner's own CPD figure IS the course length —
      // it's the only measure of the work that exists for something self-reported.
      const hrs =
        creditHours > 0
          ? creditHours
          : typeof cpdHours === "number" && cpdHours > 0
            ? cpdHours
            : typeof durationHours === "number" && durationHours > 0
              ? durationHours
              : 1;
      course = await prisma.course.create({
        data: {
          title: cleanTitle,
          source: "internal",
          externalSource: "manual-self",
          externalUrl: url,
          provider: typeof provider === "string" && provider.trim() ? provider.trim() : null,
          level: typeof level === "string" && level.trim() ? level.trim() : null,
          durationHours: typeof durationHours === "number" ? durationHours : null,
          cpdHours: hrs,
          approved: false,
          availableToOrg: false,
          preferredProvider: false,
          status: "draft",
          language: "English",
        },
        select: { id: true, title: true, provider: true, cpdHours: true },
      });
    }

    // Bank the certificate before the enrollment exists, mirroring "Mark Complete":
    // if this write fails the request throws and the learner is left with no completed
    // course rather than a completed course with no evidence.
    if (wantCompleted) {
      await issueCompletionCertificate({
        userId: authUser.id,
        courseTitle: course.title,
        provider: course.provider,
        cpdHours: course.cpdHours,
        creditHours,        // the hours the learner typed — never the catalogue's
        proof,
      });
    }

    // Enrol (idempotent per user+course).
    let enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: authUser.id, courseId: course.id } },
    });
    if (!enrollment) {
      const nextStatus = wantCompleted ? "completed" : wantInProgress ? "in_progress" : "not_started";
      // A course reported as already finished counts the CPD hours the learner entered
      // as time spent; there is no session history for something done before enrolling.
      const hoursLogged = wantCompleted ? creditHours : 0;
      const now = new Date();
      enrollment = await prisma.enrollment.create({
        data: {
          userId: authUser.id,
          courseId: course.id,
          status: nextStatus,
          progress: deriveProgress({
            hoursLogged,
            status: nextStatus,
            durationHours: durationHours ?? null,
            cpdHours: course.cpdHours,
          }).progress,
          hoursLogged,
          lastActivityAt: now,
          startedAt: wantInProgress || wantCompleted ? now : null,
          completedAt: wantCompleted ? now : null,
          events: {
            create: [
              { type: "enrolled", note: "Added a self-reported course", createdAt: now },
              ...(wantInProgress ? [{ type: "started" as const, note: "Started the course", createdAt: now }] : []),
              ...(wantCompleted
                ? [{
                    type: "completed" as const,
                    note: `Logged as already completed · ${creditHours}h CPD · certificate uploaded`,
                    createdAt: now,
                  }]
                : []),
            ],
          },
        },
      });
    } else if (wantCompleted && enrollment.status !== "completed") {
      // The learner already had this course on their list and is now reporting it done.
      // Without this the certificate would be issued while the course sat in the wrong
      // tab. Their own logged hours win if they exceed the figure typed here.
      const now = new Date();
      const hoursLogged = Math.max(enrollment.hoursLogged, creditHours);
      enrollment = await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "completed",
          progress: 100,
          hoursLogged,
          lastActivityAt: now,
          startedAt: enrollment.startedAt ?? now,
          completedAt: now,
          events: {
            create: {
              type: "completed",
              note: `Logged as already completed · ${hoursLogged}h CPD · certificate uploaded`,
              createdAt: now,
            },
          },
        },
      });
    }

    // CPD for the completion — the hours the learner typed, never a catalogue figure.
    // No-op if this enrollment already has a CPD record, so hours can't be counted twice.
    if (wantCompleted) {
      await logCompletionCpd({
        userId: authUser.id,
        enrollmentId: enrollment.id,
        courseTitle: course.title,
        provider: course.provider,
        cpdHours: course.cpdHours,
        creditHours,
      });
    }
    return NextResponse.json({ ok: true, enrollmentId: enrollment.id, manual: true });
  }

  // ── Catalog course ─────────────────────────────────────────────────────────
  if (typeof courseId !== "string" || !courseId) {
    return NextResponse.json({ error: "courseId is required." }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Course not found." }, { status: 404 });

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: authUser.id, courseId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, enrollmentId: existing.id, already: true });
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: authUser.id,
      courseId,
      status: "not_started",
      progress: 0,
      events: { create: { type: "enrolled", note: "Enrolled from the catalogue" } },
    },
  });
  return NextResponse.json({ ok: true, enrollmentId: enrollment.id });
}
