import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { parseCpd, CPD_CATEGORIES } from "@/lib/cpd-activity";

const CATEGORY_COLORS: Record<string, string> = {
  "Technical Skills": "#3b82f6",
  "Professional Skills": "#2e7d5b",
  Leadership: "#8b5cf6",
  Other: "#f59e0b",
};

// Weeks of consecutive activity ending this week.
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const WEEK = 7 * 86400000;
  const now = new Date();
  const weekKeys = new Set(
    dates.map((d) => Math.floor((now.getTime() - d.getTime()) / WEEK))
  );
  let streak = 0;
  while (weekKeys.has(streak)) streak++;
  return streak;
}

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [records, target] = await Promise.all([
    prisma.cpdRecord.findMany({
      where: { userId: authUser.id },
      orderBy: { loggedAt: "desc" },
      include: { enrollment: { include: { course: true } } },
    }),
    getCpdTargetHours(authUser.departmentId),
  ]);

  const completed = records.reduce((sum, r) => sum + r.hours, 0);
  const activitiesGoal = 15;

  // Category breakdown
  const catHours: Record<string, number> = {};
  const activities = records.map((r) => {
    const meta = parseCpd(r.description, r.enrollment?.course.title ?? "CPD activity", r.source === "course" ? "Learning" : "Other");
    catHours[meta.category] = (catHours[meta.category] ?? 0) + r.hours;
    return {
      id: r.id,
      title: meta.title,
      type: meta.type,
      category: meta.category,
      provider: meta.provider,
      date: r.loggedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      hours: r.hours,
      note: meta.note,
      source: r.source,
    };
  });

  const categories = CPD_CATEGORIES.map((name) => ({
    name,
    hours: Math.round((catHours[name] ?? 0) * 10) / 10,
    pct: completed > 0 ? Math.round(((catHours[name] ?? 0) / completed) * 100) : 0,
    color: CATEGORY_COLORS[name],
  })).filter((c) => c.hours > 0);

  return NextResponse.json({
    target,
    completed: Math.round(completed * 10) / 10,
    remaining: Math.max(0, Math.round((target - completed) * 10) / 10),
    pct: Math.min(100, Math.round((completed / target) * 100)),
    activitiesCompleted: records.length,
    streak: computeStreak(records.map((r) => new Date(r.loggedAt))),
    goals: {
      hoursGoal: target,
      hoursDone: Math.round(completed * 10) / 10,
      hoursPct: Math.min(100, Math.round((completed / target) * 100)),
      activitiesGoal,
      activitiesDone: records.length,
      activitiesPct: Math.min(100, Math.round((records.length / activitiesGoal) * 100)),
    },
    categories,
    activities,
  });
}
