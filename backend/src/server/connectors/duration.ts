/**
 * Workload → hours parsing.
 *
 * Coursera's `workload` field is free text written by course authors in several
 * languages: "1 hour 30 minutes", "4h 30m", "2 heures", "1.5 hours",
 * "4 weeks of study, 2-4 hours a week", or a sentence. Roughly 55% of courses
 * populate it at all.
 *
 * Deliberate choice: a rate with no duration ("4-8 hours/week", no week count)
 * returns `undefined` rather than a guess. cpdHours feeds recommendation
 * scoring, so an absent value is safer than an invented one.
 */

/** Hours assumed per week when a course states weeks but no weekly rate. */
export const DEFAULT_HOURS_PER_WEEK = 3;

/** Anything beyond this is a parse artefact, not a course length. */
const MAX_PLAUSIBLE_HOURS = 2000;

const HOUR = String.raw`hours?|hrs?|heures?|heure|horas?|hora|stunden|stunde|ore|ora|h`;
const MIN = String.raw`minutes?|minuten|minutos?|minuti|mins?|m`;
const WEEK = String.raw`weeks?|semaines?|semanas?|wochen|woche|settimane|settimana`;

/** A number or a range ("2", "1.5", "2-4", "1 to 2"). Captures both bounds. */
const NUM = String.raw`(\d+(?:[.,]\d+)?)(?:\s*(?:[-–—]|to|a|à)\s*(\d+(?:[.,]\d+)?))?`;

/** "… per week", "… /week", "… a week", "… par semaine". */
const PER_WEEK = String.raw`\s*(?:\/|per\s+|a\s+|each\s+|por\s+|par\s+|pro\s+)\s*(?:${WEEK})`;

const perWeekRe = new RegExp(`${NUM}\\s*(?:${HOUR})\\b${PER_WEEK}`, "i");
const weeksRe = new RegExp(`${NUM}\\s*(?:${WEEK})\\b`, "i");
const hoursRe = new RegExp(`${NUM}\\s*(?:${HOUR})\\b`, "i");
const minsRe = new RegExp(`${NUM}\\s*(?:${MIN})\\b`, "i");

/** Midpoint of a captured range, or the single value. Handles "1,5" decimals. */
function midpoint(match: RegExpMatchArray): number {
  const lo = parseFloat(match[1].replace(",", "."));
  const hi = match[2] ? parseFloat(match[2].replace(",", ".")) : undefined;
  return hi !== undefined && hi >= lo ? (lo + hi) / 2 : lo;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Parse an ISO-8601 duration ("PT3H41M22S") into hours. This is the shape
 * LinkedIn Learning emits in its `courseWorkload` JSON-LD field, distinct from
 * Coursera's free-text `workload`. Only the time part (PTnHnMnS) is honoured;
 * a course length is never expressed in days/months, so those are ignored.
 */
export function parseIsoDuration(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(raw.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const hours = Number(m[1] ?? 0) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600;
  return hours > 0 && hours <= MAX_PLAUSIBLE_HOURS ? round2(hours) : undefined;
}

/**
 * Parse a free-text workload string into whole hours of study.
 * Returns `undefined` when no defensible total can be derived.
 */
export function parseWorkload(raw?: string | number | null): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") return raw > 0 && raw <= MAX_PLAUSIBLE_HOURS ? raw : undefined;

  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return undefined;

  const perWeek = s.match(perWeekRe);
  const weeks = s.match(weeksRe);

  // "N weeks [, M hours/week]" — a duration we can multiply out.
  if (weeks) {
    const total = midpoint(weeks) * (perWeek ? midpoint(perWeek) : DEFAULT_HOURS_PER_WEEK);
    return total > 0 && total <= MAX_PLAUSIBLE_HOURS ? round2(total) : undefined;
  }

  // A weekly rate with no week count is an unknown total. Don't guess.
  if (perWeek) return undefined;

  const hours = s.match(hoursRe);
  const mins = s.match(minsRe);
  // A bare minutes match must not re-read the hours match ("1 hour 30 minutes").
  const minsAfterHours = hours && mins ? (mins.index ?? 0) > (hours.index ?? 0) : true;

  let total = 0;
  if (hours) total += midpoint(hours);
  if (mins && minsAfterHours) total += midpoint(mins) / 60;

  return total > 0 && total <= MAX_PLAUSIBLE_HOURS ? round2(total) : undefined;
}
