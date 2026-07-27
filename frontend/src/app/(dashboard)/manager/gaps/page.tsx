"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, AlertTriangle, Users, BarChart3, ChevronDown } from "lucide-react";
import Stat3D from "@/components/dashboard/Stat3D";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import { getToken } from "@/lib/authClient";

// Only the skills that really matter get flagged — the rest carry no jargon badge.
const isPriority = (importance: string) => importance === "CRITICAL" || importance === "HIGH";

interface Gap { skill: string; required: number; current: number; gap: number; importance: string; }
interface Emp { id: string; fullName: string; department: string; position: string; hasRole: boolean; roleTitle?: string; totalGap: number; criticalGaps: number; gaps: Gap[]; }
interface Data { totalEmployees: number; withRoleProfile: number; withoutRoleProfile: number; employees: Emp[]; }
interface Dept { id: string; name: string; }

const API = process.env.NEXT_PUBLIC_API_URL;

const LEVELS = ["None", "Basic", "Intermediate", "Advanced", "Expert"];
const levelName = (n: number) => LEVELS[n] ?? `Level ${n}`;

// Simple, readable gap bar: the full track is the level the role requires, the
// green fill is how much of that the employee already has. Full = on target.
function GapBar({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 100;
  const met = current >= required;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${met ? "bg-emerald-500" : "bg-[var(--brand)]"}`} style={{ width: `${pct}%` }} />
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
      .then((d) => { setData(d); setLoading(false); setOpen(null); })
      .catch(() => setLoading(false));
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={BarChart3} tone={TONES.violet} />
          <div><h1 className="text-2xl font-bold text-[var(--ink)]">Skill Gaps</h1><p className="mt-1 text-sm text-[var(--muted)]">Each employee&apos;s current skills against their role&apos;s requirements.</p></div>
        </div>
        <select value={deptId} onChange={e => setDeptId(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load skill gaps.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat3D icon={Users} tone={TONES.indigo} label="Employees" value={data.totalEmployees} />
            <Stat3D icon={TrendingUp} tone={TONES.emerald} label="With Role Profile" value={data.withRoleProfile} sub="gap computable" />
            <Stat3D icon={AlertTriangle} tone={TONES.rose} label="No Role Profile" value={data.withoutRoleProfile} sub="position unmatched" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-[var(--brand)]" /> Progress toward the level the role needs</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-emerald-500" /> On target</span>
          </div>

          <div className="space-y-2.5">
            {data.employees.map((emp) => {
              const isOpen = open === emp.id;
              const toImprove = emp.gaps.filter((g) => g.gap > 0).length;
              return (
                <div key={emp.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                  <button onClick={() => emp.hasRole && setOpen(isOpen ? null : emp.id)} className={`flex w-full items-center gap-3 p-3.5 text-left ${emp.hasRole ? "transition-colors hover:bg-slate-50" : "cursor-default"}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{emp.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{emp.fullName}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{emp.department} · {emp.position}</p>
                    </div>
                    {emp.hasRole ? (
                      <>
                        {toImprove === 0 ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">On target</span>
                        ) : (
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${emp.criticalGaps > 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{toImprove} to improve</span>
                        )}
                        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">No role profile</span>
                    )}
                  </button>
                  {isOpen && emp.hasRole && (
                    <div className="border-t border-[var(--border)] p-4">
                      <ul className="space-y-4">
                        {emp.gaps.map((g) => (
                          <li key={g.skill}>
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-[var(--ink)]">{g.skill}</span>
                                {g.gap > 0 && isPriority(g.importance) && (
                                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">Priority</span>
                                )}
                              </div>
                              <span className="text-xs text-[var(--muted)]">
                                {levelName(g.current)} <span className="text-slate-400">→</span> {levelName(g.required)}
                                {g.gap > 0
                                  ? <span className="ml-1 font-medium text-amber-600">· needs +{g.gap} level{g.gap === 1 ? "" : "s"}</span>
                                  : <span className="ml-1 font-medium text-emerald-600">· on target ✓</span>}
                              </span>
                            </div>
                            <GapBar current={g.current} required={g.required} />
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
