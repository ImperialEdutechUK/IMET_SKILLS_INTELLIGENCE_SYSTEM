import { describe, it, expect } from "vitest";
import {
  levelToNumber,
  numberToLevel,
  classifyGap,
  scorePriority,
  courseLevelToNumber,
  courseLevelFit,
} from "./levels";

describe("levelToNumber", () => {
  it("maps canonical names to 0–4", () => {
    expect(levelToNumber("None")).toBe(0);
    expect(levelToNumber("Basic")).toBe(1);
    expect(levelToNumber("Intermediate")).toBe(2);
    expect(levelToNumber("Advanced")).toBe(3);
    expect(levelToNumber("Expert")).toBe(4);
  });

  it("is case-insensitive and handles common phrasings", () => {
    expect(levelToNumber("beginner")).toBe(1);
    expect(levelToNumber("PROFICIENT")).toBe(3);
    expect(levelToNumber("advanced user")).toBe(3);
  });

  it("clamps numbers into range (legacy 1–5 collapses gracefully)", () => {
    expect(levelToNumber(5)).toBe(4);
    expect(levelToNumber(-2)).toBe(0);
    expect(levelToNumber(2)).toBe(2);
  });

  it("falls back for unknown/empty input", () => {
    expect(levelToNumber("")).toBe(0);
    expect(levelToNumber(null)).toBe(0);
    expect(levelToNumber("banana", 1)).toBe(1);
  });
});

describe("numberToLevel", () => {
  it("round-trips", () => {
    expect(numberToLevel(0)).toBe("None");
    expect(numberToLevel(2)).toBe("Intermediate");
    expect(numberToLevel(4)).toBe("Expert");
  });
});

describe("classifyGap", () => {
  it("MEETS_REQUIREMENT when current >= required", () => {
    expect(classifyGap("Intermediate", "Advanced").status).toBe("MEETS_REQUIREMENT");
    expect(classifyGap(2, 2).status).toBe("MEETS_REQUIREMENT");
  });

  it("NEEDS_IMPROVEMENT for a gap of exactly 1", () => {
    const r = classifyGap("Intermediate", "Basic");
    expect(r.gapValue).toBe(1);
    expect(r.status).toBe("NEEDS_IMPROVEMENT");
  });

  it("CRITICAL_GAP for a gap of 2+", () => {
    expect(classifyGap("Expert", "Basic").status).toBe("CRITICAL_GAP");
  });

  it("MISSING_SKILL when the current level is missing or 0 and a level is required", () => {
    expect(classifyGap("Intermediate", null).status).toBe("MISSING_SKILL");
    expect(classifyGap("Basic", 0).status).toBe("MISSING_SKILL");
  });

  it("MEETS_REQUIREMENT when nothing is required", () => {
    expect(classifyGap("None", null).status).toBe("MEETS_REQUIREMENT");
    expect(classifyGap(0, 0).status).toBe("MEETS_REQUIREMENT");
  });

  it("reproduces the Amali example", () => {
    // Google Analytics: required Intermediate, current Basic → needs improvement
    expect(classifyGap("Intermediate", "Basic").status).toBe("NEEDS_IMPROVEMENT");
    // Campaign Reporting: required Intermediate, current Basic → needs improvement
    expect(classifyGap("Intermediate", "Basic").status).toBe("NEEDS_IMPROVEMENT");
    // AI Marketing: required Basic, current Basic → meets
    expect(classifyGap("Basic", "Basic").status).toBe("MEETS_REQUIREMENT");
  });
});

describe("scorePriority", () => {
  it("scores a met requirement as zero / LOW", () => {
    const r = scorePriority({ status: "MEETS_REQUIREMENT", gapValue: 0, importance: "HIGH", confidence: 1 });
    expect(r.priorityScore).toBe(0);
    expect(r.priority).toBe("LOW");
  });

  it("ranks a critical missing high-importance skill above a minor gap", () => {
    const critical = scorePriority({ status: "MISSING_SKILL", gapValue: 3, importance: "CRITICAL", confidence: 1 });
    const minor = scorePriority({ status: "NEEDS_IMPROVEMENT", gapValue: 1, importance: "LOW", confidence: 0.5 });
    expect(critical.priorityScore).toBeGreaterThan(minor.priorityScore);
    expect(critical.priority).toBe("CRITICAL");
  });

  it("factors department priority into the score", () => {
    const base = scorePriority({ status: "NEEDS_IMPROVEMENT", gapValue: 1, importance: "MEDIUM", confidence: 1 });
    const boosted = scorePriority({ status: "NEEDS_IMPROVEMENT", gapValue: 1, importance: "MEDIUM", confidence: 1, departmentPriority: 10 });
    expect(boosted.priorityScore).toBe(base.priorityScore + 10);
  });
});

describe("courseLevel helpers", () => {
  it("maps free-text course levels", () => {
    expect(courseLevelToNumber("Beginner")).toBe(1);
    expect(courseLevelToNumber("Introduction to X")).toBe(1);
    expect(courseLevelToNumber("Intermediate")).toBe(2);
    expect(courseLevelToNumber("Advanced")).toBe(3);
    expect(courseLevelToNumber("Unknown")).toBe(null);
  });

  it("judges suitability by the employee level", () => {
    expect(courseLevelFit(1, 1)).toBe("suitable"); // Basic → Beginner
    expect(courseLevelFit(1, 2)).toBe("suitable"); // Basic → Intermediate
    expect(courseLevelFit(1, 3)).toBe("tooAdvanced"); // Basic → Advanced
    expect(courseLevelFit(2, 3)).toBe("suitable"); // Intermediate → Advanced
  });
});
