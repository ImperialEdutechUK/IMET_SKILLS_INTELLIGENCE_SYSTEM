"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Star, Target, PlusCircle, Sparkles, CheckCircle2, ArrowUpRight } from "lucide-react";
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

export default function MySkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    fetch(`${API}/api/me/skills`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your skills.</p></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">My Skills</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Track your skills, see your progress and plan what to improve next.</p>
      </div>

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
