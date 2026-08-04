import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";
import { excludeTestAccounts } from "@/lib/test-accounts";
import { type MetricMember, avgCpdProgressPct } from "@/lib/metrics/teamMetrics";

const round1 = (n: number) => Math.round(n * 10) / 10;

// "May 26" style label (month short + day).
function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// GET /api/manager/reports?departmentId=
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;

  const rawUsers = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { enrollments: true, cpdRecords: true, department: true },
    orderBy: { fullName: "asc" },
  });
  // Exclude seeded test/onboarding accounts from every reported figure.
  const users = excludeTestAccounts(rawUsers);

  // Per-department CPD target cache (used to compute each member's cpdProgress).
  const targetCache = new Map<string | null, number>();
  async function target(deptId: string | null) {
    if (!targetCache.has(deptId)) targetCache.set(deptId, await getCpdTargetHours(deptId));
    return targetCache.get(deptId)!;
  }

  const mm: MetricMember[] = await Promise.all(
    users.map(async (u) => {
      const targetHours = await target(u.departmentId);
      const cpdHours = u.cpdRecords.reduce((s, r) => s + r.hours, 0);
      const { cpdProgress, status } = cpdRiskStatus(cpdHours, targetHours);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        userSkills: [],
        enrollmentsCount: u.enrollments.length,
        coursesCompleted: u.enrollments.filter((e) => e.status === "completed").length,
        coursesInProgress: u.enrollments.filter((e) => e.status === "in_progress").length,
        cpdHours,
        cpdRecordsCount: u.cpdRecords.length,
        cpdProgress,
        riskStatus: status,
      };
    })
  );

  const totalMembers = mm.length;
  const totalCpdHours = round1(mm.reduce((s, m) => s + m.cpdHours, 0));
  const coursesCompleted = mm.reduce((s, m) => s + m.coursesCompleted, 0);
  const coursesInProgress = mm.reduce((s, m) => s + m.coursesInProgress, 0);
  // Canonical metric (single implementation): mean CPD progress vs annual target.
  const avgCpd = avgCpdProgressPct(mm);
  const avgProgress = avgCpd.value;

  // ---- Trend: last 8 weeks ----
  const allEnrollments = users.flatMap((u) => u.enrollments);
  const totalEnrollments = allEnrollments.length;
  const allRecords = users.flatMap((u) => u.cpdRecords);

  const now = new Date();

  // Weekly CPD cannot be bucketed by CpdRecord.loggedAt. A course keeps ONE record
  // that is topped up in place as time is logged and again on completion, while
  // loggedAt stays at the date it was first created — so every later hour landed
  // retroactively in an old week and recent weeks read empty. The append-only
  // EnrollmentEvent trail carries the hours each event ADDED at the moment it
  // happened, which is what a "hours per week" series actually needs. Standalone CPD
  // (manual entries, certificate uploads — no enrollment, so no trail) still comes
  // from loggedAt, which is accurate for those rows because they are written once.
  const trendStart = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  const trendEvents = await prisma.enrollmentEvent.findMany({
    where: {
      enrollment: { userId: { in: users.map((u) => u.id) } },
      createdAt: { gte: trendStart },
      hours: { not: null },
    },
    select: { hours: true, createdAt: true },
  });
  const standaloneRecords = allRecords.filter((r) => r.enrollmentId === null);

  const trend: { label: string; avgProgress: number; cpdHours: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const inWeek = (d: Date) => d >= weekStart && d < weekEnd;
    const cpdHours = round1(
      Math.max(
        0,
        trendEvents.filter((e) => inWeek(e.createdAt)).reduce((s, e) => s + (e.hours ?? 0), 0) +
          standaloneRecords.filter((r) => inWeek(r.loggedAt)).reduce((s, r) => s + r.hours, 0)
      )
    );

    const completedByThen = allEnrollments.filter((e) => {
      if (e.status !== "completed") return false;
      const when = e.completedAt ?? e.updatedAt;
      return when <= weekEnd;
    }).length;
    const cumProgress = totalEnrollments
      ? Math.round((completedByThen / totalEnrollments) * 100)
      : 0;

    trend.push({ label: weekLabel(weekEnd), avgProgress: cumProgress, cpdHours });
  }

  // ---- Progress summary ----
  const targetPerMember = await getCpdTargetHours(null);
  const cpdDenom = totalMembers * targetPerMember;
  const cpdProgress = cpdDenom ? Math.round((totalCpdHours / cpdDenom) * 100) : 0;
  const completionDenom = coursesCompleted + coursesInProgress;
  const completionRate = completionDenom
    ? Math.round((coursesCompleted / completionDenom) * 100)
    : 0;

  return NextResponse.json({
    stats: {
      totalMembers,
      totalCpdHours,
      coursesCompleted,
      coursesInProgress,
      avgProgress,
      avgCpdProgress: avgProgress,
    },
    definitions: { avgCpdProgress: avgCpd.definition },
    trend,
    progress: {
      learningProgress: avgProgress,
      cpdProgress,
      completionRate,
    },
    recentReports: [],
  });
}
