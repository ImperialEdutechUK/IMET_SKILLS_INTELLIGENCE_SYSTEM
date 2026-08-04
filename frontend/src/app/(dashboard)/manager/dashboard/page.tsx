"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp, Download, ChevronRight, ArrowRight, AlertTriangle, CheckCircle2, LayoutDashboard, BarChart3, PieChart, Activity, Clock } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import Dropdown from "@/components/dashboard/Dropdown";
import CollapsibleCard from "@/components/dashboard/CollapsibleCard";
import { TONES } from "@/components/dashboard/Icon3D";
import { useApi, apiSend, ApiError } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";
import MetricInfo from "@/components/ui/MetricInfo";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import StatusPill, { type Status } from "@/components/ui/StatusPill";

interface DashData {
  fullName: string;
  departmentName: string;
  stats: { teamMembers: number; activeLearners: number; coursesInProgress: number; coursesCompleted: number; notStarted: number; cpdCompletion: number; cpdHoursTotal: number; teamTarget: number; avgSkillLevel: number; avgSkillTracked: number; avgSkillTotal: number; onTrack: number; atRisk: number; attention: number; expectedWeeklyHours: number };
  definitions?: { avgSkillLevel: string; avgCpdProgress: string; pace: string };
  progressOverTime: { label: string; hours: number }[];
  attention: { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "not_started" }[];
  recentActivity: { id: string; user: string; action: string; type: string; time: string }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
  cpdStatusBreakdown: { name: string; value: number; color: string }[];
}

// One calm card surface on a white page — the same token the admin dashboard and
// the landing cards use, so every surface reads as one product.
const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

export default function ManagerDashboardPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<DashData>("/api/manager/dashboard");
  const [reminding, setReminding] = useState(false);
  const [remindMsg, setRemindMsg] = useState("");
  const [showAtRisk, setShowAtRisk] = useState(false);
  const [trendWeeks, setTrendWeeks] = useState(8);

  async function sendReminders() {
    setReminding(true); setRemindMsg("");
    try {
      // Reminders change who is flagged, so the dashboard read is stale after this.
      const d = await apiSend<{ employeesNotified?: number; behind?: number }>(
        "/api/cpd/notify", "POST", {}, { invalidates: ["/api/manager/dashboard", "/api/notifications"] },
      );
      if (d.employeesNotified && d.employeesNotified > 0) {
        setRemindMsg(`Reminder sent to ${d.employeesNotified} team member${d.employeesNotified === 1 ? "'s" : "s'"} dashboard${d.employeesNotified === 1 ? "" : "s"}.`);
      } else if (d.behind && d.behind > 0) {
        setRemindMsg("Everyone behind pace already has an unread reminder on their dashboard.");
      } else {
        setRemindMsg("Nobody is behind pace right now — no reminders needed.");
      }
    } catch (e) {
      setRemindMsg(e instanceof ApiError ? `Could not send reminders — ${e.message}` : "Could not send reminders — the server didn't respond. Please try again.");
    }
    setReminding(false);
  }

  // Only block when there is genuinely nothing cached to paint.
  if (isLoading) return <PageSkeleton />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load dashboard."} onRetry={refresh} />;

  const { stats } = data;
  const behind = stats.atRisk + stats.attention;
  // "Not started" (no courses, no hours) is a separate population — never counted
  // as behind. On-track comes straight from the server's 4-way pace breakdown.
  const onTrack = stats.onTrack;
  const notStarted = stats.notStarted;
  const totalCourses = stats.coursesInProgress + stats.coursesCompleted;
  const thisWeek = data.progressOverTime.length ? data.progressOverTime[data.progressOverTime.length - 1].hours : 0;
  const trend = data.progressOverTime.slice(-trendWeeks);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // The single verdict a manager reads first — same language as the admin view.
  const verdict = stats.teamMembers === 0
    ? { icon: Users, iconWrap: "bg-slate-100 text-slate-500", accent: "from-slate-50", word: "No team yet", line: `No employees in ${data.departmentName} yet.` }
    : stats.atRisk > 0
      ? { icon: AlertTriangle, iconWrap: "bg-rose-50 text-rose-600", accent: "from-rose-50/70", word: "Needs attention", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning — a reminder now gives them time to catch up.` }
      : stats.attention > 0
        ? { icon: AlertTriangle, iconWrap: "bg-amber-50 text-amber-600", accent: "from-amber-50/70", word: "Mostly on track", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : notStarted > 0
          ? { icon: BookOpen, iconWrap: "bg-slate-100 text-slate-500", accent: "from-slate-50", word: "Ready to begin", line: `Everyone active is on pace. ${notStarted} of ${stats.teamMembers} ${notStarted === 1 ? "person hasn't" : "people haven't"} started yet.` }
          : { icon: CheckCircle2, iconWrap: "bg-emerald-50 text-emerald-600", accent: "from-emerald-50/70", word: "On track", line: `All ${stats.teamMembers} team members are on pace with their learning.` };
  const VerdictIcon = verdict.icon;

  return (
    <div className="-m-6 min-h-full bg-white p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <PageHeader
          icon={LayoutDashboard}
          title="Team dashboard"
          meta={<span>{today} · {data.departmentName} · {stats.teamMembers} total member{stats.teamMembers === 1 ? "" : "s"}</span>}
          action={
            <>
              <RefreshingBadge show={isRefreshing} />
              <Link href="/manager/reports" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50">
                <Download className="h-4 w-4" /> Export report
              </Link>
            </>
          }
        />

        {/* Verdict — the answer, first. data-tour anchor kept for the onboarding tour. */}
        <section data-tour="mgr-health" className={`${CARD} relative mb-8 overflow-hidden`}>
          {/* Soft status wash — a quiet tint bleeding from the corner, keyed to health. */}
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${verdict.accent} to-transparent to-40%`} aria-hidden />
          <div className="relative p-6 sm:p-7">
            {/* Header — status icon tile + headline */}
            <div className="flex items-start gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${verdict.iconWrap}`}>
                <VerdictIcon className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-[1.4rem]">{verdict.word}</h2>
                <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">{remindMsg || verdict.line}</p>
              </div>
            </div>

            {/* Breakdown — one refined panel, four divided populations. "Not
                started" is separated from "at risk" so no-data is not triaged. */}
            {stats.teamMembers > 0 && (
              <>
                <div className="mt-6 grid grid-cols-2 divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white/70 sm:grid-cols-4 sm:divide-x">
                  <BreakdownStat tone="emerald" label="On track" value={onTrack} total={stats.teamMembers} />
                  <BreakdownStat tone="amber" label="Behind pace" value={stats.attention} total={stats.teamMembers} />
                  <BreakdownStat tone="rose" label="At risk" value={stats.atRisk} total={stats.teamMembers} />
                  <BreakdownStat tone="slate" label="Not started" value={notStarted} total={stats.teamMembers} />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Expected pace: about {stats.expectedWeeklyHours}h per week to stay on the annual CPD target.
                  {data.definitions?.pace && <MetricInfo label="How pace is judged" definition={data.definitions.pace} />}
                </p>
              </>
            )}

            {/* Manager actions */}
            {behind > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button data-tour="mgr-remind" onClick={sendReminders} disabled={reminding} className="group inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60">
                  {reminding ? "Sending…" : remindMsg ? "Send again" : `Send reminders to all ${behind}`}
                  {!reminding && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
                <button onClick={() => setShowAtRisk((v) => !v)} className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50">
                  {showAtRisk ? "Hide at-risk" : `View at-risk (${behind})`}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* At-risk list — hidden by default, revealed by the "View at-risk" button. */}
        {showAtRisk && behind > 0 && (
          <div className={`${CARD} mb-8 overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[var(--ink)]">Who needs attention</h3>
                <p className="text-xs text-[var(--muted)]">Open anyone to view their full profile — skills, courses, badges &amp; certificates</p>
              </div>
            </div>
            {data.attention.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">Everyone is on track.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.attention.map((a) => {
                  return (
                    <li key={a.id}>
                      <Link href={`/manager/employees/${a.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                        <Avatar name={a.fullName} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--ink)]">{a.fullName}</p><p className="truncate text-xs text-[var(--muted)]">{a.reason}</p></div>
                        <span className="shrink-0"><StatusPill status={a.status as Status} /></span>
                        <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[var(--brand)] transition-colors group-hover:text-[var(--brand-dark)] sm:inline-flex">
                          View profile <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400 sm:hidden" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Key numbers — clean, light, clickable tiles */}
        <p className="mb-3 text-sm font-semibold text-[var(--ink)]">Key numbers</p>
        <div data-tour="mgr-kpis" className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard href="/manager/team-learning" icon={Users} label="Active learners" value={`${stats.activeLearners} of ${stats.teamMembers}`} sublabel="Enrolled in a course" />
          <KpiCard href="/manager/team-learning" icon={BookOpen} label="Courses in progress" value={stats.coursesInProgress} sublabel={`${stats.coursesCompleted} completed`} />
          <KpiCard href="/manager/team-learning" icon={Award} label="Courses completed" value={stats.coursesCompleted} sublabel="Across the team" />
          <KpiCard href="/manager/team-skills" icon={TrendingUp} label="Avg skill level" value={`${stats.avgSkillLevel}%`} sublabel={`${stats.avgSkillTracked} of ${stats.avgSkillTotal} tracked`} definition={data.definitions?.avgSkillLevel} />
        </div>

        {/* Detail behind dropdowns — keeps the main view clear, detail one click away */}
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink)]">More detail</h2>
          <span className="text-xs text-[var(--muted)]">Tap to expand</span>
        </div>
        <div className="space-y-4">
          <CollapsibleCard title="Team learning hours" subtitle={thisWeek > 0 ? `${thisWeek}h logged this week` : "Learning hours logged over time"} icon={BarChart3} tone={TONES.emerald}>
            <div className="mb-4 flex justify-end">
              <Dropdown
                value={String(trendWeeks)}
                onChange={(v) => setTrendWeeks(Number(v))}
                options={[{ value: "8", label: "Last 8 weeks" }, { value: "4", label: "Last 4 weeks" }]}
              />
            </div>
            <LearnAreaChart data={trend} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
          </CollapsibleCard>

          <CollapsibleCard title="Learning by category" subtitle={`${totalCourses} course${totalCourses === 1 ? "" : "s"} across the team`} icon={PieChart} tone={TONES.emerald}>
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No enrolments yet.</p>
            ) : (
              <LearnDonutChart data={data.categoryBreakdown} label={`${totalCourses}`} sublabel="Courses" height={200} />
            )}
          </CollapsibleCard>

          <CollapsibleCard title="Recent team activity" subtitle="Enrolments and course completions" icon={Activity} tone={TONES.emerald}>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No team activity yet. It appears here as employees enrol and complete courses.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                      <ActIcon type={item.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--ink)]"><span className="font-medium">{item.user}</span> {item.action}</p>
                      <p className="text-xs text-[var(--muted)]">{item.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleCard>
        </div>

        <p className="mt-6 text-xs text-[var(--muted)]">
          Looking for your own level, XP and badges?{" "}
          <Link href="/me/learning" className="font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">Open My Learning →</Link>
        </p>
      </div>
    </div>
  );
}

type BreakdownTone = "emerald" | "amber" | "rose" | "slate";
const STATUS_TONE: Record<BreakdownTone, { dot: string; num: string }> = {
  emerald: { dot: "bg-emerald-500", num: "text-[var(--ink)]" },
  amber: { dot: "bg-amber-500", num: "text-[var(--ink)]" },
  rose: { dot: "bg-rose-500", num: "text-rose-600" },
  slate: { dot: "bg-slate-400", num: "text-[var(--ink)]" },
};

// One status column inside the breakdown panel: a coloured dot + micro-label,
// a big neutral count, and its share of the team. Clean and quiet — the colour
// lives in the dot, not a filled block, so the row reads as one refined unit.
function BreakdownStat({ tone, label, value, total }: { tone: BreakdownTone; label: string; value: number; total: number }) {
  const t = STATUS_TONE[tone];
  const share = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      </div>
      <p className={`nums-tabular mt-2.5 text-[1.75rem] font-bold leading-none tracking-tight ${t.num}`}>
        {value}<span className="text-base font-medium text-[var(--muted)]"> / {total}</span>
      </p>
      <p className="nums-tabular mt-1.5 text-xs text-[var(--muted)]">{share}% of team</p>
    </div>
  );
}

function ActIcon({ type }: { type?: string }) {
  const Icon = type === "course_complete" ? Award : type === "cpd" ? Clock : BookOpen;
  return <Icon className="h-3.5 w-3.5" />;
}

function Avatar({ name }: { name: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>;
}
