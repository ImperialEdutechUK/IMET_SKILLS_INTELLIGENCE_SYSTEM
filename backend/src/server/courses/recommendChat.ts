/**
 * Recommendation chat engine.
 *
 * A guided, preference-aware layer on top of the deterministic core. The chat
 * UI collects a few hard-coded preferences (time commitment, preferred brands,
 * goal, difficulty); this module:
 *
 *   1. (re)runs the deterministic GAP ANALYSIS for the employee — reflecting
 *      any freshly-uploaded skill matrix / CPD log / daily report,
 *   2. scores APPROVED, PUBLISHED catalogue courses against those gaps
 *      (deterministic), then applies preference-aware boosts,
 *   3. asks the AI (DeepSeek by default) to SELECT and EXPLAIN the top few from
 *      that safe candidate set — considering the job role, the documents (via
 *      the gaps they produced), and the stated preferences,
 *   4. persists them and returns display-ready rows.
 *
 * The AI can only choose from the candidate courseIds and may only phrase facts
 * we pass it — it never invents courses. If the AI is unavailable the engine
 * falls back to deterministic picks with template reasons.
 */
import { DocumentType, type MatchLabel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { numberToLevel, clampLevel, MAX_LEVEL } from "@/lib/levels";
import { rankCourses, type ScoringGap, type ScoringCourse, type CourseScore } from "./scoring";
import { runGapAnalysis, GapAnalysisError } from "@/server/gaps/gapAnalysis";
import { generateJson, isConfigured, activeProvider } from "@/server/ai/aiClient";
import {
  PREFERENCE_QUESTIONS,
  readablePreferences,
  applyPreferences,
  type ChatAnswers,
  type Boosted,
} from "./recommendPreferences";
import { z } from "zod";

export type { ChatAnswers } from "./recommendPreferences";
export { PREFERENCE_QUESTIONS } from "./recommendPreferences";

export class RecommendationChatError extends Error {}

export interface ChatRecommendation {
  rank: number;
  courseId: string;
  title: string;
  provider: string | null;
  source: string;
  category: string;
  level: string | null;
  durationHours: number | null;
  cpdHours: number;
  rating: number | null;
  externalUrl: string | null;
  matchScore: number;
  matchLabel: MatchLabel;
  reason: string;
  reasonSource: "ai" | "engine";
  gapsCovered: { skill: string; from: string; to: string }[];
  preferenceMatches: string[];
}

export interface ChatResult {
  userId: string;
  employeeName: string;
  roleTitle: string | null;
  aiProvider: string | null;
  aiExplained: boolean;
  generated: number;
  recommendations: ChatRecommendation[];
  /** Set when we could not produce recommendations (no role profile, no gaps, no courses). */
  note?: string;
}

interface GenerateOpts {
  answers?: ChatAnswers;
  limit?: number;
}

// ── Gap loading (with friendly notes instead of 500s) ─────────────────────────

async function loadGaps(userId: string): Promise<{ gaps: ScoringGap[] } | { note: string }> {
  try {
    // Recompute so freshly-uploaded documents are reflected in the gaps.
    await runGapAnalysis(userId);
  } catch (err) {
    if (err instanceof GapAnalysisError) return { note: err.message };
    throw err;
  }
  const stored = await prisma.skillGap.findMany({ where: { userId }, include: { skill: true } });
  const gaps = stored
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
  return { gaps };
}

// ── Fallback when there's no role profile ─────────────────────────────────────
//
// Gap analysis needs the role's *required* skill levels (a RoleProfile, set up
// by a manager/admin) to compare against. When that doesn't exist yet we can't
// compute true gaps — but we can still help by treating the employee's own
// recorded skills as things to deepen, and, failing even that, by surfacing
// solid catalogue picks. These paths always carry a note nudging the employee
// (or their manager) toward the inputs that sharpen the results.

const FALLBACK_SKILLS_NOTE =
  "Heads up: I don't have a full role profile for your position yet, so these picks " +
  "are based on the skills already on your record rather than your role's specific " +
  "requirements. For sharper, gap-targeted recommendations, upload your Skills Matrix, " +
  "CPD Log or Daily Report — or ask your manager to set up your role profile.";

const FALLBACK_BROAD_NOTE =
  "Heads up: I don't have a role profile or any recorded skills for you yet, so these " +
  "are solid, well-rated starting points rather than tailored picks. Upload your Skills " +
  "Matrix, CPD Log or Daily Report — or ask your manager to set up your role profile — " +
  "and I'll tailor these to close your specific gaps.";

/**
 * Synthesise "improvement gaps" from the employee's own recorded skills, used
 * when there is no role profile to compute real gaps against. Each skill below
 * the ceiling becomes a gap to move one level up (or toward its target level).
 */
async function loadFallbackGaps(userId: string): Promise<ScoringGap[]> {
  const userSkills = await prisma.userSkill.findMany({ where: { userId }, include: { skill: true } });
  const gaps: ScoringGap[] = [];
  for (const us of userSkills) {
    const currentLevel = clampLevel(us.currentLevel);
    if (currentLevel >= MAX_LEVEL) continue; // already at the ceiling — nothing to target
    const requiredLevel = Math.min(MAX_LEVEL, Math.max(currentLevel + 1, clampLevel(us.targetLevel)));
    const gapValue = requiredLevel - currentLevel;
    gaps.push({
      skillId: us.skillId,
      skill: us.skill.name,
      currentLevel,
      requiredLevel,
      gapValue,
      status: gapValue >= 2 ? "CRITICAL_GAP" : "NEEDS_IMPROVEMENT",
      priorityScore: gapValue * 30,
    });
  }
  return gaps;
}

// ── AI selection + explanation ────────────────────────────────────────────────

const aiSelectionSchema = z.object({
  recommendations: z
    .array(z.object({ courseId: z.string(), reason: z.string().min(1) }))
    .default([]),
});

function selectionPrompt(payload: unknown, limit: number): string {
  return `You are a learning & development advisor helping an employee pick their next course.

Choose the ${limit} BEST courses for this employee from the candidateCourses list below.

STRICT RULES:
- Choose ONLY from the provided candidateCourses. Use each course's exact "courseId".
- Never invent courses, providers, durations, levels, or skills. Use only the facts given.
- RELEVANCE FIRST: two courses can teach the same skill for very different audiences.
  Read each course's title and description and prefer the one whose subject and intended
  audience actually fit THIS employee's role. Down-rank a course that closes the skill gap
  only incidentally while being aimed at a different profession (e.g. a general
  cybersecurity course for a security team vs. an AI-agent course for an AI developer),
  even if its skill tags match. When two courses fit the role equally well, prefer the
  higher "rating".
- Order best-first. Return at most ${limit}.
- For each pick write a 1–2 sentence "reason" in plain, encouraging English that ties the
  course to (a) the employee's ROLE, (b) the specific skill GAP(s) it closes, and (c) the
  employee's stated PREFERENCES where relevant. Do not mention scores, algorithms, or JSON.

DATA:
${JSON.stringify(payload, null, 2)}

Return STRICT JSON ONLY of this exact shape (no markdown, no commentary):
{ "recommendations": [ { "courseId": string, "reason": string } ] }`;
}

// ── Candidate course shape ────────────────────────────────────────────────────

interface CandidateCourse {
  id: string;
  title: string;
  description: string | null;
  provider: string | null;
  source: string;
  externalUrl: string | null;
  level: string | null;
  durationHours: number | null;
  cpdHours: number;
  rating: number | null;
  enrollmentCount: number;
  category: string;
  approved: boolean;
  preferredProvider: boolean;
  availableToOrg: boolean;
  skillIds: string[];
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generateChatRecommendations(
  userId: string,
  opts: GenerateOpts = {}
): Promise<ChatResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RecommendationChatError("Employee not found.");

  const answers = opts.answers ?? {};
  const limit = Math.min(Math.max(opts.limit ?? 4, 1), 6);
  const provider = activeProvider();

  const base = {
    userId,
    employeeName: user.fullName,
    roleTitle: user.position ?? null,
    aiProvider: provider,
    aiExplained: false,
    generated: 0,
    recommendations: [] as ChatRecommendation[],
  };

  // Resolve gaps. Prefer the role-profile-driven analysis; if that can't run
  // (no role profile / requirements / position for this employee), fall back to
  // their own recorded skills so we still recommend something useful.
  let gaps: ScoringGap[];
  let generalNote: string | undefined;

  const gapResult = await loadGaps(userId);
  if ("note" in gapResult) {
    gaps = await loadFallbackGaps(userId);
    if (gaps.length === 0) {
      // Nothing personal to go on — surface solid catalogue picks instead.
      return broadRecommendations(userId, base, limit);
    }
    generalNote = FALLBACK_SKILLS_NOTE;
  } else {
    gaps = gapResult.gaps;
    if (gaps.length === 0) {
      await prisma.recommendation.deleteMany({ where: { userId, source: "ai" } });
      return {
        ...base,
        note: "You're meeting all of your role's skill requirements right now — no gaps to target. Upload a fresh skill matrix, CPD log or daily report and I'll re-check.",
      };
    }
  }

  const gapSkillIds = gaps.map((g) => g.skillId);
  const rows = await prisma.course.findMany({
    where: {
      approved: true,
      status: "published",
      courseSkills: { some: { skillId: { in: gapSkillIds } } },
    },
    include: { courseSkills: true, category: true, _count: { select: { enrollments: true } } },
  });

  if (rows.length === 0) {
    return {
      ...base,
      note:
        generalNote ??
        "I found skill gaps for your role, but there aren't any approved courses in the catalogue that cover them yet. Ask your L&D team to add or approve some.",
    };
  }

  const candidates: CandidateCourse[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    provider: c.provider,
    source: c.source,
    externalUrl: c.externalUrl,
    level: c.level,
    durationHours: c.durationHours,
    cpdHours: c.cpdHours,
    rating: c.rating,
    enrollmentCount: c._count.enrollments,
    category: c.category?.name ?? "General",
    approved: c.approved,
    preferredProvider: c.preferredProvider,
    availableToOrg: c.availableToOrg,
    skillIds: c.courseSkills.map((cs) => cs.skillId),
  }));
  const courseById = new Map(candidates.map((c) => [c.id, c]));

  const scoringCourses: ScoringCourse[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    level: c.level,
    durationHours: c.durationHours,
    approved: c.approved,
    preferredProvider: c.preferredProvider,
    availableToOrg: c.availableToOrg,
    skillIds: c.skillIds,
    rating: c.rating,
    enrollmentCount: c.enrollmentCount,
  }));

  const ranked = rankCourses(scoringCourses, gaps);
  const boosted = applyPreferences(ranked, courseById, answers).slice(0, Math.max(limit * 2, 8));
  if (boosted.length === 0) {
    return { ...base, note: "No suitable approved courses matched your skill gaps." };
  }

  const gapsCoveredFor = (score: CourseScore) =>
    score.coveredGaps.map((g) => ({
      skill: g.skill,
      from: numberToLevel(g.currentLevel),
      to: numberToLevel(g.requiredLevel),
    }));

  // Ask the AI to pick + explain from the safe candidate pool.
  let aiReasons: Record<string, string> | null = null;
  let aiOrder: string[] | null = null;
  if (isConfigured()) {
    const payload = {
      employee: { name: user.fullName, role: user.position ?? "Unknown" },
      preferences: readablePreferences(answers),
      skillGaps: gaps.map((g) => ({
        skill: g.skill,
        current: numberToLevel(g.currentLevel),
        required: numberToLevel(g.requiredLevel),
        status: g.status,
      })),
      candidateCourses: boosted.map((b) => {
        const c = courseById.get(b.score.courseId)!;
        return {
          courseId: c.id,
          title: c.title,
          description: c.description ? c.description.slice(0, 300) : null,
          provider: c.provider,
          level: c.level,
          durationHours: c.durationHours,
          cpdHours: c.cpdHours,
          rating: c.rating,
          category: c.category,
          addressesSkillGaps: b.score.coveredGaps.map((g) => g.skill),
          matchesYourPreferences: b.preferenceMatches,
        };
      }),
    };
    try {
      const parsed = aiSelectionSchema.safeParse(
        // Generous cap so reasoning models (e.g. deepseek-v4-pro) have room to
        // think AND still emit the JSON answer; non-reasoning models stop early.
        await generateJson(selectionPrompt(payload, limit), { temperature: 0.3, maxOutputTokens: 4000 })
      );
      if (parsed.success) {
        const valid = parsed.data.recommendations.filter((r) => courseById.has(r.courseId));
        if (valid.length > 0) {
          aiReasons = Object.fromEntries(valid.map((r) => [r.courseId, r.reason]));
          aiOrder = valid.map((r) => r.courseId);
        }
      }
    } catch {
      // Fall back to deterministic ordering + template reasons.
    }
  }

  // Final ordering: AI order if we have it, else the boosted deterministic order.
  const boostedById = new Map(boosted.map((b) => [b.score.courseId, b]));
  const orderedIds = (aiOrder ?? boosted.map((b) => b.score.courseId))
    .filter((id) => boostedById.has(id))
    .slice(0, limit);

  const recommendations: ChatRecommendation[] = orderedIds.map((id, i) => {
    const b = boostedById.get(id)!;
    const c = courseById.get(id)!;
    const aiReason = aiReasons?.[id];
    const prefNote = b.preferenceMatches[0] ? ` ${b.preferenceMatches[0]}.` : "";
    return {
      rank: i + 1,
      courseId: id,
      title: c.title,
      provider: c.provider,
      source: c.source,
      category: c.category,
      level: c.level,
      durationHours: c.durationHours,
      cpdHours: c.cpdHours,
      rating: c.rating,
      externalUrl: c.externalUrl,
      matchScore: b.score.normalized,
      matchLabel: b.score.matchLabel,
      reason: aiReason ?? `${b.score.reason}${prefNote}`,
      reasonSource: aiReason ? "ai" : "engine",
      gapsCovered: gapsCoveredFor(b.score),
      preferenceMatches: b.preferenceMatches,
    };
  });

  await persistChatRecommendations(userId, recommendations);

  return {
    ...base,
    aiExplained: !!aiReasons,
    generated: recommendations.length,
    recommendations,
    note: generalNote,
  };
}

// ── Broad picks (no role profile AND no recorded skills) ──────────────────────

/**
 * Last-resort recommendations: the employee has neither a role profile nor any
 * recorded skills, so there are no gaps at all. Surface solid, well-rated
 * approved courses so the advisor is never a dead end, with a note explaining
 * how to get tailored picks.
 */
async function broadRecommendations(
  userId: string,
  base: Omit<ChatResult, "note">,
  limit: number
): Promise<ChatResult> {
  const rows = await prisma.course.findMany({
    where: { approved: true, status: "published" },
    include: { category: true },
    orderBy: [
      { rating: { sort: "desc", nulls: "last" } },
      { availableToOrg: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });

  if (rows.length === 0) {
    return {
      ...base,
      note: "There aren't any approved courses in the catalogue yet. Ask your L&D team to add some.",
    };
  }

  const recommendations: ChatRecommendation[] = rows.map((c, i) => ({
    rank: i + 1,
    courseId: c.id,
    title: c.title,
    provider: c.provider,
    source: c.source,
    category: c.category?.name ?? "General",
    level: c.level,
    durationHours: c.durationHours,
    cpdHours: c.cpdHours,
    rating: c.rating,
    externalUrl: c.externalUrl,
    matchScore: 50,
    matchLabel: "good",
    reason: `A well-rated ${c.category?.name ?? "professional"} course to get you started while I learn more about your role and skills.`,
    reasonSource: "engine",
    gapsCovered: [],
    preferenceMatches: [],
  }));

  await persistChatRecommendations(userId, recommendations);

  return {
    ...base,
    generated: recommendations.length,
    recommendations,
    note: FALLBACK_BROAD_NOTE,
  };
}

// ── Persistence (shared by every path) ────────────────────────────────────────

/**
 * Persist the chat's picks as AI-sourced recommendations, replacing any earlier
 * ones no longer in the set. Kept separate from manager-run `engine` recs so the
 * two coexist. Bounded: at most `limit` (≤ 6) rows per employee — upserted, not
 * accumulated — so this never grows the table per run.
 */
async function persistChatRecommendations(userId: string, recommendations: ChatRecommendation[]) {
  const newIds = recommendations.map((r) => r.courseId);
  await prisma.$transaction(
    [
    prisma.recommendation.deleteMany({ where: { userId, source: "ai", courseId: { notIn: newIds } } }),
    ...recommendations.map((r) =>
      prisma.recommendation.upsert({
        where: { userId_courseId: { userId, courseId: r.courseId } },
        update: {
          matchLabel: r.matchLabel,
          matchScore: r.matchScore,
          reason: r.reason,
          rank: r.rank,
          gapsCovered: r.gapsCovered as unknown as Prisma.InputJsonValue,
          source: "ai",
          dismissed: false,
        },
        create: {
          userId,
          courseId: r.courseId,
          matchLabel: r.matchLabel,
          matchScore: r.matchScore,
          reason: r.reason,
          rank: r.rank,
          gapsCovered: r.gapsCovered as unknown as Prisma.InputJsonValue,
          source: "ai",
        },
      })
    ),
    ],
    // Remote-DB latency headroom so N upserts can't expire the default 5s tx (P2028).
    { timeout: 15000 }
  );
}

/** Read this employee's stored chat recommendations in display order. */
async function loadStoredRecommendations(userId: string): Promise<ChatRecommendation[]> {
  const recs = await prisma.recommendation.findMany({
    where: { userId, source: "ai", dismissed: false },
    orderBy: [{ rank: "asc" }, { matchScore: "desc" }],
    include: { course: { include: { category: true } } },
  });
  return recs.map((r) => ({
    rank: r.rank ?? 0,
    courseId: r.courseId,
    title: r.course.title,
    provider: r.course.provider,
    source: r.course.source,
    category: r.course.category?.name ?? "General",
    level: r.course.level,
    durationHours: r.course.durationHours,
    cpdHours: r.course.cpdHours,
    rating: r.course.rating,
    externalUrl: r.course.externalUrl,
    matchScore: r.matchScore,
    matchLabel: r.matchLabel,
    reason: r.reason,
    reasonSource: "engine",
    gapsCovered: (r.gapsCovered as { skill: string; from: string; to: string }[] | null) ?? [],
    preferenceMatches: [],
  }));
}

// ── Context for the chat's opening screen ─────────────────────────────────────

const EMPLOYEE_DOC_TYPES: DocumentType[] = [
  DocumentType.SKILL_MATRIX,
  DocumentType.CPD_RECORD,
  DocumentType.DAILY_REPORT,
];

export async function getChatContext(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new RecommendationChatError("Employee not found.");

  const [role, gapCount, docs, recommendations] = await Promise.all([
    user.position
      ? prisma.roleProfile.findUnique({
          where: { title: user.position },
          include: { _count: { select: { requirements: true } } },
        })
      : Promise.resolve(null),
    prisma.skillGap.count({ where: { userId, status: { not: "MEETS_REQUIREMENT" } } }),
    prisma.document.findMany({
      where: { userId, type: { in: EMPLOYEE_DOC_TYPES } },
      orderBy: { createdAt: "desc" },
      select: { type: true, status: true, originalName: true, updatedAt: true },
    }),
    // Previously generated picks — so a page refresh re-shows them without
    // re-running the whole conversation. Stored, capped, and self-replacing.
    loadStoredRecommendations(userId),
  ]);

  // Latest document per type.
  const latestByType = new Map<string, (typeof docs)[number]>();
  for (const d of docs) if (!latestByType.has(d.type)) latestByType.set(d.type, d);

  return {
    employeeName: user.fullName,
    roleTitle: user.position ?? null,
    hasRoleProfile: !!role && (role._count?.requirements ?? 0) > 0,
    gapCount,
    ai: { provider: activeProvider(), configured: isConfigured() },
    questions: PREFERENCE_QUESTIONS,
    documents: EMPLOYEE_DOC_TYPES.map((t) => {
      const d = latestByType.get(t);
      return { type: t, uploaded: !!d, status: d?.status ?? null, name: d?.originalName ?? null };
    }),
    // Last generated picks (empty on first visit) — the UI re-displays these on load.
    recommendations,
  };
}
