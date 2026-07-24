import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";
import { parseCpd } from "@/lib/cpd-activity";

const round1 = (n: number) => Math.round(n * 10) / 10;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;
  const users = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { cpdRecords: true, department: true },
    orderBy: { fullName: "asc" },
  });

  const targetCache = new Map<string | null, number>();
  async function target(deptId: string | null) {
    if (!targetCache.has(deptId)) targetCache.set(deptId, await getCpdTargetHours(deptId));
    return targetCache.get(deptId)!;
  }

  const members = await Promise.all(
    users.map(async (u) => {
      const targetHours = await target(u.departmentId);
      const cpdHours = u.cpdRecords.reduce((s, r) => s + r.hours, 0);
      const { cpdProgress, status } = cpdRiskStatus(cpdHours, targetHours);
      const gapHours = Math.max(0, round1(targetHours - cpdHours));
      return {
        id: u.id,
        fullName: u.fullName,
        position: u.position,
        cpdHours,
        cpdProgress,
        gapHours,
        status,
      };
    })
  );

  const totalMembers = members.length;
  const totalCpdHours = round1(members.reduce((s, m) => s + m.cpdHours, 0));
  const avgPerMember = totalMembers ? round1(totalCpdHours / totalMembers) : 0;

  const atRisk = members.filter((m) => m.status === "at_risk").length;
  const attention = members.filter((m) => m.status === "attention").length;
  const onTrack = members.filter((m) => m.status === null).length;

  const behindTarget = members
    .filter((m) => m.status !== null)
    .map((m) => ({ ...m, cpdHours: round1(m.cpdHours) }))
    .sort((a, b) => a.cpdProgress - b.cpdProgress);

  const recentSubmissions = users
    .flatMap((u) => u.cpdRecords.map((r) => ({ user: u, record: r })))
    .sort((a, b) => b.record.loggedAt.getTime() - a.record.loggedAt.getTime())
    .slice(0, 6)
    .map(({ user, record }) => ({
      id: record.id,
      member: user.fullName,
      activity: parseCpd(record.description, "CPD activity").title,
      hours: record.hours,
      date: formatDate(record.loggedAt),
    }));

  return NextResponse.json({
    totalCpdHours,
    avgPerMember,
    onTrack,
    atRisk,
    attention,
    targetSummary: [
      { name: "On Track", value: onTrack, color: "#2e7d5b" },
      { name: "At Risk", value: atRisk, color: "#f43f5e" },
      { name: "Attention", value: attention, color: "#f59e0b" },
    ],
    totalMembers,
    behindTarget,
    recentSubmissions,
  });
}
