import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { deriveProgress } from "@/lib/enrollment-progress";

// My Learning: everything the 4 tabs need — In Progress, Not Started, Completed,
// and Learning Paths — all computed from the employee's real enrollment rows.
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [enrollments, cpdRecords, paths] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: authUser.id },
      include: {
        course: { include: { category: true } },
        // Most recent slice of the append-only trail — enough to show the learner
        // (and, on the manager view, an auditor) how the hours accumulated.
        events: { orderBy: { createdAt: "desc" }, take: 6 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.cpdRecord.findMany({ where: { userId: authUser.id } }),
    prisma.learningPath.findMany({ include: { items: { include: { course: true } } } }),
  ]);

  const certificates = await prisma.certificate.findMany({ where: { userId: authUser.id } });
  const certByTitle = new Map(certificates.map((c) => [c.title, c]));

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const mapCourse = (e: (typeof enrollments)[number]) => {
    // Recompute rather than trusting the stored column, so a row written before the
    // derived-progress change still renders correctly even ahead of the backfill.
    const derived = deriveProgress({
      hoursLogged: e.hoursLogged,
      status: e.status,
      durationHours: e.course.durationHours,
      cpdHours: e.course.cpdHours,
      targetHoursOverride: e.targetHoursOverride,
    });
    return {
      id: e.id,
      courseId: e.courseId,
      title: e.course.title,
      description: e.course.description ?? "",
      level: e.course.level ?? "All levels",
      durationHours: e.course.durationHours ?? null,
      category: e.course.category?.name ?? "General",
      provider: e.course.provider ?? null,
      cpdHours: e.course.cpdHours,
      progress: derived.progress,
      progressKnown: derived.progressKnown,
      targetHours: derived.targetHours,
      // What the scraped catalogue claims, kept alongside the learner's correction
      // so the edit dialog can show both and offer a reset.
      catalogueHours: e.course.durationHours ?? (e.course.cpdHours > 0 ? e.course.cpdHours : null),
      targetHoursOverride: e.targetHoursOverride,
      hoursLogged: Math.round(e.hoursLogged * 10) / 10,
      status: e.status,
      externalUrl: e.course.externalUrl ?? null,
      createdAt: fmtDate(e.createdAt),
      lastActivityAt: e.lastActivityAt ? fmtDate(e.lastActivityAt) : null,
      daysSinceActivity: e.lastActivityAt
        ? Math.floor((Date.now() - e.lastActivityAt.getTime()) / 86_400_000)
        : null,
      completedAt: e.completedAt ? fmtDate(e.completedAt) : null,
      certificateId: certByTitle.get(e.course.title)?.id ?? null,
      events: e.events.map((ev) => ({
        id: ev.id,
        type: ev.type,
        hours: ev.hours,
        note: ev.note,
        at: ev.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      })),
    };
  };

  const inProgress = enrollments.filter((e) => e.status === "in_progress").map(mapCourse);
  const notStarted = enrollments.filter((e) => e.status === "not_started").map(mapCourse);
  const completed = enrollments.filter((e) => e.status === "completed").map(mapCourse);

  // Hours spent this month (from CPD records logged in the current calendar month).
  const now = new Date();
  const hoursThisMonth = cpdRecords
    .filter((r) => {
      const d = new Date(r.loggedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, r) => s + r.hours, 0);

  const completedCourseIds = new Set(enrollments.filter((e) => e.status === "completed").map((e) => e.courseId));

  const learningPaths = paths.map((p) => {
    const total = p.items.length;
    const done = p.items.filter((it) => completedCourseIds.has(it.courseId)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      totalCourses: total,
      completedCourses: done,
      progress: pct,
      status: pct === 100 ? "completed" : pct > 0 ? "in_progress" : "not_started",
    };
  });

  return NextResponse.json({
    stats: {
      inProgress: inProgress.length,
      completed: completed.length,
      notStarted: notStarted.length,
      certificatesEarned: certificates.length,
      hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
    },
    inProgress,
    notStarted,
    completed,
    learningPaths,
  });
}
