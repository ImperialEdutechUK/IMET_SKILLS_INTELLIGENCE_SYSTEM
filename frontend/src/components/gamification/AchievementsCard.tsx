"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { computeGamification } from "@/lib/gamification";

// Compact gamification widget for the dashboard — the same badge/XP/level the
// Certificates page shows, in a single green tile. Keeps the game visible and
// connected across the app. Links through to the full Achievements view.
export default function AchievementsCard({ certCount }: { certCount: number }) {
  const g = computeGamification(certCount);
  return (
    <Link
      href="/me/certificates"
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl p-5 text-white transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "linear-gradient(135deg, #2e7d5b 0%, #1c5038 100%)" }}
    >
      <Ring pct={g.levelPct} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl">{g.current?.emoji ?? "🌱"}</span>
          <span className="text-lg font-bold">{g.current ? `${g.current.label} Achiever` : "Getting started"}</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Level {g.level}</span>
          {g.goldUnlocked && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">🎁 Reward unlocked</span>}
        </div>
        <div className="mt-2 max-w-md">
          <div className="mb-1 flex items-center justify-between text-xs text-white/80">
            <span>{g.xpIntoLevel} / {g.xpForLevel} XP</span>
            <span>{g.next ? `${g.toNext} more to ${g.next.emoji} ${g.next.label}` : "All badges earned 🏆"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${g.levelPct}%` }} />
          </div>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-white/90">
        Achievements <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 68, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, pct) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center"><span className="text-sm font-bold text-white">{pct}%</span></div>
    </div>
  );
}
