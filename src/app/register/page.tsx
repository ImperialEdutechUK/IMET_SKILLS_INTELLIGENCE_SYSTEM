"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Mail, Lock, User, Briefcase, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

interface Dept {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDepts(Array.isArray(data) ? data : []))
      .catch(() => setDepts([]));
  }, []);

  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (rules.some((r) => !r.ok)) { setError("Password does not meet all requirements."); return; }

    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, position, email, departmentId, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed. Try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--page)] px-6">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <CheckCircle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">Registration Submitted</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Your account is pending admin approval. You&apos;ll be able to sign in once an administrator approves your registration.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
          >
            <ArrowRight className="h-4 w-4" /> Go to Login
          </button>
        </div>
      </main>
    );
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
          <h2 className="text-3xl font-bold text-[var(--ink)]">Create Your<br /><span className="text-[var(--brand)]">Account</span></h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-[var(--brand)]" />
          <p className="mt-6 text-sm text-[var(--muted)]">Register your details, then sign in once an administrator approves your account.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-8 shadow-sm">
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
              <User className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-[var(--ink)]">Create Account</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Fill in your details to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field icon={User} label="Full Name" value={fullName} onChange={setFullName} type="text" placeholder="Your full name" required />
            <Field icon={Briefcase} label="Position" value={position} onChange={setPosition} type="text" placeholder="Your job title" />
            <Field icon={Mail} label="Email" value={email} onChange={setEmail} type="email" placeholder="you@imperiallearning.co.uk" required />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Department</label>
              <div className="relative">
                <select
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-3 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                >
                  <option value="">Select your department</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-10 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Field icon={Lock} label="Confirm Password" value={confirm} onChange={setConfirm} type={showPw ? "text" : "password"} placeholder="Re-enter your password" required />

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1.5 text-xs font-medium text-[var(--ink)]">Password must include:</p>
              <ul className="grid grid-cols-1 gap-1">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? "text-[var(--brand-dark)]" : "text-[var(--muted)]"}`}>
                    <CheckCircle className="h-3 w-3" /> {r.label}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] py-3 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
              <ArrowRight className="h-4 w-4" /> {loading ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-center text-sm text-[var(--muted)]">
              Already have an account? <Link href="/login" className="font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({ icon: Icon, label, value, onChange, type, placeholder, required }: {
  icon: typeof User; label: string; value: string; onChange: (v: string) => void; type: string; placeholder: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--border)] bg-white py-2.5 pl-10 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
        />
      </div>
    </div>
  );
}
