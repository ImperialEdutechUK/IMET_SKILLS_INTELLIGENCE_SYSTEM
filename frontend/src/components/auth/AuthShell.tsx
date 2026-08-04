"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { GraduationCap, Sparkles, BarChart3, Award } from "lucide-react";

// A radial sunburst of thin lines — the same quiet texture the landing hero uses,
// so the auth screens read as the same product.
function Sunburst({ size = 128, lines = 44 }: { size?: number; lines?: number }) {
  const c = size / 2, r1 = size * 0.07, r2 = size * 0.46;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => {
        const a = (i / lines) * Math.PI * 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        return <line key={i} x1={c + dx * r1} y1={c + dy * r1} x2={c + dx * r2} y2={c + dy * r2} stroke="var(--brand)" strokeWidth="1" />;
      })}
    </svg>
  );
}

const panelFeatures: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sparkles, title: "AI-recommended learning", desc: "Matched to your real skill gaps and role." },
  { icon: BarChart3, title: "Skills, measured", desc: "Watch gaps close on clear, live dashboards." },
  { icon: Award, title: "CPD, certificates & badges", desc: "Track hours, earn certificates as you grow." },
];

// Shared auth layout: the landing page's brand panel on the left, the form card on
// the right — same palette, font and sunburst texture as the home hero.
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
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <BrandPanel title={title} subtitle={subtitle} />
      <div className="flex items-center justify-center px-6 py-12">{children}</div>
    </main>
  );
}

function BrandPanel({ title, subtitle }: { title: ReactNode; subtitle: string }) {
  return (
    <div
      className="relative hidden flex-col justify-center overflow-hidden border-r border-[var(--border)] px-12 py-14 lg:flex"
      style={{ background: "linear-gradient(160deg,#ffffff 0%, var(--brand-tint) 120%)" }}
    >
      {/* Quiet sunburst textures, same as the hero */}
      <div className="pointer-events-none absolute -right-16 -top-16 opacity-[0.12]"><Sunburst size={320} lines={72} /></div>
      <div className="pointer-events-none absolute -bottom-10 -left-10 opacity-[0.08]"><Sunburst size={200} lines={56} /></div>

      {/* Logo — matches the landing nav */}
      <div className="relative flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--brand)] text-white">
          <GraduationCap className="h-5 w-5" />
        </span>
        <p className="text-xl font-extrabold tracking-tight">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
      </div>

      <div className="relative mt-14 max-w-md">
        <div className="flex items-center gap-4">
          <span className="h-px w-8 bg-[var(--brand)]" />
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--brand)] text-[var(--brand)]"><Sparkles className="h-4 w-4" /></span>
          <p className="text-[15px] text-[var(--muted)]">AI-powered <span className="font-semibold text-[var(--ink)]">skills intelligence</span></p>
        </div>

        <h2 className="mt-8 font-black leading-[0.98] tracking-[-0.03em] text-[var(--ink)]" style={{ fontSize: "clamp(2.25rem,3.6vw,3.25rem)" }}>{title}</h2>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">{subtitle}</p>

        {/* Clean feature rows — brand green, no rainbow tiles */}
        <ul className="mt-10 space-y-5">
          {panelFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.title} className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-white"><Icon className="h-5 w-5" strokeWidth={2} /></span>
                <div>
                  <p className="text-[15px] font-bold tracking-tight text-[var(--ink)]">{f.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{f.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 inline-flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-2.5 text-sm shadow-[0_20px_40px_-24px_rgba(15,27,45,.3)] backdrop-blur">
          <span className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">27k<span className="text-[var(--brand)]">+</span></span>
          <span className="text-[var(--muted)]">real courses, matched to you</span>
        </div>
      </div>
    </div>
  );
}
