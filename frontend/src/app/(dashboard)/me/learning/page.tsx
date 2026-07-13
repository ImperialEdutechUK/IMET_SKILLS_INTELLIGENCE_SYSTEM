"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle, Clock, BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const statusConfig: Record<string, { label: string; bg: string }> = {
  completed: { label: "Completed", bg: "bg-[var(--brand-tint)] text-[var(--brand-dark)]" },
  in_progress: { label: "In Progress", bg: "bg-blue-50 text-blue-700" },
  not_started: { label: "Not Started", bg: "bg-slate-100 text-slate-600" },
};

interface Course {
  id: string;
  title: string;
  source: string;
  category: string;
  cpd_hours: number;
  status: string;
  progress: number;
  externalUrl: string;
}
interface LearningData {
  totalCourses: number;
  completed: number;
  inProgress: number;
  cpdHours: number;
  cpdTarget: number;
  courses: Course[];
}

export default function MyLearningPage() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/learning`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Could not load your courses.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">My Learning</h1><p className="mt-1 text-sm text-[var(--muted)]">All your courses in one place.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="Total Courses" value={data.totalCourses} />
        <StatCard icon={CheckCircle} label="Completed" value={data.completed} delta="This year" deltaPositive />
        <StatCard icon={BarChart3} label="In Progress" value={data.inProgress} />
        <StatCard icon={Clock} label="Hours Logged" value={data.cpdHours} sub={`of ${data.cpdTarget} target`} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">All Courses</h3></div>
        {data.courses.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">You are not enrolled in any courses yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.courses.map((course) => {
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
        )}
      </div>
    </div>
  );
}
