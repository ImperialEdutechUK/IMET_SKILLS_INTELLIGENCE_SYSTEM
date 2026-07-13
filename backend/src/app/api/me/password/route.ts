import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { compare, hash } from "bcryptjs";

export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  if (next.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "Cannot change password for this account." }, { status: 400 });

  const ok = await compare(current, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const passwordHash = await hash(next, 12);
  await prisma.user.update({ where: { id: authUser.id }, data: { passwordHash } });

  return NextResponse.json({ success: true });
}
