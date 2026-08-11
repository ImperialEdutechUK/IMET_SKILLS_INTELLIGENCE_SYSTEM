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
 *
 * Vercel PREVIEW deployments get a different generated hostname per branch, so
 * they are matched by team-scoped suffix rather than listed — opt-in per
 * environment via CORS_PREVIEW_SUFFIX, see previewSuffixes() below.
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

/**
 * Vercel preview deployments — OFF unless CORS_PREVIEW_SUFFIX is set.
 *
 * Every branch gets its own generated hostname
 * (`imet-skills-intelligence-git-<branch>-<team>.vercel.app`), so previews cannot
 * be enumerated in a static allowlist — a new branch would be blocked by CORS
 * until someone edited this file. They are matched by their team-scoped suffix
 * instead.
 *
 * There is deliberately NO default. Set CORS_PREVIEW_SUFFIX on the STAGING
 * service only (`-imperialedutechuks-projects.vercel.app`). A default would ship
 * to production on the next merge to main and let any preview deployment in the
 * Vercel team call the production API with credentials — wider than production
 * needs, and easy to forget. Unset, production keeps its strict allowlist.
 *
 * The suffix is also deliberately not `.vercel.app`: `-<team>-projects.vercel.app`
 * is owned by the Vercel team, so no other account can deploy under it.
 *
 * Read per request rather than at module load so the value can be changed on the
 * host without a rebuild, and so tests can vary it.
 */
function previewSuffixes(): string[] {
  return (process.env.CORS_PREVIEW_SUFFIX ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // Reject anything that is not a bare origin (path, port, credentials); an
  // Origin header is always scheme+host, so a mismatch here means a forgery
  // attempt rather than a real browser request.
  if (url.origin !== origin || url.protocol !== "https:") return false;

  // endsWith alone would let "evil-imperialedutechuks-projects.vercel.app"
  // through only if it really were under that team — which Vercel prevents —
  // but require a non-empty subdomain prefix regardless.
  return previewSuffixes().some(
    (suffix) => url.hostname.endsWith(suffix) && url.hostname.length > suffix.length
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    // Cross-origin JS can only read the CORS-safelisted response headers unless
    // they are named here. `Retry-After` is NOT on that list, so without this
    // the frontend's `res.headers.get("Retry-After")` returns null on a 429 and
    // the throttle message degrades to a vague "try again in a moment". It reads
    // fine from curl, which has no CORS — this only reproduces in a browser.
    "Access-Control-Expose-Headers": "Retry-After",
    // Caches/proxies must not serve one origin's CORS response to another origin.
    Vary: "Origin",
  };
  // Echo the caller's origin only when it's allowed (never a wildcard, which is
  // incompatible with Allow-Credentials).
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Response headers for the API itself.
 *
 * Set here rather than in next.config so they also land on the 204 preflight,
 * and so there is one place that decorates every /api response.
 *
 * `no-store` matters most: every authenticated response carries personal data —
 * names, CPD records, skill levels, certificates — and without it a shared proxy
 * or the browser's bfcache may retain one user's response and serve it after
 * they sign out.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  // The API renders no HTML; nothing here should ever be framed or executed.
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

function withCors(res: NextResponse, origin: string | null): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders(origin))) res.headers.set(key, value);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(key, value);
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
