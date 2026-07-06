import { Library, BookOpen, AlertCircle, Users, Eye } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { authorCourses } from "@/lib/mock-data";

const statusConfig: Record<string, string> = {
  published: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  draft: "bg-slate-100 text-slate-600",
};

export default function CourseLibraryPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">Course Library</h1><p className="mt-1 text-sm text-[var(--muted)]">All courses in your working set.</p></div>
        <a href="/author/courses/new" className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><BookOpen className="h-4 w-4" /> Add Course</a>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Library} label="Total Courses" value={authorCourses.length} />
        <StatCard icon={BookOpen} label="Published" value={authorCourses.filter(c => c.status === "published").length} delta="2 this week" deltaPositive />
        <StatCard icon={AlertCircle} iconBg="bg-amber-50" label="Draft" value={authorCourses.filter(c => c.status === "draft").length} />
        <StatCard icon={Users} label="Total Enrollments" value={authorCourses.reduce((s, c) => s + c.enrollments, 0)} delta="12% up" deltaPositive />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">All Courses</h3></div>
        <ul className="divide-y divide-[var(--border)]">
          {authorCourses.map((course) => (
            <li key={course.id} className="flex items-center gap-4 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                <p className="text-xs text-[var(--muted)]">{course.source} · {course.category} · {course.enrollments} enrolled</p>
              </div>
              {course.missing && <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Incomplete</span>}
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[course.status]}`}>{course.status}</span>
              <button className="shrink-0"><Eye className="h-4 w-4 text-[var(--muted)]" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
