"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp, Download, ChevronRight, AlertTriangle, BarChart3, PieChart, Activity, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import Dropdown from "@/components/dashboard/Dropdown";
import CollapsibleCard from "@/components/dashboard/CollapsibleCard";
import { TONES } from "@/components/dashboard/Icon3D";
import { useApi, apiSend, ApiError } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface DashData {
  fullName: string;
  departmentName: string;
  stats: { teamMembers: number; activeLearners: number; coursesInProgress: number; coursesCompleted: number; notStarted: number; cpdCompletion: number; cpdHoursTotal: number; teamTarget: number; avgSkillLevel: number; atRisk: number; attention: number };
  progressOverTime: { label: string; hours: number }[];
  attention: { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "inactive" }[];
  recentActivity: { id: string; user: string; action: string; type: string; time: string }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
  cpdStatusBreakdown: { name: string; value: number; color: string }[];
}

// One calm card surface on a white page — the same token the admin dashboard and
// the landing cards use, so every surface reads as one product.
const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

const STATUS: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-rose-50 text-rose-700" },
  attention: { label: "Behind target", cls: "bg-amber-50 text-amber-700" },
  inactive: { label: "No activity", cls: "bg-slate-100 text-slate-600" },
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700" },
};

export default function ManagerDashboardPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<DashData>("/api/manager/dashboard");
  const [reminding, setReminding] = useState(false);
  const [remindMsg, setRemindMsg] = useState("");
  const [showAtRisk, setShowAtRisk] = useState(false);
  const [trendWeeks, setTrendWeeks] = useState(8);
  const [filled, setFilled] = useState(false); // drives the one health-bar entrance

  useEffect(() => { const t = setTimeout(() => setFilled(true), 60); return () => clearTimeout(t); }, []);

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
  const onTrack = Math.max(0, stats.teamMembers - behind);
  const totalCourses = stats.coursesInProgress + stats.coursesCompleted;
  const thisWeek = data.progressOverTime.length ? data.progressOverTime[data.progressOverTime.length - 1].hours : 0;
  const trend = data.progressOverTime.slice(-trendWeeks);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const pct = (n: number) => (stats.teamMembers ? (n / stats.teamMembers) * 100 : 0);

  // The single verdict a manager reads first — same language as the admin view.
  const verdict = stats.teamMembers === 0
    ? { tone: "text-slate-500", word: "No team yet", line: `No employees in ${data.departmentName} yet.` }
    : stats.atRisk > 0
      ? { tone: "text-rose-600", word: "Needs attention", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning — a reminder now gives them time to catch up.` }
      : stats.attention > 0
        ? { tone: "text-amber-600", word: "Mostly on track", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : { tone: "text-emerald-600", word: "On track", line: `All ${stats.teamMembers} team members are on pace with their learning.` };

  return (
    <div className="-m-6 min-h-full bg-white p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--ink)]">Team dashboard</h1>
              <RefreshingBadge show={isRefreshing} />
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{today} · {data.departmentName} · {stats.teamMembers} team member{stats.teamMembers === 1 ? "" : "s"}</p>
          </div>
          <Link href="/manager/reports" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export report
          </Link>
        </div>

        {/* Verdict — the answer, first. data-tour anchor kept for the onboarding tour. */}
        <section data-tour="mgr-health" className={`${CARD} mb-8 p-6 sm:p-7`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <p className={`text-2xl font-bold tracking-tight ${verdict.tone}`}>{verdict.word}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--muted)]">{remindMsg || verdict.line}</p>
            </div>
            <div className="flex gap-8">
              <Figure value={`${stats.activeLearners}/${stats.teamMembers}`} label="Active learners" />
              <Figure value={stats.coursesCompleted} label="Courses done" />
              <Figure value={`${stats.avgSkillLevel}%`} label="Avg skill" />
            </div>
          </div>

          {/* Single glanceable health bar */}
          {stats.teamMembers > 0 && (
            <div className="mt-6">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <span className="h-full bg-emerald-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(onTrack) : 0}%` }} />
                <span className="h-full bg-amber-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(stats.attention) : 0}%` }} />
                <span className="h-full bg-rose-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(stats.atRisk) : 0}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
                <Legend color="bg-emerald-500" label="On track" value={onTrack} />
                <Legend color="bg-amber-500" label="Behind pace" value={stats.attention} />
                <Legend color="bg-rose-500" label="At risk" value={stats.atRisk} />
              </div>
            </div>
          )}

          {/* Manager actions */}
          {behind > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button data-tour="mgr-remind" onClick={sendReminders} disabled={reminding} className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60">
                {reminding ? "Sending…" : remindMsg ? "Send again" : `Send reminders to all ${behind}`}
              </button>
              <button onClick={() => setShowAtRisk((v) => !v)} className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50">
                {showAtRisk ? "Hide at-risk" : `View at-risk (${behind})`}
              </button>
            </div>
          )}
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
                  const st = STATUS[a.status] ?? STATUS.attention;
                  return (
                    <li key={a.id}>
                      <Link href={`/manager/employees/${a.id}`} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                        <Avatar name={a.fullName} />
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--ink)]">{a.fullName}</p><p className="truncate text-xs text-[var(--muted)]">{a.reason}</p></div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
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
          <StatCard href="/manager/team-learning" icon={Users} label="Active learners" value={`${stats.activeLearners} of ${stats.teamMembers}`} sub="Enrolled in a course" />
          <StatCard href="/manager/team-learning" icon={BookOpen} label="Courses in progress" value={stats.coursesInProgress} sub={`${stats.coursesCompleted} completed`} />
          <StatCard href="/manager/team-learning" icon={Award} label="Courses completed" value={stats.coursesCompleted} sub="Across the team" />
          <StatCard href="/manager/team-skills" icon={TrendingUp} label="Avg skill level" value={`${stats.avgSkillLevel}%`} sub="Across the team" />
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

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="nums-tabular text-[1.55rem] font-bold leading-none tracking-tight text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-medium text-[var(--ink)]">{value}</span> {label}
    </span>
  );
}

function StatCard({ href, icon: Icon, label, value, sub }: { href: string; icon: LucideIcon; label: string; value: string | number; sub?: string }) {
  return (
    <Link href={href} className={`${CARD} group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,27,45,.04),0_18px_38px_-18px_rgba(15,27,45,.22)]`}>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)] transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <p className="nums-tabular mt-4 text-[1.8rem] font-bold leading-none tracking-tight text-[var(--ink)]">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-[var(--muted)]">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]/80">{sub}</p>}
    </Link>
  );
}

function ActIcon({ type }: { type?: string }) {
  const Icon = type === "course_complete" ? Award : type === "cpd" ? Clock : BookOpen;
  return <Icon className="h-3.5 w-3.5" />;
}

function Avatar({ name }: { name: string }) {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>;
}
