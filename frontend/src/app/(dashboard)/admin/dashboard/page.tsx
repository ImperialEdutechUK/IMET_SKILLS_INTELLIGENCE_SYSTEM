"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, Target, Users, BookOpen, AlertTriangle, CheckCircle2 } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";
import Pagination, { pageSlice } from "@/components/ui/Pagination";

const DEPT_PAGE_SIZE = 6;

interface Cat { name: string; value: number }
interface Dept {
  id: string; name: string;
  teamMembers: number; coursesInProgress: number; coursesCompleted: number; notStarted: number;
  atRisk: number; attention: number; avgCpd: number; avgSkillLevel: number; certificates: number;
  categoryBreakdown: Cat[];
}
interface Data {
  totalEmployees: number;
  activeCourses: number;
  certificatesEarned: number;
  orgHealth: { totalMembers: number; onTrack: number; atRisk: number; attention: number; avgSkillLevel: number; departments: number };
  departments: Dept[];
  categoryBreakdown: Cat[];
  learningActivity: { month: string; completions: number }[];
  skillsGap: { name: string; gap: number }[];
  recentActivities: { id: string; type: string; user: string; action: string; time: string }[];
}

// One calm card surface on a white page: hairline border + a soft, offset drop.
const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

type Health = "at_risk" | "behind" | "on_track" | "empty";
const deptHealth = (d: Dept): Health =>
  d.teamMembers === 0 ? "empty" : d.atRisk > 0 ? "at_risk" : d.attention > 0 ? "behind" : "on_track";

const DOT: Record<Health, string> = {
  at_risk: "bg-rose-500",
  behind: "bg-amber-500",
  on_track: "bg-emerald-500",
  empty: "bg-slate-300",
};
const HEALTH_LABEL: Record<Health, string> = {
  at_risk: "At risk", behind: "Behind pace", on_track: "On track", empty: "No members",
};

export default function AdminAnalyticsDashboard() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<Data>("/api/admin/dashboard");
  const [deptPage, setDeptPage] = useState(1);

  if (isLoading) return <PageSkeleton cards={4} />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load dashboard."} onRetry={refresh} />;

  const h = data.orgHealth;
  const behind = h.atRisk + h.attention;
  const completed = data.departments.reduce((s, d) => s + d.coursesCompleted, 0);
  // Not started = employees with no courses and no CPD, summed across departments.
  // Kept as its own population so no-data people aren't triaged as "at risk".
  const notStarted = data.departments.reduce((s, d) => s + d.notStarted, 0);
  const onTrack = Math.max(0, h.totalMembers - behind - notStarted);

  // The single verdict HR reads first — same language and treatment as the manager view.
  const verdict = h.totalMembers === 0
    ? { icon: Users, iconWrap: "bg-slate-100 text-slate-500", accent: "from-slate-50", word: "No employees yet", line: "No employees have been added to any department yet." }
    : h.atRisk > 0
      ? { icon: AlertTriangle, iconWrap: "bg-rose-50 text-rose-600", accent: "from-rose-50/70", word: "Needs attention", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning.` }
      : h.attention > 0
        ? { icon: AlertTriangle, iconWrap: "bg-amber-50 text-amber-600", accent: "from-amber-50/70", word: "Mostly on track", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : notStarted > 0
          ? { icon: BookOpen, iconWrap: "bg-slate-100 text-slate-500", accent: "from-slate-50", word: "Ready to begin", line: `Everyone active is on pace. ${notStarted} of ${h.totalMembers} ${notStarted === 1 ? "person hasn't" : "people haven't"} started yet.` }
          : { icon: CheckCircle2, iconWrap: "bg-emerald-50 text-emerald-600", accent: "from-emerald-50/70", word: "On track", line: `All ${h.totalMembers} employees are on pace with their learning.` };
  const VerdictIcon = verdict.icon;

  // Only departments with people are worth HR's scan; the empty ones are noise.
  // Staffed departments sort worst-first so problems surface without hunting.
  const rank: Record<Health, number> = { at_risk: 0, behind: 1, on_track: 2, empty: 3 };
  const staffed = data.departments.filter((d) => d.teamMembers > 0)
    .sort((a, b) => rank[deptHealth(a)] - rank[deptHealth(b)] || a.name.localeCompare(b.name));
  const emptyCount = data.departments.length - staffed.length;
  const pagedStaffed = pageSlice(staffed, deptPage, DEPT_PAGE_SIZE);

  const gaps = data.skillsGap.slice(0, 5);
  const maxGap = Math.max(1, ...gaps.map((g) => g.gap));

  return (
    <div>
      <div className="mx-auto max-w-6xl">
        {/* Title */}
        <div className="mb-7 flex items-center gap-2.5">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--ink)]">Organisation learning</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>

        {/* Verdict — the answer, first. Matches the manager dashboard: status icon
            tile + soft corner wash keyed to health, then a divided breakdown panel
            in place of a bar. data-tour: onboarding-tour anchor only. */}
        <section data-tour="adm-verdict" className={`${CARD} relative mb-8 overflow-hidden`}>
          {/* Soft status wash — a quiet tint bleeding from the corner, keyed to health. */}
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${verdict.accent} to-transparent to-40%`} aria-hidden />
          <div className="relative p-6 sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Status icon tile + headline */}
              <div className="flex items-start gap-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${verdict.iconWrap}`}>
                  <VerdictIcon className="h-6 w-6" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-[1.4rem]">{verdict.word}</h2>
                  <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">{verdict.line}</p>
                </div>
              </div>
              {/* Quiet supporting figures — subordinate to the verdict */}
              <div className="flex gap-8">
                <Figure value={data.totalEmployees} label="Employees" href="/admin/users" />
                <Figure value={completed} label="Courses done" href="/admin/departments" />
                <Figure value={data.certificatesEarned} label="Certificates" href="/admin/departments" />
              </div>
            </div>

            {/* Breakdown — one refined panel, four divided populations. "Not started"
                is separated from "at risk" so no-data isn't triaged. */}
            {h.totalMembers > 0 && (
              <div className="mt-6 grid grid-cols-2 divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white/70 sm:grid-cols-4 sm:divide-x">
                <BreakdownStat tone="emerald" label="On track" value={onTrack} total={h.totalMembers} href="/admin/departments" />
                <BreakdownStat tone="amber" label="Behind pace" value={h.attention} total={h.totalMembers} href="/admin/departments" />
                <BreakdownStat tone="rose" label="At risk" value={h.atRisk} total={h.totalMembers} href="/admin/departments" />
                <BreakdownStat tone="slate" label="Not started" value={notStarted} total={h.totalMembers} href="/admin/departments" />
              </div>
            )}
          </div>
        </section>

        {/* Departments — the actionable scan, worst first */}
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Departments</h2>
          <span className="text-xs text-[var(--muted)]">Sorted by who needs attention · open one to see people</span>
        </div>
        <div data-tour="adm-departments" className={`${CARD} mb-8 overflow-hidden`}>
          {staffed.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)]">No departments have employees yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {pagedStaffed.map((d) => {
                const hl = deptHealth(d);
                return (
                  <li key={d.id}>
                    <Link href={`/admin/departments/${d.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[hl]}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{d.name}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{d.teamMembers} {d.teamMembers === 1 ? "member" : "members"} · {d.coursesCompleted} completed</p>
                      </div>
                      {/* CPD mini-bar — compact, quantitative */}
                      <div className="hidden w-40 shrink-0 sm:block">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span>{HEALTH_LABEL[hl]}</span><span className="font-medium text-[var(--ink)]">{d.avgCpd}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${hl === "at_risk" ? "bg-rose-500" : hl === "behind" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, d.avgCpd)}%` }} />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {staffed.length > DEPT_PAGE_SIZE && (
            <div className="border-t border-[var(--border)] px-5 py-3">
              <Pagination page={deptPage} total={staffed.length} pageSize={DEPT_PAGE_SIZE} onChange={setDeptPage} />
            </div>
          )}
          {emptyCount > 0 && (
            <Link href="/admin/departments" className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)] transition-colors hover:bg-slate-50/80 hover:text-[var(--ink)]">
              <span>{emptyCount} more {emptyCount === 1 ? "department has" : "departments have"} no members yet</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Two quiet supporting insights */}
        <div data-tour="adm-insights" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Link href="/admin/departments" className={`${CARD} block p-5 transition hover:-translate-y-0.5 hover:shadow-lg`}>
            <div className="mb-4 flex items-center gap-2 text-[var(--ink)]">
              <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
              <h2 className="text-sm font-semibold">Completions</h2>
              <span className="ml-auto text-xs text-[var(--muted)]">Last 6 months</span>
            </div>
            <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#2e7d5b" }]} unit="" height={190} />
          </Link>

          <Link href="/admin/departments" className={`${CARD} block p-5 transition hover:-translate-y-0.5 hover:shadow-lg`}>
            <div className="mb-4 flex items-center gap-2 text-[var(--ink)]">
              <Target className="h-4 w-4 text-[var(--brand)]" />
              <h2 className="text-sm font-semibold">Biggest skill gaps</h2>
              <span className="ml-auto text-xs text-[var(--muted)]">Where to invest</span>
            </div>
            {gaps.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">No skill-gap data yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {gaps.map((g) => (
                  <li key={g.name}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="font-medium text-[var(--ink)]">{g.name}</span>
                      <span className="text-[var(--muted)]">gap {g.gap}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(g.gap / maxGap) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label, href }: { value: number; label: string; href?: string }) {
  const inner = (
    <>
      <p className="nums-tabular text-[1.55rem] font-bold leading-none tracking-tight text-[var(--ink)]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
    </>
  );
  return href
    ? <Link href={href} className="group rounded-lg transition-opacity hover:opacity-70">{inner}</Link>
    : <div>{inner}</div>;
}

type BreakdownTone = "emerald" | "amber" | "rose" | "slate";
const STATUS_TONE: Record<BreakdownTone, { dot: string; num: string }> = {
  emerald: { dot: "bg-emerald-500", num: "text-[var(--ink)]" },
  amber: { dot: "bg-amber-500", num: "text-[var(--ink)]" },
  rose: { dot: "bg-rose-500", num: "text-rose-600" },
  slate: { dot: "bg-slate-400", num: "text-[var(--ink)]" },
};

// One status column inside the breakdown panel: a coloured dot + micro-label, a
// big neutral count, and its share of the organisation. The colour lives in the
// dot, not a filled block, so the row reads as one refined unit.
function BreakdownStat({ tone, label, value, total, href }: { tone: BreakdownTone; label: string; value: number; total: number; href?: string }) {
  const t = STATUS_TONE[tone];
  const share = total ? Math.round((value / total) * 100) : 0;
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      </div>
      <p className={`nums-tabular mt-2.5 text-[1.75rem] font-bold leading-none tracking-tight ${t.num}`}>
        {value}<span className="text-base font-medium text-[var(--muted)]"> / {total}</span>
      </p>
      <p className="nums-tabular mt-1.5 text-xs text-[var(--muted)]">{share}% of staff</p>
    </>
  );
  return href
    ? <Link href={href} className="block px-5 py-4 transition-colors hover:bg-slate-50/80">{inner}</Link>
    : <div className="px-5 py-4">{inner}</div>;
}
