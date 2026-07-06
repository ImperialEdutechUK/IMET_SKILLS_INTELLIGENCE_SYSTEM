"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { GraduationCap, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (rules.some(r => !r.ok)) { setError("Password does not meet all requirements."); return; }
    setError("");
    setLoading(true);

    const res = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    // Sign out rather than keep the old session: the existing token still
    // says status "invited" until it's reissued, so signing in fresh with
    // the new password is simpler and more reliable than patching the
    // live session in place.
    await signOut({ redirect: false });
    setDone(true);
  }

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
          <h2 className="text-3xl font-bold text-[var(--ink)]">Create your<br /><span className="text-[var(--brand)]">password</span><br />and get started.</h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 text-sm text-[var(--muted)]">Your invite link is valid for 7 days. Set a strong password to activate your account.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          {!done ? (
            <>
              <div className="text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                  <Lock className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">Set Your Password</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">Welcome to LearnSmart AI. Set your password to begin.</p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]" />
                    <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Confirm Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type={showCf ? "text" : "password"} required value={confirm} onChange={e => setConfirm(e.target.value)}
                      placeholder="Confirm your password"
                      className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]" />
                    <button type="button" onClick={() => setShowCf(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {rules.map(r => (
                    <li key={r.label} className={`flex items-center gap-2 text-xs ${r.ok ? "text-[var(--brand)]" : "text-slate-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.ok ? "bg-[var(--brand)]" : "bg-slate-300"}`} />
                      {r.label}
                    </li>
                  ))}
                </ul>

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

                <button type="submit" disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
                  <Lock className="h-4 w-4" /> {loading ? "Activating..." : "Activate Account"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand)]">
                <CheckCircle className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">Account Activated!</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">Your password has been set. You can now log in to LearnSmart AI.</p>
              <a href="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[var(--brand)] py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
                Go to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
