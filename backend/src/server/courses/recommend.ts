/**
 * Recommendation orchestration:
 *   gaps → candidate courses → deterministic scoring → (optional) AI explanation
 *        → persisted Recommendation rows.
 *
 * Only APPROVED, PUBLISHED courses from the catalogue are ever recommended.
 * The AI is called strictly after scoring and may only rephrase facts we pass
 * it — it cannot invent course details or reorder the ranking.
 */
import type { MatchLabel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { numberToLevel } from "@/lib/levels";
import { rankCourses, type ScoringGap, type ScoringCourse, type CourseScore } from "./scoring";
import { runGapAnalysis } from "@/server/gaps/gapAnalysis";
import { explainRecommendations } from "@/server/ai/skillExtraction";
import { isConfigured } from "@/server/ai/aiClient";

export class RecommendationError extends Error {}

export interface RecommendationRow {
  courseId: string;
  title: string;
  provider: string | null;
  source: string;
  externalUrl: string | null;
  level: string | null;
  cpdHours: number;
  matchScore: number;
  matchLabel: MatchLabel;
  rank: number;
  reason: string;
  reasonSource: "ai" | "engine";
  gapsCovered: { skill: string; from: string; to: string; status: string }[];
  breakdown: { code: string; label: string; points: number }[];
}

export interface GenerateResult {
  userId: string;
  employeeName: string;
  roleTitle: string | null;
  generated: number;
  aiExplained: boolean;
  recommendations: RecommendationRow[];
}

export interface GenerateOptions {
  limit?: number;
  explain?: boolean; // undefined → auto (on when AI configured)
  rerunGaps?: boolean;
}

async function loadGaps(userId: string, rerun: boolean): Promise<ScoringGap[]> {
  if (rerun) {
    await runGapAnalysis(userId);
  }
  let stored = await prisma.skillGap.findMany({
    where: { userId },
    include: { skill: true },
  });
  if (stored.length === 0 && !rerun) {
    // Auto-run once if nothing has been computed yet.
    await runGapAnalysis(userId);
    stored = await prisma.skillGap.findMany({ where: { userId }, include: { skill: true } });
  }
  return stored
    .filter((g) => g.status !== "MEETS_REQUIREMENT")
    .map((g) => ({
      skillId: g.skillId,
      skill: g.skill.name,
      currentLevel: g.currentLevel,
      requiredLevel: g.requiredLevel,
      gapValue: g.gapValue,
      status: g.status,
      priorityScore: g.priorityScore,
    }));
}

export async function generateRecommendations(
  userId: string,
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RecommendationError("Employee not found.");

  const limit = opts.limit ?? 6;
  const gaps = await loadGaps(userId, opts.rerunGaps ?? false);

  if (gaps.length === 0) {
    // No outstanding gaps → clear stale engine recs and return empty.
    await prisma.recommendation.deleteMany({ where: { userId, source: "engine" } });
    return {
      userId,
      employeeName: user.fullName,
      roleTitle: user.position ?? null,
      generated: 0,
      aiExplained: false,
      recommendations: [],
    };
  }

  const gapSkillIds = gaps.map((g) => g.skillId);
  const candidates = await prisma.course.findMany({
    where: {
      approved: true,
      status: "published",
      courseSkills: { some: { skillId: { in: gapSkillIds } } },
    },
    include: { courseSkills: true },
  });

  const scoringCourses: ScoringCourse[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    level: c.level,
    durationHours: c.durationHours,
    approved: c.approved,
    preferredProvider: c.preferredProvider,
    availableToOrg: c.availableToOrg,
    skillIds: c.courseSkills.map((cs) => cs.skillId),
  }));

  const ranked = rankCourses(scoringCourses, gaps).slice(0, limit);
  const courseById = new Map(candidates.map((c) => [c.id, c]));

  // Build fact payload + attempt AI explanation for the top few.
  const wantExplain = opts.explain ?? isConfigured();
  const gapBySkillId = new Map(gaps.map((g) => [g.skillId, g]));
  const gapsCoveredFor = (score: CourseScore) =>
    score.coveredGaps.map((g) => ({
      skill: g.skill,
      from: numberToLevel(g.currentLevel),
      to: numberToLevel(g.requiredLevel),
      status: g.status,
    }));

  let aiReasons: Record<string, string> | null = null;
  if (wantExplain && ranked.length > 0) {
    const payload = {
      employee: { name: user.fullName, role: user.position ?? "Unknown" },
      courses: ranked.slice(0, 5).map((score) => {
        const c = courseById.get(score.courseId)!;
        return {
          courseId: score.courseId,
          title: c.title,
          provider: c.provider,
          level: c.level,
          durationHours: c.durationHours,
          skillsCovered: gapsCoveredFor(score),
        };
      }),
    };
    aiReasons = await explainRecommendations(payload);
  }

  // Persist: refresh the engine-sourced recommendations for this user.
  const rows: RecommendationRow[] = ranked.map((score, i) => {
    const c = courseById.get(score.courseId)!;
    const aiReason = aiReasons?.[score.courseId];
    return {
      courseId: score.courseId,
      title: c.title,
      provider: c.provider,
      source: c.source,
      externalUrl: c.externalUrl,
      level: c.level,
      cpdHours: c.cpdHours,
      matchScore: score.normalized,
      matchLabel: score.matchLabel,
      rank: i + 1,
      reason: aiReason ?? score.reason,
      reasonSource: aiReason ? "ai" : "engine",
      gapsCovered: gapsCoveredFor(score),
      breakdown: score.breakdown.map((b) => ({ code: b.code, label: b.label, points: b.points })),
    };
  });

  await prisma.$transaction([
    prisma.recommendation.deleteMany({ where: { userId, source: "engine" } }),
    ...rows.map((r) =>
      prisma.recommendation.upsert({
        where: { userId_courseId: { userId, courseId: r.courseId } },
        update: {
          matchLabel: r.matchLabel,
          matchScore: r.matchScore,
          reason: r.reason,
          rawScore: r.breakdown.reduce((s, b) => s + b.points, 0),
          rank: r.rank,
          scoreBreakdown: r.breakdown as unknown as Prisma.InputJsonValue,
          gapsCovered: r.gapsCovered as unknown as Prisma.InputJsonValue,
          source: "engine",
          dismissed: false,
        },
        create: {
          userId,
          courseId: r.courseId,
          matchLabel: r.matchLabel,
          matchScore: r.matchScore,
          reason: r.reason,
          rawScore: r.breakdown.reduce((s, b) => s + b.points, 0),
          rank: r.rank,
          scoreBreakdown: r.breakdown as unknown as Prisma.InputJsonValue,
          gapsCovered: r.gapsCovered as unknown as Prisma.InputJsonValue,
          source: "engine",
        },
      })
    ),
  ]);

  return {
    userId,
    employeeName: user.fullName,
    roleTitle: user.position ?? null,
    generated: rows.length,
    aiExplained: !!aiReasons && rows.some((r) => r.reasonSource === "ai"),
    recommendations: rows,
  };
}

/** Read stored recommendations (used by GET /api/recommendations/:employeeId). */
export async function getRecommendations(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RecommendationError("Employee not found.");

  const recs = await prisma.recommendation.findMany({
    where: { userId, dismissed: false },
    orderBy: [{ rank: "asc" }, { matchScore: "desc" }],
    include: { course: { include: { category: true } } },
  });

  return {
    userId,
    employeeName: user.fullName,
    roleTitle: user.position ?? null,
    count: recs.length,
    recommendations: recs.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      title: r.course.title,
      provider: r.course.provider,
      source: r.course.source,
      category: r.course.category?.name ?? "General",
      level: r.course.level,
      cpdHours: r.course.cpdHours,
      rating: r.course.rating,
      externalUrl: r.course.externalUrl,
      matchScore: r.matchScore,
      matchLabel: r.matchLabel,
      rank: r.rank,
      reason: r.reason,
      gapsCovered: r.gapsCovered ?? [],
      scoreBreakdown: r.scoreBreakdown ?? [],
    })),
  };
}
