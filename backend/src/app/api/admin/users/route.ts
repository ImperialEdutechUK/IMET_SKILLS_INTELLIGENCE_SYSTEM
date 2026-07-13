import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [users, departmentCount] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.department.count(),
  ]);

  return NextResponse.json({
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    pending: users.filter((u) => u.status === "pending_approval").length,
    departmentCount,
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      department: u.department?.name ?? "—",
      lastActive: u.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      role: u.role,
      status: u.status,
    })),
  });
}
