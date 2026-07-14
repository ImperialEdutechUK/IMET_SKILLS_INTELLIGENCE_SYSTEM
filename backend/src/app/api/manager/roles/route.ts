import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "manager" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const [roles, distinctPositions] = await Promise.all([
      prisma.roleProfile.findMany({
        orderBy: { title: "asc" },
        include: {
          department: true,
          requirements: { include: { skill: true } },
        },
      }),
      prisma.user.findMany({
        where: { position: { not: null } },
        select: { position: true },
        distinct: ["position"],
      }),
    ]);

    const positions = distinctPositions.map((p) => p.position).filter(Boolean) as string[];

    return NextResponse.json({
      totalRoles: roles.length,
      positionsInUse: positions,
      roles: roles.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        department: r.department?.name ?? null,
        hasMatchingEmployees: positions.includes(r.title),
        requirements: r.requirements.map((req) => ({
          id: req.id,
          skill: req.skill.name,
          requiredLevel: req.requiredLevel,
          importance: req.importance,
          reason: req.reason,
        })),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
