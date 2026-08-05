import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { checkPassword } from "@/lib/password-policy";

/**
 * First-run password setup for an INVITED account.
 *
 * The route used to write `status: "active"` for any authenticated caller, which
 * made it a self-service reactivation switch: an account set to `inactive` that
 * still held a valid token could call this and put itself back into service. The
 * status transition is now allowed only from `invited`, which is the one case
 * this flow exists for — every other status keeps whatever it already had.
 */
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { password } = body ?? {};

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, email: true, fullName: true, status: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  // Read the status from the database, not from the token: the token is a
  // snapshot taken at sign-in and may be stale by hours.
  if (user.status !== "invited" && user.status !== "active") {
    return NextResponse.json(
      { error: "This account is not active. Contact your administrator." },
      { status: 403 }
    );
  }

  const check = checkPassword(password, [user.email, user.fullName]);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const passwordHash = await hash(password as string, 12);
  await prisma.user.update({
    where: { id: authUser.id },
    data: {
      passwordHash,
      // Only an invitation may be redeemed into an active account here.
      ...(user.status === "invited" ? { status: "active" as const } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
