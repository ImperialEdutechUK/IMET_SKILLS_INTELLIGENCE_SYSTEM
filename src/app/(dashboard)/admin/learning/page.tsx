import { BookOpen, CheckCircle, Users, Star } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { mockCourses } from "@/lib/mock-data";

export default function LearningManagementPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">Learning Management</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage the course catalogue and learning paths.</p></div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><BookOpen className="h-4 w-4" /> Add Course</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="Total Courses" value={mockCourses.length} />
        <StatCard icon={CheckCircle} label="Active" value={8} delta="6.3% up" deltaPositive />
        <StatCard icon={Users} label="Total Enrollments" value={542} delta="This month" deltaPositive />
        <StatCard icon={Star} label="Avg Rating" value="4.6" delta="Up from 4.4" deltaPositive />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Course Catalogue</h3></div>
        <ul className="divide-y divide-[var(--border)]">
          {mockCourses.map((course) => (
            <li key={course.id} className="flex items-center gap-4 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                <p className="text-xs text-[var(--muted)]">{course.source} · {course.category} · {course.level} · {course.cpd_hours} CPD hrs</p>
              </div>
              <span className="shrink-0 text-sm text-[var(--muted)]">⭐ {course.rating}</span>
              <a href={course.externalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">View</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
