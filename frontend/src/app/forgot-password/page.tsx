"use client";

/**
 * Password reset — token redemption.
 *
 * This page used to take an email address and a new password and reset the
 * account outright, with the server enforcing nothing. It now redeems a
 * single-use token an administrator issues out-of-band; the token arrives either
 * in the URL (?token=…) or is pasted by hand.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import { formatRetryAfter } from "@/lib/api";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { MAX_PASSWORD_LENGTH, PASSWORD_HINT, passwordMeetsRules } from "@/lib/password-rules";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
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
    // A courtesy check only — the server re-validates every rule. Client-side
    // validation is UX, never a control.
    if (!passwordMeetsRules(password)) {
      setError("Password does not meet all the requirements below.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2000);
      } else if (r.status === 429) {
        const seconds = Number(r.headers.get("Retry-After"));
        setError(
          `${d?.error ?? "Too many attempts."} Try again ${formatRetryAfter(
            Number.isFinite(seconds) ? seconds : undefined,
          )}.`,
        );
      } else {
        setError(d?.error ?? "Could not reset your password.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl border border-[var(--border)] bg-white p-8 shadow-sm">
        <span className="gam-float mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-sm" style={{ background: "linear-gradient(135deg,#5cb891,#3f9d75)" }}>
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
            <p className="mt-2 text-center text-sm text-[var(--muted)]">
              Paste the reset code your administrator gave you, then choose a new password.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Reset code</label>
                <input
                  type="text" value={token} onChange={(e) => setToken(e.target.value)} required
                  autoComplete="one-time-code" spellCheck={false}
                  placeholder="Paste the code from your administrator"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                  maxLength={MAX_PASSWORD_LENGTH} placeholder={PASSWORD_HINT}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
                />
                <PasswordChecklist value={password} />
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

            <p className="mt-4 text-center text-xs text-[var(--muted)]">
              No code yet? Contact your administrator — they can issue one for your account.
            </p>

            <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title={<>Forgot your<br /><span className="text-[var(--brand)]">password?</span><br />No problem.</>}
      subtitle="Ask your administrator for a reset code, then set a new password here."
    >
      {/* useSearchParams needs a Suspense boundary for the static build. */}
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
