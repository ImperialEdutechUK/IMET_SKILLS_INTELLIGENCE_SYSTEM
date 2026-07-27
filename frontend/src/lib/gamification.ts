// Gamification algorithm — turns a learner's certificate count into XP, a level,
// milestone badges (Bronze → Platinum) and a reward for reaching Gold.
// Pure and deterministic: derived live from data already on the page, no backend.

export type BadgeKey = "bronze" | "silver" | "gold" | "platinum";

export interface BadgeTier {
  key: BadgeKey;
  label: string;
  need: number;   // certificates required to earn it
  emoji: string;
  ring: string;   // shade used when earned
}

export const BADGES: BadgeTier[] = [
  { key: "bronze",   label: "Bronze",   need: 1,  emoji: "🥉", ring: "#b7791f" },
  { key: "silver",   label: "Silver",   need: 3,  emoji: "🥈", ring: "#64748b" },
  { key: "gold",     label: "Gold",     need: 5,  emoji: "🥇", ring: "#eab308" },
  { key: "platinum", label: "Platinum", need: 10, emoji: "🏆", ring: "#0f766e" },
];

export const XP_PER_CERTIFICATE = 100;
export const XP_PER_LEVEL = 300;

// The reward you unlock at Gold (5 certificates).
export const GOLD_PRIZE = "£50 learning voucher";

export interface Gamification {
  certCount: number;
  xp: number;
  level: number;
  levelPct: number;      // progress through the current level (0–100)
  xpIntoLevel: number;
  xpForLevel: number;
  earned: BadgeTier[];
  current: BadgeTier | null;   // highest earned badge
  next: BadgeTier | null;      // next badge to chase
  toNext: number;              // certificates still needed for `next`
  goldUnlocked: boolean;
  prize: string | null;
  badges: BadgeTier[];
}

export function computeGamification(certCount: number): Gamification {
  const xp = certCount * XP_PER_CERTIFICATE;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp - (level - 1) * XP_PER_LEVEL;
  const levelPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);

  const earned = BADGES.filter((b) => certCount >= b.need);
  const current = earned.length ? earned[earned.length - 1] : null;
  const next = BADGES.find((b) => certCount < b.need) ?? null;
  const toNext = next ? next.need - certCount : 0;

  const gold = BADGES.find((b) => b.key === "gold")!;
  const goldUnlocked = certCount >= gold.need;

  return {
    certCount,
    xp,
    level,
    levelPct,
    xpIntoLevel,
    xpForLevel: XP_PER_LEVEL,
    earned,
    current,
    next,
    toNext,
    goldUnlocked,
    prize: goldUnlocked ? GOLD_PRIZE : null,
    badges: BADGES,
  };
}
