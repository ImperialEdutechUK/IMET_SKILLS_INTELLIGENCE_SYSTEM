import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAT_COLORS = ["#2e7d5b", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#64748b"];

// Manager dashboard — team-wide, optionally scoped to one department (?departmentId).
export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (authUser.role !== "manager") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const url = new URL(req.url);
  const departmentId = url.searchParams.get("departmentId") || null;

  const members = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: {
      department: true,
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: true,
    },
    orderBy: { fullName: "asc" },
  });

  const targetCache = new Map<string | null, number>();
  const targetFor = async (deptId: string | null) => {
    if (!targetCache.has(deptId)) targetCache.set(deptId, await getCpdTargetHours(deptId));
    return targetCache.get(deptId)!;
  };

  let inProgress = 0, completed = 0, cpdSum = 0, skillSum = 0, skillCount = 0, atRisk = 0, attention = 0;
  const attentionList: { id: string; fullName: string; reason: string; status: string }[] = [];
  const catTally = new Map<string, number>();
  const activityEvents: { time: number; user: string; action: string; type: string }[] = [];

  for (const m of members) {
    const ip = m.enrollments.filter((e) => e.status === "in_progress");
    const done = m.enrollments.filter((e) => e.status === "completed");
    inProgress += ip.length;
    completed += done.length;
    const cpdHours = m.cpdRecords.reduce((s, r) => s + r.hours, 0);
    const target = await targetFor(m.departmentId);
    const { cpdProgress, status } = cpdRiskStatus(cpdHours, target);
    cpdSum += cpdProgress;
    if (m.userSkills.length) {
      skillSum += m.userSkills.reduce((s, us) => s + us.currentLevel, 0) / m.userSkills.length;
      skillCount++;
    }
    if (status === "at_risk") { atRisk++; attentionList.push({ id: m.id, fullName: m.fullName, reason: `CPD behind target (${cpdProgress}%)`, status: "at_risk" }); }
    else if (status === "attention") { attention++; attentionList.push({ id: m.id, fullName: m.fullName, reason: `CPD needs attention (${cpdProgress}%)`, status: "attention" }); }
    else if (m.enrollments.length === 0) { attentionList.push({ id: m.id, fullName: m.fullName, reason: "No courses started", status: "inactive" }); }

    for (const e of m.enrollments) {
      const cat = e.course.category?.name ?? "Uncategorized";
      catTally.set(cat, (catTally.get(cat) ?? 0) + 1);
      if (e.completedAt) activityEvents.push({ time: new Date(e.completedAt).getTime(), user: m.fullName, action: `completed "${e.course.title}"`, type: "course_complete" });
      else if (e.startedAt) activityEvents.push({ time: new Date(e.startedAt).getTime(), user: m.fullName, action: `started "${e.course.title}"`, type: "course_start" });
    }
    for (const r of m.cpdRecords) activityEvents.push({ time: new Date(r.loggedAt).getTime(), user: m.fullName, action: `logged ${r.hours} CPD hours`, type: "cpd" });
  }

  const teamMembers = members.length;
  const now = Date.now();

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
    stats: {
      teamMembers,
      coursesInProgress: inProgress,
      coursesCompleted: completed,
      notStarted: members.filter((m) => m.enrollments.length === 0).length,
      cpdCompletion: teamMembers ? Math.round(cpdSum / teamMembers) : 0,
      avgSkillLevel: skillCount ? Math.round((skillSum / skillCount / 4) * 100) : 0,
      atRisk,
      attention,
    },
    progressOverTime,
    attention: attentionList.slice(0, 6),
    recentActivity,
    categoryBreakdown,
  });
}

function relTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
