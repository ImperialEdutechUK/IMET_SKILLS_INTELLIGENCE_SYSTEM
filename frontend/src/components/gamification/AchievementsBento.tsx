"use client";

import type { LucideIcon } from "lucide-react";
import { Lock, Zap, GraduationCap, BookOpen, Clock, Star } from "lucide-react";
import { computeGamification, GOLD_PRIZE, type GamInput, type BadgeTier } from "@/lib/gamification";

// A genuinely game-like achievements experience: a level/XP hero, a badge-journey
// roadmap, a reward banner and an animated trophy shelf. Green-forward bento on a
// white page; medals keep their metal colours so bronze→platinum reads instantly.
export default function AchievementsBento(input: GamInput) {
  const g = computeGamification(input);
  const maxNeed = g.badges[g.badges.length - 1].need;
  const trackPct = Math.min(100, Math.round((g.certCount / maxNeed) * 100));

  return (
    <div className="mb-8 space-y-4">
      {/* HERO — level, title, XP */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg, #2e7d5b 0%, #123f2b 100%)" }}>
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-lime-300/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="gam-float grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-white/15 text-center ring-1 ring-white/30">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Level</p>
                <p className="text-4xl font-extrabold leading-none">{g.level}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">You are a</p>
              <p className="text-2xl font-extrabold leading-tight">{g.title}</p>
              <p className="text-sm text-white/80">{g.current ? `${g.current.emoji} ${g.current.label} badge holder` : "Earn your first badge!"}</p>
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-1.5 flex items-end justify-between">
              <span className="inline-flex items-center gap-1.5 text-lg font-extrabold"><Zap className="h-5 w-5 fill-current" /> {g.xp} XP</span>
              <span className="text-xs text-white/80">{g.xpToNextLevel} XP to Level {g.level + 1}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-white/20">
              <div className="gam-fill h-full rounded-full" style={{ width: `${g.levelPct}%`, background: "linear-gradient(90deg,#bef264,#a7f3d0)" }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
              <Chip icon={GraduationCap} value={g.certCount} label="Certificates" />
              <Chip icon={BookOpen} value={g.coursesCompleted} label="Courses" />
              <Chip icon={Clock} value={g.cpdHours} label="CPD hrs" />
            </div>
          </div>
        </div>
      </div>

      {/* ROADMAP — the badge journey */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)]">Your badge journey</h3>
          <span className="text-xs text-[var(--muted)]">{g.earned.length} of {g.badges.length} unlocked</span>
        </div>
        <div className="relative px-4">
          <div className="absolute left-8 right-8 top-7 h-1.5 rounded-full bg-slate-100" />
          <div className="gam-fill absolute left-8 top-7 h-1.5 rounded-full bg-[var(--brand)]" style={{ width: `calc((100% - 4rem) * ${trackPct / 100})` }} />
          <div className="relative grid grid-cols-4">
            {g.badges.map((b) => {
              const earned = g.certCount >= b.need;
              return (
                <div key={b.key} className="flex flex-col items-center gap-2">
                  <Medal badge={b} earned={earned} size={56} pulse={g.next?.key === b.key} />
                  <p className={`text-xs font-semibold ${earned ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{b.label}</p>
                  <p className="text-[10px] text-[var(--muted)]">{earned ? "Unlocked ✓" : `${b.need} certs`}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REWARD */}
      {g.goldUnlocked ? (
        <div className="gam-shine relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #e0a005 0%, #b45309 100%)" }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20 text-2xl">🎁</span>
          <div>
            <p className="font-bold">Reward unlocked — {g.prize}</p>
            <p className="text-sm text-white/85">You reached Gold with {g.certCount} certificates. Claim it from your L&amp;D team.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--brand-tint)] p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-2xl">🎁</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--ink)]">Reach 🥇 Gold to unlock a reward</p>
            <p className="text-sm text-[var(--muted)]">{5 - g.certCount} more certificate{5 - g.certCount === 1 ? "" : "s"} (5 total) to claim a {GOLD_PRIZE}.</p>
            <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, (g.certCount / 5) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* TROPHY SHELF */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Star className="h-4 w-4 fill-[var(--brand)] text-[var(--brand)]" />
          <h3 className="font-semibold text-[var(--ink)]">Trophy shelf</h3>
          <span className="text-xs text-[var(--muted)]">· collect them all</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {g.badges.map((b, i) => {
            const earned = g.certCount >= b.need;
            const isLatest = g.current?.key === b.key;
            return (
              <div key={b.key} className={`gam-pop relative flex flex-col items-center rounded-2xl border p-5 text-center ${earned ? "border-[var(--brand)]/25 bg-[var(--brand-tint)]/60" : "border-[var(--border)] bg-slate-50"}`} style={{ animationDelay: `${i * 80}ms` }}>
                {isLatest && <span className="absolute -top-2 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold text-white shadow">NEW</span>}
                <Medal badge={b} earned={earned} size={72} />
                <p className={`mt-3 text-sm font-bold ${earned ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{b.label}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{earned ? "Earned ✓" : `${b.need - g.certCount} more (${b.need} certs)`}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Medal({ badge, earned, size, pulse }: { badge: BadgeTier; earned: boolean; size: number; pulse?: boolean }) {
  const inner = earned ? (
    <div className="gam-shine relative grid h-full w-full place-items-center overflow-hidden rounded-full" style={{ background: `linear-gradient(145deg, ${badge.from}, ${badge.to})`, boxShadow: `0 6px 16px -4px ${badge.to}88, inset 0 1px 2px rgba(255,255,255,.5)` }}>
      <span style={{ fontSize: size * 0.42 }} className="drop-shadow-sm">{badge.emoji}</span>
    </div>
  ) : (
    <div className="relative grid h-full w-full place-items-center rounded-full bg-slate-200">
      <span style={{ fontSize: size * 0.4 }} className="opacity-30 grayscale">{badge.emoji}</span>
      <span className="absolute bottom-0 right-0 grid h-1/3 w-1/3 place-items-center rounded-full bg-slate-400 text-white ring-2 ring-white"><Lock style={{ width: size * 0.16, height: size * 0.16 }} /></span>
    </div>
  );
  return <div className={`relative rounded-full ${pulse ? "gam-pulse-ring" : ""}`} style={{ width: size, height: size }}>{inner}</div>;
}

function Chip({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-white/90" />
      <div className="min-w-0">
        <p className="text-sm font-bold leading-none">{value}</p>
        <p className="truncate text-[10px] text-white/70">{label}</p>
      </div>
    </div>
  );
}
