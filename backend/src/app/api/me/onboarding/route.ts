import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import {
  ONBOARDING_PATCH_MAX_BYTES,
  ONBOARDING_TOUR_VERSION,
  OnboardingPatchTooLarge,
  coerceOnboardingState,
  mergeOnboardingState,
  parseOnboardingPatch,
} from "@/lib/onboarding-state";

/**
 * The frontend's source of truth for whether a user has already been shown the
 * guided tour. Server-side so the answer is the same in every browser.
 *
 * GET   → { accountCreatedAt, tourVersion, tour }
 * PATCH → merges a validated patch and returns the resulting state
 *
 * `tour` is the field that decides anything: null means the user has never
 * settled the tour, so they are shown it regardless of how old the account is.
 * `accountCreatedAt` is informational only, kept for debugging and reporting.
 */

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Two narrow columns, so this stays a cheap primary-key lookup.
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { createdAt: true, onboardingState: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const state = coerceOnboardingState(user.onboardingState);
  return NextResponse.json({
    accountCreatedAt: user.createdAt,
    tourVersion: ONBOARDING_TOUR_VERSION,
    tour: state.tour ?? null,
  });
}

export async function PATCH(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Reject an oversized body before reading it into memory.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > ONBOARDING_PATCH_MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  let patch;
  try {
    patch = parseOnboardingPatch(body);
  } catch (err) {
    if (err instanceof OnboardingPatchTooLarge) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Unsupported onboarding state.", issues: err.issues.map((i) => i.message) },
        { status: 400 },
      );
    }
    throw err;
  }

  // A user can only ever write their own state: the id comes from the token, not
  // the body, so there is nothing here to tamper with.
  const state = await mergeOnboardingState(authUser.id, patch);
  if (!state) return NextResponse.json({ error: "User not found." }, { status: 404 });

  return NextResponse.json({ tour: state.tour ?? null });
}
