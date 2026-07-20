"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, TrendingUp, Users, Building2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SkillGap { skill: string; employeesWithGap: number; avgGap: number; criticalGaps: number; priorityScore: number; }
interface Dept { id: string; name: string; employeesWithGap: number; totalGaps: number; criticalGaps: number; }
interface Data {
  totalEmployeesAnalysed: number; totalGaps: number;
  statusCounts: { MEETS_REQUIREMENT: number; NEEDS_IMPROVEMENT: number; CRITICAL_GAP: number; MISSING_SKILL: number };
  topSkillGaps: SkillGap[]; departments: Dept[];
}

export default function AdminRecommendationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/insights`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load insights.</p></div>;

  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">AI Recommendations</h1></div><p className="mt-1 text-sm text-[var(--muted)]">System-wide skill-gap intelligence across all departments.</p></div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Employees Analysed" value={data.totalEmployeesAnalysed} />
        <StatCard icon={TrendingUp} label="Total Gaps" value={data.totalGaps} sub="outstanding" />
        <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="Needs Improvement" value={data.statusCounts.NEEDS_IMPROVEMENT} />
        <StatCard icon={AlertTriangle} iconBg="bg-red-50" label="Critical / Missing" value={data.statusCounts.CRITICAL_GAP + data.statusCounts.MISSING_SKILL} />
      </div>

      {data.totalEmployeesAnalysed === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">No gap analysis available yet</p>
          <p className="mt-1 text-xs text-amber-700">Once employee skill gaps are computed, system-wide priority skills and department breakdowns will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-1 font-semibold text-[var(--ink)]">Top Priority Skills (Org-wide)</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">Highest-priority skill gaps across the organisation.</p>
            <ul className="space-y-3">
              {data.topSkillGaps.map((s) => (
                <li key={s.skill} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[var(--ink)]">{s.skill}</span>
                      {s.criticalGaps > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">{s.criticalGaps} critical</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{s.employeesWithGap} {s.employeesWithGap === 1 ? "employee" : "employees"} · avg gap {s.avgGap}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-dark)]">P{s.priorityScore}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-1 font-semibold text-[var(--ink)]">Departments by Gap Severity</h3>
            <p className="mb-4 text-xs text-[var(--muted)]">Ranked by critical gaps, then total gaps.</p>
            <ul className="space-y-3">
              {data.departments.map((d) => (
                <li key={d.id} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Building2 className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">{d.name}</p>
                    <p className="text-xs text-[var(--muted)]">{d.employeesWithGap} {d.employeesWithGap === 1 ? "employee" : "employees"} · {d.totalGaps} gaps</p>
                  </div>
                  {d.criticalGaps > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{d.criticalGaps} critical</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
