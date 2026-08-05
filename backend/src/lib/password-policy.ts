/**
 * One password policy, and the reset-token primitives that go with it.
 *
 * The rules were previously copy-pasted into four routes (register,
 * set-password, me/password, reset-password), which is how they drifted: the
 * length check was there in all four, but nothing stopped "Password1" and
 * nothing capped the input length, so a multi-megabyte string went straight
 * into bcrypt.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const MIN_PASSWORD_LENGTH = 8;
/**
 * bcrypt only considers the first 72 bytes, and hashing an unbounded string is
 * free CPU for an attacker. Reject long input rather than silently truncating.
 */
export const MAX_PASSWORD_LENGTH = 72;

/** Rejected outright regardless of whether they satisfy the character rules. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "welcome1", "welcome123",
  "qwerty123", "abc12345", "iloveyou1", "admin123", "letmein1", "monkey123",
  "football1", "changeme1", "sunshine1", "trustno1", "master123", "shadow123",
  "12345678", "123456789", "1234567890", "qwertyuiop",
]);

export interface PasswordCheck {
  ok: boolean;
  /** User-facing reason, safe to return verbatim. */
  error?: string;
}

/**
 * Validate a candidate password. `identifiers` are values the password must not
 * simply repeat — the user's own email/name, which are the first things an
 * attacker tries.
 */
export function checkPassword(value: unknown, identifiers: (string | null | undefined)[] = []): PasswordCheck {
  if (typeof value !== "string") {
    return { ok: false, error: "Password is required." };
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.` };
  }
  if (!/[A-Z]/.test(value)) {
    return { ok: false, error: "Password needs at least one uppercase letter." };
  }
  if (!/[a-z]/.test(value)) {
    return { ok: false, error: "Password needs at least one lowercase letter." };
  }
  if (!/\d/.test(value)) {
    return { ok: false, error: "Password needs at least one number." };
  }

  const lowered = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    return { ok: false, error: "That password is too common. Choose something less predictable." };
  }

  for (const identifier of identifiers) {
    if (!identifier) continue;
    // Compare against the local part of an email too — "yenushka@x.com" and
    // "Yenushka1" are the same guess.
    const local = identifier.split("@")[0]?.trim().toLowerCase();
    if (local && local.length >= 4 && lowered.includes(local)) {
      return { ok: false, error: "Password must not contain your name or email address." };
    }
  }

  return { ok: true };
}

// ── Reset tokens ────────────────────────────────────────────────────────────

/** How long an admin-issued reset token stays valid. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a reset token: the secret handed to the user, and the digest stored
 * in the database.
 *
 * Only the digest is persisted. `PasswordToken.token` used to be a place a raw
 * credential could sit; storing SHA-256 of it means a database read — a backup,
 * a log, a SQL-injection elsewhere — yields nothing redeemable. SHA-256 without
 * a salt is right here (unlike for passwords) because the input is 32 bytes of
 * CSPRNG output, so there is no dictionary to attack.
 */
export function generateResetToken(): { token: string; digest: string } {
  const token = randomBytes(32).toString("hex");
  return { token, digest: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time digest comparison, for callers that compare in application code. */
export function digestsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
