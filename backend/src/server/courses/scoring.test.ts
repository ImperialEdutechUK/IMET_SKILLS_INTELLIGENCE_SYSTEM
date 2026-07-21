import { describe, it, expect } from "vitest";
import {
  scoreCourse,
  rankCourses,
  computeQualityScore,
  gapCoveragePoints,
  selectDiverseTop,
  compareCourseScore,
  MAX_QUALITY_BONUS,
  SCORE,
  type ScoringGap,
  type ScoringCourse,
  type CourseScore,
} from "./scoring";

const gaGap: ScoringGap = {
  skillId: "ga",
  skill: "Google Analytics",
  currentLevel: 1,
  requiredLevel: 2,
  gapValue: 1,
  status: "NEEDS_IMPROVEMENT",
  priorityScore: 64,
};
const crGap: ScoringGap = {
  skillId: "cr",
  skill: "Campaign Reporting",
  currentLevel: 1,
  requiredLevel: 2,
  gapValue: 1,
  status: "NEEDS_IMPROVEMENT",
  priorityScore: 64,
};

function course(partial: Partial<ScoringCourse> & Pick<ScoringCourse, "id" | "skillIds">): ScoringCourse {
  return {
    title: partial.title ?? partial.id,
    level: partial.level ?? "Beginner",
    durationHours: partial.durationHours ?? 6,
    approved: partial.approved ?? true,
    preferredProvider: partial.preferredProvider ?? false,
    availableToOrg: partial.availableToOrg ?? false,
    ...partial,
  };
}

describe("scoreCourse", () => {
  it("returns null when the course covers no outstanding gap", () => {
    const c = course({ id: "x", skillIds: ["unrelated"] });
    expect(scoreCourse(c, [gaGap])).toBeNull();
  });

  it("awards points for covering a gap, scaled by that gap's priority", () => {
    const c = course({ id: "x", skillIds: ["ga"], level: "Beginner", durationHours: null, approved: true });
    const s = scoreCourse(c, [gaGap])!;
    const expected = gapCoveragePoints(gaGap);
    expect(s.breakdown.find((b) => b.code === "COVERS_GAP")?.points).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it("gives a higher-priority gap more coverage points than a low-priority one", () => {
    const criticalGap: ScoringGap = {
      skillId: "sec", skill: "Cloud Security", currentLevel: 0, requiredLevel: 4,
      gapValue: 4, status: "CRITICAL_GAP", priorityScore: 150,
    };
    const minorGap: ScoringGap = {
      skillId: "note", skill: "Note Taking", currentLevel: 3, requiredLevel: 4,
      gapValue: 1, status: "NEEDS_IMPROVEMENT", priorityScore: 20,
    };
    const critical = scoreCourse(course({ id: "c1", skillIds: ["sec"], level: "Beginner", durationHours: null }), [criticalGap])!;
    const minor = scoreCourse(course({ id: "c2", skillIds: ["note"], level: "Advanced", durationHours: null }), [minorGap])!;
    const criticalPoints = critical.breakdown.find((b) => b.code === "COVERS_GAP")!.points;
    const minorPoints = minor.breakdown.find((b) => b.code === "COVERS_GAP")!.points;
    expect(criticalPoints).toBeGreaterThan(minorPoints);
  });

  it("awards +20 for covering more than one gap", () => {
    const c = course({ id: "x", skillIds: ["ga", "cr"], level: "Intermediate" });
    const s = scoreCourse(c, [gaGap, crGap])!;
    expect(s.coveredGaps).toHaveLength(2);
    expect(s.breakdown.some((b) => b.code === "MULTI_GAP")).toBe(true);
  });

  it("awards +15 when the level suits the learner and penalises too-advanced courses", () => {
    const suitable = scoreCourse(course({ id: "s", skillIds: ["ga"], level: "Beginner", durationHours: null }), [gaGap])!;
    expect(suitable.breakdown.some((b) => b.code === "LEVEL_SUITABLE")).toBe(true);

    const advanced = scoreCourse(course({ id: "a", skillIds: ["ga"], level: "Advanced", durationHours: null }), [gaGap])!;
    expect(advanced.breakdown.some((b) => b.code === "TOO_ADVANCED")).toBe(true);
  });

  it("penalises unapproved courses by -30", () => {
    const s = scoreCourse(course({ id: "x", skillIds: ["ga"], level: "Beginner", durationHours: null, approved: false }), [gaGap])!;
    expect(s.breakdown.find((b) => b.code === "NOT_APPROVED")?.points).toBe(SCORE.NOT_APPROVED);
  });

  it("adds duration, preferred-provider and availability bonuses", () => {
    const s = scoreCourse(
      course({ id: "x", skillIds: ["ga"], level: "Beginner", durationHours: 6, preferredProvider: true, availableToOrg: true }),
      [gaGap]
    )!;
    expect(s.breakdown.some((b) => b.code === "DURATION_REASONABLE")).toBe(true);
    expect(s.breakdown.some((b) => b.code === "PREFERRED_PROVIDER")).toBe(true);
    expect(s.breakdown.some((b) => b.code === "AVAILABLE_TO_ORG")).toBe(true);
  });

  it("normalises the score to 0–100 and labels high matches", () => {
    const s = scoreCourse(
      course({ id: "x", skillIds: ["ga", "cr"], level: "Intermediate", durationHours: 10, preferredProvider: true, availableToOrg: true }),
      [gaGap, crGap]
    )!;
    // Both gaps + level fit + duration + provider + availability comfortably
    // saturate the 0–100 scale for this well-served, well-fitting course.
    expect(s.rawScore).toBeGreaterThanOrEqual(100);
    expect(s.normalized).toBe(100);
    expect(s.matchLabel).toBe("high");
  });

  it("builds a multi-gap reason naming the skills", () => {
    const s = scoreCourse(course({ id: "x", skillIds: ["ga", "cr"], level: "Intermediate" }), [gaGap, crGap])!;
    expect(s.reason).toContain("Google Analytics");
    expect(s.reason).toContain("Campaign Reporting");
  });
});

describe("rankCourses — Amali scenario", () => {
  const courses: ScoringCourse[] = [
    course({ id: "maf", title: "Marketing Analytics Foundation", skillIds: ["ga", "cr"], level: "Intermediate", durationHours: 10, preferredProvider: true, availableToOrg: true }),
    course({ id: "gab", title: "Google Analytics for Beginners", skillIds: ["ga"], level: "Beginner", durationHours: 6, availableToOrg: true }),
    course({ id: "brw", title: "Business Report Writing", skillIds: ["cr"], level: "Beginner", durationHours: 5 }),
    course({ id: "irrelevant", title: "Advanced Machine Learning", skillIds: ["ml"], level: "Advanced", durationHours: 40 }),
  ];

  it("recommends the expected three courses in the expected order", () => {
    const ranked = rankCourses(courses, [gaGap, crGap]);
    expect(ranked.map((r) => r.title)).toEqual([
      "Marketing Analytics Foundation",
      "Google Analytics for Beginners",
      "Business Report Writing",
    ]);
  });

  it("puts the multi-gap course first with the highest score", () => {
    const ranked = rankCourses(courses, [gaGap, crGap]);
    expect(ranked[0].coveredGaps).toHaveLength(2);
    expect(ranked[0].normalized).toBe(100);
    expect(ranked[0].matchLabel).toBe("high");
  });

  it("excludes courses that cover no gap", () => {
    const ranked = rankCourses(courses, [gaGap, crGap]);
    expect(ranked.some((r) => r.title === "Advanced Machine Learning")).toBe(false);
  });
});

describe("computeQualityScore", () => {
  it("is 0 with no rating or enrollments", () => {
    expect(computeQualityScore(null, 0)).toBe(0);
    expect(computeQualityScore(undefined)).toBe(0);
  });

  it("scales with rating and is capped at MAX_QUALITY_BONUS", () => {
    expect(computeQualityScore(5, 0)).toBe(8); // full rating → 8 of the 0–8 band
    expect(computeQualityScore(2.5, 0)).toBe(4);
    expect(computeQualityScore(5, 1_000_000)).toBeLessThanOrEqual(MAX_QUALITY_BONUS);
  });

  it("gives a small reach bonus for enrollments", () => {
    expect(computeQualityScore(0, 99)).toBeCloseTo(2, 5); // log10(100) = 2, the reach cap
    expect(computeQualityScore(5, 99)).toBe(MAX_QUALITY_BONUS); // 8 + 2 = 10
  });
});

describe("rankCourses — quality & relevance tie-breaks", () => {
  it("prefers the higher-rated course when fit is otherwise identical", () => {
    const lowRated = course({ id: "low", title: "AAA Course", skillIds: ["ga"], level: "Beginner", rating: 3.0 });
    const highRated = course({ id: "high", title: "ZZZ Course", skillIds: ["ga"], level: "Beginner", rating: 4.8 });
    const ranked = rankCourses([lowRated, highRated], [gaGap]);
    // Same score, priority, gap count and relevance — quality decides, beating
    // the alphabetical fallback that would otherwise put "AAA Course" first.
    expect(ranked[0].title).toBe("ZZZ Course");
  });

  it("prefers the more focused course over one that covers the gap only incidentally", () => {
    const focused = course({ id: "focused", title: "ZZZ Focused", skillIds: ["ga"], level: "Beginner" });
    const broad = course({ id: "broad", title: "AAA Broad", skillIds: ["ga", "off1", "off2"], level: "Beginner" });
    const ranked = rankCourses([focused, broad], [gaGap]);
    // Both cover exactly the "ga" gap with equal score, but the focused course
    // spends all its skills on what the learner needs — it wins on relevance.
    expect(ranked[0].title).toBe("ZZZ Focused");
    expect(ranked[0].relevanceRatio).toBeGreaterThan(ranked[1].relevanceRatio);
  });
});

describe("selectDiverseTop", () => {
  const sqlGap: ScoringGap = {
    skillId: "sql", skill: "SQL", currentLevel: 0, requiredLevel: 3,
    gapValue: 3, status: "CRITICAL_GAP", priorityScore: 120,
  };

  it("gives an under-served CRITICAL gap a slot instead of letting an over-served gap take every slot", () => {
    // Five well-rounded, multi-gap Excel/reporting courses all outscore the
    // single course covering the learner's separate CRITICAL SQL gap.
    const excelCourses: ScoringCourse[] = Array.from({ length: 5 }, (_, i) =>
      course({
        id: `excel-${i}`,
        title: `Excel Course ${i}`,
        skillIds: ["ga", "cr"],
        level: "Intermediate",
        durationHours: 10,
        preferredProvider: true,
        availableToOrg: true,
      })
    );
    const sqlCourse = course({ id: "sql-1", title: "SQL Fundamentals", skillIds: ["sql"], level: "Beginner" });
    const gaps = [gaGap, crGap, sqlGap];

    const ranked = rankCourses([...excelCourses, sqlCourse], gaps);
    // Without diversification the SQL course falls outside a naive top-3 slice.
    const naiveTop3 = ranked.slice(0, 3);
    expect(naiveTop3.some((r) => r.courseId === "sql-1")).toBe(false);

    const diverse = selectDiverseTop(ranked, gaps, 3, (r) => r.coveredGaps.map((g) => g.skillId), compareCourseScore);
    expect(diverse).toHaveLength(3);
    expect(diverse.some((r) => r.courseId === "sql-1")).toBe(true);
  });

  it("is a no-op when there are already fewer items than the limit", () => {
    const ranked = rankCourses(
      [course({ id: "a", skillIds: ["ga"], level: "Beginner" })],
      [gaGap]
    );
    const diverse = selectDiverseTop(ranked, [gaGap], 5, (r) => r.coveredGaps.map((g) => g.skillId), compareCourseScore);
    expect(diverse).toEqual(ranked);
  });

  it("never returns more than the requested limit or invents items", () => {
    const items: CourseScore[] = rankCourses(
      [
        course({ id: "a", skillIds: ["ga"], level: "Beginner" }),
        course({ id: "b", skillIds: ["cr"], level: "Beginner" }),
        course({ id: "c", skillIds: ["ga", "cr"], level: "Beginner" }),
      ],
      [gaGap, crGap]
    );
    const diverse = selectDiverseTop(items, [gaGap, crGap], 2, (r) => r.coveredGaps.map((g) => g.skillId), compareCourseScore);
    expect(diverse.length).toBeLessThanOrEqual(2);
    for (const d of diverse) expect(items.map((i) => i.courseId)).toContain(d.courseId);
  });
});
