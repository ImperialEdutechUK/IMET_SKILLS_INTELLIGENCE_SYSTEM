import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { applyEnrollmentCompletion } from "@/lib/enrollment-complete";
import { deriveProgress } from "@/lib/enrollment-progress";

// Enrol the signed-in employee into a course.
//  • Catalog course: pass { courseId } — reads the Course catalog, never writes it.
//  • Manual (self-reported) course the employee did outside the recommended
//    catalogue: pass { manual:true, title, externalUrl, provider, ... }. We create a
//    SEGREGATED course row (source:internal, externalSource:"manual-self",
//    approved:false) so it can be tracked/completed like any course but never enters
//    recommendations (the engine filters approved:true) and the scraped catalogue
//    is never touched. status may be "completed" to log an already-done course.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { courseId, manual, title, provider, externalUrl, level, durationHours, cpdHours, status } =
    body ?? {};
  const wantCompleted = status === "completed";
  const wantInProgress = status === "in_progress";

  // ── Manual / self-reported course ──────────────────────────────────────────
  if (manual || (!courseId && typeof title === "string")) {
    const cleanTitle = (title ?? "").trim();
    if (!cleanTitle) return NextResponse.json({ error: "Course name is required." }, { status: 400 });
    const url = typeof externalUrl === "string" && externalUrl.trim() ? externalUrl.trim() : null;

    // Reuse an existing course with the same title (titles are unique) — this lets a
    // self-reported course match a real catalogue course; otherwise create a new one.
    let course = await prisma.course.findUnique({
      where: { title: cleanTitle },
      select: { id: true, title: true, provider: true, cpdHours: true },
    });
    if (!course) {
      const hrs =
        typeof cpdHours === "number" && cpdHours > 0
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

    // Enrol (idempotent per user+course).
    let enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: authUser.id, courseId: course.id } },
    });
    if (!enrollment) {
      const nextStatus = wantCompleted ? "completed" : wantInProgress ? "in_progress" : "not_started";
      // A course reported as already finished counts its full CPD hours as time spent;
      // there is no session history to draw on for something done before enrolling.
      const hoursLogged = wantCompleted ? (course.cpdHours > 0 ? course.cpdHours : 1) : 0;
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
                ? [{ type: "completed" as const, note: "Logged as already completed", createdAt: now }]
                : []),
            ],
          },
        },
      });
    }
    if (wantCompleted) {
      await applyEnrollmentCompletion({
        userId: authUser.id,
        enrollmentId: enrollment.id,
        courseTitle: course.title,
        provider: course.provider,
        cpdHours: course.cpdHours,
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
