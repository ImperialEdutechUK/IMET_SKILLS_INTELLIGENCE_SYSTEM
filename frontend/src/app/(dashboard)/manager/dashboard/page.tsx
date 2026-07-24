"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp, Download, AlertTriangle, ChevronRight, X } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
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
  stats: { teamMembers: number; activeLearners: number; coursesInProgress: number; coursesCompleted: number; notStarted: number; cpdCompletion: number; cpdHoursTotal: number; teamTarget: number; avgSkillLevel: number; atRisk: number; attention: number };
  progressOverTime: { label: string; hours: number }[];
  attention: { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "inactive" }[];
  recentActivity: { id: string; user: string; action: string; type: string; time: string }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
  members: Member[];
}

const STATUS: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700" },
  attention: { label: "Behind target", cls: "bg-amber-50 text-amber-700" },
  inactive: { label: "No activity", cls: "bg-slate-100 text-slate-600" },
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700" },
};

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(false);
  const [remindMsg, setRemindMsg] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const load = () => fetch(`${API}/api/manager/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
    .then((r) => (r.ok ? r.json() : null)).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function sendReminders() {
    setReminding(true); setRemindMsg("");
    try {
      const r = await fetch(`${API}/api/cpd/notify`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      if (r.ok) setRemindMsg(`Reminders sent to ${d.employeesNotified} employee(s).`);
      else setRemindMsg("Could not send reminders.");
    } catch { setRemindMsg("Could not send reminders."); }
    setReminding(false);
  }

  if (loading || !data) {
    return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">{loading ? "Loading…" : "Could not load dashboard."}</p></div>;
  }

  const { stats } = data;
  const behind = stats.atRisk + stats.attention;
  const totalCourses = stats.coursesInProgress + stats.coursesCompleted;
  const thisWeek = data.progressOverTime.length ? data.progressOverTime[data.progressOverTime.length - 1].hours : 0;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Team dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{today} · {data.departmentName} · {stats.teamMembers} team member{stats.teamMembers === 1 ? "" : "s"}</p>
        </div>
        <Link href="/manager/reports" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export report
        </Link>
      </div>

      {/* CPD alert banner */}
      {behind > 0 && !dismissed && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-[var(--ink)]">
            <span className="font-semibold">{behind} {behind === 1 ? "person is" : "people are"} behind on CPD.</span>{" "}
            {remindMsg ? <span className="text-[var(--brand-dark)]">{remindMsg}</span> : "A reminder now gives them time to catch up before the deadline."}
          </p>
          {!remindMsg && (
            <button onClick={sendReminders} disabled={reminding} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)] ring-1 ring-inset ring-amber-300 hover:bg-amber-100 disabled:opacity-60">
              {reminding ? "Sending…" : `Send reminders to all ${behind}`}
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="shrink-0 text-amber-500 hover:text-amber-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Clickable stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/manager/team-learning" className="block transition hover:-translate-y-0.5">
          <StatCard icon={Users} label="Active learners" value={`${stats.activeLearners} of ${stats.teamMembers}`} sub="Enrolled in a course" />
        </Link>
        <Link href="/manager/team-learning" className="block transition hover:-translate-y-0.5">
          <StatCard icon={BookOpen} label="Courses in progress" value={stats.coursesInProgress} sub={`${stats.coursesCompleted} completed`} />
        </Link>
        <Link href="/manager/team-cpd" className="block transition hover:-translate-y-0.5">
          <StatCard icon={Award} label="CPD hours logged" value={`${stats.cpdHoursTotal} of ${stats.teamTarget}h`} sub="Annual team target" />
        </Link>
        <Link href="/manager/team-skills" className="block transition hover:-translate-y-0.5">
          <StatCard icon={TrendingUp} label="Avg skill level" value={`${stats.avgSkillLevel}%`} sub="Across the team" />
        </Link>
      </div>

      {/* Learning hours + CPD status */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Team learning hours</h3>
            <span className="text-xs text-[var(--muted)]">Last 8 weeks</span>
          </div>
          <p className="mb-3 text-sm text-[var(--muted)]">{thisWeek > 0 ? `${thisWeek}h logged this week.` : "No hours logged this week yet."}</p>
          <LearnAreaChart data={data.progressOverTime} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">CPD status</h3></div>
          {data.attention.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">Everyone is on track. 🎉</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.attention.map((a) => {
                const st = STATUS[a.status] ?? STATUS.attention;
                return (
                  <li key={a.id}>
                    <Link href={`/manager/employees/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                      <Avatar name={a.fullName} />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--ink)]">{a.fullName}</p><p className="truncate text-xs text-[var(--muted)]">{a.reason}</p></div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Team members — clickable rows */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] p-5">
          <div>
            <h3 className="font-semibold text-[var(--ink)]">Team members</h3>
            <p className="text-xs text-[var(--muted)]">Click a row to open their dashboard</p>
          </div>
          <p className="text-xs text-[var(--muted)]"><span className="font-semibold text-[var(--ink)]">{stats.avgSkillLevel}%</span> avg skill · <span className="font-semibold text-[var(--ink)]">{stats.cpdCompletion}%</span> avg CPD</p>
        </div>
        {data.members.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No employees in {data.departmentName} yet.</p>
        ) : (
          <>
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
                        <Avatar name={m.fullName} />
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--ink)]">{m.fullName}</p><p className="truncate text-xs text-[var(--muted)]">{m.position}</p></div>
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

      {/* Category + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning by category</h3>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No enrolments yet.</p>
          ) : (
            <LearnDonutChart data={data.categoryBreakdown} label={`${totalCourses}`} sublabel="Courses" height={200} />
          )}
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">Recent team activity</h3>
            <p className="text-sm text-[var(--muted)]">No team activity yet. It appears here as employees enrol, complete courses and log CPD.</p>
          </div>
        ) : (
          <ActivityFeed items={data.recentActivity} title="Recent team activity" />
        )}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>;
}

function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, value)}%` }} /></div>
      <span className="w-9 shrink-0 text-xs font-medium text-[var(--ink)]">{value}%</span>
    </div>
  );
}
