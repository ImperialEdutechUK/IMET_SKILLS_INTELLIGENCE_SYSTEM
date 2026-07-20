"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, AlertTriangle, TrendingUp, Users, Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SkillGap { skill: string; employeesWithGap: number; avgGap: number; avgGapLevel: string; criticalGaps: number; missingSkill: number; needsImprovement: number; priorityScore: number; }
interface Emp { id: string; fullName: string; position: string | null; gaps: number; critical: number; topPriority: number; }
interface Data {
  department: { id: string; name: string; priority: number };
  employeeCount: number; analysedEmployees: number;
  statusCounts: { MEETS_REQUIREMENT: number; NEEDS_IMPROVEMENT: number; CRITICAL_GAP: number; MISSING_SKILL: number };
  topSkillGaps: SkillGap[]; skillGaps: SkillGap[]; employees: Emp[];
}
interface Dept { id: string; name: string; }

export default function AiInsightsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/departments`).then(r => r.ok ? r.json() : []).then((ds: Dept[]) => {
      setDepts(ds);
      if (ds.length) setDeptId(ds[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!deptId) return;
    setLoading(true);
    fetch(`${API}/api/dashboard/department/${deptId}/skill-gaps`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--brand)]" />
          <div><h1 className="text-2xl font-bold text-[var(--ink)]">AI Insights</h1><p className="mt-1 text-sm text-[var(--muted)]">Skill-gap intelligence for your team, computed from role requirements.</p></div>
        </div>
        <select value={deptId} onChange={e => setDeptId(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load insights.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard icon={Users} label="Employees" value={data.employeeCount} sub={`${data.analysedEmployees} analysed`} />
            <StatCard icon={Target} label="Meets Requirement" value={data.statusCounts.MEETS_REQUIREMENT} />
            <StatCard icon={TrendingUp} iconBg="bg-amber-50" label="Needs Improvement" value={data.statusCounts.NEEDS_IMPROVEMENT} />
            <StatCard icon={AlertTriangle} iconBg="bg-red-50" label="Critical / Missing" value={data.statusCounts.CRITICAL_GAP + data.statusCounts.MISSING_SKILL} />
          </div>

          {data.analysedEmployees === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">No gap analysis available yet</p>
              <p className="mt-1 text-xs text-amber-700">No employees in this department have had their skill gaps computed. Once gap analysis runs, priority skills and at-risk employees will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h3 className="mb-1 font-semibold text-[var(--ink)]">Priority Skill Gaps</h3>
                <p className="mb-4 text-xs text-[var(--muted)]">Skills with the highest gap priority across the team.</p>
                {data.topSkillGaps.length === 0 ? <p className="text-sm text-[var(--muted)]">No outstanding gaps.</p> : (
                  <ul className="space-y-3">
                    {data.topSkillGaps.map((s) => (
                      <li key={s.skill} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-[var(--ink)]">{s.skill}</span>
                            {s.criticalGaps > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">{s.criticalGaps} critical</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{s.employeesWithGap} {s.employeesWithGap === 1 ? "employee" : "employees"} · avg gap {s.avgGap} ({s.avgGapLevel})</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-dark)]">P{s.priorityScore}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h3 className="mb-1 font-semibold text-[var(--ink)]">Employees Needing Attention</h3>
                <p className="mb-4 text-xs text-[var(--muted)]">Ranked by gap priority.</p>
                {data.employees.length === 0 ? <p className="text-sm text-[var(--muted)]">No employees analysed.</p> : (
                  <ul className="space-y-3">
                    {data.employees.map((e) => (
                      <li key={e.id} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{e.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--ink)]">{e.fullName}</p>
                          <p className="text-xs text-[var(--muted)]">{e.position ?? "—"} · {e.gaps} {e.gaps === 1 ? "gap" : "gaps"}</p>
                        </div>
                        {e.critical > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{e.critical} critical</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
