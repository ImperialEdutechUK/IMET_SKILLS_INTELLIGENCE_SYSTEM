import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { Users, BookOpen, Award, Medal, UserPlus, BarChart3, Star, ClipboardCheck, Sparkles } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import BarList from "@/components/charts/BarList";
import { learningActivityData, departmentPerformance, skillsGap, cpdComplianceData, recentAdminActivities, aiInsights } from "@/lib/mock-data";

const quickActions = [
  { icon: UserPlus, label: "Create User" },
  { icon: BookOpen, label: "Add Course" },
  { icon: Star, label: "Add Skill" },
  { icon: ClipboardCheck, label: "Set CPD Target" },
  { icon: Sparkles, label: "Generate Recommendations" },
  { icon: BarChart3, label: "Generate Report" },
];

const aiIconMap: Record<string, string> = {
  warning: "👥", trend: "📈", suggestion: "💡", achievement: "🎓",
};

export default function AdminDashboardPage() {
  return (
    <div>
      {/* Hero banner */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-[var(--brand)] px-8 py-7">
        <h1 className="text-2xl font-bold text-white">Good Morning, Admin! 👋</h1>
        <p className="mt-1 text-sm text-green-100">Monitor employee growth, CPD progress, and AI-powered learning insights.</p>
        <a href="/admin/reports"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[var(--brand)] hover:bg-green-50">
          <BarChart3 className="h-4 w-4" /> View Reports
        </a>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Employees" value="1,248" delta="8.5% from last month" deltaPositive />
        <StatCard icon={BookOpen} label="Active Courses" value={156} delta="6.3% from last month" deltaPositive />
        <StatCard icon={Award} label="CPD Completion Rate" value="78%" delta="9.1% from last month" deltaPositive />
        <StatCard icon={Medal} label="Certificates Earned" value={542} delta="7.2% from last month" deltaPositive />
      </div>

      {/* Learning Activity + AI Insights */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Learning Activity</h3>
            <span className="text-xs text-[var(--muted)]">Last 6 Months · completions</span>
          </div>
          <LearnAreaChart
            data={learningActivityData}
            xKey="month"
            dataKeys={[{ key: "completions", label: "completions", color: "#2e7d5b" }]}
            unit=""
            height={200}
          />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--brand)]" />
              <h3 className="font-semibold text-[var(--ink)]">AI Insights</h3>
            </div>
            <a href="/admin/recommendations" className="text-xs font-medium text-[var(--brand)]">View All</a>
          </div>
          <ul className="space-y-3">
            {aiInsights.map((ins) => (
              <li key={ins.id} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                <span className="mt-0.5 shrink-0">{aiIconMap[ins.type]}</span>
                <span dangerouslySetInnerHTML={{ __html: ins.text.replace(ins.highlight, `<strong class="text-[#2e7d5b]">${ins.highlight}</strong>`) }} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Dept Performance + Skills Gap + CPD Compliance */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Department Performance</h3>
          <BarList items={departmentPerformance} unit="%" />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Skills Gap</h3>
          <div className="flex flex-wrap gap-2">
            {skillsGap.map((s) => (
              <span key={s.name} className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--ink)] hover:bg-[var(--brand-tint)]">
                {s.name}
              </span>
            ))}
          </div>
          <a href="/admin/skills" className="mt-4 flex items-center gap-1 text-sm font-medium text-[var(--brand)]">
            View Full Analysis →
          </a>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Compliance Overview</h3>
          <LearnDonutChart data={cpdComplianceData} label="78%" sublabel="Overall" height={140} />
        </div>
      </div>

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <button key={qa.label} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border)] p-3 text-center hover:bg-[var(--brand-tint)]">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] leading-tight text-[var(--muted)]">{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ActivityFeed items={recentAdminActivities} title="Recent Activities" />
      </div>
    </div>
  );
}
