"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

const TYPES = ["Learning", "Webinar", "Conference", "Reading", "Coaching", "Other"];
const CATEGORIES = ["Technical Skills", "Professional Skills", "Leadership", "Other"];
const STEPS = ["Activity Details", "Learning Impact", "CPD Hours", "Review & Save"];

export default function RecordCpdPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("");
  const [provider, setProvider] = useState("");
  const [dateCompleted, setDateCompleted] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  // Step 2
  const [learned, setLearned] = useState("");
  const [apply, setApply] = useState("");
  const [impact, setImpact] = useState("");
  const [reflection, setReflection] = useState("");
  // Step 3
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");

  const totalHours = (Number(hrs) || 0) + (Number(mins) || 0) / 60;

  const canNext = () => {
    if (step === 0) return title.trim() && activityType && dateCompleted && description.trim();
    if (step === 1) return learned.trim() && apply.trim() && impact.trim();
    if (step === 2) return totalHours > 0;
    return true;
  };

  const next = () => { setError(""); if (canNext()) setStep((s) => Math.min(3, s + 1)); else setError("Please fill in the required fields."); };
  const back = () => { setError(""); setStep((s) => Math.max(0, s - 1)); };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/api/me/cpd/records`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title, activityType, provider, dateCompleted, category,
          hours: Math.round(totalHours * 100) / 100,
          note: description,
          impact: { learned, apply, impact, reflection },
        }),
      });
      const d = await r.json();
      if (r.ok) router.push("/me/cpd");
      else { setError(d.error ?? "Could not save."); setSaving(false); }
    } catch { setError("Could not save."); setSaving(false); }
  };

  const input = "w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]";
  const label = "mb-1.5 block text-sm font-medium text-[var(--ink)]";

  return (
    <div className="max-w-4xl">
      <div className="mb-2 text-sm text-[var(--muted)]"><Link href="/me/cpd" className="hover:text-[var(--ink)]">My CPD</Link> <span className="mx-1">›</span> Record CPD Activity</div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--ink)]">Record CPD Activity</h1>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white p-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${i < step ? "bg-[var(--brand)] text-white" : i === step ? "bg-[var(--brand)] text-white" : "bg-slate-100 text-[var(--muted)]"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:inline ${i === step ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px flex-1 bg-[var(--border)] sm:block" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={label}>Activity Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced Excel Training" className={input} /></div>
              <div><label className={label}>Activity Type *</label><select value={activityType} onChange={(e) => setActivityType(e.target.value)} className={input}><option value="">Select activity type</option>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={label}>Provider / Organisation</label><input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Coursera, LinkedIn Learning" className={input} /></div>
              <div><label className={label}>Date Completed *</label><input type="date" value={dateCompleted} onChange={(e) => setDateCompleted(e.target.value)} className={input} /></div>
            </div>
            <div><label className={label}>Description *</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe what you learned or did in this activity..." className={input} /></div>
            <div className="sm:max-w-xs"><label className={label}>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={input}><option value="">Select category</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div><label className={label}>What did you learn from this activity? *</label><textarea value={learned} onChange={(e) => setLearned(e.target.value)} rows={3} className={input} placeholder="Key knowledge, skills or insights you gained..." /></div>
            <div><label className={label}>How will you apply this learning in your role? *</label><textarea value={apply} onChange={(e) => setApply(e.target.value)} rows={3} className={input} placeholder="How you will use this in your current job or projects..." /></div>
            <div><label className={label}>What impact will this have on your work or goals? *</label><textarea value={impact} onChange={(e) => setImpact(e.target.value)} rows={3} className={input} placeholder="How this helps you, your team or organisation..." /></div>
            <div><label className={label}>Evidence or reflection (optional)</label><textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={2} className={input} placeholder="Reflections, notes or examples..." /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">Tell us how much time you spent on this learning activity. Include preparation, learning, practice and follow-up.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div><label className={label}>Hours</label><input type="number" min={0} value={hrs} onChange={(e) => setHrs(e.target.value)} placeholder="0" className={`${input} w-28`} /></div>
              <div><label className={label}>Minutes</label><input type="number" min={0} max={59} value={mins} onChange={(e) => setMins(e.target.value)} placeholder="0" className={`${input} w-28`} /></div>
              <div className="rounded-lg bg-[var(--brand-tint)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-dark)]">Total: {Math.floor(totalHours)}h {Math.round((totalHours % 1) * 60)}m</div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--ink)]">Review your activity</h3>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Review k="Activity" v={title} />
              <Review k="Type" v={activityType} />
              <Review k="Provider" v={provider || "—"} />
              <Review k="Date Completed" v={dateCompleted} />
              <Review k="Category" v={category || "—"} />
              <Review k="CPD Hours" v={`${Math.round(totalHours * 100) / 100} hrs`} />
            </dl>
            <div><p className="text-xs font-medium text-[var(--muted)]">Description</p><p className="mt-0.5 text-sm text-[var(--ink)]">{description}</p></div>
            <div><p className="text-xs font-medium text-[var(--muted)]">What you learned</p><p className="mt-0.5 text-sm text-[var(--ink)]">{learned}</p></div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-5">
          <button onClick={back} disabled={step === 0} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Back</button>
          {step < 3 ? (
            <button onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Next <ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"><Check className="h-4 w-4" /> {saving ? "Saving…" : "Save Activity"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Review({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs font-medium text-[var(--muted)]">{k}</dt><dd className="mt-0.5 text-[var(--ink)]">{v}</dd></div>;
}
