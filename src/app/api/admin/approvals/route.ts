import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const pending = await prisma.user.findMany({
    where: { status: "pending_approval" },
    select: {
      id: true,
      fullName: true,
      email: true,
      position: true,
      createdAt: true,
      department: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    pending.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      position: u.position,
      department: u.department?.name ?? "—",
      createdAt: u.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { userId, action } = body ?? {};
  if (typeof userId !== "string" || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.status !== "pending_approval") {
    return NextResponse.json({ error: "Account not found or not pending." }, { status: 404 });
  }

  if (action === "approve") {
    await prisma.user.update({ where: { id: userId }, data: { status: "active" } });
    await prisma.notification.create({
      data: {
        userId,
        title: "Account Approved",
        body: "Your registration has been approved. Welcome to LearnSmart AI — your dashboard is ready.",
      },
    });
    return NextResponse.json({ ok: true, action: "approved" });
  } else {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true, action: "rejected" });
  }
}
