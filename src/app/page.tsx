import Link from "next/link";
import Image from "next/image";
import {
  GraduationCap,
  Sparkles,
  Award,
  BarChart3,
  Globe,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const features = [
  { icon: Sparkles, title: "AI Recommended Courses" },
  { icon: Award, title: "CPD Tracking & Certificates" },
  { icon: BarChart3, title: "Track Progress & Performance" },
  { icon: Globe, title: "Learn Anytime, Anywhere" },
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

      {/* Hero: two columns */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-6 pb-4 pt-6 lg:grid-cols-2">
        {/* Left: text */}
        <div>
          <h1 className="text-4xl font-bold leading-tight text-[var(--ink)] sm:text-5xl">
            Empowering
            <br />
            <span className="text-[var(--brand)]">Employee Growth</span>
            <br />
            Through Smart Learning
          </h1>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 max-w-md text-base text-[var(--muted)] sm:text-lg">
            Enhance skills, achieve CPD goals, and discover personalized learning
            opportunities with AI-powered course recommendations.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Right: hero image */}
        <div className="relative overflow-hidden">
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

      {/* Feature bar */}
      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-[var(--border)] bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-[var(--ink)]">
                  {f.title}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--brand)]" />
          Trusted by{" "}
          <span className="font-semibold text-[var(--brand)]">100+ employees</span>{" "}
          to learn and grow every day
        </p>
      </section>
    </main>
  );
}
