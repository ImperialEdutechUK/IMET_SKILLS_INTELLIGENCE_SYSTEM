import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "author" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [categories, skills] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.skill.findMany({ include: { category: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    skills: skills.map((s) => ({ id: s.id, name: s.name, category: s.category?.name ?? "General" })),
  });
}
