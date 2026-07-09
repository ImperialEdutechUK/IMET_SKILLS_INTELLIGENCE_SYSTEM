import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getAllDepartmentSummaries } from "@/lib/team-queries";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const manager = await prisma.user.findUnique({ where: { id: authUser.id } });
  const departments = await getAllDepartmentSummaries();

  return NextResponse.json({
    fullName: manager?.fullName ?? "",
    departments,
  });
}
