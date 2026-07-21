/**
 * Recommendation-chat preferences: the hard-coded questions and the pure,
 * deterministic preference-boost logic that reorders scored courses.
 *
 * Kept free of DB / AI imports so it is fully unit-testable (like scoring.ts).
 * The chat orchestration in `recommendChat.ts` composes this with the DB and
 * the AI selection step.
 */
import { numberToLevel, courseLevelToNumber, courseLevelFit } from "@/lib/levels";
import type { CourseScore } from "./scoring";

// ── Hard-coded preference questions (the ONLY things the user may answer) ──────

export interface ChatQuestionOption {
  value: string;
  label: string;
  hint?: string;
}
export interface ChatQuestion {
  id: keyof ChatAnswers;
  prompt: string;
  help?: string;
  multiSelect: boolean;
  options: ChatQuestionOption[];
}

export interface ChatAnswers {
  timeCommitment?: string;
  providers?: string[];
  goal?: string;
  difficulty?: string;
}

export const PREFERENCE_QUESTIONS: ChatQuestion[] = [
  {
    id: "timeCommitment",
    prompt: "How much time can you realistically give a course right now?",
    help: "This helps me weigh shorter, focused courses against longer, in-depth ones.",
    multiSelect: false,
    options: [
      { value: "short", label: "Short & focused", hint: "Under ~5 hours" },
      { value: "standard", label: "A few weeks", hint: "About 5–20 hours" },
      { value: "deep", label: "In-depth", hint: "20+ hours" },
      { value: "any", label: "No preference" },
    ],
  },
  {
    id: "providers",
    prompt: "Any course brands or providers you prefer? (pick any that apply)",
    help: "I'll give a gentle boost to courses from these, but only when they still fit your gaps.",
    multiSelect: true,
    options: [
      { value: "microsoft", label: "Microsoft" },
      { value: "google", label: "Google" },
      { value: "aws", label: "AWS / Amazon" },
      { value: "ibm", label: "IBM" },
      { value: "coursera", label: "Coursera" },
      { value: "linkedin", label: "LinkedIn Learning" },
      { value: "academic", label: "University / academic", hint: "edX, iMET, etc." },
      { value: "any", label: "No preference" },
    ],
  },
  {
    id: "goal",
    prompt: "What matters most for your next course?",
    help: "This shapes how I balance closing gaps against broadening out.",
    multiSelect: false,
    options: [
      { value: "gaps", label: "Close my role's skill gaps", hint: "Get role-ready fastest" },
      { value: "certification", label: "Earn a certificate / CPD hours" },
      { value: "broaden", label: "Broaden into new areas" },
      { value: "sharpen", label: "Sharpen my existing strengths" },
    ],
  },
  // Note: there is deliberately no "what level suits you?" question. The engine
  // infers the right course level itself from the learner's current skill levels
  // (see `courseLevelFit` in scoring: level-suitable courses are rewarded and
  // too-advanced ones penalised). The `difficulty` preference below is still
  // honoured if ever supplied programmatically, but we don't ask for it.
];

/** Human-readable label for a chosen answer value (for the AI payload). */
export function labelFor(questionId: keyof ChatAnswers, value: string): string {
  const q = PREFERENCE_QUESTIONS.find((x) => x.id === questionId);
  return q?.options.find((o) => o.value === value)?.label ?? value;
}

export function readablePreferences(answers: ChatAnswers): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (answers.timeCommitment) out.timeCommitment = labelFor("timeCommitment", answers.timeCommitment);
  if (answers.providers?.length) out.preferredProviders = answers.providers.map((p) => labelFor("providers", p));
  if (answers.goal) out.goal = labelFor("goal", answers.goal);
  if (answers.difficulty) out.difficulty = labelFor("difficulty", answers.difficulty);
  return out;
}

// ── Provider matching ─────────────────────────────────────────────────────────

export const PROVIDER_ALIASES: Record<string, string[]> = {
  microsoft: ["microsoft", "azure"],
  google: ["google"],
  aws: ["aws", "amazon"],
  ibm: ["ibm"],
  coursera: ["coursera"],
  linkedin: ["linkedin"],
  academic: ["university", "college", "academy", "edx", "imet", "imperial"],
};

export function matchesPreferredProvider(
  providerName: string | null,
  source: string | null,
  preferred: string[] | undefined
): boolean {
  if (!preferred?.length || preferred.includes("any")) return false;
  const hay = `${providerName ?? ""} ${source ?? ""}`.toLowerCase();
  return preferred.some((p) => (PROVIDER_ALIASES[p] ?? [p]).some((alias) => hay.includes(alias)));
}

// ── Preference-aware boosting (deterministic, explainable) ────────────────────

/** The course metadata the boost step needs (a subset of the DB course). */
export interface PreferenceCourse {
  provider: string | null;
  source: string | null;
  level: string | null;
  durationHours: number | null;
  cpdHours: number;
}

export interface Boosted {
  score: CourseScore;
  adjustedScore: number;
  preferenceMatches: string[];
}

/**
 * Apply user preferences as modest, explainable boosts on top of the
 * deterministic normalised score, then re-sort. Never removes a course — only
 * reorders — so the safety guarantees of the deterministic core are preserved.
 */
export function applyPreferences<C extends PreferenceCourse>(
  scores: CourseScore[],
  courseById: Map<string, C>,
  answers: ChatAnswers
): Boosted[] {
  const boosted = scores.map((score): Boosted => {
    const c = courseById.get(score.courseId)!;
    const matches: string[] = [];
    let bonus = 0;

    // Preferred brand / provider (+12).
    if (matchesPreferredProvider(c.provider, c.source, answers.providers)) {
      bonus += 12;
      matches.push(`From ${c.provider ?? c.source} — a provider you prefer`);
    }

    // Time commitment: reward courses inside the chosen band, gently penalise far-off ones.
    const h = c.durationHours;
    if (answers.timeCommitment && answers.timeCommitment !== "any" && h != null) {
      if (answers.timeCommitment === "short") {
        if (h <= 5) { bonus += 8; matches.push(`Short and focused (${h}h)`); }
        else if (h > 20) bonus -= 6;
      } else if (answers.timeCommitment === "standard") {
        if (h > 5 && h <= 20) { bonus += 8; matches.push(`Fits a few weeks (${h}h)`); }
      } else if (answers.timeCommitment === "deep") {
        if (h > 20) { bonus += 8; matches.push(`In-depth (${h}h)`); }
      }
    }

    // Difficulty preference vs. the course level and the learner's weakest covered skill.
    const employeeLevel = Math.min(...score.coveredGaps.map((g) => g.currentLevel));
    const courseLevelNum = courseLevelToNumber(c.level);
    if (answers.difficulty && courseLevelNum != null) {
      if (answers.difficulty === "beginner" && courseLevelNum === 1) {
        bonus += 8; matches.push("Beginner-friendly, as you asked");
      } else if (answers.difficulty === "challenge" && courseLevelNum === 3) {
        bonus += 8; matches.push("A step-up challenge");
      } else if (answers.difficulty === "match" && courseLevelFit(employeeLevel, courseLevelNum) === "suitable") {
        bonus += 8; matches.push(`Pitched at your ${numberToLevel(employeeLevel)} level`);
      }
    }

    // Goal: certificate/CPD → nudge courses that actually carry CPD hours.
    if (answers.goal === "certification" && c.cpdHours > 0) {
      bonus += 4; matches.push(`Carries ${c.cpdHours} CPD hours`);
    }

    return { score, adjustedScore: score.normalized + bonus, preferenceMatches: matches };
  });

  boosted.sort(compareBoosted);
  return boosted;
}

/**
 * Deterministic ranking order for preference-boosted scores: adjusted score,
 * then the same priority/relevance/quality tie-breaks as the unboosted core.
 * Exported so callers can re-sort a subset (e.g. after `selectDiverseTop`)
 * without duplicating the comparator.
 */
export function compareBoosted(a: Boosted, b: Boosted): number {
  return (
    b.adjustedScore - a.adjustedScore ||
    b.score.gapPriorityScore - a.score.gapPriorityScore ||
    b.score.relevanceRatio - a.score.relevanceRatio || // prefer the more on-target course
    b.score.qualityScore - a.score.qualityScore || // then the better-rated / more-taken one
    a.score.title.localeCompare(b.score.title)
  );
}
