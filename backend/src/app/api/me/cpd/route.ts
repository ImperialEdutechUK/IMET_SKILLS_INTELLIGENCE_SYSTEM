import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [records, target] = await Promise.all([
    prisma.cpdRecord.findMany({
      where: { userId: authUser.id },
      orderBy: { loggedAt: "desc" },
      include: { enrollment: { include: { course: true } } },
    }),
    getCpdTargetHours(authUser.departmentId),
  ]);

  const completed = records.reduce((sum, r) => sum + r.hours, 0);

  return NextResponse.json({
    target,
    completed,
    remaining: Math.max(0, target - completed),
    pct: Math.min(100, Math.round((completed / target) * 100)),
    records: records.map((r) => ({
      id: r.id,
      title: r.description ?? r.enrollment?.course.title ?? "CPD activity",
      date: r.loggedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      source: r.source,
      hours: r.hours,
    })),
  });
}
