import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap, ArrowRight, ArrowDownRight,
  Sparkles, Award, BarChart3,
} from "lucide-react";
import LandingNav from "./LandingNav";

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sparkles, title: "AI-recommended learning", desc: "Every course matched to a person's real skill gaps and role — from a catalogue of 27,000+ courses." },
  { icon: BarChart3, title: "Skills, measured", desc: "Watch gaps close in real time. Clear dashboards for employees, managers and HR." },
  { icon: Award, title: "CPD, certificates & badges", desc: "Track CPD hours, earn certificates and unlock badges as skills grow." },
];

// A radial sunburst of thin lines, computed with trig.
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

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[var(--ink)]">
      {/* Nav — client island so the mobile menu works */}
      <LandingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block" style={{ background: "linear-gradient(90deg, transparent, var(--brand-tint))" }} />
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-2 lg:px-10 lg:pt-16">
          {/* Left */}
          <div className="home-rise">
            <div className="flex items-center gap-4">
              <span className="h-px w-8 bg-[var(--brand)]" />
              <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--brand)] text-[var(--brand)]"><Sparkles className="h-4 w-4" /></span>
              <p className="text-[15px] text-[var(--muted)]">AI-powered <span className="font-semibold text-[var(--ink)]">skills intelligence</span></p>
            </div>

            <h1 className="mt-9 font-black leading-[0.92] tracking-[-0.03em]" style={{ fontSize: "clamp(3rem, 8.5vw, 6.5rem)" }}>
              Skills<br />Intelligence<br /><span className="text-[var(--brand)]">Platform</span>
            </h1>

            <div className="mt-12 flex flex-wrap items-center gap-8">
              <Link href="/register" className="rounded-full bg-[var(--brand)] px-11 py-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-dark)]">Get started</Link>
              <Link href="/login" className="group flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] transition-colors group-hover:border-[var(--brand)] group-hover:text-[var(--brand)]"><ArrowRight className="h-4 w-4" /></span>
                <span className="text-[15px] font-medium underline decoration-1 underline-offset-4">Sign in</span>
              </Link>
            </div>
          </div>

          {/* Right — visual composition (landscape image, shown in full, no crop) */}
          <div className="home-rise relative mx-auto h-[440px] w-full max-w-[560px]" style={{ animationDelay: ".1s" }}>
            {/* Courses stat */}
            <div className="absolute right-0 top-0 z-20 text-right">
              <p className="text-4xl font-extrabold tracking-tight">27k<span className="ml-1 font-semibold text-[var(--brand)]">+</span></p>
              <p className="text-sm text-[var(--muted)]">Courses</p>
            </div>

            {/* Soft sunburst texture behind the frame */}
            <div className="absolute -left-4 top-8 opacity-30"><Sunburst size={120} /></div>

            {/* Hero image — frame matches the image's ratio so nothing is cropped */}
            <div className="absolute right-0 top-[68px] w-[480px] max-w-full overflow-hidden rounded-[1.75rem] border border-[var(--border)] shadow-[0_30px_60px_-30px_rgba(15,27,45,.3)]" style={{ aspectRatio: "2024 / 1382" }}>
              <Image src="/hero-team.png" alt="A team using LearnSmart AI's skills intelligence platform" fill sizes="480px" priority className="object-cover" />
            </div>

            {/* Brand accent circle — corner accent, clear of faces */}
            <div className="absolute left-8 top-8 z-20 grid h-20 w-20 place-items-center rounded-full bg-[var(--brand)] text-white shadow-lg">
              <ArrowDownRight className="h-8 w-8" />
            </div>

            {/* Info chip — floats at the lower-left, over the desk area */}
            <div className="absolute bottom-2 left-0 z-20 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/95 px-4 py-3 shadow-[0_20px_40px_-24px_rgba(15,27,45,.3)] backdrop-blur">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BarChart3 className="h-4.5 w-4.5" /></span>
              <p className="text-sm font-semibold leading-tight">Track skills<br />in real time</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
          <h2 className="max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">Everything iMET needs to close skill gaps.</h2>
          <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)] text-white"><Icon className="h-5 w-5" strokeWidth={2} /></span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section id="how" className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-10 lg:py-32">
          <h2 className="mx-auto max-w-3xl font-black leading-[0.95] tracking-[-0.02em]" style={{ fontSize: "clamp(2.5rem,6vw,4.5rem)" }}>See your organisation&apos;s<br />skills, clearly.</h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-[var(--muted)]">AI-matched courses, live skill-gap tracking, CPD and certificates — for every employee, manager and HR lead.</p>
          <div className="mt-10 flex items-center justify-center gap-6">
            <Link href="/register" className="rounded-full bg-[var(--brand)] px-10 py-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-dark)]">Get started</Link>
            <Link href="/login" className="text-[15px] font-medium underline decoration-1 underline-offset-4">Sign in</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand)] text-white"><GraduationCap className="h-4 w-4" /></span>
            <p className="font-extrabold tracking-tight">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
          </div>
          <p className="text-xs text-[var(--muted)]">© 2026 iMET · Imperial Edutech</p>
          <div className="flex items-center gap-5 text-sm text-[var(--muted)]">
            <Link href="/login" className="transition-opacity hover:opacity-60">Sign in</Link>
            <Link href="/register" className="transition-opacity hover:opacity-60">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
