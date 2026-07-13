import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const userSkills = await prisma.userSkill.findMany({
    where: { userId: authUser.id },
    include: { skill: { include: { category: true } } },
    orderBy: { skill: { name: "asc" } },
  });

  const skills = userSkills.map((us) => ({
    id: us.id,
    name: us.skill.name,
    category: us.skill.category?.name ?? "General",
    currentLevel: us.currentLevel,
    targetLevel: us.targetLevel,
  }));

  return NextResponse.json({
    total: skills.length,
    onTarget: skills.filter((s) => s.currentLevel >= s.targetLevel).length,
    improving: skills.filter((s) => s.currentLevel < s.targetLevel).length,
    skills,
  });
}
