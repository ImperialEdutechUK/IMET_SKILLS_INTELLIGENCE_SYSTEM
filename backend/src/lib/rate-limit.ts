/**
 * In-process fixed-window rate limiter.
 *
 * Guards the unauthenticated endpoints — login, registration, password reset —
 * against credential stuffing and password-spraying. Without it an attacker can
 * try passwords as fast as the network allows; bcrypt's cost factor slows a
 * single attempt but does nothing about concurrency.
 *
 * Scope and honesty about it: one Node process, in memory. On a single Railway
 * instance that is the whole surface. Behind more than one instance an attacker
 * gets N× the quota, and a restart clears the counters — so this raises the cost
 * of an online attack by orders of magnitude but is NOT a substitute for an
 * edge/WAF rate limit in a multi-instance deployment. Chosen over Redis
 * deliberately: no new dependency, no new service, no recurring cost.
 *
 * Keys are caller-supplied (e.g. `login:<ip>`); callers must never key on a
 * value an attacker controls freely, or they can simply rotate it.
 */

interface Window {
  count: number;
  /** Epoch ms at which this window expires and the count resets. */
  resetAt: number;
}

// Survives Next.js dev-mode hot reloads, like the prisma singleton in db.ts.
const globalForLimiter = globalThis as unknown as { __rateLimitBuckets?: Map<string, Window> };
const buckets = (globalForLimiter.__rateLimitBuckets ??= new Map<string, Window>());

/** Stop the map growing without bound when many distinct keys are seen. */
const MAX_KEYS = 10_000;

function sweep(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Attempts left in the current window (0 once blocked). */
  remaining: number;
  /** Seconds until the window resets — surfaced as Retry-After. */
  retryAfterSeconds: number;
}

/**
 * Consume one attempt against `key`. Returns `ok: false` once `limit` attempts
 * have been made inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Sweeping on window creation keeps eviction O(n) but amortised, and only
    // when the map is actually under pressure.
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  existing.count++;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds };
}

/**
 * Clear the counter for a key. Called after a SUCCESSFUL login so a legitimate
 * user who mistyped their password a few times is not left throttled.
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Best-effort client IP.
 *
 * Railway and Vercel both terminate TLS at their edge and set `x-forwarded-for`,
 * so the left-most entry is the real client. This header is forgeable when the
 * app is reachable directly, which is why it is only ever used for rate-limit
 * bucketing and never for authorisation: the worst case is an attacker giving
 * themselves a fresh bucket, which is no worse than having no limiter at all,
 * while genuine users behind one NAT still get independent-enough buckets.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 429 with the standard Retry-After header. */
export function tooManyRequests(result: RateLimitResult, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
    },
  });
}
