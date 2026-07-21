import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const departmentId = url.searchParams.get("departmentId");
  const users = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { cpdRecords: true },
    orderBy: { fullName: "asc" },
  });

  const targetCache = new Map<string | null, number>();
  const members = await Promise.all(
    users.map(async (u) => {
      const key = u.departmentId;
      if (!targetCache.has(key)) targetCache.set(key, await getCpdTargetHours(key));
      const target = targetCache.get(key)!;
      const cpdHours = u.cpdRecords.reduce((s, r) => s + r.hours, 0);
      const { cpdProgress, status } = cpdRiskStatus(cpdHours, target);
      return { id: u.id, fullName: u.fullName, cpdProgress, status };
    })
  );

  const atRisk = members.filter((m) => m.status === "at_risk").length;
  const onTrack = members.length - members.filter((m) => m.status).length;
  const avg = members.length
    ? Math.round(members.reduce((s, m) => s + m.cpdProgress, 0) / members.length)
    : 0;

  return NextResponse.json({
    avg,
    onTrack,
    atRisk,
    members,
  });
}
