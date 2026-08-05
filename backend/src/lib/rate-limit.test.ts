import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, resetRateLimit, clientIp, tooManyRequests } from "./rate-limit";

/** Buckets live on globalThis; give every test its own key space. */
let counter = 0;
const freshKey = () => `test-key-${counter++}-${Math.random()}`;

describe("rateLimit", () => {
  beforeEach(() => {
    counter++;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows exactly `limit` attempts and blocks the next one", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    }
    expect(rateLimit(key, 5, 60_000).ok).toBe(false);
  });

  it("counts down `remaining` accurately", () => {
    const key = freshKey();
    expect(rateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000).remaining).toBe(0);
    expect(rateLimit(key, 3, 60_000).ok).toBe(false);
  });

  it("keeps separate keys independent — one IP cannot exhaust another's budget", () => {
    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < 5; i++) rateLimit(a, 5, 60_000);
    expect(rateLimit(a, 5, 60_000).ok).toBe(false);
    expect(rateLimit(b, 5, 60_000).ok).toBe(true);
  });

  it("reports a positive Retry-After while blocked", () => {
    const key = freshKey();
    for (let i = 0; i < 3; i++) rateLimit(key, 2, 60_000);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets attempts through again once the window has elapsed", () => {
    vi.useFakeTimers();
    const key = freshKey();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);
    expect(rateLimit(key, 5, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(rateLimit(key, 5, 60_000).ok).toBe(true);
  });

  it("stays blocked until the window actually expires", () => {
    vi.useFakeTimers();
    const key = freshKey();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);

    vi.advanceTimersByTime(59_000);
    expect(rateLimit(key, 5, 60_000).ok).toBe(false);
  });

  it("clears the counter on a successful login so a legitimate user is not stuck", () => {
    const key = freshKey();
    for (let i = 0; i < 4; i++) rateLimit(key, 5, 60_000);
    resetRateLimit(key);
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    }
  });
});

describe("clientIp", () => {
  it("takes the left-most x-forwarded-for entry", () => {
    const req = new Request("http://x/api", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://x/api", { headers: { "x-real-ip": "198.51.100.7" } });
    expect(clientIp(req)).toBe("198.51.100.7");
  });

  it("returns a stable placeholder when no proxy header is present", () => {
    expect(clientIp(new Request("http://x/api"))).toBe("unknown");
  });
});

describe("tooManyRequests", () => {
  it("responds 429 with a Retry-After header", async () => {
    const res = tooManyRequests({ ok: false, remaining: 0, retryAfterSeconds: 42 }, "Slow down.");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(await res.json()).toEqual({ error: "Slow down." });
  });
});
