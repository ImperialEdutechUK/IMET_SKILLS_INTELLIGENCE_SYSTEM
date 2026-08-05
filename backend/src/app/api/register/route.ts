import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkPassword } from "@/lib/password-policy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_DOMAIN = "@imperiallearning.co.uk";

/** Bounds on free-text fields, so a registration cannot carry a novel. */
const MAX_NAME_LENGTH = 120;
const MAX_POSITION_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical maximum

// Self-registration is open to anyone who can reach the API, so it needs a
// ceiling: without one it is both a spam vector and a way to enumerate which
// addresses already exist, one request at a time.
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Is this a unique-constraint violation?
 *
 * Under the PrismaPg driver adapter a P2002 arrives without `meta.target`, and
 * some failures surface only as the underlying driver error — so check both the
 * Prisma code and Postgres' own SQLSTATE 23505.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; driverAdapterError?: { cause?: { code?: unknown } } };
  if (e.code === "P2002") return true;
  return e.driverAdapterError?.cause?.code === "23505";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = rateLimit(`register:ip:${ip}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(limit, "Too many registration attempts.");
  }

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

  if (fullName.trim().length > MAX_NAME_LENGTH || email.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json({ error: "Name or email is too long." }, { status: 400 });
  }
  if (typeof position === "string" && position.length > MAX_POSITION_LENGTH) {
    return NextResponse.json({ error: "Position is too long." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith(EMAIL_DOMAIN)) {
    return NextResponse.json({ error: `Email must end with ${EMAIL_DOMAIN}` }, { status: 400 });
  }

  const check = checkPassword(password, [normalizedEmail, fullName]);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) {
    return NextResponse.json({ error: "Selected department not found." }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  // Let the unique constraint decide, and answer identically whether the address
  // was free or already taken. The old code returned a distinct 409 for an
  // existing account, which turned this endpoint into an account-existence
  // oracle for the whole @imperiallearning.co.uk domain. Registrations require
  // admin approval anyway, so a silent no-op costs a genuine duplicate nothing
  // beyond the message below.
  try {
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
  } catch (err) {
    // ONLY a duplicate address is absorbed. Anything else is a real failure and
    // must surface rather than be reported to the user as a success.
    if (!isUniqueViolation(err)) throw err;
  }

  return NextResponse.json({
    ok: true,
    message: "Registration received. An administrator will review your account.",
  });
}
