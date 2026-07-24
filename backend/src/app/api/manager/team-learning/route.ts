import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;
  const users = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { enrollments: true, cpdRecords: true, department: true },
    orderBy: { fullName: "asc" },
  });

  const targetCache = new Map<string | null, number>();
  const members = await Promise.all(
    users.map(async (u) => {
      const key = u.departmentId;
      if (!targetCache.has(key)) targetCache.set(key, await getCpdTargetHours(key));
      const target = targetCache.get(key)!;
      const cpdHours = u.cpdRecords.reduce((s, r) => s + r.hours, 0);
      return {
        id: u.id,
        fullName: u.fullName,
        position: u.position ?? "—",
        department: u.department?.name ?? "—",
        coursesCompleted: u.enrollments.filter((e) => e.status === "completed").length,
        coursesInProgress: u.enrollments.filter((e) => e.status === "in_progress").length,
        cpdProgress: Math.min(100, Math.round((cpdHours / target) * 100)),
        lastActive: u.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      };
    })
  );

  const totalInProgress = members.reduce((s, m) => s + m.coursesInProgress, 0);
  const totalCompleted = members.reduce((s, m) => s + m.coursesCompleted, 0);
  const avgCompletion = members.length
    ? Math.round(members.reduce((s, m) => s + m.cpdProgress, 0) / members.length)
    : 0;

  return NextResponse.json({
    teamMembers: members.length,
    inProgress: totalInProgress,
    completed: totalCompleted,
    avgCompletion,
    members,
  });
}
