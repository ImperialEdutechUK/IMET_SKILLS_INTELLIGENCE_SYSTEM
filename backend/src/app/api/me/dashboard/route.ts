import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

import { getCpdTargetHours } from "@/lib/cpd-target";

const LEVEL_LABEL = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];
const label = (n: number) => LEVEL_LABEL[Math.max(0, Math.min(4, n))];
const round1 = (n: number) => Math.round(n * 10) / 10;
const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The CPD target is ANNUAL (calendar year), so a flat percentage is time-blind:
// 20% done in February is fine, in November it is not. Pace compares hours logged
// against the hours you'd expect by today — expected = (days elapsed / days in year) × target.
function cpdPace(hours: number, target: number) {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
  const daysInYear = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000);
  const daysElapsed = Math.min(daysInYear, Math.max(1, Math.ceil((now.getTime() - yearStart.getTime()) / 86400000)));
  const daysLeft = Math.max(0, daysInYear - daysElapsed);

  const expected = (daysElapsed / daysInYear) * target;
  const delta = hours - expected; // + ahead of pace, − behind pace

  // 10% of the annual target is the tolerance band before "behind" is worth flagging.
  const tolerance = target * 0.1;
  let status: "complete" | "ahead" | "on_track" | "slightly_behind" | "behind";
  if (hours >= target) status = "complete";
  else if (delta >= tolerance) status = "ahead";
  else if (delta >= 0) status = "on_track";
  else if (delta >= -tolerance) status = "slightly_behind";
  else status = "behind";

  return { expected: round1(expected), delta: round1(delta), daysLeft, status };
}

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      enrollments: { include: { course: true }, orderBy: { updatedAt: "desc" } },
      cpdRecords: { select: { hours: true } },
      userSkills: { include: { skill: { select: { name: true } } } },
      recommendations: {
        where: { dismissed: false },
        orderBy: { matchScore: "desc" },
        include: { course: { include: { category: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const unreadNotifications = await prisma.notification.findMany({
    where: { userId: user.id, readAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (unreadNotifications.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // Role-based gaps from the deterministic engine. Falls back to the employee's own
  // self-set targets when no role profile has been analysed for them yet.
  const gaps = await prisma.skillGap.findMany({
    where: { userId: user.id },
    include: { skill: { select: { name: true } } },
    orderBy: { priorityScore: "desc" },
    take: 1,
  });
  const gapCount = await prisma.skillGap.count({ where: { userId: user.id } });

  const selfGaps = user.userSkills
    .filter((s) => s.currentLevel < s.targetLevel)
    .sort((a, b) => b.targetLevel - b.currentLevel - (a.targetLevel - a.currentLevel));

  let topGap: { skill: string; currentLabel: string; requiredLabel: string } | null = null;
  if (gaps[0]) {
    topGap = {
      skill: gaps[0].skill.name,
      currentLabel: label(gaps[0].currentLevel),
      requiredLabel: label(gaps[0].requiredLevel),
    };
  } else if (selfGaps[0]) {
    topGap = {
      skill: selfGaps[0].skill.name,
      currentLabel: label(selfGaps[0].currentLevel),
      requiredLabel: label(selfGaps[0].targetLevel),
    };
  }

  const inProgress = user.enrollments.filter((e) => e.status === "in_progress");
  const notStarted = user.enrollments.filter((e) => e.status === "not_started");
  const completedCount = user.enrollments.filter((e) => e.status === "completed").length;

  // "Continue Learning" shows what is genuinely actionable: courses already underway
  // first, then queued ones (adding a recommendation creates a not_started enrollment,
  // so without these the card would look empty right after you add a course).
  const continueList = [...inProgress, ...notStarted].slice(0, 3).map((enr) => ({
    id: enr.id,
    title: enr.course.title,
    progress: enr.progress,
    status: enr.status,
    externalUrl: enr.course.externalUrl ?? null,
  }));

  // Weekly learning activity for the trend chart — course starts + completions
  // bucketed into the last 8 weeks (computed from already-loaded enrollments).
  const now = Date.now();
  const weeklyActivity: { label: string; started: number; completed: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = now - (w + 1) * 7 * DAY;
    const end = now - w * 7 * DAY;
    let started = 0, completed = 0;
    for (const e of user.enrollments) {
      if (e.startedAt) { const t = new Date(e.startedAt).getTime(); if (t > start && t <= end) started++; }
      if (e.completedAt) { const t = new Date(e.completedAt).getTime(); if (t > start && t <= end) completed++; }
    }
    const d = new Date(start);
    weeklyActivity.push({ label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, started, completed });
  }

  const cpdHours = round1(user.cpdRecords.reduce((sum, r) => sum + r.hours, 0));
  const cpdTargetHours = await getCpdTargetHours(user.departmentId);
  const cpdPercent = Math.min(100, Math.round((cpdHours / cpdTargetHours) * 100));
  const pace = cpdPace(cpdHours, cpdTargetHours);
  const topRecs = user.recommendations.slice(0, 2);

  return NextResponse.json({
    fullName: user.fullName,
    cpdHours,
    cpdPercent,
    cpdTarget: cpdTargetHours,
    cpdExpected: pace.expected,
    cpdDelta: pace.delta,
    cpdDaysLeft: pace.daysLeft,
    cpdStatus: pace.status,
    completedCount,
    inProgressCount: inProgress.length,
    notStartedCount: notStarted.length,
    gapCount: gapCount > 0 ? gapCount : selfGaps.length,
    topGap,
    weeklyActivity,
    notifications: unreadNotifications.map((n) => ({ id: n.id, title: n.title, body: n.body })),
    inProgress: continueList,
    topRecs: topRecs.map((rec) => ({
      id: rec.id,
      courseId: rec.courseId,
      title: rec.course.title,
      source: rec.course.source,
      category: rec.course.category?.name ?? "General",
      matchLabel: rec.matchLabel,
      reason: rec.reason,
      cpd_hours: rec.course.cpdHours,
      rating: rec.course.rating ?? null,
      externalUrl: rec.course.externalUrl ?? "#",
    })),
  });
}
