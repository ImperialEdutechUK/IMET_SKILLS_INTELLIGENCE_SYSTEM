"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Password needs at least 8 characters, one uppercase letter, and one number.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), newPassword: password }),
      });
      const d = await r.json();
      if (r.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(d.error ?? "Could not reset your password.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <main className="grid min-h-screen bg-[var(--page)] lg:grid-cols-2">
      <div className="hidden flex-col justify-center bg-[var(--brand-tint)] px-12 lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--brand)] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">LearnSmart <span className="text-[var(--brand)]">AI</span></p>
            <p className="text-[11px] text-[var(--muted)]">Empower. Learn. Grow.</p>
          </div>
        </div>
        <div className="mt-16 max-w-md">
          <h2 className="text-3xl font-bold text-[var(--ink)]">Forgot your<br /><span className="text-[var(--brand)]">password?</span><br />No problem.</h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 text-sm text-[var(--muted)]">Enter your username and choose a new password — you&apos;ll be back in your dashboard in seconds.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <KeyRound className="h-6 w-6" />
          </span>

          {done ? (
            <div className="mt-4 text-center">
              <div className="mx-auto mt-2 flex items-center justify-center gap-2 text-[var(--brand)]">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-semibold">Password updated</p>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">You can now sign in with your new password. Redirecting to login…</p>
              <Link href="/login" className="mt-6 inline-flex items-center justify-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mt-4 text-center text-2xl font-bold text-[var(--ink)]">Reset Your Password</h1>
              <p className="mt-2 text-center text-sm text-[var(--muted)]">Enter your username and set a new password.</p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Username (email)</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username"
                    placeholder="you@imperiallearning.co.uk"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New Password</label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                    placeholder="At least 8 characters, 1 uppercase, 1 number"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Confirm New Password</label>
                  <input
                    type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit" disabled={submitting}
                  className="w-full rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
                >
                  {submitting ? "Updating…" : "Reset Password"}
                </button>
              </form>

              <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
