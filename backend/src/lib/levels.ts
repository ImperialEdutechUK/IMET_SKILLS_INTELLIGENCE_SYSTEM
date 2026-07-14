/**
 * Canonical skill-level system for the recommendation engine.
 *
 *   None = 0 · Basic = 1 · Intermediate = 2 · Advanced = 3 · Expert = 4
 *
 * All gap maths runs on these numbers. Level *names* (as produced by the AI
 * extraction, spreadsheets, or humans) are normalised through `levelToNumber`.
 */

export const LEVELS = {
  None: 0,
  Basic: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
} as const;

export type LevelName = keyof typeof LEVELS;
export const LEVEL_NAMES = Object.keys(LEVELS) as LevelName[];
export const MIN_LEVEL = 0;
export const MAX_LEVEL = 4;

/** Common phrasings that map onto a canonical level. */
const LEVEL_ALIASES: Record<string, number> = {
  none: 0,
  "no experience": 0,
  novice: 1,
  beginner: 1,
  basic: 1,
  foundational: 1,
  foundation: 1,
  elementary: 1,
  intermediate: 2,
  competent: 2,
  proficient: 3,
  advanced: 3,
  strong: 3,
  senior: 3,
  expert: 4,
  master: 4,
  mastery: 4,
  "subject matter expert": 4,
};

/**
 * Convert a level expressed as a name, a phrase, or a number into the canonical
 * 0–4 scale. Unknown / empty inputs fall back to `fallback` (default 0).
 * Numbers are clamped into range; the legacy 1–5 scale collapses gracefully
 * because 5 clamps to 4 (Expert).
 */
export function levelToNumber(
  level: string | number | null | undefined,
  fallback = 0
): number {
  if (level === null || level === undefined) return fallback;

  if (typeof level === "number") {
    if (Number.isNaN(level)) return fallback;
    return clampLevel(Math.round(level));
  }

  const raw = level.trim().toLowerCase();
  if (raw === "") return fallback;

  // Pure numeric string, e.g. "3" or "3/5".
  const numeric = raw.match(/^(\d+(?:\.\d+)?)/);
  if (numeric && LEVEL_ALIASES[raw] === undefined) {
    return clampLevel(Math.round(parseFloat(numeric[1])));
  }

  if (LEVEL_ALIASES[raw] !== undefined) return LEVEL_ALIASES[raw];

  // Substring match as a last resort ("advanced user" → advanced).
  for (const [alias, value] of Object.entries(LEVEL_ALIASES)) {
    if (raw.includes(alias)) return value;
  }
  return fallback;
}

export function clampLevel(n: number): number {
  if (Number.isNaN(n)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, n));
}

export function numberToLevel(n: number): LevelName {
  const clamped = clampLevel(Math.round(n));
  return LEVEL_NAMES[clamped];
}

// ── Gap classification ────────────────────────────────────────────────────────

export type GapStatus =
  | "MEETS_REQUIREMENT"
  | "NEEDS_IMPROVEMENT"
  | "CRITICAL_GAP"
  | "MISSING_SKILL";

export interface GapResult {
  requiredLevel: number;
  currentLevel: number;
  gapValue: number;
  status: GapStatus;
}

/**
 * Deterministic gap classification. The AI never decides this.
 *
 *   gapValue = requiredLevel - currentLevel
 *
 *   - required <= 0                        → MEETS_REQUIREMENT (nothing required)
 *   - current missing or 0 (required > 0)  → MISSING_SKILL
 *   - gapValue <= 0                         → MEETS_REQUIREMENT
 *   - gapValue === 1                        → NEEDS_IMPROVEMENT
 *   - gapValue >= 2                         → CRITICAL_GAP
 */
export function classifyGap(
  required: number | string | null | undefined,
  current: number | string | null | undefined
): GapResult {
  const requiredLevel = clampLevel(levelToNumber(required));
  const currentMissing = current === null || current === undefined || current === "";
  const currentLevel = clampLevel(levelToNumber(current));
  const gapValue = requiredLevel - currentLevel;

  let status: GapStatus;
  if (requiredLevel <= 0) {
    status = "MEETS_REQUIREMENT";
  } else if (currentMissing || currentLevel === 0) {
    status = "MISSING_SKILL";
  } else if (gapValue <= 0) {
    status = "MEETS_REQUIREMENT";
  } else if (gapValue === 1) {
    status = "NEEDS_IMPROVEMENT";
  } else {
    status = "CRITICAL_GAP";
  }

  return { requiredLevel, currentLevel, gapValue, status };
}

export function isGap(status: GapStatus): boolean {
  return status !== "MEETS_REQUIREMENT";
}

// ── Priority scoring ──────────────────────────────────────────────────────────

export type SkillImportance = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type GapPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const IMPORTANCE_WEIGHT: Record<SkillImportance, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 25,
  CRITICAL: 35,
};

export interface PriorityInput {
  status: GapStatus;
  gapValue: number;
  importance: SkillImportance;
  confidence: number; // 0–1
  departmentPriority?: number; // 0+ (higher = more strategic)
}

export interface PriorityResult {
  priorityScore: number;
  priority: GapPriority;
}

/**
 * Deterministic gap priority. Combines the size of the gap, how important the
 * skill is to the role, how confident we are in the employee's current level,
 * and (optionally) the department's strategic priority.
 */
export function scorePriority(input: PriorityInput): PriorityResult {
  if (input.status === "MEETS_REQUIREMENT") {
    return { priorityScore: 0, priority: "LOW" };
  }

  const gapComponent = Math.max(0, input.gapValue) * 30;
  const missingBoost = input.status === "MISSING_SKILL" ? 15 : 0;
  const importanceComponent = IMPORTANCE_WEIGHT[input.importance] ?? IMPORTANCE_WEIGHT.MEDIUM;
  // Higher confidence in a low current level → we trust the gap more.
  const confidenceComponent = Math.round(Math.max(0, Math.min(1, input.confidence)) * 10);
  const deptComponent = Math.max(0, Math.min(10, input.departmentPriority ?? 0));

  const priorityScore =
    gapComponent + missingBoost + importanceComponent + confidenceComponent + deptComponent;

  let priority: GapPriority;
  if (priorityScore >= 80) priority = "CRITICAL";
  else if (priorityScore >= 55) priority = "HIGH";
  else if (priorityScore >= 30) priority = "MEDIUM";
  else priority = "LOW";

  return { priorityScore, priority };
}

// ── Course-level suitability ──────────────────────────────────────────────────

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

/** Map a free-text course level onto Beginner/Intermediate/Advanced (1/2/3). */
export function courseLevelToNumber(level: string | null | undefined): number | null {
  if (!level) return null;
  const raw = level.trim().toLowerCase();
  if (raw.includes("begin") || raw.includes("intro") || raw.includes("foundation") || raw.includes("basic")) return 1;
  if (raw.includes("intermediate")) return 2;
  if (raw.includes("advanced") || raw.includes("expert")) return 3;
  return null;
}

/**
 * Recommended course levels by the employee's *current* level on the weak skill:
 *   - None/Basic (0–1)   → Beginner or Intermediate
 *   - Intermediate (2)   → Intermediate or Advanced
 *   - Advanced/Expert (3–4) → Advanced
 * Returns whether a course level is "suitable" or "tooAdvanced".
 */
export function courseLevelFit(
  employeeLevel: number,
  courseLevelNum: number | null
): "suitable" | "tooAdvanced" | "unknown" {
  if (courseLevelNum === null) return "unknown";
  const emp = clampLevel(employeeLevel);

  let suitable: number[];
  if (emp <= 1) suitable = [1, 2];
  else if (emp === 2) suitable = [2, 3];
  else suitable = [3];

  if (suitable.includes(courseLevelNum)) return "suitable";
  if (courseLevelNum > Math.max(...suitable)) return "tooAdvanced";
  // Below the suitable range (e.g. Beginner course for an Advanced user) — not
  // ideal but not penalised as "too advanced".
  return "unknown";
}
