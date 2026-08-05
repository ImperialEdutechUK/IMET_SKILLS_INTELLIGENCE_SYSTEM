/**
 * Small HTTP helpers shared by the recommendation-engine routes:
 * consistent JSON responses, auth/role guards, and a single error boundary.
 */
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { verifyToken, type AuthUser } from "@/lib/verifyToken";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = "Not signed in.") => new HttpError(401, msg);
export const forbidden = (msg = "Unauthorized.") => new HttpError(403, msg);
export const notFound = (msg = "Not found.") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Require a valid JWT; optionally restrict to a set of roles. */
export function requireAuth(req: Request, roles?: string[]): AuthUser {
  const user = verifyToken(req);
  if (!user) throw unauthorized();
  if (roles && roles.length > 0 && !roles.includes(user.role)) throw forbidden();
  return user;
}

/**
 * Wrap a route handler so thrown `HttpError`s, Zod errors, and unexpected
 * failures all become clean JSON responses instead of 500 stack traces.
 */
export function route<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response> | Response
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.message, ...(err.details ? { details: err.details } : {}) },
          { status: err.status }
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed.", details: err.flatten() },
          { status: 400 }
        );
      }
      // Log the real error server-side; return a generic one. Echoing
      // `err.message` handed clients raw Prisma/driver text — table and column
      // names, connection strings in some failure modes, upstream API bodies —
      // which is free reconnaissance. The reference lets an operator tie a user
      // report to the log line without the response carrying any internals.
      const reference = randomUUID();
      console.error(`[route] Unhandled error (ref ${reference}):`, err);
      return NextResponse.json(
        { error: "Something went wrong. Please try again.", reference },
        { status: 500 }
      );
    }
  };
}

/** Safely parse a JSON body, raising a 400 when it is missing/malformed. */
export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
}
