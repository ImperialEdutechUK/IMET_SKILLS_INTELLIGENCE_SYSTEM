"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp, Building2, ChevronRight } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import BarList from "@/components/charts/BarList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Member {
  id: string; fullName: string; position: string; avgSkillPercent: number;
  cpdProgress: number; coursesInProgress: number; coursesCompleted: number; status: string;
}
interface DashData {
  fullName: string;
  departmentName: string;
  stats: { teamMembers: number; coursesInProgress: number; coursesCompleted: number; notStarted: number; cpdCompletion: number; avgSkillLevel: number; atRisk: number; attention: number };
  progressOverTime: { label: string; hours: number }[];
  cpdStatusBreakdown: { name: string; value: number; color: string }[];
  attention: { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "inactive" }[];
  recentActivity: { id: string; user: string; action: string; type: string; time: string }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
  members: Member[];
}

const STATUS: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700" },
  attention: { label: "Attention", cls: "bg-amber-50 text-amber-700" },
  inactive: { label: "Inactive", cls: "bg-slate-100 text-slate-600" },
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700" },
};

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/manager/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">{loading ? "Loading…" : "Could not load dashboard."}</p></div>;
  }

  const totalCourses = data.stats.coursesInProgress + data.stats.coursesCompleted;
  const skillByMember = [...data.members]
    .sort((a, b) => b.avgSkillPercent - a.avgSkillPercent)
    .slice(0, 8)
    .map((m) => ({ name: m.fullName, value: m.avgSkillPercent, color: "#2e7d5b" }));

  return (
    <div>
      {/* Header — manager is locked to one department; show which one */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {data.fullName.split(" ")[0]}! <span aria-hidden="true">👋</span></h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here&apos;s how your team is doing.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)]">
          <Building2 className="h-4 w-4 text-[var(--brand)]" /> {data.departmentName}
        </span>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Team Members" value={data.stats.teamMembers} sub="Active learners" />
        <StatCard icon={BookOpen} label="Courses in Progress" value={data.stats.coursesInProgress} sub={`${data.stats.coursesCompleted} completed`} />
        <StatCard icon={Award} label="CPD Completion" value={`${data.stats.cpdCompletion}%`} sub="Team average" />
        <StatCard icon={TrendingUp} label="Avg Skill Level" value={`${data.stats.avgSkillLevel}%`} sub="Across the team" />
      </div>

      {/* Row 1: learning trend + CPD status donut */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Team Learning Progress</h3>
            <span className="text-xs text-[var(--muted)]">CPD hours · last 8 weeks</span>
          </div>
          <LearnAreaChart data={data.progressOverTime} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Status</h3>
          {data.stats.teamMembers === 0 ? (
            <p className="text-sm text-[var(--muted)]">No team members yet.</p>
          ) : (
            <LearnDonutChart data={data.cpdStatusBreakdown} label={`${data.stats.teamMembers}`} sublabel="people" height={200} />
          )}
        </div>
      </div>

      {/* Team members — clickable through to each employee's detail */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
          <h3 className="font-semibold text-[var(--ink)]">Team Members</h3>
          <span className="text-xs text-[var(--muted)]">Click a member to open their dashboard</span>
        </div>
        {data.members.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No employees in {data.departmentName} yet.</p>
        ) : (
          <>
            {/* column header (desktop) */}
            <div className="hidden gap-3 border-b border-[var(--border)] px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <span>Member</span><span>Skill level</span><span>CPD</span><span>Courses</span><span className="w-24 text-right">Status</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {data.members.map((m) => {
                const st = STATUS[m.status] ?? STATUS.on_track;
                return (
                  <li key={m.id}>
                    <Link href={`/manager/employees/${m.id}`} className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                          <p className="truncate text-xs text-[var(--muted)]">{m.position}</p>
                        </div>
                      </div>
                      <MiniBar value={m.avgSkillPercent} />
                      <MiniBar value={m.cpdProgress} />
                      <span className="text-xs text-[var(--muted)]">{m.coursesCompleted} done · {m.coursesInProgress} active</span>
                      <span className="flex items-center justify-end gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Row 2: skill-by-member bars + learning by category */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Skill Level by Member</h3>
          {skillByMember.length === 0 ? <p className="text-sm text-[var(--muted)]">No skill data yet.</p> : <BarList items={skillByMember} />}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning by Category</h3>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No enrolments yet.</p>
          ) : (
            <LearnDonutChart data={data.categoryBreakdown} label={`${totalCourses}`} sublabel="Courses" height={200} />
          )}
        </div>
      </div>

      {/* Row 3: attention (clickable) + recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Employees Needing Attention</h3></div>
          {data.attention.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">Everyone is on track. 🎉</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.attention.map((a) => {
                const st = STATUS[a.status] ?? STATUS.attention;
                return (
                  <li key={a.id}>
                    <Link href={`/manager/employees/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{a.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--ink)]">{a.fullName}</p><p className="truncate text-xs text-[var(--muted)]">{a.reason}</p></div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">Recent Team Activity</h3>
            <p className="text-sm text-[var(--muted)]">No team activity yet. It appears here as employees enrol, complete courses and log CPD.</p>
          </div>
        ) : (
          <ActivityFeed items={data.recentActivity} title="Recent Team Activity" />
        )}
      </div>
    </div>
  );
}

function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, value)}%` }} /></div>
      <span className="w-9 shrink-0 text-xs font-medium text-[var(--ink)]">{value}%</span>
    </div>
  );
}
