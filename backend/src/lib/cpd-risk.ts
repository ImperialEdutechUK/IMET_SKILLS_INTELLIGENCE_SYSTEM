// Shared CPD risk engine.
//
// CPD targets are ANNUAL (hoursPerYear). A flat percentage threshold is
// time-blind: an employee at 48% of a 40h target in July is on-pace to
// finish by December, yet a naive `< 50%` rule flags them "at_risk".
//
// This helper is TIME-AWARE. It compares logged hours against how many
// hours the employee should have accrued BY NOW, pro-rated across the year:
//   expectedHours = (days elapsed this year / days in year) × targetHours
//   pace          = cpdHours / expectedHours   (1.0 == exactly on-pace)
// The at_risk / attention bands mirror the old 50% / 75% split, but relative
// to the expected-by-now figure rather than the full-year total.

export type CpdAttentionStatus = "at_risk" | "attention" | null;

export interface CpdRisk {
  /** Progress toward the FULL-YEAR target, 0–100 (unchanged display value). */
  cpdProgress: number;
  /** Hours the employee should have accrued by now, pro-rated across the year. */
  expectedHours: number;
  /** cpdHours / expectedHours. 1.0 == on-pace; < 1 == behind pace. */
  pace: number;
  /** Time-aware risk band. null == on track. */
  status: CpdAttentionStatus;
}

const AT_RISK_PACE = 0.5;
const ATTENTION_PACE = 0.75;

export function cpdRiskStatus(
  cpdHours: number,
  targetHours: number,
  now: Date = new Date()
): CpdRisk {
  const cpdProgress =
    targetHours > 0 ? Math.min(100, Math.round((cpdHours / targetHours) * 100)) : 0;

  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const startOfNextYear = new Date(year + 1, 0, 1).getTime();
  const daysInYear = (startOfNextYear - startOfYear) / 86_400_000;
  const daysElapsed = Math.max(0, (now.getTime() - startOfYear) / 86_400_000);
  const yearFraction = Math.min(1, daysElapsed / daysInYear);

  const expectedHours = targetHours * yearFraction;
  // Before any time has elapsed (or with no target), treat everyone as on-pace.
  const pace = expectedHours > 0 ? cpdHours / expectedHours : 1;

  let status: CpdAttentionStatus = null;
  // Already met the annual target → never flagged, regardless of pace.
  if (cpdProgress < 100) {
    if (pace < AT_RISK_PACE) status = "at_risk";
    else if (pace < ATTENTION_PACE) status = "attention";
  }

  return { cpdProgress, expectedHours, pace, status };
}
