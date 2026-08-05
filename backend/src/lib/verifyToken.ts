import jwt from "jsonwebtoken";

/**
 * Bearer-token verification for the API.
 *
 * The signing secret is read lazily rather than at module load. Reading it at
 * import time captured `undefined` whenever the module was evaluated before the
 * env was populated, and `jwt.verify(token, undefined)` throws — which this
 * function swallows into `null`. The result was an app that failed closed but
 * silently, with every request looking like a bad token. Now a missing secret is
 * a loud startup-style error, and a bad token stays a quiet 401.
 */
export const TOKEN_ISSUER = "imet-skills-intelligence";
export const TOKEN_AUDIENCE = "imet-skills-intelligence-api";
/** HMAC only. Pinned so a token cannot dictate its own verification algorithm. */
export const TOKEN_ALGORITHM = "HS256" as const;

export function jwtSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("AUTH_SECRET is not set — refusing to issue or verify tokens.");
  }
  return secret;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  departmentId: string | null;
}

/** Roles the app actually recognises. Anything else is not a valid session. */
const KNOWN_ROLES = new Set(["employee", "manager", "admin", "author"]);

export function verifyToken(req: Request): AuthUser | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    // `algorithms` is the important argument here. Without it jsonwebtoken will
    // verify whatever the token's own header asks for, which is the classic
    // algorithm-confusion foothold; pinning HS256 means a forged header is
    // rejected before any signature check happens.
    const payload = jwt.verify(token, jwtSecret(), {
      algorithms: [TOKEN_ALGORITHM],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    }) as Partial<AuthUser> & jwt.JwtPayload;

    // A signature proves the token is ours; it does not prove the claims are
    // shaped like a session. Validate before handing them to authorisation code.
    if (typeof payload.id !== "string" || !payload.id) return null;
    if (typeof payload.role !== "string" || !KNOWN_ROLES.has(payload.role)) return null;

    return {
      id: payload.id,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role,
      status: typeof payload.status === "string" ? payload.status : "",
      departmentId: typeof payload.departmentId === "string" ? payload.departmentId : null,
    };
  } catch {
    return null;
  }
}
