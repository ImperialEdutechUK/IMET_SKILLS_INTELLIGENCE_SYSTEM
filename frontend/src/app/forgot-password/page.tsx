import Link from "next/link";
import { GraduationCap, KeyRound, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
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
          <p className="mt-6 text-sm text-[var(--muted)]">Your admin can generate a new reset link for you directly — no email required.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">Forgot Your Password?</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            There&apos;s no automatic email in this phase. Contact your system administrator — they can generate a new reset link for you from User Management.
          </p>
          <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
