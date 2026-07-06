import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { Library, BookOpen, AlertCircle, Users, Upload, Tags, ClipboardCheck, Plus } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import BarList from "@/components/charts/BarList";
import { contentActivityData, coursesBySource, skillCoverage, topRecommendedCourses, recentAuthorActivities, authorCourses } from "@/lib/mock-data";

const missingConfig: Record<string, { label: string; bg: string }> = {
  curriculum: { label: "Missing Curriculum", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  learning_outcomes: { label: "No Outcomes", bg: "bg-amber-50 text-amber-700 border-amber-200" },
  category: { label: "Uncategorized", bg: "bg-red-50 text-red-700 border-red-200" },
  skill_tags: { label: "No Skill Tags", bg: "bg-orange-50 text-orange-700 border-orange-200" },
};

const quickActions = [
  { icon: Plus, label: "Add Course" },
  { icon: Upload, label: "Import" },
  { icon: BookOpen, label: "Bulk Upload" },
  { icon: Tags, label: "Add Category" },
  { icon: ClipboardCheck, label: "Add Skill Tag" },
];

const needsAttention = authorCourses.filter((c) => c.missing !== null);

export default function AuthorDashboardPage() {
  return (
    <div>
      {/* Hero banner */}
      <div className="mb-6 rounded-2xl bg-[var(--brand)] px-8 py-7">
        <h1 className="text-2xl font-bold text-white">Good Morning, Author! 👋</h1>
        <p className="mt-1 text-sm text-green-100">Manage your course library and keep it recommendation-ready.</p>
        <a href="/author/courses/new"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[var(--brand)] hover:bg-green-50">
          <Plus className="h-4 w-4" /> Add New Course
        </a>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Library} label="Total Courses" value={authorCourses.length} delta="3 this month" deltaPositive />
        <StatCard icon={BookOpen} label="Published" value={authorCourses.filter((c) => c.status === "published").length} delta="2 this week" deltaPositive />
        <StatCard icon={AlertCircle} iconBg="bg-amber-50" label="Needs Completion" value={needsAttention.length} delta="Action required" deltaPositive={false} />
        <StatCard icon={Users} label="Total Enrollments" value={authorCourses.reduce((sum, c) => sum + c.enrollments, 0)} delta="12% this month" deltaPositive />
      </div>

      {/* Content Activity + Courses Needing Attention */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Content Activity</h3>
            <span className="text-xs text-[var(--muted)]">courses / month</span>
          </div>
          <LearnAreaChart
            data={contentActivityData}
            xKey="month"
            dataKeys={[
              { key: "added", label: "Added", color: "#2e7d5b" },
              { key: "published", label: "Published", color: "#9fe1cb" },
            ]}
            unit=""
            height={200}
          />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Courses Needing Attention</h3>
            <a href="/author/review" className="text-xs font-medium text-[var(--brand)]">View All</a>
          </div>
          <ul className="space-y-3">
            {needsAttention.map((course) => {
              const cfg = missingConfig[course.missing!];
              return (
                <li key={course.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                    <p className="text-xs text-[var(--muted)]">{course.source}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.bg}`}>
                    {cfg.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Three lower panels */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Courses by Source</h3>
          <LearnDonutChart data={coursesBySource} height={140} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Skill Coverage</h3>
          <BarList items={skillCoverage.map((s) => ({ name: s.name, value: s.covered, color: s.covered < 40 ? "#f59e0b" : "var(--brand)" }))} unit="%" />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Recommended</h3>
          <ul className="space-y-3">
            {topRecommendedCourses.map((c) => (
              <li key={c.title} className="flex items-center gap-2">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${c.matchLabel === "high" ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-blue-50 text-blue-700"}`}>
                  {c.matchLabel === "high" ? "High" : "Good"}
                </span>
                <span className="truncate text-sm text-[var(--ink)]">{c.title}</span>
                <span className="ml-auto text-xs text-[var(--muted)]">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button key={qa.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--brand-tint)]">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <ActivityFeed items={recentAuthorActivities} title="Recent Activity" />
      </div>
    </div>
  );
}
