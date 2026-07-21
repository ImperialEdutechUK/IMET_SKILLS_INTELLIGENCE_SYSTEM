/**
 * CORS for the cross-origin frontend (localhost:3000 → this API on :3001).
 *
 * next.config's `headers()` can only decorate real route responses — it can't
 * satisfy the browser's PREFLIGHT, because an `OPTIONS` request hits no route
 * handler (none export OPTIONS) and returns 404, which the browser rejects
 * ("preflight … does not have HTTP ok status"). Middleware runs before routing,
 * so it answers the preflight here with 204 and stamps CORS headers on every
 * other /api response — one source of truth (setting them here AND in
 * next.config would emit duplicate Access-Control-Allow-Origin, which browsers
 * also reject).
 */
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN?.trim() || "http://localhost:3000";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
  // Caches/proxies must not serve one origin's CORS response to another origin.
  Vary: "Origin",
};

function withCors(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) res.headers.set(key, value);
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  // Preflight: short-circuit with a 204 so the browser proceeds to the real request.
  if (req.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }));
  }
  // Actual request: run the route, then attach CORS headers to its response.
  return withCors(NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};
