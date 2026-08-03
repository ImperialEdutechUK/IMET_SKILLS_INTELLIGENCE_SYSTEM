import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap, Sparkles, Award, BarChart3, ArrowRight, Trophy, ImageIcon,
} from "lucide-react";

const stats = [
  { value: "27,000+", label: "Courses in the catalogue" },
  { value: "100+", label: "Employees learning" },
  { value: "8", label: "Departments tracked" },
  { value: "24/7", label: "Learn anytime" },
];

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sparkles, title: "AI-recommended learning", desc: "Every course matched to a person's real skill gaps and role — drawn from a catalogue of 27,000+ courses, no guesswork." },
  { icon: BarChart3, title: "Skills, measured", desc: "See gaps close in real time. Clear dashboards for people, managers and HR — the whole organisation at a glance." },
  { icon: Award, title: "Certificates & badges", desc: "Earn certificates, unlock badges and climb your level. Progress that people can see and feel." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-[var(--ink)]">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--brand)] text-white">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <p className="text-[15px] font-semibold tracking-tight">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
          </div>
          <nav className="flex items-center gap-1.5">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-slate-100">Sign in</Link>
            <Link href="/register" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.03] active:scale-95">Get started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-10 text-center sm:pt-28">
        <h1 className="home-rise mx-auto max-w-4xl text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]" style={{ animationDelay: "0s" }}>
          Turn skills into your
          <br className="hidden sm:block" /> team&apos;s advantage.
        </h1>
        <p className="home-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)] sm:text-xl" style={{ animationDelay: ".08s" }}>
          AI-powered learning that finds each person&apos;s gaps, recommends the right courses, and shows your whole organisation growing — in real time.
        </p>
        <div className="home-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: ".16s" }}>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition-colors hover:bg-slate-100">
            Sign in
          </Link>
        </div>

        {/* Hero image — replace this placeholder with a real product shot / illustration.
            e.g. <Image src="/hero.png" alt="LearnSmart AI dashboard" fill className="object-cover" /> */}
        <div className="home-rise mx-auto mt-16 max-w-5xl" style={{ animationDelay: ".24s" }}>
          <div className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white shadow-[0_2px_8px_rgba(15,27,45,.05),0_40px_80px_-40px_rgba(15,27,45,.28)]">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--page)] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            {/* Image slot */}
            <div className="relative grid aspect-[16/10] place-items-center bg-gradient-to-b from-[var(--brand-tint)]/40 to-white">
              <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[var(--brand)]/10 blur-3xl" />
              <div className="relative flex flex-col items-center gap-3 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                  <ImageIcon className="h-6 w-6 text-[var(--muted)]" />
                </span>
                <p className="text-sm font-medium text-[var(--ink)]">Hero image goes here</p>
                <p className="max-w-xs text-xs text-[var(--muted)]">Drop a product screenshot or illustration into this frame — sized 16:10 for a crisp fit.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything a growing team needs to keep learning.</h2>
        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-[var(--border)] bg-[var(--page)]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-10 px-6 py-16 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
        <span className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
          <Trophy className="h-6 w-6" />
        </span>
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Start growing your team today.</h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-[var(--muted)]">Join 100+ employees already learning, closing skill gaps and earning certificates.</p>
        <Link href="/register" className="mt-9 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-95">
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold tracking-tight">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
          </div>
          <p className="text-xs text-[var(--muted)]">© 2026 iMET · Imperial Edutech. Empower. Learn. Grow.</p>
          <div className="flex items-center gap-5 text-sm text-[var(--muted)]">
            <Link href="/login" className="transition-colors hover:text-[var(--ink)]">Sign in</Link>
            <Link href="/register" className="transition-colors hover:text-[var(--ink)]">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
