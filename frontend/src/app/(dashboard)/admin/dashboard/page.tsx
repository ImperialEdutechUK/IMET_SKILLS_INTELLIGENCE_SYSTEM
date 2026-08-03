"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BookOpen, Award, Building2, TrendingUp, BarChart3, Activity, Clock,
  ChevronRight, ShieldCheck, AlertTriangle, Sparkles,
} from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import HeroRing from "@/components/dashboard/HeroRing";
import StatTile from "@/components/dashboard/StatTile";
import CollapsibleCard from "@/components/dashboard/CollapsibleCard";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Dept {
  id: string;
  name: string;
  teamMembers: number;
  coursesInProgress: number;
  coursesCompleted: number;
  notStarted: number;
  atRisk: number;
  attention: number;
  avgCpd: number;
  avgSkillLevel: number;
}
interface Data {
  totalEmployees: number;
  activeCourses: number;
  certificatesEarned: number;
  orgHealth: { totalMembers: number; onTrack: number; atRisk: number; attention: number; avgSkillLevel: number; departments: number };
  departments: Dept[];
  learningActivity: { month: string; completions: number }[];
  skillsGap: { name: string }[];
  recentActivities: { id: string; type: string; user: string; action: string; time: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">{loading ? "Loading…" : "Could not load dashboard."}</p></div>;
  }

  const h = data.orgHealth;
  const behind = h.atRisk + h.attention;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // One clear org-wide verdict at the top.
  const verdict = h.totalMembers === 0
    ? { word: "No employees yet", line: "No employees have been added to any department yet." }
    : h.atRisk > 0
      ? { word: "Needs attention", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person is" : "people are"} behind on their learning across ${h.departments} department${h.departments === 1 ? "" : "s"}.` }
      : h.attention > 0
        ? { word: "Mostly on track", line: `${behind} of ${h.totalMembers} ${behind === 1 ? "person needs" : "people need"} a nudge to stay on pace.` }
        : { word: "On track", line: `All ${h.totalMembers} employees are on pace with their learning. 🎉` };
  const ringColor = h.totalMembers === 0 ? "#94a3b8" : h.atRisk > 0 ? "#e11d48" : h.attention > 0 ? "#f59e0b" : "var(--brand)";
  const accent = h.totalMembers === 0 ? "#f1f5f9" : h.atRisk > 0 ? "#fef1f2" : h.attention > 0 ? "#fef7ec" : "#eef7f2";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Organisation dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{today} · {h.departments} department{h.departments === 1 ? "" : "s"} · {data.totalEmployees} employee{data.totalEmployees === 1 ? "" : "s"}</p>
        </div>
        <Link href="/admin/recommendations" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <BarChart3 className="h-4 w-4" /> View insights
        </Link>
      </div>

      {/* Org health hero */}
      <HeroRing
        percent={h.totalMembers ? Math.round((h.onTrack / h.totalMembers) * 100) : 0}
        ringColor={ringColor}
        ringLabel={`${h.onTrack}/${h.totalMembers}`}
        ringSublabel="on track"
        accent={accent}
        title={verdict.word}
        subtitle={verdict.line}
        metrics={[
          { label: "Departments", value: String(h.departments), color: "#0284c7" },
          { label: "Behind pace", value: String(behind), color: behind > 0 ? "#e11d48" : "#16a34a" },
          { label: "Avg skill", value: `${h.avgSkillLevel}/5`, color: "#7c3aed" },
        ]}
      />

      {/* Key numbers */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Key numbers</p>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile index={0} href="/admin/departments" icon={Building2} tone="green" label="Departments" value={h.departments} sub="Across the org" />
        <StatTile index={1} href="/admin/users" icon={Users} tone="sky" label="Employees" value={data.totalEmployees} sub="Total tracked" />
        <StatTile index={2} href="/admin/departments" icon={BookOpen} tone="teal" label="Active courses" value={data.activeCourses.toLocaleString()} sub="Published catalogue" />
        <StatTile index={3} href="/admin/departments" icon={Award} tone="violet" label="Certificates" value={data.certificatesEarned} sub="Earned org-wide" />
      </div>

      {/* Departments grid — the org-wide equivalent of a manager's team list */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Departments <span className="font-normal normal-case text-[var(--muted)]/70">· tap to drill in</span></p>
          <Link href="/admin/departments" className="text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all →</Link>
        </div>
        {data.departments.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No departments yet.</p></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.departments.map((d) => <DepartmentCard key={d.id} d={d} />)}
          </div>
        )}
      </div>

      {/* Detail behind dropdowns */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">More detail <span className="font-normal normal-case text-[var(--muted)]/70">· tap to expand</span></p>
      <div className="space-y-4">
        <CollapsibleCard title="Learning activity" subtitle="Course completions over the last 6 months" icon={BarChart3} tone={TONES.blue}>
          <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#3f9d75" }]} unit="" height={220} />
        </CollapsibleCard>

        <CollapsibleCard title="Top skill gaps" subtitle="Highest average gaps across the organisation" icon={TrendingUp} tone={TONES.amber}>
          {data.skillsGap.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No skill-gap data yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.skillsGap.map((s) => (
                <span key={s.name} className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--ink)]">{s.name}</span>
              ))}
            </div>
          )}
          <Link href="/admin/recommendations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">
            <Sparkles className="h-3.5 w-3.5" /> Full AI analysis →
          </Link>
        </CollapsibleCard>

        <CollapsibleCard title="Recent activity" subtitle="Enrolments and completions across every department" icon={Activity} tone={TONES.violet}>
          {data.recentActivities.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recent activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentActivities.map((item) => (
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
    </div>
  );
}

function ActIcon({ type }: { type?: string }) {
  const Icon = type === "course_complete" ? Award : type === "cpd" ? Clock : BookOpen;
  return <Icon className="h-3.5 w-3.5" />;
}

function DepartmentCard({ d }: { d: Dept }) {
  const behind = d.atRisk + d.attention;
  const tone = d.atRisk > 0 ? TONES.rose : d.attention > 0 ? TONES.amber : TONES.emerald;
  const badge = d.teamMembers === 0
    ? { cls: "bg-slate-100 text-slate-600", label: "No members" }
    : d.atRisk > 0
      ? { cls: "bg-red-50 text-red-700", label: `${d.atRisk} at risk` }
      : d.attention > 0
        ? { cls: "bg-amber-50 text-amber-700", label: `${d.attention} behind` }
        : { cls: "bg-emerald-50 text-emerald-700", label: "On track" };
  return (
    <Link
      href={`/admin/departments/${d.id}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon3D icon={d.atRisk > 0 || d.attention > 0 ? AlertTriangle : ShieldCheck} tone={tone} size="sm" />
          <h3 className="font-semibold text-[var(--ink)]">{d.name}</h3>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
      </div>
      <span className={`mb-4 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold leading-none text-[var(--ink)]">{d.teamMembers}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Members</p>
        </div>
        <div>
          <p className="text-lg font-bold leading-none text-[var(--brand)]">{d.coursesCompleted}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Completed</p>
        </div>
        <div>
          <p className="text-lg font-bold leading-none text-blue-600">{d.coursesInProgress}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">In progress</p>
        </div>
      </div>
      {/* Avg CPD progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Avg CPD</span><span className="font-medium text-[var(--ink)]">{d.avgCpd}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.avgCpd)}%`, background: behind > 0 ? (d.atRisk > 0 ? "#e11d48" : "#f59e0b") : "var(--brand)" }} />
        </div>
      </div>
    </Link>
  );
}
