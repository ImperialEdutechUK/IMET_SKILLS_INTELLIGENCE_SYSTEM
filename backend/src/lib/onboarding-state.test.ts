import { describe, expect, it } from "vitest";
import {
  ONBOARDING_PATCH_MAX_BYTES,
  ONBOARDING_TOUR_VERSION,
  OnboardingPatchTooLarge,
  coerceOnboardingState,
  parseOnboardingPatch,
  tourPatch,
} from "./onboarding-state";

describe("parseOnboardingPatch", () => {
  it("accepts a tour outcome", () => {
    const patch = parseOnboardingPatch({ tour: { status: "completed", version: 1 } });
    expect(patch.tour?.status).toBe("completed");
  });

  it("accepts an ISO timestamp", () => {
    const at = new Date().toISOString();
    expect(parseOnboardingPatch({ tour: { status: "skipped", version: 1, at } }).tour?.at).toBe(at);
  });

  it("rejects an unknown top-level key, so the column cannot be used as free storage", () => {
    expect(() => parseOnboardingPatch({ notes: "anything" })).toThrow();
    expect(() => parseOnboardingPatch({ tour: { status: "completed", version: 1 }, extra: 1 })).toThrow();
  });

  it("rejects an unknown key inside a section", () => {
    expect(() =>
      parseOnboardingPatch({ tour: { status: "completed", version: 1, payload: "x".repeat(20) } }),
    ).toThrow();
  });

  it("rejects a status outside the allowed set", () => {
    expect(() => parseOnboardingPatch({ tour: { status: "dismissed", version: 1 } })).toThrow();
  });

  it("rejects a non-integer or out-of-range version", () => {
    expect(() => parseOnboardingPatch({ tour: { status: "completed", version: 1.5 } })).toThrow();
    expect(() => parseOnboardingPatch({ tour: { status: "completed", version: 100_000 } })).toThrow();
  });

  it("rejects a garbage timestamp", () => {
    expect(() => parseOnboardingPatch({ tour: { status: "completed", version: 1, at: "soon" } })).toThrow();
  });

  it("rejects an empty patch so it never costs a pointless write", () => {
    expect(() => parseOnboardingPatch({})).toThrow();
  });

  it("rejects a non-object body", () => {
    expect(() => parseOnboardingPatch("completed")).toThrow();
    expect(() => parseOnboardingPatch(null)).toThrow();
    expect(() => parseOnboardingPatch([{ tour: { status: "completed", version: 1 } }])).toThrow();
  });

  it("rejects an oversized body before validating its shape", () => {
    const big = { tour: { status: "completed", version: 1, at: "z".repeat(ONBOARDING_PATCH_MAX_BYTES) } };
    expect(() => parseOnboardingPatch(big)).toThrow(OnboardingPatchTooLarge);
  });

  it("keeps a real patch far below the size ceiling", () => {
    const bytes = Buffer.byteLength(JSON.stringify(tourPatch("completed")), "utf8");
    expect(bytes).toBeLessThan(ONBOARDING_PATCH_MAX_BYTES / 4);
  });
});

describe("tourPatch", () => {
  it("stamps the current tour version and a valid time", () => {
    const patch = tourPatch("skipped");
    expect(patch.tour?.version).toBe(ONBOARDING_TOUR_VERSION);
    expect(Number.isNaN(Date.parse(patch.tour!.at!))).toBe(false);
    expect(() => parseOnboardingPatch(patch)).not.toThrow();
  });
});

describe("coerceOnboardingState", () => {
  it("reads a stored tour section", () => {
    expect(coerceOnboardingState({ tour: { status: "completed", version: 1 } }).tour?.status).toBe("completed");
  });

  it("treats an empty or missing column as nothing done", () => {
    expect(coerceOnboardingState({})).toEqual({});
    expect(coerceOnboardingState(null)).toEqual({});
    expect(coerceOnboardingState(undefined)).toEqual({});
  });

  it("ignores a malformed tour section rather than throwing", () => {
    expect(coerceOnboardingState({ tour: "completed" })).toEqual({});
    expect(coerceOnboardingState({ tour: { status: "completed" } })).toEqual({});
  });

  it("does not surface keys it does not own", () => {
    const state = coerceOnboardingState({ tour: { status: "skipped", version: 1 }, somethingElse: { a: 1 } });
    expect(state).toEqual({ tour: { status: "skipped", version: 1 } });
  });
});
