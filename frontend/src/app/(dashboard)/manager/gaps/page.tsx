"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, AlertTriangle, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const importanceConfig: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Gap { skill: string; required: number; current: number; gap: number; importance: string; }
interface Emp { id: string; fullName: string; department: string; position: string; hasRole: boolean; roleTitle?: string; totalGap: number; criticalGaps: number; gaps: Gap[]; }
interface Data { totalEmployees: number; withRoleProfile: number; withoutRoleProfile: number; employees: Emp[]; }
interface Dept { id: string; name: string; }

const API = process.env.NEXT_PUBLIC_API_URL;

function GapBar({ current, required }: { current: number; required: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        let bg = "#e6ebe8";
        if (i < current) bg = "var(--brand)";
        else if (i < required) bg = "#fca5a5";
        return <span key={i} className="h-2 w-2 rounded-full" style={{ background: bg }} />;
      })}
    </div>
  );
}

export default function SkillGapsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/departments`).then(r => r.ok ? r.json() : []).then(setDepts).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = deptId ? `?departmentId=${deptId}` : "";
    fetch(`${API}/api/manager/gaps${q}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); if (d?.employees) { const first = d.employees.find((e: Emp) => e.hasRole); if (first) setOpen(first.id); } })
      .catch(() => setLoading(false));
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Skill Gaps</h1></div><p className="mt-1 text-sm text-[var(--muted)]">Each employee's current skills against their role's requirements.</p></div>
        <select value={deptId} onChange={e => setDeptId(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load skill gaps.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label="Employees" value={data.totalEmployees} />
            <StatCard icon={TrendingUp} label="With Role Profile" value={data.withRoleProfile} sub="gap computable" />
            <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="No Role Profile" value={data.withoutRoleProfile} sub="position unmatched" />
          </div>

          <div className="mb-4 flex items-center gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} /> Current level</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#fca5a5" }} /> Gap to required</span>
          </div>

          <div className="space-y-4">
            {data.employees.map((emp) => {
              const isOpen = open === emp.id;
              return (
                <div key={emp.id} className="rounded-xl border border-[var(--border)] bg-white">
                  <button onClick={() => emp.hasRole && setOpen(isOpen ? null : emp.id)} className={`flex w-full items-center gap-4 p-5 text-left ${emp.hasRole ? "" : "cursor-default"}`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{emp.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{emp.fullName}</p>
                      <p className="text-xs text-[var(--muted)]">{emp.department} · {emp.position}</p>
                    </div>
                    {emp.hasRole ? (
                      <>
                        {emp.criticalGaps > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{emp.criticalGaps} critical</span>}
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${emp.totalGap === 0 ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-amber-50 text-amber-700"}`}>{emp.totalGap === 0 ? "On target" : `Gap ${emp.totalGap}`}</span>
                      </>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">No role profile</span>
                    )}
                  </button>
                  {isOpen && emp.hasRole && (
                    <div className="border-t border-[var(--border)] p-5">
                      <ul className="space-y-3">
                        {emp.gaps.map((g) => (
                          <li key={g.skill} className="flex items-center gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-[var(--ink)]">{g.skill}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${importanceConfig[g.importance] ?? importanceConfig.MEDIUM}`}>{g.importance}</span>
                                {g.gap > 0 && <span className="text-[10px] text-amber-600">needs +{g.gap}</span>}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="mb-1 text-[10px] text-[var(--muted)]">{g.current}/{g.required}</p>
                              <GapBar current={g.current} required={g.required} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
