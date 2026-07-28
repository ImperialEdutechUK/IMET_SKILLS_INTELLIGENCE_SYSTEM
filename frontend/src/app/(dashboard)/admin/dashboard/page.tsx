"use client";

import { useEffect, useState } from "react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { Users, BookOpen, Medal, UserCog, BarChart3, Settings, Sparkles } from "lucide-react";
import BentoStat from "@/components/dashboard/BentoStat";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import BarList from "@/components/charts/BarList";
import { getToken } from "@/lib/authClient";

const quickActions = [
  { icon: UserCog, label: "User Management", href: "/admin/users" },
  { icon: Sparkles, label: "AI Recommendations", href: "/admin/recommendations" },
  { icon: Settings, label: "Settings", href: "/me/settings" },
];

interface Data {
  totalEmployees: number;
  activeCourses: number;
  cpdCompletionRate: number;
  certificatesEarned: number;
  learningActivity: { month: string; completions: number }[];
  departmentPerformance: { name: string; value: number }[];
  skillsGap: { name: string }[];
  cpdCompliance: { name: string; value: number }[];
  compliancePct: number;
  recentActivities: { id: string; type: string; user: string; action: string; time: string }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load dashboard.</p></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Monitor employee growth and learning insights.</p>
        </div>
        <a href="/admin/recommendations" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
          <BarChart3 className="h-4 w-4" /> View Insights
        </a>
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Key numbers</p>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BentoStat index={0} icon={Users} tone="greenSolid" label="Total Employees" value={data.totalEmployees.toLocaleString()} />
        <BentoStat index={1} icon={BookOpen} tone="blue" label="Active Courses" value={data.activeCourses.toLocaleString()} />
        <BentoStat index={2} icon={Medal} tone="amber" label="Certificates Earned" value={data.certificatesEarned.toLocaleString()} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Learning Activity</h3>
            <span className="text-xs text-[var(--muted)]">Last 6 Months · completions</span>
          </div>
          <LearnAreaChart data={data.learningActivity} xKey="month" dataKeys={[{ key: "completions", label: "completions", color: "#3f9d75" }]} unit="" height={200} />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">AI Insights</h3></div>
            <a href="/admin/recommendations" className="text-xs font-medium text-[var(--brand)]">View All</a>
          </div>
          <p className="text-sm text-[var(--muted)]">See organisation-wide skill gaps and AI-matched course recommendations across every department.</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Department Performance</h3>
          {data.departmentPerformance.length === 0 ? <p className="text-sm text-[var(--muted)]">No data.</p> : <BarList items={data.departmentPerformance} unit="%" />}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Skills Gap</h3>
          <div className="flex flex-wrap gap-2">
            {data.skillsGap.map((s) => (<span key={s.name} className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--ink)] hover:bg-[var(--brand-tint)]">{s.name}</span>))}
          </div>
          <a href="/admin/recommendations" className="mt-4 flex items-center gap-1 text-sm font-medium text-[var(--brand)]">View Full Analysis →</a>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <a key={qa.label} href={qa.href} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] p-3 text-center hover:bg-[var(--brand-tint)]">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Icon className="h-5 w-5" /></span>
                  <span className="text-[10px] leading-tight text-[var(--muted)]">{qa.label}</span>
                </a>
              );
            })}
          </div>
        </div>
        {data.recentActivities.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">Recent Activities</h3>
            <p className="text-sm text-[var(--muted)]">No recent activity recorded yet.</p>
          </div>
        ) : (
          <ActivityFeed items={data.recentActivities} title="Recent Activities" />
        )}
      </div>
    </div>
  );
}
