import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { department: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({
    fullName: user.fullName,
    email: user.email,
    department: user.department?.name ?? "—",
  });
}

export async function PATCH(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (fullName.length < 2) return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: { fullName },
    include: { department: true },
  });

  return NextResponse.json({
    fullName: user.fullName,
    email: user.email,
    department: user.department?.name ?? "—",
  });
}
