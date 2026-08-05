import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { compare, hash } from "bcryptjs";
import { checkPassword } from "@/lib/password-policy";
import { clientIp, rateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Change your own password. Requires the current one — a stolen token alone must
 * not be enough to lock the real owner out of their account.
 */
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Keyed on the account, not the IP: this throttles guessing of the CURRENT
  // password by whoever holds the token.
  const key = `me-password:${authUser.id}:${clientIp(req)}`;
  const limit = rateLimit(key, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(limit, "Too many attempts.");
  }

  const body = await req.json().catch(() => ({}));
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Cannot change password for this account." }, { status: 400 });
  }

  // Verify the current password BEFORE reporting anything about the new one, so
  // this endpoint cannot be used as a password-policy oracle without the
  // existing credential.
  const ok = await compare(current, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const check = checkPassword(next, [user.email, user.fullName]);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  if (await compare(next, user.passwordHash)) {
    return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 });
  }

  const passwordHash = await hash(next, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: authUser.id }, data: { passwordHash } }),
    // A voluntary password change voids any outstanding admin-issued reset
    // token, so an old recovery code cannot undo it later.
    prisma.passwordToken.updateMany({
      where: { userId: authUser.id, type: "reset", usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  resetRateLimit(key);
  return NextResponse.json({ success: true });
}
