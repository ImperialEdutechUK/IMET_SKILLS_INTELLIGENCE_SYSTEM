"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Award } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";
const API = process.env.NEXT_PUBLIC_API_URL;
export default function DeptTeamCpdPage() {
  const { departmentId } = useParams() as { departmentId: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/manager/team-cpd?departmentId=${departmentId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [departmentId]);
  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team CPD.</p></div>;
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Team CPD</h1><p className="mt-1 text-sm text-[var(--muted)]">CPD progress for this department.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Award} label="Team CPD Avg" value={`${data.avg}%`} />
        <StatCard icon={Award} label="On Track" value={data.onTrack} sub="members" />
        <StatCard icon={Award} iconBg="bg-amber-50" label="At Risk" value={data.atRisk} sub="needs attention" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Individual CPD Progress</h3></div>
        {data.members.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">No team members in this department.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {data.members.map((m: any) => (
              <li key={m.id} className="flex items-center gap-4 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${m.status ? "text-amber-600" : "text-[var(--brand)]"}`}>{m.cpdProgress}%</span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${m.status === "at_risk" ? "bg-red-50 text-red-700" : m.status === "attention" ? "bg-amber-50 text-amber-700" : "bg-[var(--brand-tint)] text-[var(--brand-dark)]"}`}>{m.status === "at_risk" ? "At Risk" : m.status === "attention" ? "Attention" : "On Track"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
