"use client";

import { BookOpen, Award, Download } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface ReportData {
  stats: { totalCpdHours: number; cpdDelta: number; learningActivities: number; activitiesDelta: number; coursesCompleted: number; completedDelta: number; skillsImproved: number; cpdStreak: number };
  overTime: { label: string; hours: number }[];
  hoursByType: { name: string; value: number; color: string; pct: number }[];
  recent: { id: string; title: string; type: string; hours: number; date: string }[];
  progress: { cpdGoal: number; courseCompletion: number; skillImprovement: number };
}

export default function MyReportsPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<ReportData>("/api/me/reports");

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      "LearnSmart AI — My Report",
      "",
      "Metric,Value",
      `Learning Activities (this week),${data.stats.learningActivities}`,
      `Courses Completed (this week),${data.stats.coursesCompleted}`,
      `Skills Improving,${data.stats.skillsImproved}`,
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

  if (isLoading) return <PageSkeleton />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load reports."} onRetry={refresh} />;

  const delta = (n: number, unit = "") => (n === 0 ? "no change vs last week" : `${n > 0 ? "↑" : "↓"} ${Math.abs(n)}${unit} vs last week`);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--ink)]">My Reports</h1>
            <RefreshingBadge show={isRefreshing} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">Track your learning progress and growth over time.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export Report
        </button>
      </div>

      {/* Reports is about trends: every card is a this-week figure with a vs-last-week
          delta. Current-status numbers (skills, totals) live on their home pages. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={BookOpen} label="Learning Activities (this week)" value={data.stats.learningActivities} sub={delta(data.stats.activitiesDelta)} />
        <StatCard icon={Award} label="Courses Completed (this week)" value={data.stats.coursesCompleted} sub={delta(data.stats.completedDelta)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning Hours Over Time <span className="text-xs font-normal text-[var(--muted)]">· last 8 weeks</span></h3>
          <LearnAreaChart data={data.overTime} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
          {data.overTime.reduce((s, w) => s + w.hours, 0) > 0 && data.overTime.filter((w) => w.hours > 0).length <= 1 && (
            <p className="mt-2 text-xs text-[var(--muted)]">Early days — the empty weeks are history, not missing data. Keep logging and the trend will fill in.</p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Hours by Activity Type</h3>
          {/* A donut only earns its place with 2+ categories; a single 100% slice says nothing. */}
          {data.hoursByType.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No learning hours recorded yet.</p>
          ) : data.hoursByType.length === 1 ? (
            <p className="text-sm text-[var(--ink)]">All <span className="font-semibold">{data.hoursByType[0].value}h</span> so far in <span className="font-semibold">{data.hoursByType[0].name}</span>. More types will chart here as you diversify.</p>
          ) : (
            <LearnDonutChart data={data.hoursByType.map((h) => ({ name: `${h.name} (${h.pct}%)`, value: h.value, color: h.color }))}
              label={`${data.hoursByType.reduce((s, h) => s + h.value, 0)}`} sublabel="Total Hours" height={200} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
            <h3 className="font-semibold text-[var(--ink)]">Recent Activity</h3>
          </div>
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
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Progress Summary</h3>
          <ProgressRow label="Course Completion" pct={data.progress.courseCompletion} color="bg-purple-500" />
          <div className="mt-4"><ProgressRow label="Skill Improvement" pct={data.progress.skillImprovement} color="bg-amber-500" /></div>
          <p className="mt-5 text-xs text-[var(--muted)]">Reports are updated in real-time, based on your learning records.</p>
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
