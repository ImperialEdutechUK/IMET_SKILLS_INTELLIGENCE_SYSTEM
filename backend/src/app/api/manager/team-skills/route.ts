import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const userSkills = await prisma.userSkill.findMany({
    where: { user: { role: "employee" } },
    include: { skill: true },
  });

  const agg = new Map<string, { name: string; sumCurrent: number; sumGap: number; count: number }>();
  for (const us of userSkills) {
    const key = us.skill.name;
    if (!agg.has(key)) agg.set(key, { name: key, sumCurrent: 0, sumGap: 0, count: 0 });
    const a = agg.get(key)!;
    a.sumCurrent += us.currentLevel;
    a.sumGap += Math.max(0, us.targetLevel - us.currentLevel);
    a.count += 1;
  }

  const matrix = Array.from(agg.values()).map((a) => ({
    skill: a.name,
    avgLevel: Math.round((a.sumCurrent / a.count) * 10) / 10,
    avgGap: Math.round((a.sumGap / a.count) * 10) / 10,
  }));

  const overallAvg = matrix.length
    ? Math.round((matrix.reduce((s, m) => s + m.avgLevel, 0) / matrix.length) * 10) / 10
    : 0;
  const criticalGaps = matrix.filter((m) => m.avgGap >= 1.5).length;

  const gaps = [...matrix]
    .sort((a, b) => b.avgGap - a.avgGap)
    .slice(0, 6)
    .map((m) => ({ name: m.skill, value: Math.round(m.avgGap * 10) / 10 }));

  return NextResponse.json({
    skillsTracked: matrix.length,
    avgTeamLevel: overallAvg,
    criticalGaps,
    gaps,
    matrix: matrix.sort((a, b) => a.skill.localeCompare(b.skill)),
  });
}
