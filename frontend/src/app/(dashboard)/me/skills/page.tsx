"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Star, Target, PlusCircle, Sparkles, CheckCircle2, ArrowUpRight, Plus, X } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Skill { id: string; name: string; category: string; currentLevel: number; targetLevel: number; currentLabel: string; targetLabel: string }
interface Improve { name: string; category: string; current: number; target: number; currentLabel: string; targetLabel: string; gap: number; priority: string }
interface Suggest { skill: string; currentLevel: number; requiredLevel: number; currentLabel: string; requiredLabel: string; relevance: number; impact: string; priority: string }
interface SkillsData {
  overview: { total: number; strengths: number; toImprove: number; newSkills: number };
  skills: Skill[];
  distribution: { name: string; value: number; color: string }[];
  topStrengths: string[];
  recentlyAdded: { name: string; date: string }[];
  toImprove: Improve[];
  aiSuggested: Suggest[];
}

type Tab = "overview" | "improve" | "ai";
const levelBadge: Record<string, string> = {
  Advanced: "bg-[var(--brand-tint)] text-[var(--brand-dark)]", Expert: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  Intermediate: "bg-blue-50 text-blue-700", Beginner: "bg-amber-50 text-amber-700", "Not Started": "bg-slate-100 text-slate-600",
};
const prioBadge: Record<string, string> = { High: "bg-red-50 text-red-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-[var(--brand-tint)] text-[var(--brand-dark)]" };

const LEVELS = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];

export default function MySkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Add-skill form state
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [current, setCurrent] = useState(1);
  const [target, setTarget] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [addErr, setAddErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/skills`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addSkill = async () => {
    if (!name.trim()) { setAddErr("Enter a skill name."); return; }
    setSaving(true); setAddErr("");
    try {
      const r = await fetch(`${API}/api/me/skills`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), currentLevel: current, targetLevel: target, gapAnalysis: notes.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setShowAdd(false); setName(""); setCurrent(1); setTarget(3); setNotes(""); await load(); }
      else setAddErr(d.error ?? "Could not add skill.");
    } catch { setAddErr("Could not add skill."); }
    setSaving(false);
  };

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your skills.</p></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">My Skills</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track your skills, see your progress and plan what to improve next.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <Plus className="h-4 w-4" /> Add Skill
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--ink)]">Add a Skill</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Skill name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prompt Engineering"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Current level</label>
                  <select value={current} onChange={(e) => setCurrent(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                    {LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Target level</label>
                  <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                    {LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Gap Analysis <span className="font-normal text-[var(--muted)]">(optional)</span></label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Need hands-on fine-tuning project."
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]" />
              </div>
              {addErr && <p className="text-sm text-red-600">{addErr}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAdd(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Cancel</button>
                <button onClick={addSkill} disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{saving ? "Adding…" : "Add Skill"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {([["overview", "Overview"], ["improve", "Skills to Improve"], ["ai", "AI Suggested Skills"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === k ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Overall Skills" value={data.overview.total} sub="Skills added" />
            <StatCard icon={Star} label="Strengths" value={data.overview.strengths} sub="Strong skills" />
            <StatCard icon={Target} iconBg="bg-amber-50" label="Skills to Improve" value={data.overview.toImprove} sub="Needs attention" />
            <StatCard icon={PlusCircle} label="New Skills" value={data.overview.newSkills} sub="Recently added" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Your Skills</h3></div>
              {data.skills.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">No skills recorded yet.</p> : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.skills.map((s) => (
                    <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--ink)]">{s.name}</p><p className="text-xs text-[var(--muted)]">{s.category}</p></div>
                      <div className="hidden w-40 sm:block"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(s.currentLevel / 4) * 100}%` }} /></div></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${levelBadge[s.currentLabel] ?? "bg-slate-100 text-slate-600"}`}>{s.currentLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h3 className="mb-4 font-semibold text-[var(--ink)]">Skill Distribution</h3>
                {data.distribution.length === 0 ? <p className="text-sm text-[var(--muted)]">No data.</p> :
                  <LearnDonutChart data={data.distribution} label={`${data.overview.total}`} sublabel="Total" height={160} />}
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h3 className="mb-3 font-semibold text-[var(--ink)]">Top Strengths</h3>
                {data.topStrengths.length === 0 ? <p className="text-sm text-[var(--muted)]">Build a skill to Advanced to see it here.</p> : (
                  <ul className="space-y-2">{data.topStrengths.map((s) => <li key={s} className="flex items-center gap-2 text-sm text-[var(--ink)]"><CheckCircle2 className="h-4 w-4 text-[var(--brand)]" /> {s}</li>)}</ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "improve" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Skills to Improve</h3></div>
            {data.toImprove.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">You&apos;re on target across your skills. Nice work!</p> : (
              <ul className="divide-y divide-[var(--border)]">
                {data.toImprove.map((s) => (
                  <li key={s.name} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--ink)]">{s.name}</p><p className="text-xs text-[var(--muted)]">{s.category}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${prioBadge[s.priority] ?? "bg-slate-100 text-slate-600"}`}>{s.priority}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                      <span>Current: <b className="text-[var(--ink)]">{s.currentLabel}</b></span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>Target: <b className="text-[var(--brand)]">{s.targetLabel}</b></span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(s.current / s.target) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-6">
            <InfoCard title="Why Improve These Skills?" items={[
              ["Role Relevance", "These skills matter most for your current role."],
              ["Career Growth", "Boost your profile and open new opportunities."],
              ["Personal Growth", "Build confidence and solve real-world problems."],
            ]} />
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-3 font-semibold text-[var(--ink)]">Recommended Next Steps</h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• Start a course to build these skills</li>
                <li>• Follow a structured learning path</li>
                <li>• Practice on real projects and quizzes</li>
              </ul>
              <Link href="/me/recommendations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">See recommendations <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </div>
      )}

      {tab === "ai" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white">
            <div className="flex items-center gap-2 border-b border-[var(--border)] p-5"><Sparkles className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">AI Suggested Skills</h3></div>
            {data.aiSuggested.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">No AI suggestions yet — they appear once your role profile and skill gaps are analysed.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.aiSuggested.map((s) => (
                  <li key={s.skill} className="flex items-center gap-4 px-5 py-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600"><Sparkles className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{s.skill}</p>
                      <p className="text-xs text-[var(--muted)]">{s.currentLabel} → {s.requiredLabel}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--brand)]">{s.relevance}%<span className="ml-1 font-normal text-[var(--muted)]">match</span></span>
                    <span className="hidden shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 sm:inline">{s.impact}</span>
                    <Link href="/me/recommendations" className="shrink-0 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-tint)]">Start Learning</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <InfoCard title="Why these skills?" items={[
            ["Role demand", "High demand for your role."],
            ["Top performers", "Frequently used by top performers."],
            ["Career goals", "Aligns with your growth path."],
            ["Market trends", "Based on industry and market trends."],
          ]} />
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <h3 className="mb-4 font-semibold text-[var(--ink)]">{title}</h3>
      <ul className="space-y-3">
        {items.map(([h, b]) => (
          <li key={h} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
            <div><p className="text-sm font-medium text-[var(--ink)]">{h}</p><p className="text-xs text-[var(--muted)]">{b}</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
