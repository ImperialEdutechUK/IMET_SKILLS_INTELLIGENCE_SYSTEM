// The single source of truth for every team-level metric. Each function is
// named, documented, and returns its value together with a human definition
// string so the UI can render an info affordance next to the label. Nothing
// here reaches the database or invents a value — callers normalise their raw
// rows into MetricMember[] (excluding test accounts first) and pass them in.
//
// DECISIONS (confirmed with product):
//  • Managers are EXCLUDED from their own team aggregates — callers only ever
//    pass role=employee members here. The manager's personal XP is shown in
//    the top bar, labelled as personal.
//  • "Average skill level" is MEMBER-WEIGHTED over members WITH at least one
//    tracked skill (not skill-row-weighted, not counting zero-skill members).

/** Skill levels run 0…4 (None, Basic, Intermediate, Advanced, Expert). */
export const MAX_SKILL_LEVEL = 4;

export interface MetricMember {
  id: string;
  fullName: string;
  email: string;
  /** Self-assessed skills; each has current/target on the 0…MAX_SKILL_LEVEL scale. */
  userSkills: { currentLevel: number; targetLevel: number }[];
  enrollmentsCount: number;
  coursesCompleted: number;
  coursesInProgress: number;
  cpdHours: number;
  cpdRecordsCount: number;
  /** Progress toward the ANNUAL target, 0–100 (from cpdRiskStatus). */
  cpdProgress: number;
  /** Time-aware pace band from cpdRiskStatus: null == on pace. */
  riskStatus: "at_risk" | "attention" | null;
}

export type TeamStatus = "on_track" | "attention" | "at_risk" | "not_started";

// ---- Populations (never use the bare word "team" as a denominator) ----------

/** Everyone on the team (employees, test accounts already removed by the caller). */
export function totalMembers(members: MetricMember[]): number {
  return members.length;
}

/** Members enrolled in (or having completed) at least one course. */
export function activeLearners(members: MetricMember[]): number {
  return members.filter((m) => m.coursesInProgress > 0 || m.coursesCompleted > 0).length;
}

/** Members who have recorded at least one skill. */
export function membersWithTrackedSkills(members: MetricMember[]): number {
  return members.filter((m) => m.userSkills.length > 0).length;
}

// ---- Status ----------------------------------------------------------------

/**
 * A member with no enrolments AND no CPD records has nothing to be judged on —
 * they are UNSTARTED, not behind. This is checked before the pace bands so
 * "no data" is never reported as "at risk".
 */
export function memberStatus(m: MetricMember): TeamStatus {
  if (m.enrollmentsCount === 0 && m.cpdRecordsCount === 0) return "not_started";
  if (m.riskStatus === "at_risk") return "at_risk";
  if (m.riskStatus === "attention") return "attention";
  return "on_track";
}

export interface PaceBreakdown {
  onTrack: number;
  attention: number;
  atRisk: number;
  notStarted: number;
  definition: string;
}

/** Four distinct populations. "Not started" is separated from "at risk". */
export function paceBreakdown(members: MetricMember[]): PaceBreakdown {
  const b = { onTrack: 0, attention: 0, atRisk: 0, notStarted: 0 };
  for (const m of members) {
    const s = memberStatus(m);
    if (s === "on_track") b.onTrack++;
    else if (s === "attention") b.attention++;
    else if (s === "at_risk") b.atRisk++;
    else b.notStarted++;
  }
  return {
    ...b,
    definition:
      "Members split by learning pace vs the expected-by-now share of their annual CPD target. " +
      "‘Not started’ = no enrolments and no logged hours (not counted as at risk).",
  };
}

// ---- Averages --------------------------------------------------------------

export interface AvgSkillLevel {
  /** 0–100, % of the maximum skill level. */
  value: number;
  /** Members with ≥1 tracked skill (the population this average covers). */
  tracked: number;
  /** All members on the team. */
  total: number;
  definition: string;
}

/**
 * Average skill level — MEMBER-WEIGHTED, over members with ≥1 tracked skill,
 * as a percentage of the maximum level. Each member's own mean skill level is
 * computed first, then averaged across members (so a member with many skills
 * does not dominate). Members with no tracked skills are excluded, not zeroed.
 */
export function avgSkillLevelPct(members: MetricMember[]): AvgSkillLevel {
  const skilled = members.filter((m) => m.userSkills.length > 0);
  const perMemberMean = skilled.map(
    (m) => m.userSkills.reduce((s, us) => s + us.currentLevel, 0) / m.userSkills.length
  );
  const mean = perMemberMean.length
    ? perMemberMean.reduce((a, b) => a + b, 0) / perMemberMean.length
    : 0;
  return {
    value: Math.round((mean / MAX_SKILL_LEVEL) * 100),
    tracked: skilled.length,
    total: members.length,
    definition: `Mean of each member's average skill level, across the ${skilled.length} of ${members.length} members with at least one tracked skill, as a percentage of the maximum level (${MAX_SKILL_LEVEL}).`,
  };
}

export interface AvgCpdProgress {
  /** 0–100 mean CPD progress toward the annual target. */
  value: number;
  population: number;
  definition: string;
}

/**
 * Average CPD progress — mean of each member's progress toward the ANNUAL CPD
 * hours target, across all members. A member with no logged hours counts as 0%.
 * (This is the metric previously mislabelled "Average progress".)
 */
export function avgCpdProgressPct(members: MetricMember[]): AvgCpdProgress {
  const value = members.length
    ? Math.round(members.reduce((s, m) => s + m.cpdProgress, 0) / members.length)
    : 0;
  return {
    value,
    population: members.length,
    definition: `Mean progress toward the annual CPD hours target across all ${members.length} team members (a member with no logged hours counts as 0%).`,
  };
}
