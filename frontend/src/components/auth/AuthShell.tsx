"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, Sparkles, Zap, Trophy, BookOpen, Award, TrendingUp } from "lucide-react";

// Shared auth layout: a gamified Bento brand panel on the left, the form card on
// the right. Soft, easy-on-the-eye tints (the app palette) with a few interactive
// tiles so signing in / registering feels like stepping into the game.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-[var(--page)] lg:grid-cols-2">
      <BrandPanel title={title} subtitle={subtitle} />
      <div className="flex items-center justify-center px-6 py-12">{children}</div>
    </main>
  );
}

function BrandPanel({ title, subtitle }: { title: ReactNode; subtitle: string }) {
  return (
    <div className="relative hidden flex-col justify-center overflow-hidden px-12 py-14 lg:flex" style={{ background: "linear-gradient(160deg,#eef7f2 0%,#e9f1fb 100%)" }}>
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand)] text-white">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[var(--ink)]">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
          <p className="text-[11px] text-[var(--muted)]">Empower. Learn. Grow.</p>
        </div>
      </div>

      <div className="mt-12 max-w-md">
        <h2 className="text-3xl font-bold leading-tight text-[var(--ink)]">{title}</h2>
        <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
        <p className="mt-5 max-w-sm text-sm text-[var(--muted)]">{subtitle}</p>

        {/* Bento showcase — interactive gamified tiles */}
        <div className="mt-9 grid max-w-md grid-cols-2 gap-3">
          {/* Hero tile (wide) — soft green gradient with a floating spark + XP bar */}
          <div className="group relative col-span-2 flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: "linear-gradient(135deg,#5cb891,#3f9d75)" }}>
            <span className="gam-float grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
              <Sparkles className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">AI-recommended learning</p>
              <p className="mt-0.5 text-xs text-white/85">Matched to your skill gaps &amp; role</p>
              <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
                <div className="gam-fill h-full rounded-full" style={{ width: "72%", background: "linear-gradient(90deg,#bef264,#a7f3d0)" }} />
              </div>
            </div>
          </div>

          <Tile icon={Zap} tint="#e8f0fd" fg="#2456c8" value="Earn XP" label="Every course levels you up" />
          <Tile icon={Trophy} tint="#fbf1de" fg="#b06a12" value="Badges" label="Bronze → Platinum" />
          <Tile icon={BookOpen} tint="#e0f2ec" fg="#14806f" value="22,965" label="Real courses" />
          <Tile icon={Award} tint="#f0edfc" fg="#6d3fd6" value="CPD" label="Hit your annual goal" />
        </div>

        <p className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <TrendingUp className="h-4 w-4 text-[var(--brand)]" /> Trusted by 100+ employees to learn and grow
        </p>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, tint, fg, value, label }: { icon: LucideIcon; tint: string; fg: string; value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: tint }}>
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/70">
        <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18, color: fg }} />
      </span>
      <p className="text-base font-extrabold leading-none" style={{ color: fg }}>{value}</p>
      <p className="text-[11px] font-medium" style={{ color: fg, opacity: 0.8 }}>{label}</p>
    </div>
  );
}
