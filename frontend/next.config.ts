import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * The app previously sent none, so it relied entirely on React's escaping for
 * XSS, had no clickjacking defence, and let browsers MIME-sniff responses. These
 * are defence-in-depth: they do not replace the server-side controls, they
 * reduce what a bug elsewhere can be turned into.
 *
 * `connect-src` must include the API origin because the browser talks to the
 * backend cross-origin (Vercel → Railway). It is read from NEXT_PUBLIC_API_URL,
 * the same value the client uses, so the two cannot drift.
 */
const isProduction = process.env.NODE_ENV === "production";

const apiOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

// `connect-src` is baked in at BUILD time. If NEXT_PUBLIC_API_URL is not present
// in the build environment, the policy silently narrows to 'self' and the
// browser blocks every call to the API — the app loads and then fails at each
// fetch, which looks like "the backend is down" rather than a CSP problem. Fail
// loudly at build time instead of shipping that.
if (!apiOrigin) {
  // TEMPORARY DIAGNOSTIC — remove once the preview build is green.
  // The value is set as a Sensitive variable and so cannot be read back in the
  // dashboard; this reports what the BUILD actually receives, which
  // distinguishes "never arrived" from "arrived malformed" from "arrived under
  // a slightly different key". Prints no secrets: only key names, a length, and
  // a short prefix of a URL that is public in the client bundle anyway.
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const publicKeys = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC"))
    .sort();
  console.error("\n── NEXT_PUBLIC_API_URL diagnostic ──");
  console.error("  VERCEL_ENV            :", process.env.VERCEL_ENV ?? "(unset)");
  console.error("  VERCEL_GIT_COMMIT_REF :", process.env.VERCEL_GIT_COMMIT_REF ?? "(unset)");
  console.error("  VERCEL_TARGET_ENV     :", process.env.VERCEL_TARGET_ENV ?? "(unset)");
  console.error("  key in process.env    :", "NEXT_PUBLIC_API_URL" in process.env);
  console.error("  typeof value          :", typeof raw);
  console.error("  length                :", raw === undefined ? "n/a" : String(raw).length);
  console.error(
    "  first 12 chars        :",
    raw === undefined ? "n/a" : JSON.stringify(String(raw).slice(0, 12))
  );
  console.error(
    "  all NEXT_PUBLIC* keys :",
    publicKeys.length ? publicKeys.join(", ") : "(none present)"
  );
  console.error("────────────────────────────────────\n");

  const message =
    "NEXT_PUBLIC_API_URL is missing or not a valid URL. The Content-Security-Policy " +
    "connect-src would block all API requests from the browser.";
  if (isProduction) throw new Error(message);
  console.warn(`\n⚠  ${message} (dev build continuing)\n`);
}

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next's hydration bootstrap and by Tailwind's
  // injected styles. Removing it needs a per-request nonce set from middleware,
  // which forces every page to render dynamically — see SECURITY_AUDIT.md
  // residual risk R-02 for that upgrade path.
  //
  // 'unsafe-eval' is DEV ONLY. React's development build uses eval() to
  // reconstruct callstacks for the error overlay; without it the console fills
  // with "eval() is not supported in this environment" and debugging degrades.
  // React does not use eval() in production builds, so the production policy
  // stays strict — this must never be added to the production branch.
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // Certificates are stored and rendered as data: URLs.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  // Certificate PDFs are displayed in an iframe from a blob: URL.
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Production only. Locally the frontend is http://localhost:3000 talking to
  // http://localhost:3001; browsers are supposed to exempt loopback from the
  // upgrade, but relying on that leaves dev one browser-version away from every
  // API call being rewritten to https:// and refused.
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces with frame-ancestors, for anything that predates CSP support.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Production only. Browsers ignore HSTS over plain http, but a stray
  // https://localhost visit would pin the header for a year against every
  // localhost port on the machine — an unpleasant thing to debug.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
