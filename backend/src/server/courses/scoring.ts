/**
 * Deterministic course scoring.
 *
 * Pure functions (no DB, no AI) so they are fully unit-testable. The AI only
 * ever *explains* the ranking afterwards — it never changes these numbers.
 *
 * Scoring rules:
 *   +25..+55  covers the learner's highest-priority gap, scaled by that gap's
 *             priorityScore (severity × role importance × confidence × dept
 *             weight) — a CRITICAL, high-importance gap scores well above a
 *             trivial one-level, low-importance gap, instead of both getting
 *             an identical flat bonus
 *   +0..+30   covers additional gaps beyond the top one, same priority
 *             scaling, capped so a multi-gap course can't spiral past a
 *             tightly-focused one
 *   +15  level is suitable for the employee
 *   +10  duration is short/reasonable
 *   +10  provider is approved/preferred
 *   +10  course is already available to the organisation
 *   -20  course is too advanced for the employee
 *   -30  course is not approved
 */
import { courseLevelToNumber, courseLevelFit, numberToLevel, type GapStatus } from "@/lib/levels";

export const SCORE = {
  // COVERS_GAP and MULTI_GAP are no longer flat — see gapCoveragePoints()
  // below. Kept here (values unused) only so ScoreBreakdownItem.code stays
  // typed against the full set of scoring codes.
  COVERS_GAP: 0,
  MULTI_GAP: 0,
  LEVEL_SUITABLE: 15,
  DURATION_REASONABLE: 10,
  PREFERRED_PROVIDER: 10,
  AVAILABLE_TO_ORG: 10,
  TOO_ADVANCED: -20,
  NOT_APPROVED: -30,
} as const;

/** Courses at or under this many hours count as "short/reasonable". */
export const REASONABLE_DURATION_HOURS = 40;
/** Normalised score at or above this is labelled a "high" match. */
export const HIGH_MATCH_THRESHOLD = 75;
/** Ceiling on the quality (rating + reach) signal used only to break ties. */
export const MAX_QUALITY_BONUS = 10;
/** Baseline coverage points for the lowest-priority gap a course still covers. */
export const GAP_COVERAGE_MIN = 25;
/** Ceiling of coverage points for a critical, high-priority gap. */
export const GAP_COVERAGE_MAX = 55;
/** priorityScore at/above this is treated as "as urgent as it gets" for scaling. */
export const GAP_PRIORITY_CEILING = 100;
/** Each additional covered gap (beyond the top-priority one) contributes this fraction of its own coverage value. */
export const ADDITIONAL_GAP_FACTOR = 0.35;
/** Ceiling on the combined bonus from additional covered gaps. */
export const ADDITIONAL_GAP_CAP = 30;

export interface ScoringGap {
  skillId: string;
  skill: string;
  currentLevel: number; // 0–4
  requiredLevel: number; // 0–4
  gapValue: number;
  status: GapStatus;
  priorityScore: number;
}

export interface ScoringCourse {
  id: string;
  title: string;
  level: string | null; // Beginner | Intermediate | Advanced
  durationHours: number | null;
  approved: boolean;
  preferredProvider: boolean;
  availableToOrg: boolean;
  skillIds: string[];
  rating?: number | null; // catalogue rating, 0–5 (null when unknown)
  enrollmentCount?: number; // internal enrollments — a reach/popularity proxy
}

export interface ScoreBreakdownItem {
  code: keyof typeof SCORE;
  label: string;
  points: number;
}

export interface CourseScore {
  courseId: string;
  title: string;
  rawScore: number;
  normalized: number; // 0–100
  matchLabel: "high" | "good";
  breakdown: ScoreBreakdownItem[];
  coveredGaps: ScoringGap[];
  gapPriorityScore: number; // Σ priorityScore of covered gaps (tie-breaker)
  relevanceRatio: number; // coveredGaps ÷ total course skills — how focused the course is on what the learner needs (tie-breaker)
  qualityScore: number; // 0–MAX_QUALITY_BONUS quality signal (rating + reach); tie-breaker only, never part of matchScore
  reason: string; // deterministic fallback explanation
}

/**
 * Quality signal (0–MAX_QUALITY_BONUS) from catalogue rating and reach. Used
 * ONLY to break ties between courses that fit a learner's gaps equally well — it
 * never enters `matchScore`, so a better-rated course can win an otherwise even
 * contest but can never outrank a course that closes more or higher-priority gaps.
 */
export function computeQualityScore(rating?: number | null, enrollmentCount = 0): number {
  let q = 0;
  if (rating != null && rating > 0) q += (Math.min(rating, 5) / 5) * 8; // 0–8 from rating
  if (enrollmentCount > 0) q += Math.min(2, Math.log10(enrollmentCount + 1)); // 0–2 from reach
  return Math.min(MAX_QUALITY_BONUS, Math.round(q * 100) / 100);
}

/**
 * Points for covering one gap, scaled by its priorityScore so a course that
 * closes a critical, high-importance gap scores meaningfully higher than one
 * that only nudges a low-priority, one-level gap — instead of a flat bonus
 * that treated every covered gap identically until tie-breaks.
 */
export function gapCoveragePoints(gap: ScoringGap): number {
  const fraction = Math.max(0, Math.min(1, gap.priorityScore / GAP_PRIORITY_CEILING));
  return Math.round(GAP_COVERAGE_MIN + (GAP_COVERAGE_MAX - GAP_COVERAGE_MIN) * fraction);
}

/**
 * Score one course against an employee's gaps. Returns `null` when the course
 * covers no outstanding gap (it is simply not a candidate).
 */
export function scoreCourse(course: ScoringCourse, gaps: ScoringGap[]): CourseScore | null {
  const skillSet = new Set(course.skillIds);
  // Highest-priority covered gap first, so both the score and the reason text
  // (which quotes coveredGaps[0]) foreground what matters most to this learner.
  const coveredGaps = gaps
    .filter((g) => skillSet.has(g.skillId) && g.status !== "MEETS_REQUIREMENT")
    .sort((a, b) => b.priorityScore - a.priorityScore);
  if (coveredGaps.length === 0) return null;

  const breakdown: ScoreBreakdownItem[] = [];
  const add = (code: keyof typeof SCORE, label: string, points: number = SCORE[code]) =>
    breakdown.push({ code, label, points });

  // Covers the top-priority gap — scaled, not flat (see gapCoveragePoints).
  add("COVERS_GAP", `Addresses ${coveredGaps[0].skill}`, gapCoveragePoints(coveredGaps[0]));

  // Covers more than one gap — each additional gap contributes a scaled,
  // capped share of its own coverage value rather than a flat +20 regardless
  // of how many gaps or how important they are.
  if (coveredGaps.length >= 2) {
    const extraPoints = Math.min(
      ADDITIONAL_GAP_CAP,
      Math.round(
        coveredGaps.slice(1).reduce((sum, g) => sum + gapCoveragePoints(g) * ADDITIONAL_GAP_FACTOR, 0)
      )
    );
    add("MULTI_GAP", `Covers ${coveredGaps.length} skill gaps at once`, extraPoints);
  }

  // Level suitability, driven by the weakest covered skill.
  const employeeLevel = Math.min(...coveredGaps.map((g) => g.currentLevel));
  const courseLevelNum = courseLevelToNumber(course.level);
  const fit = courseLevelFit(employeeLevel, courseLevelNum);
  if (fit === "suitable") {
    add("LEVEL_SUITABLE", `${course.level ?? "Level"} suits a ${numberToLevel(employeeLevel)} learner`);
  } else if (fit === "tooAdvanced") {
    add("TOO_ADVANCED", `${course.level} may be too advanced for a ${numberToLevel(employeeLevel)} learner`);
  }

  // +10 duration reasonable
  if (course.durationHours != null && course.durationHours <= REASONABLE_DURATION_HOURS) {
    add("DURATION_REASONABLE", `Short/reasonable (${course.durationHours}h)`);
  }

  // +10 preferred provider
  if (course.preferredProvider) add("PREFERRED_PROVIDER", "From a preferred provider");

  // +10 available to organisation
  if (course.availableToOrg) add("AVAILABLE_TO_ORG", "Already available to the organisation");

  // -30 not approved
  if (!course.approved) add("NOT_APPROVED", "Not in the approved catalogue");

  const rawScore = breakdown.reduce((s, b) => s + b.points, 0);
  const normalized = Math.max(0, Math.min(100, rawScore));
  const matchLabel: "high" | "good" = normalized >= HIGH_MATCH_THRESHOLD ? "high" : "good";
  const gapPriorityScore = coveredGaps.reduce((s, g) => s + g.priorityScore, 0);
  // How focused the course is on what this learner actually needs: a course
  // whose skills are mostly the learner's gaps beats one that teaches the same
  // gap among many unrelated topics (e.g. a general cybersecurity course that
  // happens to touch "AI Security"). Deterministic, role-agnostic.
  const relevanceRatio = coveredGaps.length / Math.max(1, course.skillIds.length);
  const qualityScore = computeQualityScore(course.rating, course.enrollmentCount);

  return {
    courseId: course.id,
    title: course.title,
    rawScore,
    normalized,
    matchLabel,
    breakdown,
    coveredGaps,
    gapPriorityScore,
    relevanceRatio,
    qualityScore,
    reason: buildReason(course, coveredGaps),
  };
}

/** Deterministic, manager-friendly reason used when the AI is not available. */
export function buildReason(course: ScoringCourse, coveredGaps: ScoringGap[]): string {
  if (coveredGaps.length >= 2) {
    const names = coveredGaps.map((g) => g.skill);
    const list =
      names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
    return `Covers multiple skill gaps: ${list}.`;
  }
  const g = coveredGaps[0];
  return `Focused improvement for ${g.skill} — moves from ${numberToLevel(g.currentLevel)} toward the required ${numberToLevel(g.requiredLevel)}.`;
}

/**
 * Deterministic ranking order: normalised score, then the combined priority of
 * the gaps covered, then coverage breadth, relevance and quality tie-breaks.
 * Exported so callers can re-sort a subset (e.g. after `selectDiverseTop`)
 * without duplicating the comparator.
 */
export function compareCourseScore(a: CourseScore, b: CourseScore): number {
  return (
    b.normalized - a.normalized ||
    b.gapPriorityScore - a.gapPriorityScore ||
    b.coveredGaps.length - a.coveredGaps.length ||
    b.relevanceRatio - a.relevanceRatio || // prefer the more on-target course
    b.qualityScore - a.qualityScore || // then the better-rated / more-taken one
    a.title.localeCompare(b.title)
  );
}

/**
 * Score and rank a set of courses. Sorted by normalised score, then by the
 * combined priority of the gaps covered (so higher-priority gaps win ties).
 */
export function rankCourses(courses: ScoringCourse[], gaps: ScoringGap[]): CourseScore[] {
  const scored = courses
    .map((c) => scoreCourse(c, gaps))
    .filter((s): s is CourseScore => s !== null && s.rawScore > 0);

  scored.sort(compareCourseScore);
  return scored;
}

/**
 * Trim a ranked list to `limit` while giving each of the learner's
 * highest-priority gaps a fair shot at representation, instead of letting
 * whichever gap happens to be best-served by the catalogue crowd out every
 * slot (e.g. ten great Excel courses pushing out the only course covering a
 * CRITICAL SQL gap). Purely a reshuffle: it never adds a course that wasn't
 * already in `items` and never returns more than `limit`.
 *
 * Pass 1 walks the learner's gaps in priority order and claims, for each gap
 * not yet represented, the single best-ranked remaining item that covers it.
 * Pass 2 fills any leftover slots with the next-best items overall, so once
 * every gap has a foothold the list still favours quality and legitimate
 * overlap (e.g. two strong courses for the one CRITICAL gap).
 */
export function selectDiverseTop<T>(
  items: T[],
  gaps: ScoringGap[],
  limit: number,
  coveredSkillIdsOf: (item: T) => string[],
  compare: (a: T, b: T) => number
): T[] {
  if (items.length <= limit) return items;

  const gapsByPriority = [...gaps].sort((a, b) => b.priorityScore - a.priorityScore);
  const remaining = [...items];
  const picked: T[] = [];
  const representedSkillIds = new Set<string>();

  for (const gap of gapsByPriority) {
    if (picked.length >= limit) break;
    if (representedSkillIds.has(gap.skillId)) continue;
    const idx = remaining.findIndex((item) => coveredSkillIdsOf(item).includes(gap.skillId));
    if (idx === -1) continue;
    const [item] = remaining.splice(idx, 1);
    picked.push(item);
    for (const skillId of coveredSkillIdsOf(item)) representedSkillIds.add(skillId);
  }

  for (const item of remaining) {
    if (picked.length >= limit) break;
    picked.push(item);
  }

  return picked.sort(compare);
}
