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

  const gold = BADGES.find((b) => b.key === "gold")!;
  const goldUnlocked = certCount >= gold.need;

  return {
    certCount, coursesCompleted, cpdHours,
    xp, level, title: levelTitle(level), levelPct, xpIntoLevel, xpForLevel: XP_PER_LEVEL, xpToNextLevel,
    earned, current, next, toNext,
    goldUnlocked, prize: goldUnlocked ? GOLD_PRIZE : null,
    prizeAt: gold.need, toPrize: Math.max(0, gold.need - certCount), badges: BADGES,
  };
}
