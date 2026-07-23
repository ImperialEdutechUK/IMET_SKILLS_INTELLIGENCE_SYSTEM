import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

import { getCpdTargetHours } from "@/lib/cpd-target";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: true,
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

  const inProgress = user.enrollments.filter((e) => e.status === "in_progress");
  const completedCourseIds = new Set(
    user.enrollments.filter((e) => e.status === "completed").map((e) => e.courseId)
  );

  // Learning paths in progress (started but not fully complete for this user).
  const paths = await prisma.learningPath.findMany({ include: { items: true } });
  const learningPathsInProgress = paths.filter((p) => {
    if (p.items.length === 0) return false;
    const done = p.items.filter((it) => completedCourseIds.has(it.courseId)).length;
    return done > 0 && done < p.items.length;
  }).length;

  const cpdHours = user.cpdRecords.reduce((sum, r) => sum + r.hours, 0);
  const cpdTargetHours = await getCpdTargetHours(user.departmentId);
  const cpdPercent = Math.min(100, Math.round((cpdHours / cpdTargetHours) * 100));
  const skillsImproving = user.userSkills.filter((s) => s.currentLevel < s.targetLevel).length;
  const topRecs = user.recommendations.slice(0, 2);

  const now = new Date();
  const monthBuckets: { month: string; hours: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ month: MONTHS[d.getMonth()], hours: 0 });
  }
  for (const rec of user.cpdRecords) {
    const logged = new Date(rec.loggedAt);
    const monthsAgo = (now.getFullYear() - logged.getFullYear()) * 12 + (now.getMonth() - logged.getMonth());
    if (monthsAgo >= 0 && monthsAgo <= 5) {
      monthBuckets[5 - monthsAgo].hours += rec.hours;
    }
  }

  return NextResponse.json({
    fullName: user.fullName,
    cpdHours,
    cpdPercent,
    cpdTarget: cpdTargetHours,
    enrolledCount: user.enrollments.length,
    learningPathsInProgress,
    skillsImproving,
    notifications: unreadNotifications.map((n) => ({ id: n.id, title: n.title, body: n.body })),
    inProgress: inProgress.map((enr) => ({
      id: enr.id,
      title: enr.course.title,
      progress: enr.progress,
      externalUrl: enr.course.externalUrl ?? null,
    })),
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
    monthBuckets,
  });
}
