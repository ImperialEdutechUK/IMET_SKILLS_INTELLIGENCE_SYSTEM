"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAuth, dashboardPathFor } from "@/lib/authClient";
import { swrCache } from "@/lib/swr-cache";
import { prefetch, formatRetryAfter } from "@/lib/api";

/** Endpoints each role lands on — requested during the redirect, not after it. */
const WARM_ON_LOGIN = {
  admin: ["/api/admin/dashboard", "/api/notifications"],
  manager: ["/api/manager/dashboard", "/api/notifications"],
  author: ["/api/author/dashboard", "/api/notifications"],
  employee: ["/api/me/dashboard", "/api/me/certificates", "/api/notifications"],
} as const;
import AuthShell from "@/components/auth/AuthShell";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
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
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);
      setLoading(false);
      if (!res.ok) {
        // The API throttles repeated sign-in attempts. Without this the user
        // sees "Incorrect email or password" while holding the RIGHT password,
        // which sends them off to reset it for no reason.
        if (res.status === 429) {
          const seconds = Number(res.headers.get("Retry-After"));
          setError(
            `${data?.error ?? "Too many sign-in attempts."} Try again ${formatRetryAfter(
              Number.isFinite(seconds) ? seconds : undefined,
            )}.`,
          );
          return;
        }
        setError(data?.error || "Incorrect email or password.");
        return;
      }
      saveAuth(data.token, data.user);
      // Switch the cache to this user (wiping whoever was here before) and start
      // their dashboard request now, so the route paints on arrival instead of
      // beginning its fetch then.
      swrCache.activate(data.user.id);
      prefetch(...(WARM_ON_LOGIN[data.user.role as keyof typeof WARM_ON_LOGIN] ?? []));
      router.push(dashboardPathFor(data.user));
    } catch {
      setLoading(false);
      setError("Unable to sign in. Please try again.");
    }
  }

  return (
    <AuthShell
      title={<>Welcome Back!<br /><span className="text-[var(--brand)]">Let&apos;s continue your</span><br />learning journey</>}
      subtitle="Sign in to access your dashboard, pick up your XP and keep climbing the leaderboard."
    >
      {/* Right: sign-in card */}
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-8 shadow-[0_1px_2px_rgba(15,27,45,.04),0_20px_50px_-24px_rgba(15,27,45,.25)]">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)] text-white">
              <GraduationCap className="h-6 w-6" />
            </span>
            <h1 className="mt-5 font-black tracking-[-0.02em] text-[var(--ink)]" style={{ fontSize: "clamp(1.6rem,3vw,1.9rem)" }}>
              Welcome back
            </h1>
            <p className="mt-1.5 text-[15px] text-[var(--muted)]">
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
                  className="w-full rounded-xl border border-[var(--border)] bg-white py-3 pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
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
                  className="w-full rounded-xl border border-[var(--border)] bg-white py-3 pl-10 pr-10 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
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
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
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
    </AuthShell>
  );
}
