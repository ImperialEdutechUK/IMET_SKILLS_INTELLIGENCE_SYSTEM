import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const departmentId = url.searchParams.get("departmentId");

  const userSkills = await prisma.userSkill.findMany({
    where: { user: { role: "employee", ...(departmentId ? { departmentId } : {}) } },
    include: { skill: true, user: true },
  });

  // ---- Per-skill aggregation ----
  const skillAgg = new Map<
    string,
    { name: string; sumCurrent: number; sumGap: number; count: number; membersBelow: number }
  >();
  for (const us of userSkills) {
    const key = us.skill.name;
    if (!skillAgg.has(key))
      skillAgg.set(key, { name: key, sumCurrent: 0, sumGap: 0, count: 0, membersBelow: 0 });
    const a = skillAgg.get(key)!;
    a.sumCurrent += us.currentLevel;
    a.sumGap += Math.max(0, us.targetLevel - us.currentLevel);
    a.count += 1;
    if (us.currentLevel < us.targetLevel) a.membersBelow += 1;
  }

  const skills = Array.from(skillAgg.values()).map((a) => {
    const avgLevel = a.count ? a.sumCurrent / a.count : 0;
    const avgGap = a.count ? a.sumGap / a.count : 0;
    return { name: a.name, avgLevel, avgGap, count: a.count, membersBelow: a.membersBelow };
  });

  // ---- Per-member aggregation ----
  const memberAgg = new Map<
    string,
    {
      id: string;
      fullName: string;
      position: string | null;
      sumCurrent: number;
      count: number;
      improveSkills: string[];
      maxGap: number;
    }
  >();
  for (const us of userSkills) {
    const u = us.user;
    if (!memberAgg.has(u.id))
      memberAgg.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        position: u.position,
        sumCurrent: 0,
        count: 0,
        improveSkills: [],
        maxGap: 0,
      });
    const m = memberAgg.get(u.id)!;
    m.sumCurrent += us.currentLevel;
    m.count += 1;
    const gap = us.targetLevel - us.currentLevel;
    if (gap > 0) {
      m.improveSkills.push(us.skill.name);
      if (gap > m.maxGap) m.maxGap = gap;
    }
  }

  const teamMembers = memberAgg.size;

  const avgTeamLevel = userSkills.length
    ? Math.round((userSkills.reduce((s, us) => s + us.currentLevel, 0) / userSkills.length / 4) * 100)
    : 0;

  const strongSkills = skills.filter((s) => s.avgLevel >= 3).length;
  const skillsToImprove = skills.filter((s) => s.avgGap >= 1).length;

  const skillOverview = [...skills]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((s) => ({ skill: s.name, avgPercent: Math.round((s.avgLevel / 4) * 100) }));

  const needImprovement = skills
    .filter((s) => s.membersBelow > 0)
    .sort((a, b) => b.membersBelow - a.membersBelow)
    .slice(0, 5)
    .map((s) => ({
      skill: s.name,
      membersNeedImprovement: s.membersBelow,
      avgGapPercent: Math.round((s.avgGap / 4) * 100),
    }));

  const prioRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  const memberNeeds = Array.from(memberAgg.values())
    .filter((m) => m.improveSkills.length >= 1)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      position: m.position,
      avgLevelPercent: m.count ? Math.round((m.sumCurrent / m.count / 4) * 100) : 0,
      skills: m.improveSkills,
      priority: m.maxGap >= 2 ? "High" : m.maxGap === 1 ? "Medium" : "Low",
    }))
    .sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);

  return NextResponse.json({
    teamMembers,
    avgTeamLevel,
    strongSkills,
    skillsToImprove,
    skillOverview,
    needImprovement,
    memberNeeds,
  });
}
