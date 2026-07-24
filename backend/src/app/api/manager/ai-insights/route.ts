import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;
  const scope = { role: "employee" as const, ...(departmentId ? { departmentId } : {}) };

  const [gaps, recommendedTrainings, employeeCount] = await Promise.all([
    prisma.skillGap.findMany({
      where: { user: scope },
      include: { skill: true, user: true },
    }),
    prisma.recommendation.count({
      where: { user: scope, dismissed: false },
    }),
    prisma.user.count({ where: scope }),
  ]);

  const totalGaps = gaps.length;

  // ---- Aggregations ----
  const metCount = gaps.filter(
    (g) => g.status === "MEETS_REQUIREMENT" || g.gapValue <= 0
  ).length;

  const engagementScore = totalGaps ? Math.round((metCount / totalGaps) * 100) : 0;
  const metRatio = totalGaps ? metCount / totalGaps : 0;
  const learningTrend =
    metRatio >= 0.6 ? "Positive" : metRatio >= 0.4 ? "Steady" : "Needs Focus";

  // Distinct employees with >=1 high-importance gap
  const priorityEmployees = new Set<string>();
  for (const g of gaps) {
    if (g.importance === "CRITICAL" || g.importance === "HIGH") {
      priorityEmployees.add(g.userId);
    }
  }
  const topPriority = priorityEmployees.size;

  // Distinct skills that appear in any gap with gapValue > 0
  const gappedSkills = new Set<string>();
  for (const g of gaps) {
    if (g.gapValue > 0) gappedSkills.add(g.skillId);
  }
  const skillGapsIdentified = gappedSkills.size;

  const stats = {
    topPriority,
    recommendedTrainings,
    skillGapsIdentified,
    learningTrend,
    engagementScore,
  };

  // ---- Team health ----
  const healthLabel =
    engagementScore >= 70 ? "Good" : engagementScore >= 40 ? "Fair" : "Needs Attention";

  // ---- Per-skill aggregation (top skill gaps) ----
  const skillAgg = new Map<
    string,
    { skill: string; members: Set<string>; sumGap: number; gapCount: number }
  >();
  for (const g of gaps) {
    if (g.gapValue <= 0) continue;
    const key = g.skillId;
    if (!skillAgg.has(key))
      skillAgg.set(key, { skill: g.skill.name, members: new Set(), sumGap: 0, gapCount: 0 });
    const a = skillAgg.get(key)!;
    a.members.add(g.userId);
    a.sumGap += g.gapValue;
    a.gapCount += 1;
  }

  const topSkillGaps = Array.from(skillAgg.values())
    .map((a) => {
      const avgGap = a.gapCount ? a.sumGap / a.gapCount : 0;
      const gapLevel: "High" | "Medium" | "Low" =
        avgGap >= 2 ? "High" : avgGap >= 1 ? "Medium" : "Low";
      return { skill: a.skill, gapLevel, membersAffected: a.members.size };
    })
    .sort((a, b) => b.membersAffected - a.membersAffected)
    .slice(0, 5);

  // ---- Per-employee aggregation (members needing attention) ----
  const memberAgg = new Map<
    string,
    { id: string; fullName: string; gapCount: number; hasCritical: boolean }
  >();
  for (const g of gaps) {
    if (g.gapValue <= 0) continue;
    if (!memberAgg.has(g.userId))
      memberAgg.set(g.userId, {
        id: g.userId,
        fullName: g.user.fullName,
        gapCount: 0,
        hasCritical: false,
      });
    const m = memberAgg.get(g.userId)!;
    m.gapCount += 1;
    if (g.importance === "CRITICAL") m.hasCritical = true;
  }

  const membersNeedingAttention = Array.from(memberAgg.values())
    .sort((a, b) => b.gapCount - a.gapCount)
    .slice(0, 6)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      reason: `${m.gapCount} skill ${m.gapCount === 1 ? "gap" : "gaps"}`,
      status: (m.hasCritical ? "at_risk" : "attention") as "at_risk" | "attention",
    }));

  const membersNeedingSupport = memberAgg.size;

  // ---- Team health points ----
  const points: string[] = [];
  if (engagementScore >= 70) points.push("Team is meeting most skill requirements");
  else if (engagementScore >= 40) points.push("Team progress is on track");
  else points.push("Several requirements not yet met");
  if (membersNeedingSupport > 0)
    points.push(`${membersNeedingSupport} member${membersNeedingSupport === 1 ? "" : "s"} need support`);
  else points.push("No members currently need support");
  if (skillGapsIdentified > 0)
    points.push(`${skillGapsIdentified} skill ${skillGapsIdentified === 1 ? "gap" : "gaps"} identified`);
  if (recommendedTrainings > 0)
    points.push(`${recommendedTrainings} training${recommendedTrainings === 1 ? "" : "s"} recommended`);
  const teamHealth = { score: engagementScore, label: healthLabel, points: points.slice(0, 4) };

  // ---- AI summary ----
  const aiSummary: string[] = [];
  if (totalGaps === 0) {
    aiSummary.push("Not enough data yet — insights appear once skill gaps are analysed.");
  } else {
    if (learningTrend === "Positive")
      aiSummary.push("Your team is making good progress against its role requirements.");
    else if (learningTrend === "Steady")
      aiSummary.push("Your team is progressing steadily, with room to close more gaps.");
    else
      aiSummary.push("Your team needs focus — many role requirements are not yet met.");

    if (topSkillGaps.length >= 2)
      aiSummary.push(
        `Focus on ${topSkillGaps[0].skill} and ${topSkillGaps[1].skill} to close the widest gaps.`
      );
    else if (topSkillGaps.length === 1)
      aiSummary.push(`Focus on ${topSkillGaps[0].skill} to close the biggest gap.`);

    if (topPriority > 0)
      aiSummary.push(
        `${topPriority} member${topPriority === 1 ? "" : "s"} have high-priority gaps that need attention.`
      );

    if (recommendedTrainings > 0)
      aiSummary.push(
        `${recommendedTrainings} recommended training${recommendedTrainings === 1 ? "" : "s"} can help close these gaps.`
      );
  }

  return NextResponse.json({
    employeeCount,
    stats,
    teamHealth,
    topSkillGaps,
    membersNeedingAttention,
    aiSummary,
  });
}
