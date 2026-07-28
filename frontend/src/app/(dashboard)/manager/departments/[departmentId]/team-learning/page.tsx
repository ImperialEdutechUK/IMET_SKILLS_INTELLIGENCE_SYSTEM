"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BookOpen, CheckCircle, BarChart3, Users, ChevronDown } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";
const API = process.env.NEXT_PUBLIC_API_URL;
// Self-assessed levels, 0-based — the same scale as My Skills.
const LEVELS = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];
const levelName = (n: number) => LEVELS[n] ?? `Level ${n}`;
export default function DeptTeamLearningPage() {
  const { departmentId } = useParams() as { departmentId: string };
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openGaps, setOpenGaps] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API}/api/manager/team-learning?departmentId=${departmentId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [departmentId]);
  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team learning.</p></div>;
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Learning</h1><p className="mt-1 text-sm text-[var(--muted)]">Learning progress for this department.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Members" value={data.teamMembers} />
        <StatCard icon={BookOpen} label="In Progress" value={data.inProgress} />
        <StatCard icon={CheckCircle} label="Completed" value={data.completed} />
        <StatCard icon={BarChart3} label="Avg Completion" value={`${data.avgCompletion}%`} />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Members</h3></div>
        {data.members.length === 0 ? <p className="p-5 text-sm text-[var(--muted)]">No team members in this department.</p> : (
          <ul className="divide-y divide-[var(--border)]">
            {data.members.map((m: any) => {
              const gaps = m.skillGaps ?? [];
              const isOpen = openGaps === m.id;
              return (
              <li key={m.id} className="p-4">
                <div className="flex items-center gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                    <p className="text-xs text-[var(--muted)]">{m.department} · {m.coursesCompleted} courses</p>
                  </div>
                  {gaps.length > 0 ? (
                    <button onClick={() => setOpenGaps(isOpen ? null : m.id)}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline">
                      {gaps.length} {gaps.length === 1 ? "gap" : "gaps"}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-[var(--muted)]">{m.skillsTracked > 0 ? "On target" : "No skills added"}</span>
                  )}
                  <div className="w-32">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--muted)]">CPD</span><span className="font-medium">{m.cpdProgress}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
                  </div>
                </div>
                {isOpen && gaps.length > 0 && (
                  <ul className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 pl-4">
                    {gaps.map((g: any) => (
                      <li key={g.skill} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-medium text-[var(--ink)]">{g.skill}</span>
                        <span className="text-[var(--muted)]">{levelName(g.current)} <span className="text-slate-400">→</span> {levelName(g.target)}</span>
                        <span className="font-medium text-amber-600">+{g.gap} level{g.gap === 1 ? "" : "s"} to go</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
