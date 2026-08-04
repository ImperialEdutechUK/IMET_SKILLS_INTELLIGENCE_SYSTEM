"use client";

import { Lock, Zap } from "lucide-react";
import { computeGamification, type GamInput, type BadgeTier } from "@/lib/gamification";

// Condensed counterpart to AchievementsBento. A manager reviewing one employee
// doesn't need the full trophy shelf — just the three things that matter at a
// glance: what level they're on, which badge they hold (and the next one), and
// how many certificates they've earned. One row, no scrolling.
export default function AchievementsSummary(input: GamInput) {
  const g = computeGamification(input);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Current level */}
      <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #45a37c 0%, #216b4c 100%)" }}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-center ring-1 ring-white/30">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">Level</p>
              <p className="text-2xl font-extrabold leading-none">{g.level}</p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold leading-tight">{g.title}</p>
            <p className="inline-flex items-center gap-1 text-xs text-white/80"><Zap className="h-3.5 w-3.5 fill-current" /> {g.xp} XP</p>
          </div>
        </div>
        <div className="relative">
          <div className="mb-1 text-[11px] text-white/80">{g.xpToNextLevel} XP to Level {g.level + 1}</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full" style={{ width: `${g.levelPct}%`, background: "linear-gradient(90deg,#bef264,#a7f3d0)" }} />
          </div>
        </div>
      </div>

      {/* Trophy badge — the tier actually EARNED, plus honest progress to the next
          one. A locked tier never gets a medal here, so a manager can't read
          "working toward Bronze" as "holds Bronze". */}
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        {g.current ? (
          <Medal badge={g.current} />
        ) : (
          <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-slate-100">
            <span className="text-2xl opacity-30 grayscale">🏅</span>
            <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-slate-400 text-white ring-2 ring-white"><Lock className="h-2.5 w-2.5" /></span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Trophy badge</p>
          <p className="text-lg font-bold leading-tight text-[var(--ink)]">{g.current ? g.current.label : "No badge yet"}</p>
          <p className="text-xs text-[var(--muted)]">
            {g.next
              ? `${g.certCount} of ${g.next.need} certificates to ${g.next.label}`
              : "All badges unlocked"}
          </p>
          {g.next && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${g.nextProgressPct}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Certificates */}
      <div className="flex flex-col justify-center rounded-2xl p-5" style={{ background: "#e8f1ed" }}>
        <p className="text-4xl font-extrabold leading-none text-[var(--brand-dark)]">{g.certCount}</p>
        <p className="mt-2 text-sm font-semibold text-[var(--brand-dark)]">Certificates earned</p>
        <p className="text-xs text-[var(--brand-dark)]/80">{g.coursesCompleted} course{g.coursesCompleted === 1 ? "" : "s"} completed</p>
      </div>
    </div>
  );
}

function Medal({ badge }: { badge: BadgeTier }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: `linear-gradient(145deg, ${badge.from}, ${badge.to})`, boxShadow: `0 6px 16px -6px ${badge.to}88, inset 0 1px 2px rgba(255,255,255,.5)` }}>
      <span className="text-2xl drop-shadow-sm">{badge.emoji}</span>
    </div>
  );
}
