// Gamification engine — turns real learning activity (certificates, completed
// courses, CPD hours) into XP, levels, milestone badges and a reward. Pure and
// deterministic so the same inputs give the same game state anywhere in the app.

export type BadgeKey = "bronze" | "silver" | "gold" | "platinum";

export interface BadgeTier {
  key: BadgeKey;
  label: string;
  need: number;   // certificates required to earn it
  days: number;   // challenging time frame to earn them within
  emoji: string;
  from: string;   // medal gradient (light)
  to: string;     // medal gradient (dark)
}

// Metal-coloured medals read instantly as bronze→platinum. Each carries a
// deliberately challenging time frame (~5 certificates per month, sustained).
export const BADGES: BadgeTier[] = [
  { key: "bronze",   label: "Bronze",   need: 5,  days: 30,  emoji: "🥉", from: "#e8b06b", to: "#a9691f" },
  { key: "silver",   label: "Silver",   need: 10, days: 60,  emoji: "🥈", from: "#dfe6ec", to: "#9aa7b4" },
  { key: "gold",     label: "Gold",     need: 15, days: 90,  emoji: "🥇", from: "#ffdf6e", to: "#e0a005" },
  { key: "platinum", label: "Platinum", need: 20, days: 120, emoji: "🏆", from: "#a7f3d0", to: "#0f766e" },
];

// XP is earned across the whole system, so every action nudges the learner back.
export const XP_PER_CERTIFICATE = 100;
export const XP_PER_COURSE = 50;
export const XP_PER_CPD_HOUR = 10;
export const XP_PER_LEVEL = 500;

// Level flavour titles — the "you are a …" identity that keeps players climbing.
export const LEVEL_TITLES = ["Rookie", "Explorer", "Achiever", "Specialist", "Expert", "Master", "Legend"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

// The reward you unlock at Gold (15 certificates).
export const GOLD_PRIZE = "cash prize";

export interface GamInput { certificates: number; coursesCompleted?: number; cpdHours?: number }

// --- Trophy-shelf geometry -------------------------------------------------
// The medals are laid out on an EVEN grid (one column per tier), so tier i sits
// at the centre of its column — not at `need / maxNeed`. Any rail drawn under
// them has to use these anchors, otherwise the fill overshoots a medal the
// learner hasn't earned yet (3 of 20 certs = 15% of the bar, but Bronze's medal
// centre is only 12.5% across — the bar visually "awards" Bronze at 3 certs).

/** Centre of tier `index`'s medal, as a % of the medal row's width. */
export const badgeAnchorPct = (index: number, total: number) => ((index + 0.5) / total) * 100;

/**
 * How far the trophy rail should fill for a given certificate count, as a % of
 * the medal row's width. Interpolates between medal anchors, so the fill lands
 * exactly on a medal the moment it is earned — never a pixel before.
 */
export function trackFillPct(certCount: number, badges: BadgeTier[] = BADGES): number {
  if (!badges.length) return 0;
  // Segment 0 runs from the row's left edge (0 certs) to the first medal.
  const anchors = [0, ...badges.map((_, i) => badgeAnchorPct(i, badges.length))];
  const needs = [0, ...badges.map((b) => b.need)];

  for (let i = 0; i < needs.length - 1; i++) {
    if (certCount < needs[i + 1]) {
      const span = needs[i + 1] - needs[i];
      const t = span > 0 ? Math.max(0, Math.min(1, (certCount - needs[i]) / span)) : 1;
      return anchors[i] + t * (anchors[i + 1] - anchors[i]);
    }
  }
  return 100; // every tier earned — run the rail all the way out
}

export interface Gamification {
  certCount: number;
  coursesCompleted: number;
  cpdHours: number;
  xp: number;
  level: number;
  title: string;
  levelPct: number;      // progress through the current level (0–100)
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNextLevel: number;
  earned: BadgeTier[];
  current: BadgeTier | null;   // highest earned badge
  next: BadgeTier | null;      // next badge to chase
  toNext: number;              // certificates still needed for `next`
  nextFrom: number;            // certificates the current tier started at
  nextProgressPct: number;     // progress from `nextFrom` → `next.need` (0–100)
  trackPct: number;            // trophy-rail fill, aligned to the medal anchors
  goldUnlocked: boolean;
  prize: string | null;
  prizeAt: number;             // certificates required to unlock the cash prize
  toPrize: number;             // certificates still needed for the prize
  badges: BadgeTier[];
}

export function computeGamification(input: GamInput): Gamification {
  const certCount = input.certificates;
  const coursesCompleted = input.coursesCompleted ?? 0;
  const cpdHours = input.cpdHours ?? 0;

  const xp =
    certCount * XP_PER_CERTIFICATE +
    coursesCompleted * XP_PER_COURSE +
    Math.round(cpdHours) * XP_PER_CPD_HOUR;

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp - (level - 1) * XP_PER_LEVEL;
  const levelPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;

  const earned = BADGES.filter((b) => certCount >= b.need);
  const current = earned.length ? earned[earned.length - 1] : null;
  const next = BADGES.find((b) => certCount < b.need) ?? null;
  const toNext = next ? next.need - certCount : 0;

  // Progress toward the next medal is measured from the tier you're standing on,
  // not from zero — otherwise 12 certificates would read as "80% to Gold" when
  // it's really 2 of the 5 certificates between Silver and Gold.
  const nextFrom = current ? current.need : 0;
  const nextProgressPct = next
    ? Math.max(0, Math.min(100, Math.round(((certCount - nextFrom) / (next.need - nextFrom)) * 100)))
    : 100;

  const gold = BADGES.find((b) => b.key === "gold")!;
  const goldUnlocked = certCount >= gold.need;

  return {
    certCount, coursesCompleted, cpdHours,
    xp, level, title: levelTitle(level), levelPct, xpIntoLevel, xpForLevel: XP_PER_LEVEL, xpToNextLevel,
    earned, current, next, toNext, nextFrom, nextProgressPct, trackPct: trackFillPct(certCount),
    goldUnlocked, prize: goldUnlocked ? GOLD_PRIZE : null,
    prizeAt: gold.need, toPrize: Math.max(0, gold.need - certCount), badges: BADGES,
  };
}
