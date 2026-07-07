"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BookOpen,
  BarChart3,
  Sparkles,
  AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }

    // Where this lands (own dashboard, or /set-password for invited accounts)
    // is decided by proxy.ts based on the session — not hardcoded here.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen bg-[var(--page)] lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-center overflow-hidden bg-[var(--brand-tint)] px-12 lg:flex">
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

        <div className="mt-16 max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-[var(--ink)]">
            Welcome Back!
            <br />
            <span className="text-[var(--brand)]">Let&apos;s continue your</span>
            <br />
            learning journey
          </h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 text-sm text-[var(--muted)]">
            Sign in to access your dashboard and continue learning smarter.
          </p>

          <div className="mt-10 flex gap-4">
            {[BookOpen, BarChart3, Sparkles].map((Icon, i) => (
              <span
                key={i}
                className="grid h-12 w-12 place-items-center rounded-xl bg-white text-[var(--brand-dark)] shadow-sm"
              >
                <Icon className="h-5 w-5" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: sign-in card */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
              <GraduationCap className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">
              Welcome Back
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sign in to continue your learning journey.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
            >
              <ArrowRight className="h-4 w-4" />
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Don&apos;t have an account?{" "}
            <a href="/register" className="font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
              Register
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
