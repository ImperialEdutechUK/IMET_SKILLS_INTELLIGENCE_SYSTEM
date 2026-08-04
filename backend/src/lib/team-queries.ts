import { prisma } from "@/lib/db";

import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";
import { excludeTestAccounts } from "@/lib/test-accounts";
import { type MetricMember, avgSkillLevelPct } from "@/lib/metrics/teamMetrics";

export async function getTeamMembers(departmentId: string) {
  const targetHours = await getCpdTargetHours(departmentId);
  const rawMembers = await prisma.user.findMany({
    where: { departmentId, role: "employee" },
    include: {
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: true,
    },
    orderBy: { fullName: "asc" },
  });
  // Exclude seeded test/onboarding accounts from every department roll-up.
  const members = excludeTestAccounts(rawMembers);

  return members.map((m) => {
    const completed = m.enrollments.filter((e) => e.status === "completed");
    const inProgress = m.enrollments.filter((e) => e.status === "in_progress");
    const cpdHours = m.cpdRecords.reduce((sum, r) => sum + r.hours, 0);
    const { cpdProgress, status: attentionStatus } = cpdRiskStatus(cpdHours, targetHours);
    const avgSkillLevel = m.userSkills.length
      ? m.userSkills.reduce((sum, s) => sum + s.currentLevel, 0) / m.userSkills.length
      : 0;

    return {
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      status: m.status,
      coursesCompleted: completed.length,
      coursesInProgress: inProgress.length,
      cpdHours,
      cpdProgress,
      avgSkillLevel,
      attentionStatus,
      // Carried for the canonical team average (see getTeamSummary).
      userSkills: m.userSkills.map((us) => ({ currentLevel: us.currentLevel, targetLevel: us.targetLevel })),
      enrollmentsCount: m.enrollments.length,
      cpdRecordsCount: m.cpdRecords.length,
      enrollments: [...completed, ...inProgress],
    };
  });
}

export async function getTeamSummary(departmentId: string) {
  const members = await getTeamMembers(departmentId);

  const notStarted = await prisma.user.count({
    where: { departmentId, role: "employee", enrollments: { none: {} } },
  });

  const categoryTally = new Map<string, number>();
  for (const m of members) {
    for (const e of m.enrollments) {
      const cat = e.course.category?.name ?? "Uncategorized";
      categoryTally.set(cat, (categoryTally.get(cat) ?? 0) + 1);
    }
  }

  return {
    teamMembers: members.length,
    coursesInProgress: members.reduce((s, m) => s + m.coursesInProgress, 0),
    coursesCompleted: members.reduce((s, m) => s + m.coursesCompleted, 0),
    notStarted,
    atRisk: members.filter((m) => m.attentionStatus === "at_risk").length,
    attention: members.filter((m) => m.attentionStatus === "attention").length,
    avgCpd: members.length
      ? Math.round(members.reduce((s, m) => s + m.cpdProgress, 0) / members.length)
      : 0,
    // Canonical average skill level: member-weighted, skilled members only, as a
    // percentage of the maximum level (single implementation in teamMetrics).
    avgSkillLevel: avgSkillLevelPct(members as unknown as MetricMember[]).value,
    categoryBreakdown: Array.from(categoryTally.entries()).map(([name, value]) => ({ name, value })),
  };
}

export async function getAllDepartmentSummaries() {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  return Promise.all(
    departments.map(async (d) => ({
      id: d.id,
      name: d.name,
      ...(await getTeamSummary(d.id)),
    }))
  );
}
