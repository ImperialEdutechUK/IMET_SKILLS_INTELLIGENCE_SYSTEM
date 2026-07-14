import { describe, it, expect } from "vitest";
import {
  matchesPreferredProvider,
  applyPreferences,
  readablePreferences,
  type PreferenceCourse,
} from "./recommendPreferences";
import type { CourseScore, ScoringGap } from "./scoring";

function gap(overrides: Partial<ScoringGap> = {}): ScoringGap {
  return {
    skillId: "s1",
    skill: "Google Analytics",
    currentLevel: 1,
    requiredLevel: 2,
    gapValue: 1,
    status: "NEEDS_IMPROVEMENT",
    priorityScore: 40,
    ...overrides,
  };
}

function score(courseId: string, normalized: number, overrides: Partial<CourseScore> = {}): CourseScore {
  return {
    courseId,
    title: courseId,
    rawScore: normalized,
    normalized,
    matchLabel: normalized >= 75 ? "high" : "good",
    breakdown: [],
    coveredGaps: [gap()],
    gapPriorityScore: 40,
    relevanceRatio: 1,
    qualityScore: 0,
    reason: "covers a gap",
    ...overrides,
  };
}

function course(overrides: Partial<PreferenceCourse> = {}): PreferenceCourse {
  return { provider: null, source: "internal", level: null, durationHours: null, cpdHours: 0, ...overrides };
}

describe("matchesPreferredProvider", () => {
  it("matches by provider name and its aliases", () => {
    expect(matchesPreferredProvider("Microsoft Learn", "internal", ["microsoft"])).toBe(true);
    expect(matchesPreferredProvider("Azure Fundamentals", "internal", ["microsoft"])).toBe(true); // azure alias
    expect(matchesPreferredProvider("IBM SkillsBuild", "internal", ["ibm"])).toBe(true);
  });

  it("matches academic against iMET / edX", () => {
    expect(matchesPreferredProvider("iMET Academy", "internal", ["academic"])).toBe(true);
    expect(matchesPreferredProvider(null, "edx", ["academic"])).toBe(true);
  });

  it("returns false for no preference, empty, or non-match", () => {
    expect(matchesPreferredProvider("Coursera", "coursera", ["any"])).toBe(false);
    expect(matchesPreferredProvider("Coursera", "coursera", [])).toBe(false);
    expect(matchesPreferredProvider("Coursera", "coursera", ["microsoft"])).toBe(false);
  });
});

describe("applyPreferences", () => {
  it("leaves order by score when no preferences", () => {
    const scores = [score("A", 60), score("B", 55)];
    const map = new Map([["A", course()], ["B", course()]]);
    const out = applyPreferences(scores, map, {});
    expect(out.map((b) => b.score.courseId)).toEqual(["A", "B"]);
    expect(out[0].adjustedScore).toBe(60);
  });

  it("a preferred provider can overtake a slightly higher base score", () => {
    const scores = [score("A", 60), score("B", 55)];
    const map = new Map([
      ["A", course({ provider: "Coursera", source: "coursera" })],
      ["B", course({ provider: "Microsoft Learn", source: "internal" })],
    ]);
    const out = applyPreferences(scores, map, { providers: ["microsoft"] });
    expect(out[0].score.courseId).toBe("B"); // 55 + 12 = 67 > 60
    expect(out[0].preferenceMatches[0]).toContain("provider you prefer");
  });

  it("boosts and explains a short course when short time is preferred", () => {
    const scores = [score("A", 50)];
    const map = new Map([["A", course({ durationHours: 3 })]]);
    const out = applyPreferences(scores, map, { timeCommitment: "short" });
    expect(out[0].adjustedScore).toBe(58);
    expect(out[0].preferenceMatches.join(" ")).toContain("Short and focused (3h)");
  });

  it("penalises a long course when short time is preferred", () => {
    const scores = [score("A", 50)];
    const map = new Map([["A", course({ durationHours: 40 })]]);
    const out = applyPreferences(scores, map, { timeCommitment: "short" });
    expect(out[0].adjustedScore).toBe(44);
  });

  it("rewards a level-appropriate course when 'match my level' is chosen", () => {
    const scores = [score("A", 50, { coveredGaps: [gap({ currentLevel: 1 })] })];
    const map = new Map([["A", course({ level: "Intermediate" })]]);
    const out = applyPreferences(scores, map, { difficulty: "match" });
    expect(out[0].adjustedScore).toBe(58);
    expect(out[0].preferenceMatches.join(" ")).toContain("Basic level");
  });

  it("nudges CPD-bearing courses toward a certification goal", () => {
    const scores = [score("A", 50)];
    const map = new Map([["A", course({ cpdHours: 8 })]]);
    const out = applyPreferences(scores, map, { goal: "certification" });
    expect(out[0].adjustedScore).toBe(54);
    expect(out[0].preferenceMatches.join(" ")).toContain("8 CPD hours");
  });
});

describe("readablePreferences", () => {
  it("maps answer values to human labels for the AI payload", () => {
    const out = readablePreferences({ timeCommitment: "short", providers: ["microsoft", "ibm"], goal: "certification" });
    expect(out.timeCommitment).toBe("Short & focused");
    expect(out.preferredProviders).toEqual(["Microsoft", "IBM"]);
    expect(out.goal).toBe("Earn a certificate / CPD hours");
    // "difficulty" is no longer an asked question, so it isn't surfaced.
    expect(out.difficulty).toBeUndefined();
  });
});
