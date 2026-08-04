"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp, Download, ChevronRight, ShieldCheck, AlertTriangle, BarChart3, PieChart, Activity, Clock } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import HeroRing from "@/components/dashboard/HeroRing";
import StatTile from "@/components/dashboard/StatTile";
import Dropdown from "@/components/dashboard/Dropdown";
import CollapsibleCard from "@/components/dashboard/CollapsibleCard";
import MyAchievementsCard from "@/components/gamification/MyAchievementsCard";
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

const STATUS: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700" },
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

  async function sendReminders() {
    setReminding(true); setRemindMsg("");
    try {
      // Reminders change who is flagged, so the dashboard read is stale after this.
      const d = await apiSend<{ employeesNotified?: number; behind?: number }>(
        "/api/cpd/notify", "POST", {}, { invalidates: ["/api/manager/dashboard", "/api/notifications"] },
      );
      if (d.employeesNotified && d.employeesNotified > 0) {
        setRemindMsg(`✅ Reminder sent to ${d.employeesNotified} team member${d.employeesNotified === 1 ? "'s" : "s'"} dashboard${d.employeesNotified === 1 ? "" : "s"}.`);
      } else if (d.behind && d.behind > 0) {
        setRemindMsg("Everyone behind pace already has an unread reminder on their dashboard.");
      } else {
        setRemindMsg("Nobody is behind pace right now — no reminders needed. 🎉");
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
  const today =new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // One clear health verdict for the top of the page.
  const health = stats.teamMembers === 0
    ? { tone: TONES.slate, icon: ShieldCheck, word: "No team yet", line: `No employees in ${data.departmentName} yet.` }
    : stats.atRisk > 0
      ? { tone: TONES.rose, icon: AlertTriangle, word: "Needs attention", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning — a reminder now gives them time to catch up.` }
      : stats.attention > 0
        ? { tone: TONES.amber, icon: AlertTriangle, word: "Mostly on track", line: `${behind} of ${stats.teamMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : { tone: TONES.emerald, icon: ShieldCheck, word: "On track", line: `All ${stats.teamMembers} team members are on pace with their learning. 🎉` };

  // Ring colour + soft wash mirror the health verdict.
  const ringColor = stats.teamMembers === 0 ? "#94a3b8" : stats.atRisk > 0 ? "#e11d48" : stats.attention > 0 ? "#f59e0b" : "var(--brand)";
  const healthAccent = stats.teamMembers === 0 ? "#f1f5f9" : stats.atRisk > 0 ? "#fef1f2" : stats.attention > 0 ? "#fef7ec" : "#eef7f2";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--ink)]">Team dashboard</h1>
            <RefreshingBadge show={isRefreshing} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{today} · {data.departmentName} · {stats.teamMembers} team member{stats.teamMembers === 1 ? "" : "s"}</p>
        </div>
        <Link href="/manager/reports" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <Download className="h-4 w-4" /> Export report
        </Link>
      </div>

      {/* At-a-glance health — THE hero: the one ring a manager should read first.
          data-tour: onboarding-tour anchor only — no behaviour change. */}
      <div data-tour="mgr-health">
        <HeroRing
          percent={stats.teamMembers ? Math.round((onTrack / stats.teamMembers) * 100) : 0}
          ringColor={ringColor}
          ringLabel={`${onTrack}/${stats.teamMembers}`}
          ringSublabel="on track"
          accent={healthAccent}
          title={health.word}
          subtitle={remindMsg || health.line}
          metrics={[
            { label: "Active learners", value: `${stats.activeLearners}/${stats.teamMembers}`, color: "#0284c7" },
            { label: "Courses done", value: String(stats.coursesCompleted), color: "#16a34a" },
            { label: "Avg skill", value: `${stats.avgSkillLevel}%`, color: "#7c3aed" },
          ]}
        >
          {behind > 0 && (
            <>
              <button data-tour="mgr-remind" onClick={sendReminders} disabled={reminding} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
                {reminding ? "Sending…" : remindMsg ? "Send again" : `Send reminders to all ${behind}`}
              </button>
              <button onClick={() => setShowAtRisk((v) => !v)} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-slate-50">
                {showAtRisk ? "Hide at-risk" : `View at-risk (${behind})`}
              </button>
            </>
          )}
        </HeroRing>
      </div>

      {/* At-risk list — hidden by default, revealed by the "View at-risk" button. */}
      {showAtRisk && behind > 0 && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
            <Icon3D icon={AlertTriangle} tone={TONES.rose} size="sm" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[var(--ink)]">Who needs attention</h3>
              <p className="text-xs text-[var(--muted)]">Click a name to open their dashboard</p>
            </div>
          </div>
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
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Key numbers — clickable, live tiles */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Key numbers</p>
      <div data-tour="mgr-kpis" className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile index={0} href="/manager/team-learning" icon={Users} tone="green" label="Active learners" value={`${stats.activeLearners} of ${stats.teamMembers}`} sub="Enrolled in a course" />
        <StatTile index={1} href="/manager/team-learning" icon={BookOpen} tone="sky" label="Courses in progress" value={stats.coursesInProgress} sub={`${stats.coursesCompleted} completed`} />
        <StatTile index={2} href="/manager/team-learning" icon={Award} tone="teal" label="Courses completed" value={stats.coursesCompleted} sub="Across the team" />
        <StatTile index={3} href="/manager/team-skills" icon={TrendingUp} tone="violet" label="Avg skill level" value={`${stats.avgSkillLevel}%`} sub="Across the team" />
      </div>

      {/* Detail behind dropdowns — keeps the main view clear, detail one click away */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">More detail <span className="font-normal normal-case text-[var(--muted)]/70">· tap to expand</span></p>
      <div className="space-y-4">
        <CollapsibleCard title="Team learning hours" subtitle={thisWeek > 0 ? `${thisWeek}h logged this week` : "Learning hours logged over time"} icon={BarChart3} tone={TONES.blue}>
          <div className="mb-4 flex justify-end">
            <Dropdown
              value={String(trendWeeks)}
              onChange={(v) => setTrendWeeks(Number(v))}
              options={[{ value: "8", label: "Last 8 weeks" }, { value: "4", label: "Last 4 weeks" }]}
            />
          </div>
          <LearnAreaChart data={trend} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#3b82f6" }]} unit="h" height={220} />
        </CollapsibleCard>

        <CollapsibleCard title="Learning by category" subtitle={`${totalCourses} course${totalCourses === 1 ? "" : "s"} across the team`} icon={PieChart} tone={TONES.blue}>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No enrolments yet.</p>
          ) : (
            <LearnDonutChart data={data.categoryBreakdown} label={`${totalCourses}`} sublabel="Courses" height={200} />
          )}
        </CollapsibleCard>

        <CollapsibleCard title="Recent team activity" subtitle="Enrolments and course completions" icon={Activity} tone={TONES.violet}>
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

      {/* Your own learning game — personal, so it sits below the team picture */}
      <p className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Your progress</p>
      <MyAchievementsCard />
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

