"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle, BarChart3, Users, Search, Download } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

interface Member {
  id: string;
  fullName: string;
  position: string;
  department: string;
  coursesCompleted: number;
  coursesInProgress: number;
  cpdProgress: number;
  lastActive: string;
}
interface Data {
  teamMembers: number;
  inProgress: number;
  completed: number;
  avgCompletion: number;
  members: Member[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

export default function TeamLearningPage() {
  const [data, setData] = useState<Data | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/manager/team-learning`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const members = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return q ? data.members.filter((m) => m.fullName.toLowerCase().includes(q)) : data.members;
  }, [data, search]);

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Name", "Position", "Department", "Overall Progress", "Courses In Progress", "Completed Courses", "Last Active"];
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = members.map((m) => [
      m.fullName, m.position, m.department, `${m.cpdProgress}%`, m.coursesInProgress, m.coursesCompleted, m.lastActive,
    ].map(escape).join(","));
    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-learning.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Team Learning</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track your team&apos;s learning progress and course activity.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team learning.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total Team Members" value={data.teamMembers} />
            <StatCard icon={BookOpen} label="Courses In Progress" value={data.inProgress} />
            <StatCard icon={CheckCircle} label="Completed Courses" value={data.completed} />
            <StatCard icon={BarChart3} label="Average Progress" value={`${data.avgCompletion}%`} />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-5">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team members..."
                  className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" />
              </div>
              <button onClick={exportCsv} disabled={members.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>

            {members.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">No team members found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--muted)]">
                      <th className="px-5 py-3">Team Member</th>
                      <th className="px-5 py-3">Department</th>
                      <th className="px-5 py-3 w-48">Overall Progress</th>
                      <th className="px-5 py-3">Courses In Progress</th>
                      <th className="px-5 py-3">Completed Courses</th>
                      <th className="px-5 py-3">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {members.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <Link href={`/manager/employees/${m.id}`} className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--ink)] hover:text-[var(--brand)]">{m.fullName}</p>
                              <p className="text-xs text-[var(--muted)]">{m.position}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--muted)]">{m.department}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${m.cpdProgress}%` }} /></div>
                            <span className="w-9 shrink-0 text-right text-xs font-medium text-[var(--ink)]">{m.cpdProgress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--ink)]">{m.coursesInProgress}</td>
                        <td className="px-5 py-3.5 text-[var(--ink)]">{m.coursesCompleted}</td>
                        <td className="px-5 py-3.5 text-[var(--muted)]">{m.lastActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
