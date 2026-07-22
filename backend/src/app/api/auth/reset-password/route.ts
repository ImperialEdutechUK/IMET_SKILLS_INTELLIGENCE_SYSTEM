import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

// Self-service password reset by username (email) — no email link required.
// NOTE: this trusts whoever knows the username; it is intentionally simple for
// this phase and should be hardened (email/OTP verification) before production.
export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, newPassword } = body ?? {};
  if (typeof email !== "string" || !email.trim() || typeof newPassword !== "string") {
    return NextResponse.json({ error: "Username and new password are required." }, { status: 400 });
  }

  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json(
      { error: "Password needs at least 8 characters, one uppercase letter, and one number." },
      { status: 400 }
    );
  }

  // Case-insensitive lookup so any casing of the username works.
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (!user) {
    return NextResponse.json({ error: "No account found with that username." }, { status: 404 });
  }

  const passwordHash = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
