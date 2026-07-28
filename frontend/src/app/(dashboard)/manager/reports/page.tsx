"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, Clock, TrendingUp, Download, ArrowRight, ArrowLeft, GraduationCap, Target, CheckCircle2, ScrollText, BarChart3 } from "lucide-react";
import Stat3D from "@/components/dashboard/Stat3D";
import Icon3D, { TONES, type Icon3DTone } from "@/components/dashboard/Icon3D";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import ProgressRing from "@/components/cpd/ProgressRing";
import { getToken } from "@/lib/authClient";

type InsightTab = "progress" | "trend" | "breakdown";
const INSIGHT_TABS: { key: InsightTab; label: string; icon: typeof BarChart3 }[] = [
  { key: "progress", label: "Progress", icon: Target },
  { key: "trend", label: "Trend", icon: TrendingUp },
  { key: "breakdown", label: "Breakdown", icon: BarChart3 },
];

const API = process.env.NEXT_PUBLIC_API_URL;

interface ReportData {
  stats: { totalMembers: number; totalCpdHours: number; coursesCompleted: number; coursesInProgress: number; avgProgress: number };
  trend: { label: string; avgProgress: number; cpdHours: number }[];
  progress: { learningProgress: number; cpdProgress: number; completionRate: number };
  recentReports: { name: string; generatedOn: string; format: string }[];
}

const REPORT_CARDS: { title: string; desc: string; href: string; icon: typeof GraduationCap; tone: Icon3DTone }[] = [
  { title: "Team Learning Report", desc: "Course enrolments, completions, progress and each person's skill gaps.", href: "/manager/team-learning?from=reports", icon: GraduationCap, tone: TONES.blue },
  { title: "Team Skills Report", desc: "Skill levels across your team and who needs improvement.", href: "/manager/team-skills?from=reports", icon: Target, tone: TONES.emerald },
  { title: "Team CPD Report", desc: "CPD hours logged versus annual targets, with at-risk flags.", href: "/manager/team-cpd?from=reports", icon: Clock, tone: TONES.amber },
  { title: "Completion Rate Report", desc: "How much of your team's learning is finished versus in progress.", href: "/manager/reports", icon: CheckCircle2, tone: TONES.violet },
];

export default function ManagerReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<InsightTab>("progress");

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
      <Link href="/manager/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={ScrollText} tone={TONES.blue} />
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">Reports</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">View and export key reports to track your team&apos;s learning performance.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Export All Reports
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REPORT_CARDS.map((c) => (
          <Link key={c.title} href={c.href} className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <Icon3D icon={c.icon} tone={c.tone} />
            <h3 className="mt-3 font-semibold text-[var(--ink)]">{c.title}</h3>
            <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{c.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] group-hover:underline">
              View Report <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load reports.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Stat3D icon={Users} tone={TONES.indigo} label="Total Members" value={data.stats.totalMembers} />
            <Stat3D icon={BookOpen} tone={TONES.blue} label="Courses In Progress" value={data.stats.coursesInProgress} />
            <Stat3D icon={Award} tone={TONES.emerald} label="Completed Courses" value={data.stats.coursesCompleted} />
            <Stat3D icon={Clock} tone={TONES.amber} label="CPD Hours" value={data.stats.totalCpdHours} />
            <Stat3D icon={TrendingUp} tone={TONES.violet} label="Average Progress" value={`${data.stats.avgProgress}%`} />
          </div>

          {/* One engaging view at a time — tap a tab to switch. Keeps the page
              uncluttered instead of stacking every chart on screen at once. */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Icon3D icon={BarChart3} tone={TONES.blue} size="sm" />
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">Team insights</h3>
                  <p className="text-xs text-[var(--muted)]">{INSIGHT_TABS.find((t) => t.key === tab)?.label} view · tap to switch</p>
                </div>
              </div>
              <div className="inline-flex rounded-xl bg-[var(--brand-tint)] p-1">
                {INSIGHT_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-white text-[var(--brand-dark)] shadow-sm" : "text-[var(--brand-dark)]/70 hover:text-[var(--brand-dark)]"}`}>
                      <Icon className="h-4 w-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "progress" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <RingStat label="Learning progress" pct={data.progress.learningProgress} color="#2e7d5b" bg="#eaf4ee" />
                <RingStat label="CPD progress" pct={data.progress.cpdProgress} color="#2f7fe0" bg="#e8f0fd" />
                <RingStat label="Completion rate" pct={data.progress.completionRate} color="#d9880f" bg="#fbf1de" />
              </div>
            ) : tab === "trend" ? (
              <>
                <LearnAreaChart data={data.trend} xKey="label" dataKeys={[{ key: "avgProgress", label: "progress %", color: "#3f9d75" }, { key: "cpdHours", label: "CPD hours", color: "#5b8def" }]} height={240} />
                <p className="mt-2 text-center text-xs text-[var(--muted)]">Average learning progress and CPD hours · last 8 weeks</p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:justify-center sm:gap-10">
                <LearnDonutChart
                  data={[
                    { name: "Completed", value: data.stats.coursesCompleted, color: "#3f9d75" },
                    { name: "In progress", value: data.stats.coursesInProgress, color: "#5b8def" },
                  ]}
                  label={`${data.stats.coursesCompleted + data.stats.coursesInProgress}`}
                  sublabel="courses"
                  height={220}
                />
                <div className="space-y-3">
                  <LegendRow color="#3f9d75" label="Completed" value={data.stats.coursesCompleted} />
                  <LegendRow color="#5b8def" label="In progress" value={data.stats.coursesInProgress} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// A gamified progress ring in a soft tinted tile — animated, tappable feel.
function RingStat({ label, pct, color, bg }: { label: string; pct: number; color: string; bg: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: bg }}>
      <ProgressRing percentage={pct} size={120} strokeWidth={11} color={color} trackColor="#ffffff" />
      <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <span className="ml-auto font-bold text-[var(--ink)]">{value}</span>
    </div>
  );
}
