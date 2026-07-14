"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, CheckCircle, BarChart3, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

interface Member { id: string; fullName: string; department: string; coursesCompleted: number; coursesInProgress: number; cpdProgress: number; }
interface Data { teamMembers: number; inProgress: number; completed: number; avgCompletion: number; members: Member[]; }
interface Dept { id: string; name: string; }

const API = process.env.NEXT_PUBLIC_API_URL;

export default function TeamLearningPage() {
  const [data, setData] = useState<Data | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/departments`).then(r => r.ok ? r.json() : []).then(setDepts).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = deptId ? `?departmentId=${deptId}` : "";
    fetch(`${API}/api/manager/team-learning${q}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">Team Learning</h1><p className="mt-1 text-sm text-[var(--muted)]">Track your team's learning progress.</p></div>
        <select value={deptId} onChange={e => setDeptId(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team learning.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard icon={Users} label="Team Members" value={data.teamMembers} />
            <StatCard icon={BookOpen} label="In Progress" value={data.inProgress} />
            <StatCard icon={CheckCircle} label="Completed" value={data.completed} />
            <StatCard icon={BarChart3} label="Avg Completion" value={`${data.avgCompletion}%`} />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Team Members</h3></div>
            {data.members.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">No team members in this view.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-4 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                      <p className="text-xs text-[var(--muted)]">{m.department} · {m.coursesCompleted} courses</p>
                    </div>
                    <div className="w-32">
                      <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--muted)]">CPD</span><span className="font-medium">{m.cpdProgress}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
