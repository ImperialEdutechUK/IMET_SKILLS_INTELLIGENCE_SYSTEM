import { describe, it, expect } from "vitest";
import { cpdRiskStatus } from "./cpd-risk";

// Mid-year reference: 2026-07-21 is day ~202 of 365 → ~55.3% of the year.
// Expected hours against a 40h target ≈ 22.1h by this date.
const MID_YEAR = new Date(2026, 6, 21);

describe("cpdRiskStatus (time-aware)", () => {
  it("does NOT flag an on-pace employee (Emma: 19h of 40h in July)", () => {
    const r = cpdRiskStatus(19, 40, MID_YEAR);
    expect(r.cpdProgress).toBe(48); // full-year progress still shown as 48%
    expect(r.status).toBeNull(); // but on-pace, so not flagged
    expect(r.pace).toBeGreaterThan(0.75);
  });

  it("flags an employee with zero hours mid-year as at_risk", () => {
    const r = cpdRiskStatus(0, 40, MID_YEAR);
    expect(r.status).toBe("at_risk");
  });

  it("flags a moderately-behind employee as attention", () => {
    // ~65% of the expected ~22.1h → pace between 0.5 and 0.75.
    const r = cpdRiskStatus(14, 40, MID_YEAR);
    expect(r.pace).toBeGreaterThanOrEqual(0.5);
    expect(r.pace).toBeLessThan(0.75);
    expect(r.status).toBe("attention");
  });

  it("never flags someone who already met the annual target", () => {
    const r = cpdRiskStatus(40, 40, MID_YEAR);
    expect(r.cpdProgress).toBe(100);
    expect(r.status).toBeNull();
  });

  it("does not flag anyone at the very start of the year (no time elapsed)", () => {
    const r = cpdRiskStatus(0, 40, new Date(2026, 0, 1));
    expect(r.status).toBeNull();
  });

  it("handles a zero/absent target without dividing by zero", () => {
    const r = cpdRiskStatus(0, 0, MID_YEAR);
    expect(r.cpdProgress).toBe(0);
    expect(r.status).toBeNull();
  });
});
