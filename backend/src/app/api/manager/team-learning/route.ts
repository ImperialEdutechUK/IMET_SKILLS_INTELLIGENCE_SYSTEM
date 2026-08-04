import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";
import { excludeTestAccounts } from "@/lib/test-accounts";
import { type MetricMember, avgCpdProgressPct, activeLearners } from "@/lib/metrics/teamMetrics";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;
  const rawUsers = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: {
      enrollments: true,
      cpdRecords: true,
      department: true,
      userSkills: { include: { skill: true } },
    },
    orderBy: { fullName: "asc" },
  });
  const users = excludeTestAccounts(rawUsers);

  const targetCache = new Map<string | null, number>();
  const rows = await Promise.all(
    users.map(async (u) => {
      const key = u.departmentId;
      if (!targetCache.has(key)) targetCache.set(key, await getCpdTargetHours(key));
      const target = targetCache.get(key)!;
      const cpdHours = u.cpdRecords.reduce((s, r) => s + r.hours, 0);
      const { cpdProgress, status } = cpdRiskStatus(cpdHours, target);

      // Gaps are self-assessed only: the target the employee set for a skill
      // minus where they are now. No role profile is involved.
      const skillGaps = u.userSkills
        .filter((us) => us.targetLevel > us.currentLevel)
        .map((us) => ({
          skill: us.skill.name,
          current: us.currentLevel,
          target: us.targetLevel,
          gap: us.targetLevel - us.currentLevel,
        }))
        .sort((a, b) => b.gap - a.gap || a.skill.localeCompare(b.skill));

      const member = {
        id: u.id,
        fullName: u.fullName,
        position: u.position ?? "—",
        department: u.department?.name ?? "—",
        coursesCompleted: u.enrollments.filter((e) => e.status === "completed").length,
        coursesInProgress: u.enrollments.filter((e) => e.status === "in_progress").length,
        cpdProgress,
        skillsTracked: u.userSkills.length,
        skillGaps,
        // ISO for relative-time rendering on the client; formatted date kept for exports.
        lastActiveAt: u.updatedAt.toISOString(),
        lastActive: u.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      };

      const metric: MetricMember = {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        userSkills: u.userSkills.map((us) => ({ currentLevel: us.currentLevel, targetLevel: us.targetLevel })),
        enrollmentsCount: u.enrollments.length,
        coursesCompleted: member.coursesCompleted,
        coursesInProgress: member.coursesInProgress,
        cpdHours,
        cpdRecordsCount: u.cpdRecords.length,
        cpdProgress,
        riskStatus: status,
      };
      return { member, metric };
    })
  );

  const members = rows.map((r) => r.member);
  const mm = rows.map((r) => r.metric);
  const avgCpd = avgCpdProgressPct(mm);

  return NextResponse.json({
    totalMembers: members.length,
    teamMembers: members.length,
    activeLearners: activeLearners(mm),
    inProgress: members.reduce((s, m) => s + m.coursesInProgress, 0),
    completed: members.reduce((s, m) => s + m.coursesCompleted, 0),
    // Mean CPD progress vs the annual target (previously mislabelled "avgCompletion").
    avgCpdProgress: avgCpd.value,
    avgCompletion: avgCpd.value,
    definitions: { avgCpdProgress: avgCpd.definition },
    members,
  });
}
