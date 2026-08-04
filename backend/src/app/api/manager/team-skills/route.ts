import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { excludeTestAccounts } from "@/lib/test-accounts";
import { type MetricMember, avgSkillLevelPct } from "@/lib/metrics/teamMetrics";

const PRIO_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;

  // Fetch the team as members (so we know the TOTAL, including members with no
  // tracked skills) — then exclude seeded test/onboarding accounts.
  const rawUsers = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { userSkills: { include: { skill: true } } },
    orderBy: { fullName: "asc" },
  });
  const users = excludeTestAccounts(rawUsers);

  // ---- Per-skill aggregation ----
  const skillAgg = new Map<
    string,
    { name: string; sumCurrent: number; sumGap: number; count: number; membersBelow: number }
  >();
  for (const u of users) {
    for (const us of u.userSkills) {
      const key = us.skill.name;
      if (!skillAgg.has(key))
        skillAgg.set(key, { name: key, sumCurrent: 0, sumGap: 0, count: 0, membersBelow: 0 });
      const a = skillAgg.get(key)!;
      a.sumCurrent += us.currentLevel;
      a.sumGap += Math.max(0, us.targetLevel - us.currentLevel);
      a.count += 1;
      if (us.currentLevel < us.targetLevel) a.membersBelow += 1;
    }
  }

  const skills = Array.from(skillAgg.values()).map((a) => {
    const avgLevel = a.count ? a.sumCurrent / a.count : 0;
    const avgGap = a.count ? a.sumGap / a.count : 0;
    return { name: a.name, avgLevel, avgGap, count: a.count, membersBelow: a.membersBelow };
  });

  // ---- Per-member aggregation (for the "needs improvement" table) ----
  const memberNeeds = users
    .map((u) => {
      const improve: string[] = [];
      let sumCurrent = 0;
      let maxGap = 0;
      for (const us of u.userSkills) {
        sumCurrent += us.currentLevel;
        const gap = us.targetLevel - us.currentLevel;
        if (gap > 0) {
          improve.push(us.skill.name);
          if (gap > maxGap) maxGap = gap;
        }
      }
      return {
        id: u.id,
        fullName: u.fullName,
        position: u.position,
        avgLevelPercent: u.userSkills.length ? Math.round((sumCurrent / u.userSkills.length / 4) * 100) : 0,
        skills: improve,
        priority: maxGap >= 2 ? "High" : maxGap === 1 ? "Medium" : "Low",
        needsImprovement: improve.length >= 1,
      };
    })
    .filter((m) => m.needsImprovement)
    .sort((a, b) => (PRIO_RANK[a.priority] ?? 3) - (PRIO_RANK[b.priority] ?? 3));

  // ---- Canonical average skill level (member-weighted, skilled members only) ----
  const mm: MetricMember[] = users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    userSkills: u.userSkills.map((us) => ({ currentLevel: us.currentLevel, targetLevel: us.targetLevel })),
    enrollmentsCount: 0,
    coursesCompleted: 0,
    coursesInProgress: 0,
    cpdHours: 0,
    cpdRecordsCount: 0,
    cpdProgress: 0,
    riskStatus: null,
  }));
  const avgSkill = avgSkillLevelPct(mm);

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
      // Gap size as a percentage of the maximum level: a LONGER bar means a
      // BIGGER gap (worse), consistent with the label on the frontend.
      avgGapPercent: Math.round((s.avgGap / 4) * 100),
    }));

  return NextResponse.json({
    avgTeamLevel: avgSkill.value,
    avgSkillTracked: avgSkill.tracked,
    avgSkillTotal: avgSkill.total,
    totalMembers: avgSkill.total,
    membersWithTrackedSkills: avgSkill.tracked,
    strongSkills,
    skillsToImprove,
    skillOverview,
    needImprovement,
    memberNeeds,
    definitions: { avgSkillLevel: avgSkill.definition },
  });
}
