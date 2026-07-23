import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { parseCpd } from "@/lib/cpd-activity";

const DAY = 86400000;

// Display grouping for the "Hours by Activity Type" donut.
const TYPE_GROUP: Record<string, { label: string; color: string }> = {
  Learning: { label: "Online Courses", color: "#2e7d5b" },
  Reading: { label: "Articles & Reading", color: "#8b5cf6" },
  Coaching: { label: "Practice & Projects", color: "#f59e0b" },
  Webinar: { label: "Webinars & Videos", color: "#3b82f6" },
  Conference: { label: "Webinars & Videos", color: "#3b82f6" },
  Other: { label: "Other", color: "#94a3b8" },
};

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [records, enrollments, userSkills, target] = await Promise.all([
    prisma.cpdRecord.findMany({
      where: { userId: authUser.id },
      orderBy: { loggedAt: "desc" },
      include: { enrollment: { include: { course: true } } },
    }),
    prisma.enrollment.findMany({ where: { userId: authUser.id } }),
    prisma.userSkill.findMany({ where: { userId: authUser.id } }),
    getCpdTargetHours(authUser.departmentId),
  ]);

  const now = Date.now();
  const inLast = (d: Date, days: number) => now - new Date(d).getTime() <= days * DAY;
  const between = (d: Date, from: number, to: number) => {
    const age = now - new Date(d).getTime();
    return age > from * DAY && age <= to * DAY;
  };

  // This-week vs last-week deltas
  const hoursThisWeek = records.filter((r) => inLast(r.loggedAt, 7)).reduce((s, r) => s + r.hours, 0);
  const hoursLastWeek = records.filter((r) => between(r.loggedAt, 7, 14)).reduce((s, r) => s + r.hours, 0);
  const actsThisWeek = records.filter((r) => inLast(r.loggedAt, 7)).length;
  const actsLastWeek = records.filter((r) => between(r.loggedAt, 7, 14)).length;
  const completedThisWeek = enrollments.filter((e) => e.status === "completed" && e.completedAt && inLast(e.completedAt, 7)).length;
  const completedLastWeek = enrollments.filter((e) => e.status === "completed" && e.completedAt && between(e.completedAt, 7, 14)).length;
  const skillsImproving = userSkills.filter((s) => s.currentLevel < s.targetLevel).length;

  // CPD streak (consecutive weeks)
  const weekKeys = new Set(records.map((r) => Math.floor((now - new Date(r.loggedAt).getTime()) / (7 * DAY))));
  let streak = 0;
  while (weekKeys.has(streak)) streak++;

  // CPD hours over last 8 weeks (oldest -> newest)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const overTime: { label: string; hours: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now - (w + 1) * 7 * DAY);
    const end = now - w * 7 * DAY;
    const hours = records
      .filter((r) => new Date(r.loggedAt).getTime() > start.getTime() && new Date(r.loggedAt).getTime() <= end)
      .reduce((s, r) => s + r.hours, 0);
    overTime.push({ label: `${MONTHS[start.getMonth()]} ${start.getDate()}`, hours: Math.round(hours * 10) / 10 });
  }

  // Hours by activity type (grouped)
  const groupHours: Record<string, { label: string; color: string; hours: number }> = {};
  let totalHours = 0;
  for (const r of records) {
    const meta = parseCpd(r.description, r.enrollment?.course.title ?? "CPD", r.source === "course" ? "Learning" : "Other");
    const g = TYPE_GROUP[meta.type] ?? TYPE_GROUP.Other;
    groupHours[g.label] = groupHours[g.label] ?? { label: g.label, color: g.color, hours: 0 };
    groupHours[g.label].hours += r.hours;
    totalHours += r.hours;
  }
  const hoursByType = Object.values(groupHours)
    .map((g) => ({ name: g.label, value: Math.round(g.hours * 10) / 10, color: g.color, pct: totalHours ? Math.round((g.hours / totalHours) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  // Recent learning activities
  const recent = records.slice(0, 6).map((r) => {
    const meta = parseCpd(r.description, r.enrollment?.course.title ?? "CPD", r.source === "course" ? "Learning" : "Other");
    return {
      id: r.id,
      title: meta.title,
      type: meta.type,
      hours: r.hours,
      date: r.loggedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    };
  });

  const completedCount = enrollments.filter((e) => e.status === "completed").length;
  const onTargetSkills = userSkills.filter((s) => s.currentLevel >= s.targetLevel).length;

  return NextResponse.json({
    stats: {
      totalCpdHours: Math.round(hoursThisWeek * 10) / 10,
      cpdDelta: Math.round((hoursThisWeek - hoursLastWeek) * 10) / 10,
      learningActivities: actsThisWeek,
      activitiesDelta: actsThisWeek - actsLastWeek,
      coursesCompleted: completedThisWeek,
      completedDelta: completedThisWeek - completedLastWeek,
      skillsImproved: skillsImproving,
      cpdStreak: streak,
    },
    overTime,
    hoursByType,
    recent,
    progress: {
      cpdGoal: Math.min(100, Math.round((records.reduce((s, r) => s + r.hours, 0) / target) * 100)),
      learningGoal: enrollments.length ? Math.round((completedCount / enrollments.length) * 100) : 0,
      skillImprovement: userSkills.length ? Math.round((onTargetSkills / userSkills.length) * 100) : 0,
    },
  });
}
