"use client";

import { useEffect, useState } from "react";
import { Clock, BookOpen, Award, Target, Flame, Download } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface ReportData {
  stats: { totalCpdHours: number; cpdDelta: number; learningActivities: number; activitiesDelta: number; coursesCompleted: number; completedDelta: number; skillsImproved: number; cpdStreak: number };
  overTime: { label: string; hours: number }[];
  hoursByType: { name: string; value: number; color: string; pct: number }[];
  recent: { id: string; title: string; type: string; hours: number; date: string }[];
  progress: { cpdGoal: number; learningGoal: number; skillImprovement: number };
}

export default function MyReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/me/reports`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      "LearnSmart AI — My Report",
      "",
      "Metric,Value",
      `Total CPD Hours (this week),${data.stats.totalCpdHours}`,
      `Learning Activities (this week),${data.stats.learningActivities}`,
      `Courses Completed (this week),${data.stats.coursesCompleted}`,
      `Skills Improving,${data.stats.skillsImproved}`,
      `CPD Streak (weeks),${data.stats.cpdStreak}`,
      "",
      "Recent Activity,Type,Hours,Completed On",
      ...data.recent.map((r) => `"${r.title}",${r.type},${r.hours},${r.date}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load reports.</p></div>;

  const delta = (n: number, unit = "") => (n === 0 ? "no change vs last week" : `${n > 0 ? "↑" : "↓"} ${Math.abs(n)}${unit} vs last week`);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">My Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track your learning progress, CPD activities and growth over time.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Clock} label="Total CPD Hours" value={data.stats.totalCpdHours} sub={delta(data.stats.cpdDelta, "h")} />
        <StatCard icon={BookOpen} label="Learning Activities" value={data.stats.learningActivities} sub={delta(data.stats.activitiesDelta)} />
        <StatCard icon={Award} label="Courses Completed" value={data.stats.coursesCompleted} sub={delta(data.stats.completedDelta)} />
        <StatCard icon={Target} label="Skills Improving" value={data.stats.skillsImproved} sub="below target" />
        <StatCard icon={Flame} iconBg="bg-amber-50" label="CPD Streak" value={`${data.stats.cpdStreak} wk`} sub="Keep it up!" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Hours Over Time <span className="text-xs font-normal text-[var(--muted)]">· last 8 weeks</span></h3>
          <LearnAreaChart data={data.overTime} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Hours by Activity Type</h3>
          {data.hoursByType.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No CPD activity recorded yet.</p>
          ) : (
            <LearnDonutChart data={data.hoursByType.map((h) => ({ name: `${h.name} (${h.pct}%)`, value: h.value, color: h.color }))}
              label={`${data.hoursByType.reduce((s, h) => s + h.value, 0)}`} sublabel="Total Hours" height={200} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Recent Learning Activities</h3></div>
          {data.recent.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">No recent activities.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--ink)]">{r.title}</p><p className="text-xs text-[var(--muted)]">{r.type}</p></div>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{r.date}</span>
                  <span className="w-14 shrink-0 text-right text-sm font-semibold text-[var(--brand)]">{r.hours}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Progress Summary</h3>
          <ProgressRow label="CPD Goal Progress" pct={data.progress.cpdGoal} color="bg-[var(--brand)]" />
          <div className="mt-4"><ProgressRow label="Learning Goal Progress" pct={data.progress.learningGoal} color="bg-purple-500" /></div>
          <div className="mt-4"><ProgressRow label="Skill Improvement Progress" pct={data.progress.skillImprovement} color="bg-amber-500" /></div>
          <p className="mt-5 text-xs text-[var(--muted)]">Reports are updated in real-time, based on your CPD activities and learning records.</p>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-[var(--ink)]">{label}</span><span className="text-[var(--muted)]">{pct}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
