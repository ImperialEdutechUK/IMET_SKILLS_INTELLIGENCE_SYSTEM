"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, Target } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

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
  const [filled, setFilled] = useState(false); // drives the one entrance animation

  useEffect(() => { const t = setTimeout(() => setFilled(true), 60); return () => clearTimeout(t); }, []);

  if (isLoading) return <PageSkeleton cards={4} />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load dashboard."} onRetry={refresh} />;

  const h = data.orgHealth;
  const behind = h.atRisk + h.attention;
  const onTrack = Math.max(0, h.totalMembers - behind);
  const completed = data.departments.reduce((s, d) => s + d.coursesCompleted, 0);
  const pct = (n: number) => (h.totalMembers ? (n / h.totalMembers) * 100 : 0);

  // The single verdict HR reads first.
  const verdict = h.totalMembers === 0
    ? { tone: "text-slate-500", line: "No employees have been added to any department yet." }
    : h.atRisk > 0
      ? { tone: "text-rose-600", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning.` }
      : h.attention > 0
        ? { tone: "text-amber-600", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : { tone: "text-emerald-600", line: `All ${h.totalMembers} employees are on pace with their learning.` };
  const headline = h.totalMembers === 0 ? "No employees yet"
    : h.atRisk > 0 ? "Needs attention" : h.attention > 0 ? "Mostly on track" : "On track";

  // Only departments with people are worth HR's scan; the empty ones are noise.
  // Staffed departments sort worst-first so problems surface without hunting.
  const rank: Record<Health, number> = { at_risk: 0, behind: 1, on_track: 2, empty: 3 };
  const staffed = data.departments.filter((d) => d.teamMembers > 0)
    .sort((a, b) => rank[deptHealth(a)] - rank[deptHealth(b)] || a.name.localeCompare(b.name));
  const emptyCount = data.departments.length - staffed.length;

  const gaps = data.skillsGap.slice(0, 5);
  const maxGap = Math.max(1, ...gaps.map((g) => g.gap));

  return (
    <div className="-m-6 min-h-full bg-white p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Title */}
        <div className="mb-7 flex items-center gap-2.5">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--ink)]">Organisation learning</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>

        {/* Verdict — the answer, first */}
        <section className={`${CARD} mb-8 p-6 sm:p-7`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-lg">
              <p className={`text-2xl font-bold tracking-tight ${verdict.tone}`}>{headline}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--muted)]">{verdict.line}</p>
            </div>
            {/* Quiet supporting figures — subordinate to the verdict */}
            <div className="flex gap-8">
              <Figure value={data.totalEmployees} label="Employees" />
              <Figure value={completed} label="Courses done" />
              <Figure value={data.certificatesEarned} label="Certificates" />
            </div>
          </div>

          {/* Single glanceable health bar */}
          {h.totalMembers > 0 && (
            <div className="mt-6">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <span className="h-full bg-emerald-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(onTrack) : 0}%` }} />
                <span className="h-full bg-amber-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(h.attention) : 0}%` }} />
                <span className="h-full bg-rose-500 transition-[width] duration-700 ease-out" style={{ width: `${filled ? pct(h.atRisk) : 0}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
                <Legend color="bg-emerald-500" label="On track" value={onTrack} />
                <Legend color="bg-amber-500" label="Behind pace" value={h.attention} />
                <Legend color="bg-rose-500" label="At risk" value={h.atRisk} />
              </div>
            </div>
          )}
        </section>

        {/* Departments — the actionable scan, worst first */}
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Departments</h2>
          <span className="text-xs text-[var(--muted)]">Sorted by who needs attention · open one to see people</span>
        </div>
        <div className={`${CARD} mb-8 overflow-hidden`}>
          {staffed.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)]">No departments have employees yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {staffed.map((d) => {
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
          {emptyCount > 0 && (
            <Link href="/admin/departments" className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)] transition-colors hover:bg-slate-50/80 hover:text-[var(--ink)]">
              <span>{emptyCount} more {emptyCount === 1 ? "department has" : "departments have"} no members yet</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Two quiet supporting insights */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={`${CARD} p-5`}>
            <div className="mb-4 flex items-center gap-2 text-[var(--ink)]">
              <TrendingUp className="h-4 w-4 text-[var(--brand)]" />
              <h2 className="text-sm font-semibold">Completions</h2>
              <span className="ml-auto text-xs text-[var(--muted)]">Last 6 months</span>
            </div>
            <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#2e7d5b" }]} unit="" height={190} />
          </section>

          <section className={`${CARD} p-5`}>
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
          </section>
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[1.55rem] font-bold leading-none tracking-tight text-[var(--ink)]">{value.toLocaleString()}</p>
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
