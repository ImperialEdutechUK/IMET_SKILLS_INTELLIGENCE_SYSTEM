"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Target, Award, Sparkles, Bell, Check, ScrollText, TrendingUp, PieChart, ArrowRight } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { computeGamification } from "@/lib/gamification";
import { useApi, apiSend } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";
import ClickableCard from "@/components/ui/ClickableCard";

interface Rec {
  id: string; courseId: string; title: string; source: string; category: string;
  matchLabel: string; reason: string; cpd_hours: number; rating: number | null; externalUrl: string;
}
interface DashboardData {
  fullName: string;
  cpdHours: number;   // retained: an internal input to XP, not shown as CPD
  completedCount: number; inProgressCount: number; notStartedCount: number;
  gapCount: number;
  topGap: { skill: string; currentLabel: string; requiredLabel: string } | null;
  weeklyActivity: { label: string; started: number; completed: number }[];
  notifications: { id: string; title: string; body: string }[];
  inProgress: { id: string; title: string; progress: number; status: string; externalUrl: string | null }[];
  topRecs: Rec[];
}

// Status pill for the "My courses" table (Latest Projects / Recent Orders style).
function statusPill(status: string) {
  if (status === "completed") return { label: "Completed", cls: "bg-emerald-50 text-emerald-600" };
  if (status === "in_progress") return { label: "In progress", cls: "bg-sky-50 text-sky-600" };
  return { label: "Not started", cls: "bg-slate-100 text-slate-500" };
}

export default function EmployeeDashboardPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<DashboardData>("/api/me/dashboard");
  // Shares its cache entry with the certificates page and the gamification
  // widgets, so this costs nothing extra once any of them has loaded.
  const { data: certData } = useApi<{ certificates: unknown[] }>("/api/me/certificates");
  const certCount = certData?.certificates?.length ?? 0;
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});

  const enrol = async (courseId: string) => {
    setEnrolling((s) => ({ ...s, [courseId]: true }));
    try {
      // Enrolling changes the course counts on this very page and on My Learning.
      await apiSend("/api/me/enrollments", "POST", { courseId }, {
        invalidates: ["/api/me/dashboard", "/api/me/learning"],
      });
      setEnrolled((s) => ({ ...s, [courseId]: true }));
    } catch { /* button re-enables; the row is unchanged */ }
    setEnrolling((s) => ({ ...s, [courseId]: false }));
  };

  if (isLoading) return <PageSkeleton />;
  if (!data) return <ErrorPanel message={error?.message ?? "Account not found. Please sign in again."} onRetry={refresh} />;

  const g = computeGamification({ certificates: certCount, coursesCompleted: data.completedCount, cpdHours: data.cpdHours });
  const first = data.fullName.split(" ")[0];

  const totalCourses = data.completedCount + data.inProgressCount + data.notStartedCount;
  const statusSegments = [
    { name: "Completed", value: data.completedCount, color: "#2e7d5b" },
    { name: "In progress", value: data.inProgressCount, color: "#0284c7" },
    { name: "Not started", value: data.notStartedCount, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
  const activityTotal = data.weeklyActivity.reduce((s, w) => s + w.started + w.completed, 0);

  // KPI cards — Welter style: colored left accent, big number, tinted icon square.
  const kpis = [
    { label: "Certificates earned", value: certCount, sub: g.next ? `${g.toNext} more certificate${g.toNext === 1 ? "" : "s"} to ${g.next.label}` : "all badges earned", icon: ScrollText, accent: "#16a34a", tint: "bg-emerald-50 text-emerald-600", href: "/me/learning?tab=certificates" },
    { label: "Courses in progress", value: data.inProgressCount, sub: data.notStartedCount > 0 ? `${data.notStartedCount} not started` : "keep it going", icon: BookOpen, accent: "#0284c7", tint: "bg-sky-50 text-sky-600", href: "/me/learning" },
    { label: "Courses completed", value: data.completedCount, sub: data.completedCount > 0 ? "nice work" : "add a course to start", icon: Award, accent: "#7c3aed", tint: "bg-violet-50 text-violet-600", href: "/me/learning" },
    { label: "Skill gaps", value: data.gapCount, sub: data.topGap ? `top: ${data.topGap.skill}` : "on target", icon: Target, accent: "#d97706", tint: "bg-amber-50 text-amber-600", href: "/me/skills" },
  ];

  return (
    <div className="space-y-6">
      {/* Reminders / notifications from a manager land here first. */}
      {data.notifications.length > 0 && (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-tint)] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white"><Bell className="h-4 w-4" /></span>
              <div><p className="text-sm font-semibold text-[var(--ink)]">{n.title}</p><p className="mt-0.5 text-sm text-[var(--muted)]">{n.body}</p></div>
            </div>
          ))}
        </div>
      )}

      {/* HEADER — plain title, as in the reference dashboards. */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Dashboard</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">Welcome back, {first} — here&rsquo;s your learning at a glance.</p>
      </div>

      {/* ROW 1 — four KPI cards. */}
      <div data-tour="dashboard-kpis" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderLeft: `4px solid ${k.accent}` }}>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--muted)]">{k.label}</p>
              <p className="mt-1.5 text-[1.9rem] font-extrabold leading-none text-[var(--ink)]">{k.value}</p>
              <p className="mt-1.5 truncate text-xs text-[var(--muted)]">{k.sub}</p>
            </div>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${k.tint}`}>
              <k.icon className="h-6 w-6" strokeWidth={2.2} />
            </span>
          </Link>
        ))}
      </div>

      {/* ROW 2 — learning-activity chart (wide) + recommendations sidebar. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ClickableCard href="/me/reports" data-tour="dashboard-activity" ariaLabel="Open reports" className="rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-[var(--ink)]">Learning activity</h3>
                <p className="text-xs text-[var(--muted)]">Course starts &amp; completions · last 8 weeks</p>
              </div>
            </div>
            <Link href="/me/reports" onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">Reports</Link>
          </div>
          <LearnAreaChart
            data={data.weeklyActivity}
            xKey="label"
            unit=""
            height={250}
            dataKeys={[
              { key: "started", label: "Started", color: "#0284c7" },
              { key: "completed", label: "Completed", color: "#2e7d5b" },
            ]}
          />
          {activityTotal === 0 && (
            <p className="mt-2 text-center text-xs text-[var(--muted)]">No activity yet — add a course and your trend will start to build.</p>
          )}
        </ClickableCard>

        {/* Recommendations sidebar — the "Recent Orders" sidebar pattern. */}
        <ClickableCard href="/me/recommendations" data-tour="dashboard-recommended" ariaLabel="Open all recommendations" className="flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600"><Sparkles className="h-5 w-5" /></span>
              <h3 className="font-semibold text-[var(--ink)]">Recommended</h3>
            </div>
            <Link href="/me/recommendations" onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">All</Link>
          </div>
          {data.topRecs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.topRecs.map((rec) => {
                const isEnrolled = enrolled[rec.courseId];
                return (
                  <li key={rec.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={rec.title}>{rec.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[var(--muted)]">{rec.category}</span>
                      <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-dark)]">{rec.matchLabel}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); enrol(rec.courseId); }} disabled={isEnrolled || enrolling[rec.courseId]}
                      className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isEnrolled ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"} disabled:opacity-70`}>
                      {isEnrolled ? <><Check className="h-3.5 w-3.5" /> Added</> : enrolling[rec.courseId] ? "Adding…" : "Add to My Learning"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ClickableCard>
      </div>

      {/* ROW 3 — my-courses table (wide) + course-status donut. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Data table — "Latest Projects" / "Recent Orders" pattern. */}
        <ClickableCard href="/me/learning" data-tour="dashboard-courses" ariaLabel="Open My Learning" className="rounded-2xl border border-[var(--border)] bg-white transition hover:-translate-y-0.5 hover:shadow-md lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><BookOpen className="h-5 w-5" /></span>
              <h3 className="font-semibold text-[var(--ink)]">My courses</h3>
            </div>
            <Link href="/me/learning" onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
          </div>
          {data.inProgress.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">No active courses yet. Add one from your recommendations to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th className="px-5 py-3 font-medium">Course</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.inProgress.map((enr) => {
                    const notStarted = enr.status === "not_started";
                    const pill = statusPill(enr.status);
                    const pct = notStarted ? 0 : enr.progress;
                    return (
                      <tr key={enr.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                            <span className="line-clamp-1 max-w-[22rem] font-medium text-[var(--ink)]" title={enr.title}>{enr.title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.cls}`}>{pill.label}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(pct, notStarted ? 0 : 2)}%` }} /></div>
                            <span className="text-xs tabular-nums text-[var(--muted)]">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link href="/me/learning" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">
                            {notStarted ? "Start" : "Continue"} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ClickableCard>

        {/* Donut with legend — "Browser Usage" / "Order By Device" pattern. */}
        <ClickableCard href="/me/learning" data-tour="dashboard-status" ariaLabel="Open My Learning" className="rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><PieChart className="h-5 w-5" /></span>
            <div>
              <h3 className="font-semibold text-[var(--ink)]">Course status</h3>
              <p className="text-xs text-[var(--muted)]">{totalCourses} course{totalCourses === 1 ? "" : "s"} total</p>
            </div>
          </div>
          {statusSegments.length === 0 ? (
            <div className="flex h-[170px] flex-col items-center justify-center text-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-[var(--muted)]">No courses yet.</p>
              <Link href="/me/recommendations" onClick={(e) => e.stopPropagation()} className="mt-1 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-dark)]">Browse recommendations →</Link>
            </div>
          ) : (
            <LearnDonutChart data={statusSegments} label={String(totalCourses)} sublabel="courses" height={170} />
          )}
        </ClickableCard>
      </div>
    </div>
  );
}
