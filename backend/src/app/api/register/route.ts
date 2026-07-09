import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const EMAIL_DOMAIN = "@imperiallearning.co.uk";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { fullName, position, email, departmentId, password } = body ?? {};


  if (
    typeof fullName !== "string" || !fullName.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof departmentId !== "string" || !departmentId ||
    typeof password !== "string"
  ) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith(EMAIL_DOMAIN)) {
    return NextResponse.json({ error: `Email must end with ${EMAIL_DOMAIN}` }, { status: 400 });
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: "Password needs at least 8 characters, one uppercase letter, and one number." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) {
    return NextResponse.json({ error: "Selected department not found." }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName: fullName.trim(),
      position: typeof position === "string" && position.trim() ? position.trim() : null,
      role: "employee",
      status: "pending_approval",
      passwordHash,
      departmentId,
    },
  });

  return NextResponse.json({ ok: true });
}
