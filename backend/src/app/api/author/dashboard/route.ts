import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "author" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [total, published, totalEnrollments, bySourceRaw, needAttentionCourses, skills, activities, recentCourses] =
    await Promise.all([
      prisma.course.count(),
      prisma.course.count({ where: { status: "published" } }),
      prisma.enrollment.count(),
      prisma.course.groupBy({ by: ["source"], _count: { source: true } }),
      prisma.course.findMany({
        where: {
          OR: [
            { curriculum: null }, { curriculum: "" },
            { learningOutcomes: null }, { learningOutcomes: "" },
            { categoryId: null },
            { courseSkills: { none: {} } },
          ],
        },
        take: 8,
        include: { courseSkills: true },
      }),
      prisma.skill.findMany({ include: { courseSkills: true } }),
      prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { user: true } }),
      prisma.course.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { createdAt: true, status: true } }),
    ]);

  const needsAttentionCount = await prisma.course.count({
    where: {
      OR: [
        { curriculum: null }, { curriculum: "" },
        { learningOutcomes: null }, { learningOutcomes: "" },
        { categoryId: null },
        { courseSkills: { none: {} } },
      ],
    },
  });

  const needsAttention = needAttentionCourses.map((c) => {
    let missing = "curriculum";
    if (!c.curriculum) missing = "curriculum";
    else if (!c.learningOutcomes) missing = "learning_outcomes";
    else if (!c.categoryId) missing = "category";
    else if (c.courseSkills.length === 0) missing = "skill_tags";
    return { id: c.id, title: c.title, source: c.source, missing };
  });

  const coursesBySource = bySourceRaw.map((r) => ({ name: r.source, value: r._count.source }));

  const now = new Date();
  const months: { month: string; added: number; published: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.toLocaleDateString("en-GB", { month: "short" }), added: 0, published: 0 });
  }
  for (const c of recentCourses) {
    const diff = (now.getFullYear() - c.createdAt.getFullYear()) * 12 + (now.getMonth() - c.createdAt.getMonth());
    if (diff >= 0 && diff < 6) {
      months[5 - diff].added += 1;
      if (c.status === "published") months[5 - diff].published += 1;
    }
  }

  const skillCoverage = skills
    .map((s) => ({ name: s.name, covered: s.courseSkills.length > 0 ? 100 : 0 }))
    .slice(0, 8);

  return NextResponse.json({
    totalCourses: total,
    published,
    needsCompletion: needsAttentionCount,
    totalEnrollments,
    contentActivity: months,
    needsAttention,
    coursesBySource,
    skillCoverage,
    recentActivities: activities.map((a) => {
      const payload = (a.payload ?? {}) as Record<string, unknown>;
      return {
        id: a.id, type: a.type, user: a.user?.fullName ?? "",
        action: typeof payload.action === "string" ? payload.action : a.type,
        time: a.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      };
    }),
  });
}
