import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "author" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = 25;
  const search = (url.searchParams.get("search") ?? "").trim();

  const where = search ? { title: { contains: search, mode: "insensitive" as const } } : {};

  const [total, published, draft, enrollAgg, pageCourses] = await Promise.all([
    prisma.course.count(),
    prisma.course.count({ where: { status: "published" } }),
    prisma.course.count({ where: { status: "draft" } }),
    prisma.enrollment.count(),
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, courseSkills: true, _count: { select: { enrollments: true } } },
    }),
  ]);

  const matchCount = search ? await prisma.course.count({ where }) : total;

  return NextResponse.json({
    total,
    published,
    draft,
    totalEnrollments: enrollAgg,
    page,
    pageSize,
    matchCount,
    totalPages: Math.ceil(matchCount / pageSize),
    courses: pageCourses.map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source,
      category: c.category?.name ?? "Uncategorized",
      enrollments: c._count.enrollments,
      status: c.status,
      incomplete: !c.curriculum || !c.learningOutcomes || !c.categoryId || c.courseSkills.length === 0,
    })),
  });
}
