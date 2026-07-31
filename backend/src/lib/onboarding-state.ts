import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Read and write `User.onboardingState`, the small JSONB blob that records how far
 * a user has got through onboarding.
 *
 * Two things matter here:
 *
 *  1. Writes MERGE. A caller updating `tour` must not wipe a key it has never
 *     heard of, so the merge happens inside Postgres with the jsonb `||`
 *     operator: one atomic statement, no read-modify-write race between two tabs.
 *
 *  2. The shape is CLOSED. Every schema below is `.strict()`, so an unknown key
 *     is rejected rather than stored. That is what stops a client turning this
 *     column into free storage, and it is also what keeps the value small enough
 *     to stay inline in the row so unrelated `User` queries are unaffected.
 */

// Bump when the tour steps change enough that everyone should see it again.
// Must stay in step with TOUR_VERSION in frontend/src/lib/onboarding.ts.
// v3: hands-on — the user clicks the real menu items and buttons themselves.
export const ONBOARDING_TOUR_VERSION = 3;

// Hard ceiling on an incoming patch. The closed schemas already bound the size;
// this is a cheap first gate so an oversized body never reaches Zod or the DB.
export const ONBOARDING_PATCH_MAX_BYTES = 512;

const isoDate = z
  .string()
  .max(32)
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Expected an ISO date string." });

export const tourStateSchema = z
  .object({
    status: z.enum(["completed", "skipped"]),
    version: z.number().int().min(1).max(9999),
    at: isoDate.optional(),
  })
  .strict();

/**
 * A patch. Every section is optional so a caller sends only what it changed, but
 * no key outside this list is accepted, and an empty patch is refused so we never
 * spend a write doing nothing.
 */
export const onboardingStatePatchSchema = z
  .object({
    tour: tourStateSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Patch must change something." });

/** The stored value. Parsed leniently on read: bad data reads as "nothing done". */
export const onboardingStateSchema = z
  .object({
    tour: tourStateSchema.optional(),
  })
  .partial()
  .catchall(z.unknown());

export type TourState = z.infer<typeof tourStateSchema>;
export type OnboardingStatePatch = z.infer<typeof onboardingStatePatchSchema>;
export type OnboardingState = { tour?: TourState };

export class OnboardingPatchTooLarge extends Error {
  constructor() {
    super(`Onboarding patch exceeds ${ONBOARDING_PATCH_MAX_BYTES} bytes.`);
    this.name = "OnboardingPatchTooLarge";
  }
}

/**
 * Validate an untrusted body into a patch.
 * Throws OnboardingPatchTooLarge for an oversized body, or ZodError for a bad shape.
 */
export function parseOnboardingPatch(body: unknown): OnboardingStatePatch {
  if (byteLength(body) > ONBOARDING_PATCH_MAX_BYTES) throw new OnboardingPatchTooLarge();
  return onboardingStatePatchSchema.parse(body);
}

/** Normalise whatever is in the column into a state object we can trust. */
export function coerceOnboardingState(raw: unknown): OnboardingState {
  const parsed = onboardingStateSchema.safeParse(raw);
  if (!parsed.success) return {};
  // Only surface sections that are individually valid; ignore the rest.
  const tour = tourStateSchema.safeParse(parsed.data.tour);
  return tour.success ? { tour: tour.data } : {};
}

/** Read one user's onboarding state. Selects the single column, nothing else. */
export async function readOnboardingState(userId: string): Promise<OnboardingState> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingState: true },
  });
  return coerceOnboardingState(row?.onboardingState);
}

/**
 * Merge `patch` into the user's existing state and return the result.
 *
 * The merge is a single atomic UPDATE using jsonb `||`, which is a shallow
 * top-level merge: keys in the patch replace their counterparts, every other key
 * is left exactly as it was. `jsonb_strip_nulls` means a caller can remove a
 * section by sending it as null, without needing a second endpoint.
 *
 * Returns null when the user id does not exist.
 */
export async function mergeOnboardingState(
  userId: string,
  patch: OnboardingStatePatch,
): Promise<OnboardingState | null> {
  const json = JSON.stringify(patch);
  if (Buffer.byteLength(json, "utf8") > ONBOARDING_PATCH_MAX_BYTES) throw new OnboardingPatchTooLarge();

  const rows = await prisma.$queryRaw<{ onboardingState: unknown }[]>`
    UPDATE "User"
       SET "onboardingState" = jsonb_strip_nulls(
             COALESCE("onboardingState", '{}'::jsonb) || ${json}::jsonb
           )
     WHERE "id" = ${userId}
    RETURNING "onboardingState"
  `;

  if (rows.length === 0) return null;
  return coerceOnboardingState(rows[0].onboardingState);
}

/** Convenience wrapper for the only writer we have today. */
export function tourPatch(status: "completed" | "skipped"): OnboardingStatePatch {
  return { tour: { status, version: ONBOARDING_TOUR_VERSION, at: new Date().toISOString() } };
}

function byteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return Number.POSITIVE_INFINITY; // circular or otherwise unserialisable
  }
}
