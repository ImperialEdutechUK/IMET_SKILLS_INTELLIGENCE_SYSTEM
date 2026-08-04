import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus, expectedWeeklyHours, AT_RISK_PACE, ATTENTION_PACE } from "@/lib/cpd-risk";
import { excludeTestAccounts } from "@/lib/test-accounts";
import {
  type MetricMember,
  avgSkillLevelPct,
  avgCpdProgressPct,
  paceBreakdown,
  activeLearners,
  memberStatus,
} from "@/lib/metrics/teamMetrics";

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAT_COLORS = ["#2e7d5b", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#64748b"];

// Manager dashboard — team-wide, scoped to the manager's own department.
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (authUser.role !== "manager") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Managers are locked to their own department, server-side (ignores any client param).
  const departmentId = authUser.departmentId;

  const rawMembers = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: {
      department: true,
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: true,
    },
    orderBy: { fullName: "asc" },
  });

  // Managers are excluded from their own team aggregates by construction (only
  // role=employee is fetched). Seeded test/onboarding accounts are removed too.
  const members = excludeTestAccounts(rawMembers);

  const dept = departmentId
    ? await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
    : null;

  const targetCache = new Map<string | null, number>();
  const targetFor = async (deptId: string | null) => {
    if (!targetCache.has(deptId)) targetCache.set(deptId, await getCpdTargetHours(deptId));
    return targetCache.get(deptId)!;
  };

  let inProgress = 0, completed = 0, cpdHoursTotal = 0;
  const mm: MetricMember[] = [];
  const attentionList: { id: string; fullName: string; reason: string; status: string }[] = [];
  const catTally = new Map<string, number>();
  const activityEvents: { time: number; user: string; action: string; type: string }[] = [];
  const memberRows: { id: string; fullName: string; position: string; avgSkillPercent: number; cpdProgress: number; coursesInProgress: number; coursesCompleted: number; status: string }[] = [];

  for (const m of members) {
    const ip = m.enrollments.filter((e) => e.status === "in_progress");
    const done = m.enrollments.filter((e) => e.status === "completed");
    inProgress += ip.length;
    completed += done.length;
    const cpdHours = m.cpdRecords.reduce((s, r) => s + r.hours, 0);
    cpdHoursTotal += cpdHours;
    const target = await targetFor(m.departmentId);
    const { cpdProgress, status } = cpdRiskStatus(cpdHours, target);

    const metricMember: MetricMember = {
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      userSkills: m.userSkills.map((us) => ({ currentLevel: us.currentLevel, targetLevel: us.targetLevel })),
      enrollmentsCount: m.enrollments.length,
      coursesCompleted: done.length,
      coursesInProgress: ip.length,
      cpdHours,
      cpdRecordsCount: m.cpdRecords.length,
      cpdProgress,
      riskStatus: status,
    };
    mm.push(metricMember);

    // 4-way team status: "not started" is separated from "at risk".
    const st = memberStatus(metricMember);
    if (st === "at_risk") attentionList.push({ id: m.id, fullName: m.fullName, reason: "Behind pace on their learning", status: "at_risk" });
    else if (st === "attention") attentionList.push({ id: m.id, fullName: m.fullName, reason: "Needs a nudge to stay on pace", status: "attention" });
    else if (st === "not_started") attentionList.push({ id: m.id, fullName: m.fullName, reason: "No courses or hours logged yet", status: "not_started" });

    memberRows.push({
      id: m.id,
      fullName: m.fullName,
      position: m.position ?? "—",
      avgSkillPercent: m.userSkills.length
        ? Math.round((m.userSkills.reduce((s, us) => s + us.currentLevel, 0) / m.userSkills.length / 4) * 100)
        : 0,
      cpdProgress,
      coursesInProgress: ip.length,
      coursesCompleted: done.length,
      status: st,
    });

    for (const e of m.enrollments) {
      const cat = e.course.category?.name ?? "Uncategorized";
      catTally.set(cat, (catTally.get(cat) ?? 0) + 1);
      if (e.completedAt) activityEvents.push({ time: new Date(e.completedAt).getTime(), user: m.fullName, action: `completed "${e.course.title}"`, type: "course_complete" });
      else if (e.startedAt) activityEvents.push({ time: new Date(e.startedAt).getTime(), user: m.fullName, action: `started "${e.course.title}"`, type: "course_start" });
    }
    for (const r of m.cpdRecords) activityEvents.push({ time: new Date(r.loggedAt).getTime(), user: m.fullName, action: `logged ${r.hours} CPD hours`, type: "cpd" });
  }

  const teamMembers = members.length;
  const deptTarget = await targetFor(departmentId);
  const teamTarget = Math.round(teamMembers * deptTarget * 10) / 10;
  const now = Date.now();

  // Canonical team metrics (single implementation, in lib/metrics/teamMetrics).
  const avgSkill = avgSkillLevelPct(mm);
  const avgCpd = avgCpdProgressPct(mm);
  const pace = paceBreakdown(mm);

  const progressOverTime: { label: string; hours: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = now - (w + 1) * 7 * DAY;
    const end = now - w * 7 * DAY;
    let hours = 0;
    for (const m of members) for (const r of m.cpdRecords) {
      const t = new Date(r.loggedAt).getTime();
      if (t > start && t <= end) hours += r.hours;
    }
    const d = new Date(start);
    progressOverTime.push({ label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, hours: Math.round(hours * 10) / 10 });
  }

  const categoryBreakdown = Array.from(catTally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: CAT_COLORS[i % CAT_COLORS.length] }));

  const recentActivity = activityEvents
    .sort((a, b) => b.time - a.time)
    .slice(0, 6)
    .map((e, i) => ({ id: `${e.time}-${i}`, user: e.user, action: e.action, type: e.type, time: relTime(now - e.time) }));

  return NextResponse.json({
    fullName: authUser.name ?? "Manager",
    departmentName: dept?.name ?? "Your Team",
    stats: {
      teamMembers,
      activeLearners: activeLearners(mm),
      coursesInProgress: inProgress,
      coursesCompleted: completed,
      notStarted: pace.notStarted,
      cpdCompletion: avgCpd.value,
      cpdHoursTotal: Math.round(cpdHoursTotal * 10) / 10,
      teamTarget,
      avgSkillLevel: avgSkill.value,
      avgSkillTracked: avgSkill.tracked,
      avgSkillTotal: avgSkill.total,
      onTrack: pace.onTrack,
      attention: pace.attention,
      atRisk: pace.atRisk,
      expectedWeeklyHours: expectedWeeklyHours(deptTarget),
      paceThresholds: { atRisk: AT_RISK_PACE, attention: ATTENTION_PACE },
    },
    definitions: {
      avgSkillLevel: avgSkill.definition,
      avgCpdProgress: avgCpd.definition,
      pace: pace.definition,
    },
    // On-track / attention / at-risk / not-started split for the status donut.
    cpdStatusBreakdown: [
      { name: "On track", value: pace.onTrack, color: "#2e7d5b" },
      { name: "Needs attention", value: pace.attention, color: "#f59e0b" },
      { name: "At risk", value: pace.atRisk, color: "#f43f5e" },
      { name: "Not started", value: pace.notStarted, color: "#94a3b8" },
    ],
    progressOverTime,
    attention: attentionList.slice(0, 6),
    recentActivity,
    categoryBreakdown,
    members: memberRows,
  });
}

function relTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
