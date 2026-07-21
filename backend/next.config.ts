import type { NextConfig } from "next";

// CORS (including the OPTIONS preflight) is handled in src/middleware.ts.
// It is intentionally NOT set here too: emitting the headers from both places
// produces duplicate Access-Control-Allow-Origin values, which browsers reject.
const nextConfig: NextConfig = {};

export default nextConfig;
