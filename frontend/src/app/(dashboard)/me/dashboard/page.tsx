"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Target, Award, Sparkles, Bell, Check, ScrollText, Trophy, TrendingUp, Activity } from "lucide-react";
import ProgressRing from "@/components/cpd/ProgressRing";
import StatTile from "@/components/dashboard/StatTile";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { computeGamification } from "@/lib/gamification";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

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

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [certCount, setCertCount] = useState(0);
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API}/api/me/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    // Same certificate count that drives the Achievements widget elsewhere, so
    // the badge/level shown here matches the Certificates page exactly.
    fetch(`${API}/api/me/certificates`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCertCount(d?.certificates?.length ?? 0))
      .catch(() => {});
  }, []);

  const enrol = async (courseId: string) => {
    setEnrolling((s) => ({ ...s, [courseId]: true }));
    try {
      const r = await fetch(`${API}/api/me/enrollments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (r.ok) setEnrolled((s) => ({ ...s, [courseId]: true }));
    } catch { /* ignore */ }
    setEnrolling((s) => ({ ...s, [courseId]: false }));
  };

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Account not found. Please sign in again.</p></div>;

  const g = computeGamification({ certificates: certCount, coursesCompleted: data.completedCount, cpdHours: data.cpdHours });
  const first = data.fullName.split(" ")[0];

  const totalCourses = data.completedCount + data.inProgressCount + data.notStartedCount;
  const statusSegments = [
    { name: "Completed", value: data.completedCount, color: "#2e7d5b" },
    { name: "In progress", value: data.inProgressCount, color: "#0284c7" },
    { name: "Not started", value: data.notStartedCount, color: "#cbd5e1" },
  ].filter((s) => s.value > 0);
  const activityTotal = data.weeklyActivity.reduce((s, w) => s + w.started + w.completed, 0);

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

      {/* HEADER — page title + a compact level/XP banner (gamification, kept subtle
          so the page reads as a standard SaaS dashboard rather than a game screen). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {first}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here&rsquo;s your learning at a glance.</p>
        </div>
        <div
          className="flex items-center gap-4 rounded-2xl border border-[var(--border)] px-5 py-3"
          style={{ background: "linear-gradient(135deg,#eef7f2,#ffffff 70%)" }}
        >
          <div className="shrink-0">
            <ProgressRing percentage={g.levelPct} size={64} strokeWidth={7} color="var(--brand)"
              trackColor="rgba(15,27,45,.08)" label={`Lv ${g.level}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--ink)]">{g.title}</p>
            <p className="text-xs text-[var(--muted)]">{g.xp} XP · {g.toNext > 0 && g.next ? `${g.toNext} XP to ${g.next.emoji} ${g.next.label}` : "all badges earned 🏆"}</p>
            <Link href="/me/certificates" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-dark)]">
              <Trophy className="h-3.5 w-3.5" /> View achievements
            </Link>
          </div>
        </div>
      </div>

      {/* KPI ROW — four clean stat cards, one fact each (standard SaaS top row). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile index={0} tone="green" icon={ScrollText} href="/me/certificates" label="Certificates earned"
          value={certCount} sub={g.next ? `${g.toNext} XP to ${g.next.emoji} ${g.next.label}` : "all badges earned 🏆"} />
        <StatTile index={1} tone="sky" icon={BookOpen} href="/me/learning" label="Courses in progress"
          value={data.inProgressCount} sub={data.notStartedCount > 0 ? `${data.notStartedCount} not started` : "keep the streak going"} />
        <StatTile index={2} tone="violet" icon={Award} href="/me/learning" label="Courses completed"
          value={data.completedCount} sub={data.completedCount > 0 ? "nice work" : "add a course to start"} />
        <StatTile index={3} tone="amber" icon={Target} href="/me/skills" label="Skill gaps"
          value={data.gapCount} sub={data.topGap ? `top: ${data.topGap.skill}` : "on target across skills"} />
      </div>

      {/* CHARTS ROW — a learning-activity trend (wide) + a course-status donut. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-[var(--ink)]">Learning activity</h3>
                <p className="text-xs text-[var(--muted)]">Course starts &amp; completions · last 8 weeks</p>
              </div>
            </div>
            <Link href="/me/reports" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">Reports</Link>
          </div>
          <LearnAreaChart
            data={data.weeklyActivity}
            xKey="label"
            unit=""
            height={240}
            dataKeys={[
              { key: "started", label: "Started", color: "#0284c7" },
              { key: "completed", label: "Completed", color: "#2e7d5b" },
            ]}
          />
          {activityTotal === 0 && (
            <p className="mt-2 text-center text-xs text-[var(--muted)]">No activity yet — add a course below and your trend will start to build.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><Activity className="h-5 w-5" /></span>
            <div>
              <h3 className="font-semibold text-[var(--ink)]">Course status</h3>
              <p className="text-xs text-[var(--muted)]">{totalCourses} course{totalCourses === 1 ? "" : "s"} total</p>
            </div>
          </div>
          {statusSegments.length === 0 ? (
            <div className="flex h-[160px] flex-col items-center justify-center text-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-[var(--muted)]">No courses yet.</p>
              <Link href="/me/recommendations" className="mt-1 text-xs font-semibold text-[var(--brand)] hover:text-[var(--brand-dark)]">Browse recommendations →</Link>
            </div>
          ) : (
            <LearnDonutChart data={statusSegments} label={String(totalCourses)} sublabel="courses" height={160} />
          )}
        </div>
      </div>

      {/* LISTS ROW — continue learning (wide) + recommended for you. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><BookOpen className="h-5 w-5" /></span>
              <h3 className="font-semibold text-[var(--ink)]">Continue learning</h3>
            </div>
            <Link href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
          </div>
          {data.inProgress.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No courses yet. Add a recommendation to get started.</p>
          ) : (
            <ul className="space-y-4">
              {data.inProgress.map((enr) => {
                const notStarted = enr.status === "not_started";
                return (
                  <li key={enr.id} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={enr.title}>{enr.title}</p>
                      <p className="text-xs text-[var(--brand)]">{notStarted ? "Not started" : enr.progress < 5 ? "Just started" : `${enr.progress}% completed`}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${notStarted ? 0 : Math.max(enr.progress, 2)}%` }} /></div>
                    </div>
                    <Link href="/me/learning" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">{notStarted ? "Start" : "Continue"}</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50 text-purple-600"><Sparkles className="h-5 w-5" /></span>
              <h3 className="font-semibold text-[var(--ink)]">Recommended for you</h3>
            </div>
            <Link href="/me/recommendations" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
          </div>
          {data.topRecs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.topRecs.map((rec) => {
                const isEnrolled = enrolled[rec.courseId];
                return (
                  <li key={rec.id} className="rounded-xl border border-[var(--border)] p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600"><Sparkles className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={rec.title}>{rec.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[var(--muted)]">{rec.category}</span>
                          <span className="rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-dark)]">{rec.matchLabel} match</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => enrol(rec.courseId)} disabled={isEnrolled || enrolling[rec.courseId]}
                      className={`mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isEnrolled ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"} disabled:opacity-70`}>
                      {isEnrolled ? <><Check className="h-3.5 w-3.5" /> Added</> : enrolling[rec.courseId] ? "Adding…" : "Add to My Learning"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
