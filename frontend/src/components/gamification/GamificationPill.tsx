"use client";

import Link from "next/link";
import { computeGamification, type GamInput } from "@/lib/gamification";
import { useApi } from "@/lib/api";

// Always-on gamification widget for the top bar — keeps the player's level, XP
// and current medal visible on every page of the app. Links to the full
// Achievements view. Read-only; degrades to nothing if data can't load.
//
// It reads the same two endpoints the employee dashboard does. Both go through
// SWR, so they share one cache entry and one in-flight request — mounting this
// on every page costs nothing beyond the first fetch.
export default function GamificationPill() {
  const { data: certs } = useApi<{ certificates: unknown[] }>("/api/me/certificates");
  const { data: dash } = useApi<{ completedCount: number; cpdHours: number }>("/api/me/dashboard");

  if (!certs && !dash) return null;
  const input: GamInput = {
    certificates: certs?.certificates?.length ?? 0,
    coursesCompleted: dash?.completedCount ?? 0,
    cpdHours: dash?.cpdHours ?? 0,
  };
  const g = computeGamification(input);

  return (
    <Link
      data-tour="topbar-level"
      href="/me/learning?tab=certificates"
      aria-label={`Your personal learning progress: ${g.title}, level ${g.level}, ${g.xp} XP`}
      className="hidden items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-[var(--brand-tint)] py-1 pl-1.5 pr-3 transition hover:shadow-sm sm:flex"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm shadow-sm">{g.current?.emoji ?? "🌱"}</span>
      <span className="leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--brand)]/70">You</span>
          <span className="text-xs font-bold text-[var(--brand-dark)]">Lv {g.level}</span>
          <span className="text-[10px] font-semibold text-[var(--brand)]">{g.xp} XP</span>
        </span>
        <span className="mt-0.5 block h-1 w-16 overflow-hidden rounded-full bg-white/80">
          <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${g.levelPct}%` }} />
        </span>
      </span>
    </Link>
  );
}
