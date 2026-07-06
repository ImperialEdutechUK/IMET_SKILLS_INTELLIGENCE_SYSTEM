import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BookOpen, Target, Award, BarChart3, ArrowRight, Sparkles } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ProgressRing from "@/components/cpd/ProgressRing";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import { mockCourses, myRecommendations } from "@/lib/mock-data";

const myLearningOverTime = [
  { month: "Jan", hours: 4 }, { month: "Feb", hours: 6 },
  { month: "Mar", hours: 5 }, { month: "Apr", hours: 8 },
  { month: "May", hours: 7 }, { month: "Jun", hours: 9 },
];

const inProgressCourses = mockCourses.filter((c) => c.status === "in_progress");
const topRecs = myRecommendations.slice(0, 2);

export default function EmployeeDashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, Emma! 👋</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Let&apos;s continue your learning journey today.</p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">CPD Progress</p>
          <p className="mt-1 text-3xl font-bold text-[var(--brand)]">60%</p>
          <div className="mt-3">
            <ProgressRing percentage={60} size={80} strokeWidth={7} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">24 / 40 hrs completed</p>
        </div>
        <StatCard icon={BookOpen} label="Courses in Progress" value={2} delta="Keep going!" deltaPositive sub="Continue learning →" />
        <StatCard icon={Target} label="Learning Path" value={1} sub="In Progress" delta="View path →" deltaPositive />
        <StatCard icon={BarChart3} label="Skills Improving" value={3} sub="Skills in progress" delta="View skills →" deltaPositive />
      </div>

      {/* Resume Learning + AI Recommended */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Resume Learning */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Resume Learning</h3>
            <a href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</a>
          </div>
          <ul className="space-y-4">
            {inProgressCourses.map((course) => (
              <li key={course.id} className="rounded-lg border border-[var(--border)] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">{course.title}</p>
                    <p className="text-xs text-[var(--brand)]">{course.progress}% completed</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                  <a href={course.externalUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-tint)]">
                    Continue
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* AI Recommended */}
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--brand)]" />
              <h3 className="font-semibold text-[var(--ink)]">AI Recommended for You</h3>
            </div>
            <a href="/me/recommendations" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</a>
          </div>
          <div className="space-y-3">
            {topRecs.map((rec) => (
              <RecommendationCard key={rec.id} {...rec} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Learning activity chart */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)]">My Learning Activity</h3>
          <span className="text-xs text-[var(--muted)]">Last 6 months</span>
        </div>
        <LearnAreaChart
          data={myLearningOverTime}
          xKey="month"
          dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]}
          unit="hrs"
          height={180}
        />
      </div>
    </div>
  );
}
