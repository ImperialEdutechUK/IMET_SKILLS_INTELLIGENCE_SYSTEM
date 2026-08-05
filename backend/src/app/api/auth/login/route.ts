import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import {
  jwtSecret,
  TOKEN_ALGORITHM,
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
} from "@/lib/verifyToken";
import { clientIp, rateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Sessions last 8 hours, not 7 days.
 *
 * There is no server-side session store and no token revocation list, so the
 * token IS the session: deactivating an account or demoting a manager cannot
 * take effect until the token they already hold expires. Seven days made that
 * window unacceptable. Eight hours bounds it to roughly a working day while
 * still not asking anyone to log in twice in one shift. See SECURITY_AUDIT.md
 * (A-09) for the revocation work this defers.
 */
const TOKEN_TTL = "8h";

/**
 * A bcrypt hash of a value nobody knows, compared against when the account does
 * not exist. Without it the "no such user" path returns in microseconds while a
 * real user costs a ~100ms bcrypt compare, and that difference alone tells an
 * attacker which addresses are registered.
 */
const DUMMY_HASH_PROMISE = hash("account-does-not-exist", 12);

// Online-guessing budget: 10 attempts per IP per 15 minutes, and a second,
// slower bucket per email so distributing an attack across IPs still runs into
// a wall on any single account.
const IP_LIMIT = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;

/** Statuses that may hold a session. Anything else cannot sign in. */
const LOGIN_ALLOWED_STATUSES = new Set(["active", "invited"]);

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipLimit = rateLimit(`login:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
  if (!ipLimit.ok) {
    // Messages here state WHAT happened only. The client appends the wait from
    // Retry-After, so adding "please wait and try again" produces the redundant
    // "Please wait and try again. Try again in about 15 minutes."
    return tooManyRequests(ipLimit, "Too many sign-in attempts.");
  }

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

  const normalizedEmail = email.trim().toLowerCase();
  const emailLimit = rateLimit(
    `login:email:${normalizedEmail}`,
    EMAIL_LIMIT,
    EMAIL_WINDOW_MS
  );
  if (!emailLimit.ok) {
    return tooManyRequests(emailLimit, "Too many sign-in attempts for this account.");
  }

  // Case-insensitive email lookup so login is forgiving of casing
  // (some accounts were created with mixed-case emails, e.g. HR@imet.lk).
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    include: { department: true },
  });

  // Always spend a bcrypt compare, even with no user and no stored hash, so
  // every failure path costs the same wall-clock time.
  const valid = await compare(
    password,
    user?.passwordHash ?? (await DUMMY_HASH_PROMISE)
  );

  if (!user || !user.passwordHash || !valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.status === "pending_approval") {
    return NextResponse.json({ error: "Your account is pending admin approval." }, { status: 403 });
  }
  // Deactivated accounts previously still authenticated: the only status the
  // route rejected was pending_approval, so setting a leaver to `inactive` did
  // not actually lock them out.
  if (!LOGIN_ALLOWED_STATUSES.has(user.status)) {
    return NextResponse.json(
      { error: "This account is not active. Contact your administrator." },
      { status: 403 }
    );
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

  const token = jwt.sign(userPayload, jwtSecret(), {
    algorithm: TOKEN_ALGORITHM,
    expiresIn: TOKEN_TTL,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

  // A correct password clears the throttle so someone who fat-fingered it twice
  // is not left locked out for the rest of the window.
  resetRateLimit(`login:email:${normalizedEmail}`);
  resetRateLimit(`login:ip:${ip}`);

  return NextResponse.json({ token, user: userPayload });
}
