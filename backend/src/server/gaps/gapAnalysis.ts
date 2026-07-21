/**
 * Deterministic gap analysis.
 *
 * The AI never decides a gap. This module compares an employee's stored current
 * skill levels against their role's required levels using pure arithmetic, then
 * persists one SkillGap row per required skill.
 *
 * Also here: helpers to persist AI-extracted employee skills (UserSkill) and
 * role requirements (RoleProfile + RoleSkillRequirement), so the pipeline
 * "extract → store → analyse" is complete.
 */
import type { GapPriority, GapStatus, SkillImportance } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  classifyGap,
  scorePriority,
  clampLevel,
  levelToNumber,
  numberToLevel,
  MAX_LEVEL,
} from "@/lib/levels";
import { resolveSkill } from "@/server/skills/normalize";
import { withLock } from "@/lib/locks";
import type { DetectedSkill, RequiredSkill } from "@/server/validation/schemas";
import type { ScoringGap } from "@/server/courses/scoring";

export class GapAnalysisError extends Error {}

// ── Persisting extracted data ─────────────────────────────────────────────────

/** Detections below this confidence are too speculative to store: a weak guess
 *  that a skill exists would downgrade a MISSING_SKILL gap (the most urgent
 *  kind) into a milder one and hide the employee's real need. */
export const MIN_DETECTION_CONFIDENCE = 0.4;

export interface StoreEmployeeSkillsOptions {
  useAI?: boolean;
  /**
   * How to reconcile a detected level with an existing UserSkill row:
   *
   * - "authoritative" (skill matrix, manager evaluation): the document states
   *   the employee's level outright, so it SETS the level — including
   *   LOWERING a stale record. Without this, a wrong/outdated high level
   *   could never be corrected, permanently hiding the gap the fresh document
   *   reveals.
   * - "observational" (daily report, CPD log — the default): the document
   *   only evidences use at some level, so higher recorded levels win —
   *   mentioning a skill in passing must not demote an expert.
   */
  mode?: "authoritative" | "observational";
}

/**
 * Store AI-detected employee skills into UserSkill (0–4 scale). Also stores an
 * explicitly-stated target level (e.g. a skill matrix's "Target Level" column)
 * so self-assessed gap fallbacks reflect the employee's own goals.
 */
export async function storeEmployeeSkills(
  userId: string,
  detected: DetectedSkill[],
  opts: StoreEmployeeSkillsOptions = {}
): Promise<{ stored: number }> {
  const mode = opts.mode ?? "observational";
  let stored = 0;
  // Highest level wins when one document mentions the same skill twice — even
  // in authoritative mode, where "set" semantics apply against the DB, not
  // against other rows of the same document.
  const batchLevels = new Map<string, number>();

  for (const d of detected) {
    if (d.confidence < MIN_DETECTION_CONFIDENCE) continue;
    const resolved = await resolveSkill(d.skill, { useAI: opts.useAI });
    if (!resolved) continue;
    const skillId = resolved.skill.id;
    const level = clampLevel(levelToNumber(d.estimatedLevel));
    const explicitTarget =
      d.targetLevel != null ? clampLevel(levelToNumber(d.targetLevel)) : null;

    let nextLevel: number;
    if (batchLevels.has(skillId)) {
      nextLevel = Math.max(batchLevels.get(skillId)!, level);
    } else if (mode === "authoritative") {
      nextLevel = level;
    } else {
      const existing = await prisma.userSkill.findUnique({
        where: { userId_skillId: { userId, skillId } },
      });
      nextLevel = existing ? Math.max(existing.currentLevel, level) : level;
    }
    batchLevels.set(skillId, nextLevel);

    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      update: {
        currentLevel: nextLevel,
        ...(explicitTarget != null && explicitTarget > 0 ? { targetLevel: explicitTarget } : {}),
      },
      create: {
        userId,
        skillId,
        currentLevel: nextLevel,
        targetLevel:
          explicitTarget != null && explicitTarget > 0 ? explicitTarget : Math.max(nextLevel, 3),
      },
    });
    stored++;
  }
  return { stored };
}

/**
 * Store AI-extracted role requirements into a RoleProfile + RoleSkillRequirement
 * rows. The role is keyed by title so it can be matched to `User.position`.
 */
export async function storeRoleRequirements(
  roleTitle: string,
  required: RequiredSkill[],
  opts: { departmentId?: string; useAI?: boolean } = {}
): Promise<{ roleProfileId: string; stored: number }> {
  const role = await prisma.roleProfile.upsert({
    where: { title: roleTitle },
    update: opts.departmentId ? { departmentId: opts.departmentId } : {},
    create: { title: roleTitle, departmentId: opts.departmentId },
  });

  let stored = 0;
  for (const r of required) {
    const resolved = await resolveSkill(r.skill, { useAI: opts.useAI });
    if (!resolved) continue;
    const requiredLevel = clampLevel(levelToNumber(r.requiredLevel));
    await prisma.roleSkillRequirement.upsert({
      where: { roleProfileId_skillId: { roleProfileId: role.id, skillId: resolved.skill.id } },
      update: { requiredLevel, importance: r.importance as SkillImportance, reason: r.reason },
      create: {
        roleProfileId: role.id,
        skillId: resolved.skill.id,
        requiredLevel,
        importance: r.importance as SkillImportance,
        reason: r.reason,
      },
    });
    stored++;
  }
  return { roleProfileId: role.id, stored };
}

// ── The gap analysis itself ───────────────────────────────────────────────────

export interface GapRow {
  skillId: string;
  skill: string;
  requiredLevel: number;
  requiredLevelName: string;
  currentLevel: number;
  currentLevelName: string;
  gapValue: number;
  status: GapStatus;
  priority: GapPriority;
  priorityScore: number;
  importance: SkillImportance;
  confidence: number;
}

export interface GapAnalysisResult {
  userId: string;
  employeeName: string;
  roleTitle: string;
  roleProfileId: string;
  departmentId: string | null;
  gaps: GapRow[];
  summary: {
    total: number;
    meets: number;
    needsImprovement: number;
    criticalGaps: number;
    missing: number;
  };
}

/**
 * Run gap analysis for one employee and persist SkillGap rows.
 *
 *   1. resolve the employee's role (User.position → RoleProfile.title)
 *   2. load the role's required skills
 *   3. load the employee's current skills (UserSkill)
 *   4. classify each required skill deterministically
 *   5. score priority and persist
 */
export async function runGapAnalysis(userId: string): Promise<GapAnalysisResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { department: true, userSkills: { include: { skill: true } } },
  });
  if (!user) throw new GapAnalysisError("Employee not found.");
  if (!user.position) {
    throw new GapAnalysisError(
      "Employee has no role/position set. Set User.position or process a role/job description first."
    );
  }

  const role = await prisma.roleProfile.findUnique({
    where: { title: user.position },
    include: { requirements: { include: { skill: true } }, department: true },
  });
  if (!role) {
    throw new GapAnalysisError(
      `No role profile found for position "${user.position}". Process a role requirement / job description for it first.`
    );
  }
  if (role.requirements.length === 0) {
    throw new GapAnalysisError(`Role "${role.title}" has no required skills defined.`);
  }

  const currentBySkill = new Map(user.userSkills.map((us) => [us.skillId, us]));
  const deptPriority = role.department?.priority ?? user.department?.priority ?? 0;

  const gaps: GapRow[] = [];
  for (const req of role.requirements) {
    const us = currentBySkill.get(req.skillId);
    const currentLevel = us ? clampLevel(us.currentLevel) : 0;
    const { requiredLevel, gapValue, status } = classifyGap(req.requiredLevel, us ? currentLevel : null);
    // Confidence: how sure we are of the employee's current level. Missing skill
    // (no observation) is high-confidence-that-it's-a-gap.
    const confidence = us ? 0.9 : 1.0;

    const { priority, priorityScore } = scorePriority({
      status,
      gapValue,
      importance: req.importance,
      confidence,
      departmentPriority: deptPriority,
    });

    gaps.push({
      skillId: req.skillId,
      skill: req.skill.name,
      requiredLevel,
      requiredLevelName: numberToLevel(requiredLevel),
      currentLevel,
      currentLevelName: numberToLevel(currentLevel),
      gapValue,
      status,
      priority,
      priorityScore,
      importance: req.importance,
      confidence,
    });
  }

  // Persist: replace this user's SkillGap set with the fresh computation.
  // Use a single deleteMany + createMany (2 round-trips) instead of one
  // create() per gap (N+1 round-trips), which against a remote DB blows past
  // the default 5s interactive-transaction timeout (P2028).
  //
  // withLock serialises this replace per user: two concurrent runs (double
  // click, chat + manager generate at once) otherwise interleave as
  // T1-delete → T2-delete → T1-insert → T2-insert, where the second insert
  // hits the (userId, skillId) unique constraint (P2002) or stalls on the
  // first run's row locks until the transaction dies (P2028). skipDuplicates
  // absorbs any race the in-process lock can't see (e.g. a second server
  // instance) — concurrent runs compute identical rows, so dropping the
  // duplicate insert is safe.
  await withLock(`skill-gaps:${userId}`, () =>
    prisma.$transaction(
      [
        prisma.skillGap.deleteMany({ where: { userId } }),
        prisma.skillGap.createMany({
          data: gaps.map((g) => ({
            userId,
            skillId: g.skillId,
            roleProfileId: role.id,
            requiredLevel: g.requiredLevel,
            currentLevel: g.currentLevel,
            gapValue: g.gapValue,
            status: g.status,
            priority: g.priority,
            priorityScore: g.priorityScore,
            importance: g.importance,
            confidence: g.confidence,
          })),
          skipDuplicates: true,
        }),
      ],
      // maxWait: allow up to 10s to *acquire* a pooled connection under
      // concurrent load (default 2s throws P2028 "unable to start a
      // transaction"); timeout: headroom for the work itself on a remote DB.
      { maxWait: 10000, timeout: 15000 }
    )
  );

  gaps.sort((a, b) => b.priorityScore - a.priorityScore);

  const summary = {
    total: gaps.length,
    meets: gaps.filter((g) => g.status === "MEETS_REQUIREMENT").length,
    needsImprovement: gaps.filter((g) => g.status === "NEEDS_IMPROVEMENT").length,
    criticalGaps: gaps.filter((g) => g.status === "CRITICAL_GAP").length,
    missing: gaps.filter((g) => g.status === "MISSING_SKILL").length,
  };

  return {
    userId,
    employeeName: user.fullName,
    roleTitle: role.title,
    roleProfileId: role.id,
    departmentId: user.departmentId,
    gaps,
    summary,
  };
}

// ── Fallback when there's no role profile ─────────────────────────────────────
//
// runGapAnalysis needs a RoleProfile (set up by a manager/admin) to compare
// against. When one doesn't exist yet — no `User.position`, or no matching
// RoleProfile / requirements for it — we still don't want to leave the
// employee with nothing. Both recommendation surfaces (the manager-run
// "engine" path and the employee-facing chat) fall back to this: treat the
// employee's own recorded skills as things to deepen, one level at a time.

/**
 * Synthesise "improvement gaps" from the employee's own recorded skills, used
 * when there is no role profile to compute real gaps against. Each skill below
 * its target level (or the ceiling) becomes a gap to move one level up.
 * Shared by `recommend.ts` and `recommendChat.ts` so an employee without a
 * role profile gets the same graceful degradation from either surface,
 * instead of one erroring out while the other quietly recovers.
 */
export async function loadSelfAssessedGaps(userId: string): Promise<ScoringGap[]> {
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
  return gaps.sort((a, b) => b.priorityScore - a.priorityScore);
}
