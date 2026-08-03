"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowUpRight } from "lucide-react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import LearnBarChart from "@/components/charts/LearnBarChart";
import BarList from "@/components/charts/BarList";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;
const CATEGORY_COLORS = ["#2e7d5b", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#0ea5e9", "#64748b", "#e11d48"];

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
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState<string | null>(null); // null = whole organisation

  useEffect(() => {
    fetch(`${API}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const dept = useMemo(() => (data && deptId ? data.departments.find((d) => d.id === deptId) ?? null : null), [data, deptId]);

  if (loading || !data) {
    return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">{loading ? "Loading…" : "Could not load dashboard."}</p></div>;
  }

  const sum = (f: (d: Dept) => number) => data.departments.reduce((s, d) => s + f(d), 0);
  const scopeLabel = dept ? dept.name : "Whole organisation";

  // KPI values re-scope to the selected department chip (org totals when "All").
  const kpis: { label: string; value: string | number; color?: string; sub?: string }[] = [
    { label: "Employees", value: dept ? dept.teamMembers : data.totalEmployees, sub: dept ? "in department" : "org-wide" },
    { label: "Completed", value: dept ? dept.coursesCompleted : sum((d) => d.coursesCompleted), color: "#2e7d5b", sub: "courses" },
    { label: "In progress", value: dept ? dept.coursesInProgress : sum((d) => d.coursesInProgress), color: "#2563eb", sub: "courses" },
    { label: "Not started", value: dept ? dept.notStarted : sum((d) => d.notStarted), color: "#64748b", sub: "employees" },
    { label: "Certificates", value: dept ? dept.certificates : data.certificatesEarned, color: "#7c3aed", sub: "earned" },
    { label: "At risk", value: dept ? dept.atRisk : sum((d) => d.atRisk), color: (dept ? dept.atRisk : sum((d) => d.atRisk)) > 0 ? "#e11d48" : "#2e7d5b", sub: "behind pace" },
  ];

  // Donut: category breakdown for the current scope.
  const catSource = dept ? dept.categoryBreakdown : data.categoryBreakdown;
  const categoryData = catSource.map((c, i) => ({ ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }));
  const catTotal = catSource.reduce((s, c) => s + c.value, 0);

  // Completed courses per department (comparison bar list — highlight the selected dept).
  const maxCompleted = Math.max(1, ...data.departments.map((d) => d.coursesCompleted));
  const completedByDept = data.departments.map((d) => ({
    name: d.name,
    value: d.coursesCompleted,
    max: maxCompleted,
    color: deptId && d.id !== deptId ? "#cbd5e1" : "#3f9d75",
  }));

  // CPD % per department (vertical bars).
  const cpdByDept = data.departments.map((d) => ({ name: d.name, value: d.avgCpd }));

  // Top skill gaps (org-wide).
  const maxGap = Math.max(1, ...data.skillsGap.map((s) => s.gap));
  const skillGapItems = data.skillsGap.map((s) => ({ name: s.name, value: s.gap, max: maxGap, color: "#f59e0b" }));

  return (
    <div>
      {/* Header + department filter chips */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Organisation analytics</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{scopeLabel} · {data.orgHealth.departments} departments · {data.totalEmployees} employees</p>
        </div>
        <Link href="/admin/recommendations" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <BarChart3 className="h-4 w-4" /> AI insights
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Chip active={deptId === null} onClick={() => setDeptId(null)}>All departments</Chip>
        {data.departments.map((d) => (
          <Chip key={d.id} active={deptId === d.id} onClick={() => setDeptId(deptId === d.id ? null : d.id)}>{d.name}</Chip>
        ))}
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{k.label}</p>
            <p className="mt-2 text-[1.75rem] font-extrabold leading-none" style={{ color: k.color ?? "var(--ink)" }}>{typeof k.value === "number" ? k.value.toLocaleString() : k.value}</p>
            {k.sub && <p className="mt-1 text-[11px] text-[var(--muted)]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Row 1 — donut · area · department matrix */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Learning by category" subtitle={scopeLabel}>
          {categoryData.length === 0 ? (
            <Empty>No enrolments yet.</Empty>
          ) : (
            <LearnDonutChart data={categoryData} label={String(catTotal)} sublabel="Courses" height={200} />
          )}
        </Panel>

        <Panel title="Learning activity" subtitle="Completions · last 6 months · org-wide">
          <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#3f9d75" }]} unit="" height={200} />
        </Panel>

        <Panel title="Department breakdown" subtitle="Members · completed · in progress · at risk">
          <DeptMatrix departments={data.departments} selectedId={deptId} onSelect={(id) => setDeptId(deptId === id ? null : id)} />
        </Panel>
      </div>

      {/* Row 2 — completed by dept · CPD by dept · skill gaps */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Completed by department" subtitle="Total completed courses">
          {completedByDept.length === 0 ? <Empty>No departments yet.</Empty> : <BarList items={completedByDept} unit="" max={maxCompleted} />}
        </Panel>

        <Panel title="CPD compliance by department" subtitle="Average CPD progress %">
          {cpdByDept.length === 0 ? <Empty>No departments yet.</Empty> : <LearnBarChart data={cpdByDept} unit="%" height={200} highlightName={dept?.name ?? null} />}
        </Panel>

        <Panel title="Top skill gaps" subtitle="Highest average gaps · org-wide">
          {skillGapItems.length === 0 ? (
            <Empty>No skill-gap data yet.</Empty>
          ) : (
            <>
              <BarList items={skillGapItems} unit="" max={maxGap} />
              <Link href="/admin/recommendations" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)]">Full AI analysis <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </>
          )}
        </Panel>
      </div>

      {/* Recent activity — full width */}
      <Panel title="Recent activity" subtitle="Enrolments and completions across every department">
        {data.recentActivities.length === 0 ? (
          <Empty>No recent activity recorded yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {data.recentActivities.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 last:border-0">
                <p className="min-w-0 truncate text-sm text-[var(--ink)]"><span className="font-medium">{a.user}</span> {a.action}</p>
                <span className="shrink-0 text-xs text-[var(--muted)]">{a.time}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-[var(--brand)] text-white shadow-sm"
          : "border border-[var(--border)] bg-white text-[var(--ink)] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-[var(--ink)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
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
