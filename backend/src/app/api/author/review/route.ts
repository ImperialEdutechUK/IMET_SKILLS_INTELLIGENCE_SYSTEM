import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "author" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const incompleteWhere = {
    OR: [
      { curriculum: null }, { curriculum: "" },
      { learningOutcomes: null }, { learningOutcomes: "" },
      { categoryId: null },
      { courseSkills: { none: {} } },
    ],
  };

  const [needsCount, missingCurriculum, missingOutcomes, courses] = await Promise.all([
    prisma.course.count({ where: incompleteWhere }),
    prisma.course.count({ where: { OR: [{ curriculum: null }, { curriculum: "" }] } }),
    prisma.course.count({ where: { OR: [{ learningOutcomes: null }, { learningOutcomes: "" }] } }),
    prisma.course.findMany({ where: incompleteWhere, take: 25, orderBy: { createdAt: "desc" }, include: { courseSkills: true } }),
  ]);

  return NextResponse.json({
    needsAttention: needsCount,
    missingCurriculum,
    missingOutcomes,
    courses: courses.map((c) => {
      let missing = "curriculum";
      if (!c.curriculum) missing = "curriculum";
      else if (!c.learningOutcomes) missing = "learning_outcomes";
      else if (!c.categoryId) missing = "category";
      else if (c.courseSkills.length === 0) missing = "skill_tags";
      return { id: c.id, title: c.title, source: c.source, missing };
    }),
  });
}
