/**
 * Keep the engine's *stored* derived state honest after an employee edits their
 * own skill levels in My Skills.
 *
 * UserSkill is the source of truth, but two things are persisted from it and so
 * go stale the moment a level changes:
 *
 *   - SkillGap  — written by runGapAnalysis, read by manager dashboards and by
 *                 the engine recommendation path. Recomputed here.
 *   - Recommendation — course picks justified by a gap. A pick whose gaps have
 *                 all been closed is no longer a recommendation, it's a leftover.
 *                 Cleared here.
 *
 * Everything else (My Skills, team-skills, reports) reads UserSkill live and
 * needs no invalidation.
 *
 * This runs after the edit has already been committed: a failure to refresh must
 * never lose the employee's edit, so callers should treat it as best-effort.
 */
import { prisma } from "@/lib/db";
import {
  runGapAnalysis,
  GapAnalysisError,
  loadSelfAssessedGaps,
} from "@/server/gaps/gapAnalysis";

export interface SkillRefreshResult {
  /** False when the employee has no role profile — gaps came from their own targets. */
  roleGapsRecomputed: boolean;
  /** How many skills are still short of their required/target level after the edit. */
  outstandingGaps: number;
  /** Stored course picks dropped because every gap they covered is now closed. */
  recommendationsCleared: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Skill names out of a persisted `gapsCovered` payload. Both writers (engine and
 * chat) store `[{ skill, from, to, ... }]`, but it is untyped JSON coming back
 * out of the DB, so treat anything unexpected as "no covered skills" — which
 * makes the row un-judgeable and therefore never deleted.
 */
function coveredSkillNames(gapsCovered: unknown): string[] {
  if (!Array.isArray(gapsCovered)) return [];
  return gapsCovered
    .map((g) => (g && typeof g === "object" ? (g as { skill?: unknown }).skill : null))
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map(norm);
}

/**
 * Recompute this employee's gaps and drop recommendations they've outgrown.
 *
 * A recommendation is dropped only when it covers at least one skill AND none of
 * those skills is still an outstanding gap — i.e. the employee has genuinely
 * closed everything that course was suggested for. Recommendations covering a
 * still-open gap are left alone: a level edit makes the ranking stale, not wrong,
 * and both recommendation surfaces re-rank from scratch on their next run.
 */
export async function refreshDerivedSkillState(userId: string): Promise<SkillRefreshResult> {
  // Prefer the role-profile analysis; fall back to the employee's own targets
  // when they have no role profile — the same degradation the recommendation
  // paths use, so "outstanding" means the same thing here as it does there.
  let roleGapsRecomputed = true;
  try {
    await runGapAnalysis(userId);
  } catch (err) {
    if (!(err instanceof GapAnalysisError)) throw err;
    roleGapsRecomputed = false;
  }

  let outstanding: Set<string>;
  if (roleGapsRecomputed) {
    const rows = await prisma.skillGap.findMany({
      where: { userId, status: { not: "MEETS_REQUIREMENT" } },
      include: { skill: true },
    });
    outstanding = new Set(rows.map((g) => norm(g.skill.name)));
  } else {
    const selfAssessed = await loadSelfAssessedGaps(userId);
    outstanding = new Set(selfAssessed.map((g) => norm(g.skill)));
  }

  const recs = await prisma.recommendation.findMany({
    where: { userId },
    select: { id: true, gapsCovered: true },
  });
  const obsolete = recs
    .filter((r) => {
      const covered = coveredSkillNames(r.gapsCovered);
      return covered.length > 0 && !covered.some((s) => outstanding.has(s));
    })
    .map((r) => r.id);

  if (obsolete.length > 0) {
    await prisma.recommendation.deleteMany({ where: { id: { in: obsolete } } });
  }

  return {
    roleGapsRecomputed,
    outstandingGaps: outstanding.size,
    recommendationsCleared: obsolete.length,
  };
}
