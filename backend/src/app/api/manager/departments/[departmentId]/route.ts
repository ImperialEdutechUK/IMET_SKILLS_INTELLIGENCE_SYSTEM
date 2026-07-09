import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
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
    })),
    activities: activities.map((a) => ({
      id: a.id,
      user: a.user.fullName,
      action: a.type,
      time: a.createdAt.toLocaleDateString(),
    })),
  });
}
