/**
 * CORS for the cross-origin frontend (localhost:3000 in dev, the Vercel app in
 * production → this API on Railway).
 *
 * next.config's `headers()` can only decorate real route responses — it can't
 * satisfy the browser's PREFLIGHT, because an `OPTIONS` request hits no route
 * handler (none export OPTIONS) and returns 404, which the browser rejects
 * ("preflight … does not have HTTP ok status"). Middleware runs before routing,
 * so it answers the preflight here with 204 and stamps CORS headers on every
 * other /api response — one source of truth (setting them here AND in
 * next.config would emit duplicate Access-Control-Allow-Origin, which browsers
 * also reject).
 *
 * Multiple origins: `Access-Control-Allow-Origin` may only carry a SINGLE origin
 * (a comma-separated list is invalid), so we keep an allowlist and echo back the
 * request's Origin when it matches. Defaults cover local dev and the known Vercel
 * deployment; add more via CORS_ORIGIN (comma-separated) without a code change.
 */
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "https://imet-skills-intelligence-system.vercel.app",
];

const ALLOWED_ORIGINS = new Set(
  [
    ...DEFAULT_ORIGINS,
    ...(process.env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim()),
  ].filter(Boolean)
);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    // Caches/proxies must not serve one origin's CORS response to another origin.
    Vary: "Origin",
  };
  // Echo the caller's origin only when it's on the allowlist (never a wildcard,
  // which is incompatible with Allow-Credentials).
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function withCors(res: NextResponse, origin: string | null): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(origin))) res.headers.set(key, value);
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  // Preflight: short-circuit with a 204 so the browser proceeds to the real request.
  if (req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), origin);
  }
  // Actual request: run the route, then attach CORS headers to its response.
  return withCors(NextResponse.next(), origin);
}

export const config = {
  matcher: "/api/:path*",
};
