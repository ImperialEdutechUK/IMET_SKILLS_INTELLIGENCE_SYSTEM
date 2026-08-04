"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Download, ArrowRight, GraduationCap, Target, CheckCircle2, ScrollText, BarChart3 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Icon3D, { TONES, type Icon3DTone } from "@/components/dashboard/Icon3D";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import ProgressRing from "@/components/cpd/ProgressRing";
import { useApi } from "@/lib/api";
import { CardGridSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

type InsightTab = "progress" | "trend" | "breakdown";
const INSIGHT_TABS: { key: InsightTab; label: string; icon: typeof BarChart3 }[] = [
  { key: "progress", label: "Progress", icon: Target },
  { key: "trend", label: "Trend", icon: TrendingUp },
  { key: "breakdown", label: "Breakdown", icon: BarChart3 },
];


interface ReportData {
  stats: { totalMembers: number; totalCpdHours: number; coursesCompleted: number; coursesInProgress: number; avgProgress: number; avgCpdProgress: number };
  definitions?: { avgCpdProgress: string };
  trend: { label: string; avgProgress: number; cpdHours: number }[];
  progress: { learningProgress: number; cpdProgress: number; completionRate: number };
  recentReports: { name: string; generatedOn: string; format: string }[];
}

const REPORT_CARDS: { title: string; desc: string; href: string; icon: typeof GraduationCap; tone: Icon3DTone }[] = [
  { title: "Team Learning Report", desc: "Course enrolments, completions, progress and each person's skill gaps.", href: "/manager/team-learning?from=reports", icon: GraduationCap, tone: TONES.blue },
  { title: "Team Skills Report", desc: "Skill levels across your team and who needs improvement.", href: "/manager/team-skills?from=reports", icon: Target, tone: TONES.emerald },
  { title: "Completion Rate Report", desc: "How much of your team's learning is finished versus in progress.", href: "/manager/reports", icon: CheckCircle2, tone: TONES.violet },
];

export default function ManagerReportsPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<ReportData>("/api/manager/reports");
  const [tab, setTab] = useState<InsightTab>("progress");

  const exportCsv = () => {
    if (!data) return;
    const lines = [
      "LearnSmart AI — Team Reports",
      "",
      "Metric,Value",
      `Total Members,${data.stats.totalMembers}`,
      `Courses In Progress,${data.stats.coursesInProgress}`,
      `Completed Courses,${data.stats.coursesCompleted}`,
      `Average CPD progress,${data.stats.avgProgress}%`,
      "",
      "Week,Progress %",
      ...data.trend.map((t) => `${t.label},${t.avgProgress}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "team-reports.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="Reports"
        subtitle="View and export key reports on your team's learning performance."
        meta={<RefreshingBadge show={isRefreshing} />}
        action={
          <button onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Export report
          </button>
        }
      />

      {/* data-tour: onboarding-tour anchor only — no behaviour change. */}
      <div data-tour="mgr-report-cards" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_CARDS.map((c) => (
          <Link key={c.title} href={c.href} className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <Icon3D icon={c.icon} tone={c.tone} />
            <h3 className="mt-3 font-semibold text-[var(--ink)]">{c.title}</h3>
            <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{c.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] group-hover:underline">
              View report <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      {isLoading ? (
        <CardGridSkeleton />
      ) : !data ? (
        <ErrorPanel message={error?.message ?? "Could not load reports."} onRetry={refresh} />
      ) : (
        <>
          {/* Reports focuses on export and period comparison. Present-state
              headline figures live on the dashboard and Team courses, not here,
              to avoid showing the same numbers twice. */}
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
              <div role="tablist" aria-label="Team insights view" className="flex max-w-full overflow-x-auto rounded-xl bg-[var(--brand-tint)] p-1">
                {INSIGHT_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button key={t.key} role="tab" aria-selected={active} onClick={() => setTab(t.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-white text-[var(--brand-dark)] shadow-sm" : "text-[var(--brand-dark)]/70 hover:text-[var(--brand-dark)]"}`}>
                      <Icon className="h-4 w-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === "progress" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RingStat label="Learning progress" pct={data.progress.learningProgress} color="#2e7d5b" bg="#eaf4ee" />
                <RingStat label="Completion rate" pct={data.progress.completionRate} color="#d9880f" bg="#fbf1de" />
              </div>
            ) : tab === "trend" ? (
              <>
                <LearnAreaChart data={data.trend} xKey="label" dataKeys={[{ key: "avgProgress", label: "progress %", color: "#3f9d75" }]} height={240} />
                <p className="mt-2 text-center text-xs text-[var(--muted)]">Average learning progress · last 8 weeks</p>
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
