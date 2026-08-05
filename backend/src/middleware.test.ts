import { describe, it, expect } from "vitest";
import { middleware } from "./middleware";
import type { NextRequest } from "next/server";

/**
 * CORS and API response headers.
 *
 * The Expose-Headers case is the one that matters most here: it is invisible to
 * curl (which has no CORS) and only reproduces in a browser, where a missing
 * entry silently turns `res.headers.get("Retry-After")` into null and degrades
 * the rate-limit message to "try again in a moment".
 */

const FRONTEND = "http://localhost:3000";

function request(url: string, init: { method?: string; origin?: string } = {}): NextRequest {
  const headers = new Headers();
  if (init.origin) headers.set("origin", init.origin);
  return new Request(url, { method: init.method ?? "GET", headers }) as unknown as NextRequest;
}

describe("CORS", () => {
  it("answers the preflight with 204 so the browser proceeds", () => {
    const res = middleware(request("http://localhost:3001/api/auth/login", { method: "OPTIONS", origin: FRONTEND }));
    expect(res.status).toBe(204);
  });

  it("echoes an allowlisted origin", () => {
    const res = middleware(request("http://localhost:3001/api/departments", { origin: FRONTEND }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(FRONTEND);
  });

  it("does NOT echo an origin that is not allowlisted", () => {
    const res = middleware(request("http://localhost:3001/api/departments", { origin: "https://evil.example" }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("never answers with a wildcard (incompatible with credentials)", () => {
    for (const origin of [FRONTEND, "https://evil.example", undefined]) {
      const res = middleware(request("http://localhost:3001/api/departments", { origin }));
      expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
    }
  });

  it("varies on Origin so a cache cannot cross-serve responses", () => {
    const res = middleware(request("http://localhost:3001/api/departments", { origin: FRONTEND }));
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("exposes Retry-After to cross-origin JS", () => {
    // Without this the frontend cannot read Retry-After on a 429 — the header is
    // not CORS-safelisted, so the browser hides it even though it is present on
    // the wire. Verified against a real browser; curl cannot catch this.
    const res = middleware(request("http://localhost:3001/api/auth/login", { origin: FRONTEND }));
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
  });

  it("exposes Retry-After on the preflight too", () => {
    const res = middleware(request("http://localhost:3001/api/auth/login", { method: "OPTIONS", origin: FRONTEND }));
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
  });
});

describe("API security headers", () => {
  const res = () => middleware(request("http://localhost:3001/api/me/dashboard", { origin: FRONTEND }));

  it("forbids caching of authenticated personal data", () => {
    // Every authenticated response carries names, CPD records and skill levels;
    // a shared proxy or the bfcache must not retain them past sign-out.
    expect(res().headers.get("Cache-Control")).toContain("no-store");
  });

  it("sets nosniff", () => {
    expect(res().headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("refuses to be framed", () => {
    expect(res().headers.get("X-Frame-Options")).toBe("DENY");
    expect(res().headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("sends no referrer from the API", () => {
    expect(res().headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("applies the security headers to the preflight as well", () => {
    const pre = middleware(request("http://localhost:3001/api/me/dashboard", { method: "OPTIONS", origin: FRONTEND }));
    expect(pre.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(pre.headers.get("Cache-Control")).toContain("no-store");
  });
});
