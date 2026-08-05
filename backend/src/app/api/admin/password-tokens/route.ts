import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-policy";

/**
 * POST /api/admin/password-tokens  { userId }  → { token, expiresAt }
 *
 * Admin-only account recovery. Replaces the unauthenticated reset endpoint: an
 * administrator identifies the user out-of-band (a phone call, a desk visit),
 * mints a single-use token here, and reads it to them. They redeem it at
 * POST /api/auth/reset-password.
 *
 * The raw token is returned exactly once and never stored — only its SHA-256
 * digest goes to the database, so it cannot be recovered from a backup or by
 * re-reading this endpoint.
 */
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { userId } = body ?? {};
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId.trim() },
    select: { id: true, email: true, fullName: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { token, digest } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Void any token already outstanding for this user before issuing a new one,
  // so "reissue" cannot quietly leave two live keys for the same account.
  await prisma.$transaction([
    prisma.passwordToken.updateMany({
      where: { userId: target.id, type: "reset", usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordToken.create({
      data: { token: digest, type: "reset", expiresAt, userId: target.id },
    }),
  ]);

  console.info(
    `[admin] password reset token issued by ${authUser.id} for user ${target.id}`
  );

  return NextResponse.json({
    userId: target.id,
    email: target.email,
    fullName: target.fullName,
    // Shown once. Not retrievable afterwards.
    token,
    expiresAt: expiresAt.toISOString(),
  });
}
