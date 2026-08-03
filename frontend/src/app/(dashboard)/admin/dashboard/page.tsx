"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Users, CheckCircle2, Clock, CircleDashed, Award, AlertTriangle,
  PieChart, TrendingUp, Building2, Target, Activity, BookOpen,
} from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import LearnBarChart from "@/components/charts/LearnBarChart";
import BarList from "@/components/charts/BarList";
import StatTile, { type TileTone } from "@/components/dashboard/StatTile";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

const CATEGORY_COLORS = ["#2e7d5b", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#0ea5e9", "#64748b", "#e11d48"];

// Soft, layered card elevation — the "3D" feel: a hairline highlight + a deep soft drop.
const CARD = "rounded-3xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_12px_32px_-14px_rgba(15,27,45,.14)]";

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

export default function AdminAnalyticsDashboard() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<Data>("/api/admin/dashboard");
  const [deptId, setDeptId] = useState<string | null>(null); // null = whole organisation

  // Re-resolved against the latest response; if a revalidation drops the selected
  // department, this falls back to org-wide rather than rendering stale data.
  const dept = useMemo(() => (data && deptId ? data.departments.find((d) => d.id === deptId) ?? null : null), [data, deptId]);

  if (isLoading) return <PageSkeleton cards={6} />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load dashboard."} onRetry={refresh} />;

  const sum = (f: (d: Dept) => number) => data.departments.reduce((s, d) => s + f(d), 0);
  const scopeLabel = dept ? dept.name : "Whole organisation";
  const atRiskVal = dept ? dept.atRisk : sum((d) => d.atRisk);

  // KPI cards — vivid animated 3D tiles. Values re-scope to the selected chip.
  const kpis: { label: string; value: number; sub: string; icon: LucideIcon; tone: TileTone; delta?: { dir: "up" | "down"; text: string } }[] = [
    { label: "Employees", value: dept ? dept.teamMembers : data.totalEmployees, sub: dept ? "in department" : "org-wide", icon: Users, tone: "sky" },
    { label: "Completed", value: dept ? dept.coursesCompleted : sum((d) => d.coursesCompleted), sub: "courses", icon: CheckCircle2, tone: "green" },
    { label: "In progress", value: dept ? dept.coursesInProgress : sum((d) => d.coursesInProgress), sub: "courses", icon: Clock, tone: "teal" },
    { label: "Not started", value: dept ? dept.notStarted : sum((d) => d.notStarted), sub: "employees", icon: CircleDashed, tone: "amber" },
    { label: "Certificates", value: dept ? dept.certificates : data.certificatesEarned, sub: "earned", icon: Award, tone: "violet" },
    { label: "At risk", value: atRiskVal, sub: "behind pace", icon: AlertTriangle, tone: "pink", delta: atRiskVal > 0 ? { dir: "down", text: "behind" } : undefined },
  ];

  const catSource = dept ? dept.categoryBreakdown : data.categoryBreakdown;
  const categoryData = catSource.map((c, i) => ({ ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
  const catTotal = catSource.reduce((s, c) => s + c.value, 0);

  const maxCompleted = Math.max(1, ...data.departments.map((d) => d.coursesCompleted));
  const completedByDept = data.departments.map((d) => ({
    name: d.name, value: d.coursesCompleted, max: maxCompleted,
    color: deptId && d.id !== deptId ? "#cbd5e1" : "#3f9d75",
  }));

  const cpdByDept = data.departments.map((d) => ({ name: d.name, value: d.avgCpd }));

  const maxGap = Math.max(1, ...data.skillsGap.map((s) => s.gap));
  const skillGapItems = data.skillsGap.map((s) => ({ name: s.name, value: s.gap, max: maxGap, color: "#f59e0b" }));

  return (
    // Whiter, modern backdrop — full-bleed over the shell's grey page colour.
    <div className="-m-6 min-h-full bg-gradient-to-b from-white via-white to-[#f4f9f6] p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <span className="gam-float grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md" style={{ background: "linear-gradient(135deg,#4ade80,#16a34a)" }}>
          <Building2 className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-[var(--ink)]">Organisation analytics</h1>
            <RefreshingBadge show={isRefreshing} />
          </div>
          <p className="text-sm text-[var(--muted)]">{scopeLabel} · {data.orgHealth.departments} departments · {data.totalEmployees} employees</p>
        </div>
      </div>

      {/* Department filter chips — clear, button-like, active state pops */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={deptId === null} onClick={() => setDeptId(null)}>All departments</Chip>
        {data.departments.map((d) => (
          <Chip key={d.id} active={deptId === d.id} onClick={() => setDeptId(deptId === d.id ? null : d.id)}>{d.name}</Chip>
        ))}
      </div>

      {/* KPI row — animated 3D tiles */}
      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k, i) => (
          <StatTile key={k.label} index={i} icon={k.icon} tone={k.tone} label={k.label} value={k.value.toLocaleString()} sub={k.sub} delta={k.delta} />
        ))}
      </div>

      {/* Row 1 — donut · area · department matrix */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Learning by category" subtitle={scopeLabel} icon={PieChart} tone="green">
          {categoryData.length === 0 ? <Empty>No enrolments yet.</Empty> : <LearnDonutChart data={categoryData} label={String(catTotal)} sublabel="Courses" height={200} />}
        </Panel>

        <Panel title="Learning activity" subtitle="Completions · last 6 months · org-wide" icon={TrendingUp} tone="sky">
          <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#3f9d75" }]} unit="" height={200} />
        </Panel>

        <Panel title="Department breakdown" subtitle="Members · completed · in progress · at risk" icon={Building2} tone="violet">
          <DeptMatrix departments={data.departments} selectedId={deptId} onSelect={(id) => setDeptId(deptId === id ? null : id)} />
        </Panel>
      </div>

      {/* Row 2 — completed by dept · CPD by dept · skill gaps */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Completed by department" subtitle="Total completed courses" icon={CheckCircle2} tone="teal">
          {completedByDept.length === 0 ? <Empty>No departments yet.</Empty> : <BarList items={completedByDept} unit="" max={maxCompleted} />}
        </Panel>

        <Panel title="CPD compliance by department" subtitle="Average CPD progress %" icon={BookOpen} tone="green">
          {cpdByDept.length === 0 ? <Empty>No departments yet.</Empty> : <LearnBarChart data={cpdByDept} unit="%" height={200} highlightName={dept?.name ?? null} />}
        </Panel>

        <Panel title="Top skill gaps" subtitle="Highest average gaps · org-wide" icon={Target} tone="amber">
          {skillGapItems.length === 0 ? <Empty>No skill-gap data yet.</Empty> : <BarList items={skillGapItems} unit="" max={maxGap} />}
        </Panel>
      </div>

      {/* Recent activity — full width */}
      <Panel title="Recent activity" subtitle="Enrolments and completions across every department" icon={Activity} tone="pink">
        {data.recentActivities.length === 0 ? (
          <Empty>No recent activity recorded yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            {data.recentActivities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2.5 last:border-0">
                <p className="min-w-0 truncate text-sm text-[var(--ink)]"><span className="font-semibold">{a.user}</span> {a.action}</p>
                <span className="shrink-0 text-xs font-medium text-[var(--muted)]">{a.time}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const TILE_GRADIENTS: Record<TileTone, string> = {
  green:  "linear-gradient(135deg,#4ade80,#16a34a)",
  sky:    "linear-gradient(135deg,#38bdf8,#0284c7)",
  violet: "linear-gradient(135deg,#a78bfa,#7c3aed)",
  pink:   "linear-gradient(135deg,#f472b6,#db2777)",
  amber:  "linear-gradient(135deg,#fbbf24,#d97706)",
  teal:   "linear-gradient(135deg,#2dd4bf,#0d9488)",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? "text-white shadow-md shadow-emerald-600/20"
          : "border border-[var(--border)] bg-white text-[var(--ink)] shadow-sm hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md"
      }`}
      style={active ? { background: "linear-gradient(135deg,#34d399,#16a34a)" } : undefined}
    >
      {children}
    </button>
  );
}

function Panel({ title, subtitle, icon: Icon, tone = "green", children }: { title: string; subtitle?: string; icon?: LucideIcon; tone?: TileTone; children: React.ReactNode }) {
  return (
    <div className={`${CARD} p-5 transition-shadow hover:shadow-[0_1px_2px_rgba(15,27,45,.05),0_18px_44px_-16px_rgba(15,27,45,.2)]`}>
      <div className="mb-4 flex items-center gap-3">
        {Icon && (
          <span className="gam-float grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm" style={{ background: TILE_GRADIENTS[tone] }}>
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--ink)]">{title}</h3>
          {subtitle && <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-[var(--muted)]">{children}</p>;
}

function DeptMatrix({ departments, selectedId, onSelect }: { departments: Dept[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (departments.length === 0) return <Empty>No departments yet.</Empty>;
  const total = departments.reduce(
    (t, d) => ({ m: t.m + d.teamMembers, c: t.c + d.coursesCompleted, p: t.p + d.coursesInProgress, r: t.r + d.atRisk }),
    { m: 0, c: 0, p: 0, r: 0 }
  );
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--brand-dark)]">
            <th className="px-1 pb-2 text-left font-semibold">Department</th>
            <th className="px-1 pb-2 text-right font-semibold">Mem</th>
            <th className="px-1 pb-2 text-right font-semibold">Done</th>
            <th className="px-1 pb-2 text-right font-semibold">Prog</th>
            <th className="px-1 pb-2 text-right font-semibold">Risk</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => {
            const sel = d.id === selectedId;
            return (
              <tr
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={`cursor-pointer border-t border-[var(--border)] transition-colors ${sel ? "bg-[var(--brand-tint)]" : "hover:bg-slate-50"}`}
              >
                <td className="px-1 py-2 font-medium text-[var(--ink)]">{d.name}</td>
                <td className="px-1 py-2 text-right text-[var(--ink)]">{d.teamMembers}</td>
                <td className="px-1 py-2 text-right text-[var(--brand-dark)]">{d.coursesCompleted}</td>
                <td className="px-1 py-2 text-right text-blue-600">{d.coursesInProgress}</td>
                <td className={`px-1 py-2 text-right font-medium ${d.atRisk > 0 ? "text-red-600" : "text-[var(--muted)]"}`}>{d.atRisk}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-[var(--border)] font-bold text-[var(--ink)]">
            <td className="px-1 py-2">Total</td>
            <td className="px-1 py-2 text-right">{total.m}</td>
            <td className="px-1 py-2 text-right">{total.c}</td>
            <td className="px-1 py-2 text-right">{total.p}</td>
            <td className="px-1 py-2 text-right">{total.r}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
