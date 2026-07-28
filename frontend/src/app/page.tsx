import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap, Sparkles, Award, BarChart3, Globe, ArrowRight, ShieldCheck,
  Trophy, Zap, Users, BookOpen,
} from "lucide-react";

const stats = [
  { icon: BookOpen, value: "22,965", label: "Courses in the catalogue" },
  { icon: Users, value: "100+", label: "Employees learning" },
  { icon: Award, value: "8", label: "Departments tracked" },
  { icon: Globe, value: "24/7", label: "Learn anytime, anywhere" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--page)]">
      {/* Logo */}
      <header className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand)] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[var(--ink)]">
              LearnSmart <span className="text-[var(--brand)]">AI</span>
            </p>
            <p className="text-[11px] text-[var(--muted)]">Empower. Learn. Grow.</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-6 pb-4 pt-6 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-tint)] px-3 py-1 text-xs font-semibold text-[var(--brand-dark)]">
            <Sparkles className="h-3.5 w-3.5" /> AI-powered · Gamified learning
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-[var(--ink)] sm:text-5xl">
            Empowering
            <br />
            <span className="text-[var(--brand)]">Employee Growth</span>
            <br />
            Through Smart Learning
          </h1>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 max-w-md text-base text-[var(--muted)] sm:text-lg">
            Enhance skills, achieve CPD goals, earn badges and discover personalized
            learning with AI-powered course recommendations.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative overflow-hidden rounded-3xl">
          <Image
            src="/hero.png"
            alt="Employee learning with AI-powered recommendations"
            width={1210}
            height={1088}
            priority
            className="h-auto w-full scale-[1.03]"
          />
        </div>
      </section>

      {/* Bento showcase */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Big AI tile (2×2) */}
          <div className="relative col-span-2 flex flex-col justify-between overflow-hidden rounded-3xl p-6 text-white lg:row-span-2" style={{ background: "linear-gradient(135deg,#45a37c,#216b4c)" }}>
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Sparkles className="h-6 w-6" /></span>
            <div className="relative mt-6">
              <h3 className="text-2xl font-extrabold">AI-Recommended Courses</h3>
              <p className="mt-2 max-w-sm text-sm text-white/85">Matched to each person&apos;s skill gaps and role from a catalogue of 22,965 real courses — no guesswork.</p>
            </div>
          </div>

          <Feature icon={Award} tone="blue" title="CPD Tracking & Certificates" desc="Log hours, hit annual targets, collect certificates." />
          <Feature icon={BarChart3} tone="teal" title="Track Progress" desc="Circular progress, skill gaps and clear dashboards." />

          {/* Gamified wide tile */}
          <div className="relative col-span-2 flex items-center gap-4 overflow-hidden rounded-3xl p-6 text-white" style={{ background: "linear-gradient(135deg,#5b8def,#3563d6)" }}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Trophy className="h-6 w-6" /></span>
            <div>
              <h3 className="text-lg font-extrabold">Gamified learning</h3>
              <p className="mt-1 text-sm text-white/85">Earn <Zap className="inline h-3.5 w-3.5 fill-current" /> XP, unlock badges and climb your team leaderboard.</p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl bg-[var(--brand-tint)] p-5">
                <Icon className="h-5 w-5 text-[var(--brand-dark)]" />
                <p className="mt-3 text-2xl font-extrabold text-[var(--brand-dark)]">{s.value}</p>
                <p className="mt-1 text-xs font-medium text-[var(--brand-dark)]/80">{s.label}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--brand)]" />
          Trusted by <span className="font-semibold text-[var(--brand)]">100+ employees</span> to learn and grow every day
        </p>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, tone, title, desc }: { icon: LucideIcon; tone: "blue" | "teal"; title: string; desc: string }) {
  const c = tone === "blue" ? { bg: "#e3eefb", fg: "#1d4ed8" } : { bg: "#d7efe8", fg: "#0f766e" };
  return (
    <div className="flex flex-col rounded-2xl p-5" style={{ background: c.bg }}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/70"><Icon className="h-5 w-5" style={{ color: c.fg }} /></span>
      <h3 className="mt-3 text-base font-bold" style={{ color: c.fg }}>{title}</h3>
      <p className="mt-1 text-xs" style={{ color: c.fg, opacity: 0.8 }}>{desc}</p>
    </div>
  );
}
