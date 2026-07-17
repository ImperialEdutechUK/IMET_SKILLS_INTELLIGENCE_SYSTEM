"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, AlertTriangle, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";
const API = process.env.NEXT_PUBLIC_API_URL;
const importanceConfig: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};
function GapBar({ current, required }: { current: number; required: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        let bg = "#e6ebe8";
        if (i < current) bg = "var(--brand)"; else if (i < required) bg = "#fca5a5";
        return <span key={i} className="h-2 w-2 rounded-full" style={{ background: bg }} />;
      })}
    </div>
  );
}
export default function DeptGapsPage() {
  const { departmentId } = useParams() as { departmentId: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API}/api/manager/gaps?departmentId=${departmentId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { setData(d); setLoading(false); if (d?.employees) { const f = d.employees.find((e: any) => e.hasRole); if (f) setOpen(f.id); } }).catch(() => setLoading(false));
  }, [departmentId]);
  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load skill gaps.</p></div>;
  return (
    <div>
      <div className="mb-6"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[var(--brand)]" /><h1 className="text-2xl font-bold text-[var(--ink)]">Skill Gaps</h1></div><p className="mt-1 text-sm text-[var(--muted)]">Current skills against role requirements for this department.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Employees" value={data.totalEmployees} />
        <StatCard icon={TrendingUp} label="With Role Profile" value={data.withRoleProfile} sub="gap computable" />
        <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="No Role Profile" value={data.withoutRoleProfile} sub="position unmatched" />
      </div>
      <div className="space-y-4">
        {data.employees.map((emp: any) => {
          const isOpen = open === emp.id;
          return (
            <div key={emp.id} className="rounded-xl border border-[var(--border)] bg-white">
              <button onClick={() => emp.hasRole && setOpen(isOpen ? null : emp.id)} className={`flex w-full items-center gap-4 p-5 text-left ${emp.hasRole ? "" : "cursor-default"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{emp.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{emp.fullName}</p>
                  <p className="text-xs text-[var(--muted)]">{emp.department} · {emp.position}</p>
                </div>
                {emp.hasRole ? (
                  <>
                    {emp.criticalGaps > 0 && <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{emp.criticalGaps} critical</span>}
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${emp.totalGap === 0 ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-amber-50 text-amber-700"}`}>{emp.totalGap === 0 ? "On target" : `Gap ${emp.totalGap}`}</span>
                  </>
                ) : <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">No role profile</span>}
              </button>
              {isOpen && emp.hasRole && (
                <div className="border-t border-[var(--border)] p-5">
                  <ul className="space-y-3">
                    {emp.gaps.map((g: any) => (
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
    </div>
  );
}
