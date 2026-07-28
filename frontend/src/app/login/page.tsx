"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAuth, dashboardPathFor } from "@/lib/authClient";
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
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data?.error || "Incorrect email or password.");
        return;
      }
      saveAuth(data.token, data.user);
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
        <div className="rounded-3xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="text-center">
            <span className="gam-float mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-sm" style={{ background: "linear-gradient(135deg,#5cb891,#3f9d75)" }}>
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
    </AuthShell>
  );
}
