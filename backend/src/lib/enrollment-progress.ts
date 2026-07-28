// Derived course progress.
//
// Progress used to be a free 0–100 slider the learner dragged, which measured
// nothing: any value was reachable in one gesture, with no timestamp and no unit.
// It is now DERIVED from the only input the learner can state meaningfully — hours
// spent — against the course's own published duration:
//
//   progress = hoursLogged / durationHours   (clamped to 1–99 while in progress)
//
// The catalogue is external (Coursera / LinkedIn Learning / edX) and none of those
// expose a completion API, so hours remain self-reported. What changes is that the
// number now has a unit, an audit trail (EnrollmentEvent), and a denominator the
// learner does not control.
//
// Clamping to 99 while in_progress keeps "100%" meaning exactly one thing: the
// learner explicitly marked the course complete. Over-logging hours never silently
// completes a course, and completion never silently rewrites the hours.

export type EnrollmentStatusLike = "not_started" | "in_progress" | "completed";

export interface DerivedProgress {
  /** 0–100, safe to persist to Enrollment.progress. */
  progress: number;
  /**
   * False when the course publishes neither a duration nor CPD hours, so there is
   * no honest denominator. Callers should show hours logged instead of a bar.
   */
  progressKnown: boolean;
  /** The denominator actually used, or null when unknown. */
  targetHours: number | null;
}

/**
 * Floor for an in-progress course that has SOME hours logged, so a small first
 * entry against a long course still shows movement instead of rounding to 0%.
 * Zero hours logged is always 0% — a started course you haven't touched has made
 * no progress, and claiming 1% would be the same small lie the slider told.
 */
const IN_PROGRESS_FLOOR = 1;
/** Ceiling for an in-progress course — 100 is reserved for explicit completion. */
const IN_PROGRESS_CEILING = 99;

/** Largest override we accept; beyond this it is a typo, not a course length. */
export const MAX_TARGET_HOURS = 2000;

/**
 * Resolve the denominator for a course, most-trusted first:
 *   1. the learner's own override — they know the course better than the scraper
 *   2. the catalogue's published duration
 *   3. the course's CPD hours (most scraped courses carry at least one)
 * Returns null when nothing usable exists.
 *
 * The override lives on the Enrollment, never on Course: the catalogue is scraped
 * production data shared by every user, and its cpdHours is derived from
 * durationHours, so editing it there would re-score recommendations for everyone.
 */
export function resolveTargetHours(
  durationHours: number | null | undefined,
  cpdHours: number | null | undefined,
  targetHoursOverride?: number | null
): number | null {
  if (typeof targetHoursOverride === "number" && targetHoursOverride > 0) return targetHoursOverride;
  if (typeof durationHours === "number" && durationHours > 0) return durationHours;
  if (typeof cpdHours === "number" && cpdHours > 0) return cpdHours;
  return null;
}

export function deriveProgress(opts: {
  hoursLogged: number;
  status: EnrollmentStatusLike;
  durationHours?: number | null;
  cpdHours?: number | null;
  targetHoursOverride?: number | null;
}): DerivedProgress {
  const targetHours = resolveTargetHours(opts.durationHours, opts.cpdHours, opts.targetHoursOverride);
  const hours = Number.isFinite(opts.hoursLogged) ? Math.max(0, opts.hoursLogged) : 0;

  if (opts.status === "completed") return { progress: 100, progressKnown: true, targetHours };
  if (opts.status === "not_started") return { progress: 0, progressKnown: targetHours !== null, targetHours };

  // in_progress — nothing logged yet is genuinely 0%, whatever the denominator.
  if (hours <= 0) return { progress: 0, progressKnown: targetHours !== null, targetHours };

  // No denominator means we cannot state a percentage honestly; the caller shows
  // the raw hours instead.
  if (targetHours === null) return { progress: 0, progressKnown: false, targetHours: null };

  const raw = Math.round((hours / targetHours) * 100);
  const progress = Math.min(IN_PROGRESS_CEILING, Math.max(IN_PROGRESS_FLOOR, raw));
  return { progress, progressKnown: true, targetHours };
}

/**
 * Largest single hours entry we accept. Anything above this is a typo or an abuse
 * of the honour system, not a day of study.
 */
export const MAX_HOURS_PER_ENTRY = 24;
