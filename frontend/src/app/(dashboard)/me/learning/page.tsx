import { BookOpen, CheckCircle, Clock, BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { mockCourses } from "@/lib/mock-data";

const statusConfig: Record<string, { label: string; bg: string }> = {
  completed: { label: "Completed", bg: "bg-[var(--brand-tint)] text-[var(--brand-dark)]" },
  in_progress: { label: "In Progress", bg: "bg-blue-50 text-blue-700" },
  not_started: { label: "Not Started", bg: "bg-slate-100 text-slate-600" },
};

export default function MyLearningPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">My Learning</h1><p className="mt-1 text-sm text-[var(--muted)]">All your courses in one place.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="Total Courses" value={mockCourses.length} />
        <StatCard icon={CheckCircle} label="Completed" value={mockCourses.filter(c => c.status === "completed").length} delta="This year" deltaPositive />
        <StatCard icon={BarChart3} label="In Progress" value={mockCourses.filter(c => c.status === "in_progress").length} />
        <StatCard icon={Clock} label="Hours Logged" value={24} sub="of 40 target" />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">All Courses</h3></div>
        <ul className="divide-y divide-[var(--border)]">
          {mockCourses.map((course) => {
            const cfg = statusConfig[course.status];
            return (
              <li key={course.id} className="flex items-center gap-4 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                  <p className="text-xs text-[var(--muted)]">{course.source} · {course.category} · {course.cpd_hours} CPD hrs</p>
                  {course.status === "in_progress" && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${course.progress}%`}} /></div>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg}`}>{cfg.label}</span>
                {course.status !== "completed" && <a href={course.externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">{course.status === "in_progress" ? "Continue" : "Start"}</a>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
