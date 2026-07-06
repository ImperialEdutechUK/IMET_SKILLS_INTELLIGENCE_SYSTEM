import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
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
    where: { id: session.user.id },
    data: { passwordHash, status: "active" },
  });

  return NextResponse.json({ ok: true });
}
