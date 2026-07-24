"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, Clock, TrendingUp, Download, ArrowRight, GraduationCap, Target, CheckCircle2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface ReportData {
  stats: { totalMembers: number; totalCpdHours: number; coursesCompleted: number; coursesInProgress: number; avgProgress: number };
  trend: { label: string; avgProgress: number; cpdHours: number }[];
  progress: { learningProgress: number; cpdProgress: number; completionRate: number };
  recentReports: { name: string; generatedOn: string; format: string }[];
}

const REPORT_CARDS = [
  { title: "Team Learning Report", desc: "Course enrolments, completions and progress across your team.", href: "/manager/team-learning", icon: GraduationCap },
  { title: "Team Skills Report", desc: "Skill levels and gaps measured against role requirements.", href: "/manager/team-skills", icon: Target },
  { title: "Team CPD Report", desc: "CPD hours logged versus annual targets, with at-risk flags.", href: "/manager/team-cpd", icon: Clock },
  { title: "Completion Rate Report", desc: "How much of your team's learning is finished versus in progress.", href: "/manager/reports", icon: CheckCircle2 },
];

export default function ManagerReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/manager/reports`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      "LearnSmart AI — Team Reports",
      "",
      "Metric,Value",
      `Total Members,${data.stats.totalMembers}`,
      `Courses In Progress,${data.stats.coursesInProgress}`,
      `Completed Courses,${data.stats.coursesCompleted}`,
      `Total CPD Hours,${data.stats.totalCpdHours}`,
      `Average Progress,${data.stats.avgProgress}%`,
      "",
      "Week,Progress %,CPD Hours",
      ...data.trend.map((t) => `${t.label},${t.avgProgress},${t.cpdHours}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "team-reports.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Reports</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">View and export key reports to track your team&apos;s learning performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Export All Reports
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORT_CARDS.map((c) => (
          <div key={c.title} className="flex h-full flex-col rounded-xl border border-[var(--border)] bg-white p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]">
              <c.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold text-[var(--ink)]">{c.title}</h3>
            <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{c.desc}</p>
            <Link href={c.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline">
              View Report <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load reports.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={Users} label="Total Members" value={data.stats.totalMembers} />
            <StatCard icon={BookOpen} label="Courses In Progress" value={data.stats.coursesInProgress} />
            <StatCard icon={Award} label="Completed Courses" value={data.stats.coursesCompleted} />
            <StatCard icon={Clock} label="CPD Hours" value={data.stats.totalCpdHours} />
            <StatCard icon={TrendingUp} label="Average Progress" value={`${data.stats.avgProgress}%`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning Progress Trend <span className="text-xs font-normal text-[var(--muted)]">· last 8 weeks</span></h3>
              <LearnAreaChart data={data.trend} xKey="label" dataKeys={[{ key: "avgProgress", label: "progress %", color: "#2e7d5b" }, { key: "cpdHours", label: "CPD hours", color: "#3b82f6" }]} height={220} />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">Progress Summary</h3>
              <ProgressRow label="Learning Progress" pct={data.progress.learningProgress} color="bg-[var(--brand)]" />
              <div className="mt-4"><ProgressRow label="CPD Progress" pct={data.progress.cpdProgress} color="bg-blue-500" /></div>
              <div className="mt-4"><ProgressRow label="Completion Rate" pct={data.progress.completionRate} color="bg-amber-500" /></div>
              {data.recentReports.length === 0 && (
                <p className="mt-5 text-xs text-[var(--muted)]">Generated reports will be listed here.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-[var(--ink)]">{label}</span><span className="text-[var(--muted)]">{pct}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}
