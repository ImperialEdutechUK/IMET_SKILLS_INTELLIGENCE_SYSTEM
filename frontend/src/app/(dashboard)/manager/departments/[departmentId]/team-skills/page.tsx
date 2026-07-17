"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import BarList from "@/components/charts/BarList";
import { getToken } from "@/lib/authClient";
const API = process.env.NEXT_PUBLIC_API_URL;
export default function DeptTeamSkillsPage() {
  const { departmentId } = useParams() as { departmentId: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/manager/team-skills?departmentId=${departmentId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [departmentId]);
  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team skills.</p></div>;
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Team Skills</h1><p className="mt-1 text-sm text-[var(--muted)]">Skill levels and gaps for this department.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Skills Tracked" value={data.skillsTracked} />
        <StatCard icon={Target} label="Avg Team Level" value={`${data.avgTeamLevel}/5`} sub="Across all skills" />
        <StatCard icon={Target} iconBg="bg-amber-50" label="Critical Gaps" value={data.criticalGaps} sub="needs attention" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Skill Gaps</h3>
          {data.gaps.length === 0 ? <p className="text-sm text-[var(--muted)]">No gaps to show.</p> : <BarList items={data.gaps.map((g: any) => ({ name: g.name, value: g.value, max: 5 }))} unit="" />}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Team Average Levels</h3>
          {data.matrix.length === 0 ? <p className="text-sm text-[var(--muted)]">No skills tracked in this view.</p> : (
            <ul className="space-y-4">
              {data.matrix.map((s: any) => (
                <li key={s.skill}>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-[var(--ink)]">{s.skill}</span><span className="text-[var(--muted)]">{s.avgLevel}/5</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${(s.avgLevel/5)*100}%`}} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
