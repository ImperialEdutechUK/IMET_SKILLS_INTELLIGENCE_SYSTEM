import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";

const JWT_SECRET = process.env.AUTH_SECRET as string;

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, password } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // Case-insensitive email lookup so login is forgiving of casing
  // (some accounts were created with mixed-case emails, e.g. HR@imet.lk).
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    include: { department: true },
  });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.status === "pending_approval") {
    return NextResponse.json({ error: "Your account is pending admin approval." }, { status: 403 });
  }

  const userPayload = {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    status: user.status,
    departmentId: user.departmentId,
    department: user.department?.name ?? "",
    avatarUrl: user.avatarUrl ?? null,
  };

  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "7d" });

  return NextResponse.json({ token, user: userPayload });
}
