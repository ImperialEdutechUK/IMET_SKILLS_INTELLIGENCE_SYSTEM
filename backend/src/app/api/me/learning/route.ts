import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [enrollments, cpdRecords, cpdTarget] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: authUser.id },
      include: { course: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cpdRecord.findMany({ where: { userId: authUser.id } }),
    getCpdTargetHours(authUser.departmentId),
  ]);

  const cpdHours = cpdRecords.reduce((sum, r) => sum + r.hours, 0);

  return NextResponse.json({
    totalCourses: enrollments.length,
    completed: enrollments.filter((e) => e.status === "completed").length,
    inProgress: enrollments.filter((e) => e.status === "in_progress").length,
    cpdHours,
    cpdTarget,
    courses: enrollments.map((e) => ({
      id: e.id,
      title: e.course.title,
      source: e.course.source,
      category: e.course.category?.name ?? "General",
      cpd_hours: e.course.cpdHours,
      status: e.status,
      progress: e.progress,
      externalUrl: e.course.externalUrl ?? "#",
    })),
  });
}
