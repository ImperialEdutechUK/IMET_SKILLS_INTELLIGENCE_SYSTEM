import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap, Menu, ArrowRight, ArrowDownRight, ArrowDown, Play,
  Sparkles, Award, BarChart3, ImageIcon,
} from "lucide-react";

// Warm, editorial palette matched to the reference: greige canvas, near-black ink,
// a single orange accent, black pills.
const C = {
  bg: "#e7e3dc",
  panel: "#dcd7cd",
  ink: "#1b1b19",
  muted: "#6f6a61",
  accent: "#ee5a1c",
};

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sparkles, title: "AI-recommended learning", desc: "Every course matched to a person's real skill gaps and role — from a catalogue of 27,000+ courses." },
  { icon: BarChart3, title: "Skills, measured", desc: "See gaps close in real time. Clear dashboards for people, managers and HR." },
  { icon: Award, title: "Certificates & badges", desc: "Earn certificates, unlock badges and climb your level as you grow." },
];

// A radial sunburst of thin lines, computed with trig.
function Sunburst({ size = 128, lines = 44 }: { size?: number; lines?: number }) {
  const c = size / 2, r1 = size * 0.07, r2 = size * 0.46;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => {
        const a = (i / lines) * Math.PI * 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        return <line key={i} x1={c + dx * r1} y1={c + dy * r1} x2={c + dx * r2} y2={c + dy * r2} stroke={C.ink} strokeWidth="1" />;
      })}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.ink }}>
      {/* Nav */}
      <header className="border-b" style={{ borderColor: "rgba(0,0,0,.12)" }}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: C.ink }}>
              <GraduationCap className="h-5 w-5" />
            </span>
            <p className="text-xl font-extrabold tracking-tight">LearnSmart</p>
          </div>
          <nav className="hidden items-center gap-10 text-[15px] font-medium lg:flex">
            <Link href="/login" className="transition-opacity hover:opacity-60">Platform</Link>
            <a href="#features" className="transition-opacity hover:opacity-60">Features</a>
            <a href="#how" className="transition-opacity hover:opacity-60">How it works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/register" className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95" style={{ background: C.ink }}>Get the app</Link>
            <button aria-label="Menu" className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-black/5"><Menu className="h-6 w-6" /></button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Subtle darker panel on the far right, echoing the reference */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block" style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,.03))" }} />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-2 lg:px-10 lg:pt-16">
          {/* Left */}
          <div className="home-rise">
            <div className="flex items-center gap-4">
              <span className="h-px w-8" style={{ background: C.ink }} />
              <span className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "rgba(0,0,0,.4)" }}><ArrowRight className="h-4 w-4" /></span>
              <p className="text-[15px]" style={{ color: C.muted }}>Explore a 14&#8209;day <span className="font-semibold" style={{ color: C.ink }}>free trial</span></p>
            </div>

            <h1 className="mt-9 font-black leading-[0.92] tracking-[-0.03em]" style={{ fontSize: "clamp(3rem, 8.5vw, 6.5rem)" }}>
              Skills<br />Intelligence<br />Platform
            </h1>

            <div className="mt-12 flex flex-wrap items-center gap-8">
              <Link href="/register" className="rounded-full px-11 py-5 text-base font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95" style={{ background: C.ink }}>Try for free</Link>
              <Link href="/login" className="group flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full border transition-colors group-hover:bg-black/5" style={{ borderColor: "rgba(0,0,0,.4)" }}><Play className="h-4 w-4 fill-current" /></span>
                <span className="text-[15px] font-medium underline decoration-1 underline-offset-4">See demo</span>
              </Link>
            </div>
          </div>

          {/* Right — visual composition */}
          <div className="home-rise relative mx-auto h-[560px] w-full max-w-[560px]" style={{ animationDelay: ".1s" }}>
            {/* Downloads stat with bracket */}
            <div className="absolute right-0 top-2 text-right">
              <p className="text-4xl font-extrabold tracking-tight">27k<span className="ml-1 font-semibold" style={{ color: C.muted }}>+</span></p>
              <p className="text-sm" style={{ color: C.muted }}>Courses</p>
              <div className="ml-auto mt-3 h-8 w-px" style={{ background: "rgba(0,0,0,.35)" }} />
            </div>

            {/* Portrait image frame — drop a real photo here (object-cover). */}
            <div className="absolute right-2 top-16 h-[420px] w-[340px] overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(0,0,0,.45)]" style={{ background: "linear-gradient(160deg,#d7d2c7,#efece5)" }}>
              <div className="grid h-full w-full place-items-center">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/70"><ImageIcon className="h-6 w-6" style={{ color: C.muted }} /></span>
                  <p className="text-sm font-medium">Add your photo</p>
                  <p className="max-w-[10rem] text-xs" style={{ color: C.muted }}>Portrait, ~3:4</p>
                </div>
              </div>
            </div>

            {/* Overlapping info card */}
            <div className="absolute left-0 top-24 w-56 rounded-[1.5rem] p-5 shadow-[0_20px_40px_-24px_rgba(0,0,0,.4)]" style={{ background: "linear-gradient(155deg,#d9d4c9,#cbc5b8)" }}>
              <div className="flex gap-1">
                {[3, 1, 2, 4, 2].map((h, i) => <span key={i} className="w-1.5 rounded-sm" style={{ height: `${h * 5}px`, background: C.ink, opacity: 0.85 }} />)}
              </div>
              <p className="mt-5 text-[17px] font-semibold leading-snug">Track skills<br />in real time</p>
            </div>

            {/* Orange accent circle with diagonal arrow */}
            <div className="absolute left-44 top-8 grid h-24 w-24 place-items-center rounded-full shadow-lg" style={{ background: C.accent }}>
              <ArrowDownRight className="h-9 w-9" style={{ color: C.ink }} />
            </div>

            {/* Sunburst */}
            <div className="absolute bottom-16 left-2 opacity-80"><Sunburst size={124} /></div>

            {/* Connector line + down button */}
            <svg className="pointer-events-none absolute bottom-0 left-28 h-40 w-44" viewBox="0 0 176 160" fill="none" aria-hidden>
              <path d="M8 8 V80 Q8 96 24 96 H150 Q166 96 166 112 V160" stroke="rgba(0,0,0,.4)" strokeWidth="1.5" />
            </svg>
            <span className="absolute bottom-24 left-[7.5rem] grid h-9 w-9 place-items-center rounded-full border bg-[#e7e3dc]" style={{ borderColor: "rgba(0,0,0,.4)" }}><ArrowDown className="h-4 w-4" /></span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t" style={{ borderColor: "rgba(0,0,0,.1)" }}>
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <h2 className="max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">Everything a growing team needs.</h2>
          <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: C.ink }}><Icon className="h-5 w-5" strokeWidth={2} /></span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section id="how" className="border-t" style={{ borderColor: "rgba(0,0,0,.1)" }}>
        <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-10 lg:py-32">
          <h2 className="mx-auto max-w-3xl font-black leading-[0.95] tracking-[-0.02em]" style={{ fontSize: "clamp(2.5rem,6vw,4.5rem)" }}>Start growing<br />your team today.</h2>
          <p className="mx-auto mt-6 max-w-lg text-lg" style={{ color: C.muted }}>Join 100+ employees already learning, closing skill gaps and earning certificates.</p>
          <div className="mt-10 flex items-center justify-center gap-6">
            <Link href="/register" className="rounded-full px-10 py-5 text-base font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95" style={{ background: C.ink }}>Try for free</Link>
            <Link href="/login" className="text-[15px] font-medium underline decoration-1 underline-offset-4">Sign in</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "rgba(0,0,0,.1)" }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: C.ink }}><GraduationCap className="h-4 w-4" /></span>
            <p className="font-extrabold tracking-tight">LearnSmart</p>
          </div>
          <p className="text-xs" style={{ color: C.muted }}>© 2026 iMET · Imperial Edutech</p>
          <div className="flex items-center gap-5 text-sm" style={{ color: C.muted }}>
            <Link href="/login" className="transition-opacity hover:opacity-60">Sign in</Link>
            <Link href="/register" className="transition-opacity hover:opacity-60">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
