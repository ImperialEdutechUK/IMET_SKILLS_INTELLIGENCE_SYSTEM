import { describe, it, expect } from "vitest";
import { deriveProgress, resolveTargetHours } from "./enrollment-progress";

describe("resolveTargetHours", () => {
  it("prefers the published duration", () => {
    expect(resolveTargetHours(12, 8)).toBe(12);
  });

  it("falls back to CPD hours when there is no duration", () => {
    expect(resolveTargetHours(null, 8)).toBe(8);
    expect(resolveTargetHours(0, 8)).toBe(8);
  });

  it("returns null when the course publishes neither", () => {
    expect(resolveTargetHours(null, 0)).toBeNull();
    expect(resolveTargetHours(undefined, undefined)).toBeNull();
  });
});

describe("deriveProgress", () => {
  it("scales logged hours against the course duration", () => {
    const r = deriveProgress({ hoursLogged: 6, status: "in_progress", durationHours: 12 });
    expect(r.progress).toBe(50);
    expect(r.progressKnown).toBe(true);
    expect(r.targetHours).toBe(12);
  });

  it("never reaches 100 from hours alone — completion must be explicit", () => {
    const r = deriveProgress({ hoursLogged: 40, status: "in_progress", durationHours: 12 });
    expect(r.progress).toBe(99);
  });

  it("reports 0% for a started course with nothing logged yet", () => {
    const r = deriveProgress({ hoursLogged: 0, status: "in_progress", durationHours: 500 });
    expect(r.progress).toBe(0);
  });

  it("floors a small first entry at 1% so it does not round away to nothing", () => {
    // 0.5h of a 500h course rounds to 0% — show 1% instead, so logging is visibly felt.
    const r = deriveProgress({ hoursLogged: 0.5, status: "in_progress", durationHours: 500 });
    expect(r.progress).toBe(1);
  });

  it("reports 100 for a completed course regardless of hours logged", () => {
    const r = deriveProgress({ hoursLogged: 0, status: "completed", durationHours: 12 });
    expect(r.progress).toBe(100);
  });

  it("reports 0 for a course that has not been started", () => {
    const r = deriveProgress({ hoursLogged: 0, status: "not_started", durationHours: 12 });
    expect(r.progress).toBe(0);
  });

  it("flags progress as unknown when the course has no duration or CPD hours", () => {
    const r = deriveProgress({ hoursLogged: 3, status: "in_progress", durationHours: null, cpdHours: 0 });
    expect(r.progressKnown).toBe(false);
    expect(r.targetHours).toBeNull();
  });

  it("uses CPD hours as the denominator when duration is missing", () => {
    const r = deriveProgress({ hoursLogged: 2, status: "in_progress", durationHours: null, cpdHours: 8 });
    expect(r.progress).toBe(25);
    expect(r.progressKnown).toBe(true);
  });

  it("treats negative or non-finite hours as zero", () => {
    expect(deriveProgress({ hoursLogged: -5, status: "in_progress", durationHours: 10 }).progress).toBe(0);
    expect(deriveProgress({ hoursLogged: NaN, status: "in_progress", durationHours: 10 }).progress).toBe(0);
  });
});

describe("deriveProgress with a learner override", () => {
  // The catalogue duration is a scraped estimate of total study time (Coursera's
  // free-text "workload"), which routinely overstates the real course length.
  it("prefers the learner's override over the catalogue duration", () => {
    const r = deriveProgress({
      hoursLogged: 4,
      status: "in_progress",
      durationHours: 16,
      cpdHours: 16,
      targetHoursOverride: 8,
    });
    expect(r.targetHours).toBe(8);
    expect(r.progress).toBe(50); // 4/8, not 4/16
  });

  it("falls back to the catalogue duration when the override is cleared", () => {
    const r = deriveProgress({
      hoursLogged: 4,
      status: "in_progress",
      durationHours: 16,
      targetHoursOverride: null,
    });
    expect(r.targetHours).toBe(16);
    expect(r.progress).toBe(25);
  });

  it("makes progress knowable for a course the catalogue gave no duration", () => {
    const r = deriveProgress({
      hoursLogged: 3,
      status: "in_progress",
      durationHours: null,
      cpdHours: 0,
      targetHoursOverride: 6,
    });
    expect(r.progressKnown).toBe(true);
    expect(r.progress).toBe(50);
  });

  it("ignores a zero or negative override", () => {
    expect(resolveTargetHours(16, 16, 0)).toBe(16);
    expect(resolveTargetHours(16, 16, -3)).toBe(16);
  });
});
