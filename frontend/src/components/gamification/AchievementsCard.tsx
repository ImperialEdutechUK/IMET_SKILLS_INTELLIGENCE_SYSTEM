"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { computeGamification, type GamInput } from "@/lib/gamification";

// Compact gamification widget for the dashboard — same engine/inputs as the full
// Achievements page, so the level, XP and badges stay identical across the app.
export default function AchievementsCard(input: GamInput) {
  const g = computeGamification(input);
  return (
    <Link
      href="/me/certificates"
      className="group relative mb-6 block overflow-hidden rounded-2xl p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "linear-gradient(135deg, #45a37c 0%, #216b4c 100%)" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        {/* Level shield */}
        <div className="gam-float grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-center ring-1 ring-white/30">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-white/70">Lvl</p>
            <p className="text-2xl font-extrabold leading-none">{g.level}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-extrabold">{g.title}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold"><Zap className="h-3 w-3 fill-current" /> {g.xp} XP</span>
            {g.current && <span className="text-lg">{g.current.emoji}</span>}
            {g.goldUnlocked && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">🎁 Reward</span>}
          </div>
          <div className="mt-2 max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-white/80">
              <span>Level {g.level}</span>
              <span>{g.next ? `${g.toNext} to ${g.next.emoji} ${g.next.label}` : "All badges earned 🏆"}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="gam-fill h-full rounded-full" style={{ width: `${g.levelPct}%`, background: "linear-gradient(90deg,#bef264,#a7f3d0)" }} />
            </div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-white/90 transition group-hover:gap-2">
          Achievements <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
