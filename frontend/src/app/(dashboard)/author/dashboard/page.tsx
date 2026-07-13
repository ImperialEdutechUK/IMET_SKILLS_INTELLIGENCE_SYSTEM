"use client";

import { useEffect, useState } from "react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { Library, BookOpen, AlertCircle, Users, Upload, Tags, ClipboardCheck, Plus } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import BarList from "@/components/charts/BarList";
import { getToken } from "@/lib/authClient";

const missingConfig: Record<string, { label: string; bg: string }> = {
  curriculum: { label: "Missing Curriculum", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  learning_outcomes: { label: "No Outcomes", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  category: { label: "Uncategorized", bg: "bg-red-50 text-red-700 border-red-200" },
  skill_tags: { label: "No Skill Tags", bg: "bg-orange-50 text-orange-700 border-orange-200" },
};
const quickActions = [
  { icon: Plus, label: "Add Course", href: "/author/courses/new" },
  { icon: Upload, label: "Import", href: "/author/library" },
  { icon: BookOpen, label: "Bulk Upload", href: "/author/library" },
  { icon: Tags, label: "Add Category", href: "/author/taxonomy" },
  { icon: ClipboardCheck, label: "Add Skill Tag", href: "/author/taxonomy" },
];

interface Data {
  totalCourses: number;
  published: number;
  needsCompletion: number;
  totalEnrollments: number;
  contentActivity: { month: string; added: number; published: number }[];
  needsAttention: { id: string; title: string; source: string; missing: string }[];
  coursesBySource: { name: string; value: number }[];
  skillCoverage: { name: string; covered: number }[];
  recentActivities: { id: string; type: string; user: string; action: string; time: string }[];
}

export default function AuthorDashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/author/dashboard`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load dashboard.</p></div>;

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-[var(--brand)] px-8 py-7">
        <h1 className="text-2xl font-bold text-white">Author Dashboard</h1>
        <p className="mt-1 text-sm text-green-100">Manage your course library and keep it recommendation-ready.</p>
        <a href="/author/courses/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[var(--brand)] hover:bg-green-50">
          <Plus className="h-4 w-4" /> Add New Course
        </a>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Library} label="Total Courses" value={data.totalCourses.toLocaleString()} />
        <StatCard icon={BookOpen} label="Published" value={data.published.toLocaleString()} />
        <StatCard icon={AlertCircle} iconBg="bg-amber-50" label="Needs Completion" value={data.needsCompletion.toLocaleString()} sub="action required" />
        <StatCard icon={Users} label="Total Enrollments" value={data.totalEnrollments.toLocaleString()} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Content Activity</h3>
            <span className="text-xs text-[var(--muted)]">courses / month</span>
          </div>
          <LearnAreaChart data={data.contentActivity} xKey="month" dataKeys={[{ key: "added", label: "Added", color: "#2e7d5b" }, { key: "published", label: "Published", color: "#9fe1cb" }]} unit="" height={200} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Courses Needing Attention</h3>
            <a href="/author/review" className="text-xs font-medium text-[var(--brand)]">View All</a>
          </div>
          {data.needsAttention.length === 0 ? <p className="text-sm text-[var(--muted)]">All courses complete.</p> : (
            <ul className="space-y-3">
              {data.needsAttention.map((course) => {
                const cfg = missingConfig[course.missing] ?? missingConfig.curriculum;
                return (
                  <li key={course.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                      <p className="text-xs text-[var(--muted)]">{course.source}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.bg}`}>{cfg.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Courses by Source</h3>
          <LearnDonutChart data={data.coursesBySource} height={140} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Skill Coverage</h3>
          <BarList items={data.skillCoverage.map((s) => ({ name: s.name, value: s.covered, color: s.covered < 40 ? "#f59e0b" : "var(--brand)" }))} unit="%" />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Recommended</h3>
          <p className="text-sm text-[var(--muted)]">Recommendations will appear here once the AI engine is connected.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <a key={qa.label} href={qa.href} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--brand-tint)]">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Icon className="h-5 w-5" /></span>
                  <span className="text-[10px] text-[var(--muted)]">{qa.label}</span>
                </a>
              );
            })}
          </div>
        </div>
        {data.recentActivities.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">Recent Activity</h3>
            <p className="text-sm text-[var(--muted)]">No recent activity recorded yet.</p>
          </div>
        ) : (
          <ActivityFeed items={data.recentActivities} title="Recent Activity" />
        )}
      </div>
    </div>
  );
}
