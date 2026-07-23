import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { packCpd } from "@/lib/cpd-activity";

// Update the signed-in employee's own enrollment: start it, set progress, or complete it.
// Completing a course auto-creates a CPD record (from the course's CPD hours) and an
// approved certificate — closing the see-gap -> learn -> log -> CPD loop.
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
  const { progress, status } = body ?? {};

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { course: { include: { category: true } } },
  });
  if (!enrollment || enrollment.userId !== authUser.id) {
    return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
  }

  // Resolve the target state.
  let nextProgress = enrollment.progress;
  let nextStatus = enrollment.status;

  if (typeof progress === "number") {
    nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
    nextStatus = nextProgress >= 100 ? "completed" : nextProgress > 0 ? "in_progress" : "not_started";
  }
  if (status === "in_progress" || status === "not_started" || status === "completed") {
    nextStatus = status;
    if (status === "completed") nextProgress = 100;
    if (status === "in_progress" && nextProgress === 0) nextProgress = Math.max(nextProgress, 1);
  }

  const justCompleted = nextStatus === "completed" && enrollment.status !== "completed";
  const justStarted = nextStatus === "in_progress" && !enrollment.startedAt;

  const updated = await prisma.enrollment.update({
    where: { id },
    data: {
      progress: nextProgress,
      status: nextStatus,
      startedAt: justStarted ? new Date() : enrollment.startedAt,
      completedAt: justCompleted ? new Date() : nextStatus === "completed" ? enrollment.completedAt : null,
    },
  });

  // Completion side-effects (idempotent) — course completion earns CPD + a certificate.
  if (justCompleted) {
    const course = enrollment.course;
    const hours = course.cpdHours && course.cpdHours > 0 ? course.cpdHours : 1;
    const today = new Date().toISOString().slice(0, 10);

    // CPD record (enrollmentId is unique -> at most one per enrollment)
    const existingCpd = await prisma.cpdRecord.findUnique({ where: { enrollmentId: id } });
    if (!existingCpd) {
      await prisma.cpdRecord.create({
        data: {
          userId: authUser.id,
          enrollmentId: id,
          hours,
          source: "course",
          description: packCpd({
            title: course.title,
            type: "Learning",
            provider: course.provider ?? null,
            category: "Technical Skills",
            dateCompleted: today,
            note: "Completed course",
          }),
        },
      });
    }

    // Certificate (userId + title is unique)
    const existingCert = await prisma.certificate.findUnique({
      where: { userId_title: { userId: authUser.id, title: course.title } },
    });
    if (!existingCert) {
      await prisma.certificate.create({
        data: {
          userId: authUser.id,
          title: course.title,
          issuer: course.provider ?? "LearnSmart AI",
          cpdHours: hours,
          issuedDate: today,
          status: "approved",
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    enrollment: { id: updated.id, status: updated.status, progress: updated.progress },
    completed: justCompleted,
  });
}
