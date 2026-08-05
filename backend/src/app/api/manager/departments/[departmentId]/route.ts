import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { canAccessDepartment } from "@/lib/authz";
import { getTeamSummary, getTeamMembers } from "@/lib/team-queries";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { departmentId } = await params;

  // Managers are scoped to their OWN department. Without this a manager could
  // read any other department's members, CPD standing and activity feed simply
  // by changing the id in the URL — the route authenticated the caller's role
  // but never checked the object they were asking for.
  if (!canAccessDepartment(authUser, departmentId)) {
    return NextResponse.json({ error: "You do not have access to this department." }, { status: 403 });
  }

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    return NextResponse.json({ error: "Department not found." }, { status: 404 });
  }

  const [summary, members, activities] = await Promise.all([
    getTeamSummary(departmentId),
    getTeamMembers(departmentId),
    prisma.activity.findMany({
      where: { user: { departmentId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: true },
    }),
  ]);

  return NextResponse.json({
    department: { id: department.id, name: department.name },
    summary,
    members: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      coursesCompleted: m.coursesCompleted,
      coursesInProgress: m.coursesInProgress,
      cpdProgress: m.cpdProgress,
      attentionStatus: m.attentionStatus,
      courses: m.enrollments.map((e) => ({
        id: e.id,
        title: e.course.title,
        provider: e.course.provider,
        category: e.course.category?.name ?? null,
        status: e.status,
        progress: e.progress,
        externalUrl: e.course.externalUrl,
      })),
    })),
    activities: activities.map((a) => ({
      id: a.id,
      user: a.user.fullName,
      action: a.type,
      time: a.createdAt.toLocaleDateString(),
    })),
  });
}
