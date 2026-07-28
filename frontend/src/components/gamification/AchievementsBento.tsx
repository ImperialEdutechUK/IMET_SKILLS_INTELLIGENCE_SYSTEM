"use client";

import type { LucideIcon } from "lucide-react";
import { Lock, Zap, GraduationCap, BookOpen, Star } from "lucide-react";
import { computeGamification, type GamInput, type BadgeTier } from "@/lib/gamification";

// A genuine Bento grid: modular rounded tiles of different sizes packed into one
// grid so the whole game reads in a glance — big level/XP hero, small green stat
// tiles, a wide reward, and a full-width trophy shelf. White page, green shades;
// medals keep their metal colours so bronze→platinum is obvious.
export default function AchievementsBento(input: GamInput) {
  const g = computeGamification(input);
  const maxNeed = g.badges[g.badges.length - 1].need;
  const trackPct = Math.min(100, Math.round((g.certCount / maxNeed) * 100));

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* HERO — big tile (2×2) */}
      <div className="relative col-span-2 flex flex-col justify-between gap-5 overflow-hidden rounded-3xl p-6 text-white lg:row-span-2" style={{ background: "linear-gradient(135deg, #45a37c 0%, #216b4c 100%)" }}>
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-lime-300/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="gam-float grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-white/15 text-center ring-1 ring-white/30">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Level</p>
              <p className="text-3xl font-extrabold leading-none">{g.level}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">You are a</p>
            <p className="text-2xl font-extrabold leading-tight">{g.title}</p>
            <p className="text-sm text-white/80">{g.current ? `${g.current.emoji} ${g.current.label} badge holder` : "Earn your first badge!"}</p>
          </div>
        </div>
        <div className="relative">
          <div className="mb-1.5 flex items-end justify-between">
            <span className="inline-flex items-center gap-1.5 text-lg font-extrabold"><Zap className="h-5 w-5 fill-current" /> {g.xp} XP</span>
            <span className="text-xs text-white/80">{g.xpToNextLevel} XP to Level {g.level + 1}</span>
          </div>
          <div className="h-3.5 overflow-hidden rounded-full bg-white/20">
            <div className="gam-fill h-full rounded-full" style={{ width: `${g.levelPct}%`, background: "linear-gradient(90deg,#bef264,#a7f3d0)" }} />
          </div>
        </div>
      </div>

      {/* Small green stat tiles */}
      <StatTile icon={GraduationCap} bg="#e8f1ed" value={g.certCount} label="Certificates" />
      <StatTile icon={BookOpen} bg="#dcebe3" value={g.coursesCompleted} label="Courses done" />

      {/* Next-badge tile */}
      <div className="flex flex-col justify-center gap-1 rounded-2xl p-4" style={{ background: "#c7e0d3" }}>
        {g.next ? (
          <>
            <span className="text-2xl">{g.next.emoji}</span>
            <p className="text-sm font-bold text-[var(--brand-dark)]">Next: {g.next.label}</p>
            <p className="text-xs text-[var(--brand-dark)]/80">{g.toNext} more certificate{g.toNext === 1 ? "" : "s"}</p>
            <p className="text-[11px] font-medium text-amber-600">⏱ {g.next.days}-day challenge</p>
          </>
        ) : (
          <>
            <span className="text-2xl">🏆</span>
            <p className="text-sm font-bold text-[var(--brand-dark)]">All unlocked!</p>
          </>
        )}
      </div>

      {/* TROPHY SHELF / JOURNEY — full-width tile */}
      <div className="col-span-2 rounded-2xl border border-[var(--border)] bg-white p-6 lg:col-span-4">
        <div className="mb-6 flex items-center gap-2">
          <Star className="h-4 w-4 fill-[var(--brand)] text-[var(--brand)]" />
          <h3 className="font-semibold text-[var(--ink)]">Trophy shelf</h3>
          <span className="text-xs text-[var(--muted)]">· {g.earned.length} of {g.badges.length} unlocked</span>
        </div>
        <div className="relative px-4">
          <div className="absolute left-8 right-8 top-9 h-1.5 rounded-full bg-slate-100" />
          <div className="gam-fill absolute left-8 top-9 h-1.5 rounded-full bg-[var(--brand)]" style={{ width: `calc((100% - 4rem) * ${trackPct / 100})` }} />
          <div className="relative grid grid-cols-4 gap-2">
            {g.badges.map((b, i) => {
              const earned = g.certCount >= b.need;
              return (
                <div key={b.key} className="gam-pop flex flex-col items-center gap-2 text-center" style={{ animationDelay: `${i * 80}ms` }}>
                  <Medal badge={b} earned={earned} size={64} pulse={g.next?.key === b.key} />
                  {g.current?.key === b.key && <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[9px] font-bold text-white">NEW</span>}
                  <p className={`text-xs font-bold ${earned ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{b.label}</p>
                  <p className="text-[10px] text-[var(--muted)]">{earned ? "Earned ✓" : `${b.need} certs`}</p>
                  <p className="text-[10px] font-medium text-amber-600">⏱ {b.days}-day challenge</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, bg, value, label }: { icon: LucideIcon; bg: string; value: number; label: string }) {
  return (
    <div className="flex flex-col justify-center gap-1 rounded-2xl p-4" style={{ background: bg }}>
      <Icon className="h-5 w-5 text-[var(--brand-dark)]" />
      <p className="text-3xl font-extrabold leading-none text-[var(--brand-dark)]">{value}</p>
      <p className="text-xs font-medium text-[var(--brand-dark)]/80">{label}</p>
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
