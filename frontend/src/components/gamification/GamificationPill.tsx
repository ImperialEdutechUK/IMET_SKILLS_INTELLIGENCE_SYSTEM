"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computeGamification, type GamInput } from "@/lib/gamification";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

// Always-on gamification widget for the top bar — keeps the player's level, XP
// and current medal visible on every page of the app. Links to the full
// Achievements view. Read-only; degrades to nothing if data can't load.
export default function GamificationPill() {
  const [input, setInput] = useState<GamInput | null>(null);

  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${getToken()}` } };
    // Read already-deployed endpoints so the pill works without waiting on a
    // backend redeploy; certificate count + completed courses + CPD hours.
    Promise.all([
      fetch(`${API}/api/me/certificates`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API}/api/me/dashboard`, h).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([certs, dash]) => {
      if (!certs && !dash) return;
      setInput({
        certificates: certs?.certificates?.length ?? 0,
        coursesCompleted: dash?.completedCount ?? 0,
        cpdHours: dash?.cpdHours ?? 0,
      });
    });
  }, []);

  if (!input) return null;
  const g = computeGamification(input);

  return (
    <Link
      data-tour="topbar-level"
      href="/me/learning?tab=certificates"
      title={`${g.title} · Level ${g.level} · ${g.xp} XP`}
      className="hidden items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-[var(--brand-tint)] py-1 pl-1.5 pr-3 transition hover:shadow-sm sm:flex"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm shadow-sm">{g.current?.emoji ?? "🌱"}</span>
      <span className="leading-tight">
        <span className="flex items-center gap-1.5">
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
