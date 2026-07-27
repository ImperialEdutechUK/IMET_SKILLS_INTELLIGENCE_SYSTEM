"use client";

import { Gift, Sparkles, Trophy, Lock } from "lucide-react";
import { computeGamification, type BadgeTier } from "@/lib/gamification";

// A self-contained, modular gamification widget laid out as a Bento grid of
// green-shaded tiles (white page background). Derived live from the certificate
// count — earn a badge per milestone, level up on XP, unlock a reward at Gold.
export default function AchievementsBento({ certCount }: { certCount: number }) {
  const g = computeGamification(certCount);

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Hero — level + XP ring + current badge */}
      <div
        className="col-span-2 flex flex-col justify-between gap-4 rounded-2xl p-5 text-white lg:row-span-2"
        style={{ background: "linear-gradient(135deg, #2e7d5b 0%, #1c5038 100%)" }}
      >
        <div className="flex items-center gap-4">
          <Ring pct={g.levelPct} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{g.current?.emoji ?? "🌱"}</span>
              <span className="text-lg font-bold">{g.current ? `${g.current.label} Achiever` : "Getting started"}</span>
            </div>
            <p className="mt-0.5 text-sm text-white/80">Level {g.level} · {g.xp} XP</p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-white/80">
            <span>Level {g.level}</span>
            <span>{g.xpIntoLevel} / {g.xpForLevel} XP</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${g.levelPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/80">
            {g.next ? `${g.next.need * 100 - g.xp} XP to Level ${g.level + 1}` : "Max level reached — legend! 🏆"}
          </p>
        </div>
      </div>

      {/* Certificates earned */}
      <Tile bg="#e8f1ed">
        <p className="text-3xl font-extrabold text-[var(--brand-dark)]">{g.certCount}</p>
        <p className="mt-1 text-xs font-medium text-[var(--brand-dark)]/80">Certificate{g.certCount === 1 ? "" : "s"} earned</p>
      </Tile>

      {/* Next milestone */}
      <Tile bg="#d7e9e0">
        {g.next ? (
          <>
            <div className="flex items-center gap-1.5"><span className="text-xl">{g.next.emoji}</span><span className="text-sm font-bold text-[var(--brand-dark)]">{g.next.label}</span></div>
            <p className="mt-1 text-xs font-medium text-[var(--brand-dark)]/80">{g.toNext} more certificate{g.toNext === 1 ? "" : "s"} to go</p>
          </>
        ) : (
          <>
            <Trophy className="h-6 w-6 text-[var(--brand-dark)]" />
            <p className="mt-1 text-xs font-medium text-[var(--brand-dark)]/80">All badges unlocked!</p>
          </>
        )}
      </Tile>

      {/* Reward — unlocked at Gold */}
      <div className="col-span-2 rounded-2xl p-5 lg:col-span-2" style={{ background: g.goldUnlocked ? "linear-gradient(135deg, #256b4e 0%, #14432e 100%)" : "#eef5f1" }}>
        {g.goldUnlocked ? (
          <div className="flex items-center gap-4 text-white">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15"><Gift className="h-6 w-6" /></span>
            <div>
              <p className="text-sm font-semibold">🎁 Reward unlocked — {g.prize}</p>
              <p className="mt-0.5 text-xs text-white/80">You hit Gold with {g.certCount} certificates. Claim it from your L&amp;D team.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Lock className="h-6 w-6" /></span>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Reach 🥇 Gold to unlock a reward</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Earn {5 - g.certCount} more certificate{5 - g.certCount === 1 ? "" : "s"} (5 total) to claim a {"£50 learning voucher"}.</p>
            </div>
          </div>
        )}
      </div>

      {/* Badge collection */}
      <div className="col-span-2 rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-4">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="text-sm font-semibold text-[var(--ink)]">Badge collection</h3>
          <span className="text-xs text-[var(--muted)]">· {g.earned.length} of {g.badges.length} earned</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {g.badges.map((b) => <BadgeChip key={b.key} badge={b} earned={g.certCount >= b.need} certCount={g.certCount} />)}
        </div>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 76, stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, pct) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-sm font-bold text-white">{pct}%</span>
      </div>
    </div>
  );
}

function Tile({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <div className="flex flex-col justify-center rounded-2xl p-5" style={{ background: bg }}>{children}</div>;
}

function BadgeChip({ badge, earned, certCount }: { badge: BadgeTier; earned: boolean; certCount: number }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${earned ? "border-[var(--brand)]/30 bg-[var(--brand-tint)]" : "border-[var(--border)] bg-slate-50"}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${earned ? "bg-white shadow-sm" : "bg-slate-100 grayscale opacity-50"}`}>
        {badge.emoji}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${earned ? "text-[var(--brand-dark)]" : "text-[var(--muted)]"}`}>{badge.label}</p>
        <p className="text-[11px] text-[var(--muted)]">
          {earned ? "Earned ✓" : `${badge.need - certCount} more (${badge.need} certs)`}
        </p>
      </div>
    </div>
  );
}
