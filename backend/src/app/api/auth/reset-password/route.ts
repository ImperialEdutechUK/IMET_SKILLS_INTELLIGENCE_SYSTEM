import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkPassword, hashResetToken } from "@/lib/password-policy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Redeem an admin-issued password-reset token.
 *
 * This route previously accepted `{ email, newPassword }` and reset whichever
 * account matched — no token, no authentication, no rate limit. Anyone who knew
 * that admin@imperiallearning.co.uk existed could take the account over, and the
 * address is documented in the repo. That was the single most serious issue in
 * the codebase; the endpoint now requires possession of a single-use secret that
 * only an administrator can mint (POST /api/admin/password-tokens).
 *
 * Every failure returns the same 400. The old route distinguished "no account
 * found with that username" from other errors, which made it a free account
 * enumerator on top of everything else.
 */

const TOKEN_LIMIT = 10;
const TOKEN_WINDOW_MS = 15 * 60 * 1000;

const GENERIC_ERROR = "That reset link is invalid or has expired. Ask an administrator for a new one.";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = rateLimit(`reset:ip:${ip}`, TOKEN_LIMIT, TOKEN_WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(limit, "Too many attempts.");
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { token, newPassword } = body ?? {};
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Look the token up by its digest — the raw value is never stored, so a
  // database disclosure yields nothing redeemable.
  const record = await prisma.passwordToken.findUnique({
    where: { token: hashResetToken(token.trim()) },
    include: { user: { select: { id: true, email: true, fullName: true, status: true } } },
  });

  if (
    !record ||
    record.type !== "reset" ||
    record.usedAt !== null ||
    record.expiresAt <= new Date()
  ) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Password rules are checked AFTER the token, so an invalid token never
  // reveals whether the policy would have accepted the password.
  const check = checkPassword(newPassword, [record.user.email, record.user.fullName]);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const passwordHash = await hash(newPassword as string, 12);

  // Mark the token used in the SAME transaction as the password write, and only
  // if it is still unused. Two concurrent redemptions of one token would
  // otherwise both succeed; `usedAt: null` in the where-clause makes the second
  // update match zero rows and roll the whole transaction back.
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error("token-already-used");

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // A reset is also the moment an invited account becomes usable.
          ...(record.user.status === "invited" ? { status: "active" as const } : {}),
        },
      });

      // Any other outstanding reset token for this user is now void — resetting
      // the password must not leave a second key under the mat.
      await tx.passwordToken.updateMany({
        where: { userId: record.userId, type: "reset", usedAt: null },
        data: { usedAt: new Date() },
      });
    });
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
