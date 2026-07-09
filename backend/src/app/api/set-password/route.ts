import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { password } = await req.json();
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json(
      { error: "Password needs an uppercase letter and a number." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.update({
    where: { id: authUser.id },
    data: { passwordHash, status: "active" },
  });

  return NextResponse.json({ ok: true });
}
