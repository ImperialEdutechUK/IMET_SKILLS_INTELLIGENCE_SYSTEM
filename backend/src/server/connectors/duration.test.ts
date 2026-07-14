import { describe, it, expect } from "vitest";
import { parseWorkload } from "./duration";

describe("parseWorkload", () => {
  // Strings sampled from the live Coursera catalogue.
  it("parses plain hour totals", () => {
    expect(parseWorkload("2 hours")).toBe(2);
    expect(parseWorkload("1.5 hours")).toBe(1.5);
    expect(parseWorkload("Approx. 15 hours to complete")).toBe(15);
  });

  it("sums hours and minutes", () => {
    expect(parseWorkload("1 hour 30 minutes")).toBe(1.5);
    expect(parseWorkload("4h 30m")).toBe(4.5);
    expect(parseWorkload("90 minutes")).toBe(1.5);
  });

  it("handles non-English hour tokens", () => {
    expect(parseWorkload("2 heures")).toBe(2);
    expect(parseWorkload("3 horas")).toBe(3);
    expect(parseWorkload("2 Stunden")).toBe(2);
  });

  it("multiplies weeks by a stated weekly rate", () => {
    expect(parseWorkload("4 weeks of study, 2-4 hours a week")).toBe(12);
    expect(parseWorkload("4 weeks of study, 1-2 hours/week")).toBe(6);
  });

  it("falls back to a documented weekly assumption when only weeks are given", () => {
    expect(parseWorkload("6 weeks")).toBe(18); // 6 × DEFAULT_HOURS_PER_WEEK
  });

  it("returns undefined for a weekly rate with no duration", () => {
    // "4-8 hours/week" for how many weeks? Unknowable — don't invent a total.
    expect(parseWorkload("4-8 hours/week")).toBeUndefined();
    expect(parseWorkload("3-5 hours/week")).toBeUndefined();
  });

  it("averages ranges", () => {
    expect(parseWorkload("2-4 hours")).toBe(3);
    expect(parseWorkload("1 to 2 hours")).toBe(1.5);
  });

  it("takes the first hour figure from prose", () => {
    expect(
      parseWorkload("Around 4 hours of videos in total, plus a final project requiring about 5 hours to complete.")
    ).toBe(4);
  });

  it("rejects empty, absent, and implausible values", () => {
    expect(parseWorkload(undefined)).toBeUndefined();
    expect(parseWorkload(null)).toBeUndefined();
    expect(parseWorkload("")).toBeUndefined();
    expect(parseWorkload("self-paced")).toBeUndefined();
    expect(parseWorkload(99_999)).toBeUndefined();
    expect(parseWorkload(-3)).toBeUndefined();
  });

  it("passes through numeric hours", () => {
    expect(parseWorkload(6)).toBe(6);
  });
});
