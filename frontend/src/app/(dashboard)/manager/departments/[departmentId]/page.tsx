"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Users, BookOpen, Award, BarChart3, ChevronDown } from "lucide-react";
import { getToken } from "@/lib/authClient";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import StatCard from "@/components/dashboard/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

const CATEGORY_COLORS = ["#2e7d5b", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#64748b"];

interface MemberCourse {
  id: string;
  title: string;
  provider: string | null;
  category: string | null;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  externalUrl: string | null;
}
interface Member {
  id: string;
  fullName: string;
  coursesCompleted: number;
  coursesInProgress: number;
  cpdProgress: number;
  attentionStatus: "at_risk" | "attention" | null;
  courses: MemberCourse[];
}
interface Summary {
  teamMembers: number;
  coursesInProgress: number;
  coursesCompleted: number;
  notStarted: number;
  avgCpd: number;
  avgSkillLevel: number;
  categoryBreakdown: { name: string; value: number }[];
}
interface DeptData {
  department: { id: string; name: string };
  summary: Summary;
  members: Member[];
  activities: { id: string; user: string; action: string; time: string }[];
}

export default function DepartmentDetailPage() {
  const params = useParams();
  const departmentId = params.departmentId as string;
  const [data, setData] = useState<DeptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/departments/${departmentId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [departmentId]);

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
        <p className="text-sm text-[var(--muted)]">Department not found.</p>
      </div>
    );
  }

  const { department, summary, members, activities } = data;
  const attentionItems = members
    .filter((m) => m.attentionStatus)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      reason: `CPD progress at ${m.cpdProgress}%`,
      status: m.attentionStatus as "at_risk" | "attention",
    }));
  const categoryData = summary.categoryBreakdown.map((c, i) => ({
    ...c,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));
  const totalEnrollments = summary.coursesInProgress + summary.coursesCompleted;

  return (
    <div>
      <Link href="/manager/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-3.5 w-3.5" /> All Departments
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{department.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Learning, skills, and CPD status for this department.</p>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Members" value={summary.teamMembers} />
        <StatCard icon={BookOpen} label="Courses in Progress" value={summary.coursesInProgress} />
        <StatCard icon={Award} label="CPD Completion (avg)" value={`${summary.avgCpd}%`} />
        <StatCard icon={BarChart3} label="Average Skill Level" value={`${summary.avgSkillLevel}/5`} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Course Progress</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Completed", value: summary.coursesCompleted, color: "text-[var(--brand)]" },
              { label: "In Progress", value: summary.coursesInProgress, color: "text-blue-600" },
              { label: "Not Started", value: summary.notStarted, color: "text-[var(--muted)]" },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        {attentionItems.length > 0 ? (
          <AttentionList items={attentionItems} />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-2 font-semibold text-[var(--ink)]">Employees Needing Attention</h3>
            <p className="text-sm text-[var(--muted)]">Nobody is currently below target.</p>
          </div>
        )}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white p-5">
          {activities.length > 0 ? (
            <ActivityFeed items={activities} title="Recent Activity" />
          ) : (
            <>
              <h3 className="mb-2 font-semibold text-[var(--ink)]">Recent Activity</h3>
              <p className="text-sm text-[var(--muted)]">No activity has been logged yet.</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning by Category</h3>
          {categoryData.length > 0 ? (
            <LearnDonutChart data={categoryData} label={String(totalEnrollments)} sublabel="Enrollments" height={140} />
          ) : (
            <p className="text-sm text-[var(--muted)]">No enrollments yet to categorize.</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5">
          <h3 className="font-semibold text-[var(--ink)]">Members</h3>
        </div>
        {members.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No employees are assigned to this department yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map((m) => {
              const expanded = expandedId === m.id;
              const hasCourses = m.courses.length > 0;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : m.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">
                      {m.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                      <p className="text-xs text-[var(--muted)]">{m.coursesCompleted} completed · {m.coursesInProgress} in progress</p>
                    </div>
                    <div className="w-32">
                      <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--muted)]">CPD</span><span className="font-medium">{m.cpdProgress}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${m.cpdProgress}%` }} /></div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="border-t border-[var(--border)] bg-slate-50/60 px-4 py-3 pl-16">
                      {!hasCourses ? (
                        <p className="text-xs text-[var(--muted)]">No enrolled courses yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {m.courses.map((c) => (
                            <li key={c.id} className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                {c.externalUrl ? (
                                  <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--ink)] hover:text-[var(--brand)] hover:underline">{c.title}</a>
                                ) : (
                                  <p className="text-sm font-medium text-[var(--ink)]">{c.title}</p>
                                )}
                                <p className="text-xs text-[var(--muted)]">{c.provider ?? "—"}{c.category ? ` · ${c.category}` : ""}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === "completed" ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : c.status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-[var(--muted)]"}`}>
                                {c.status === "completed" ? "Completed" : c.status === "in_progress" ? `In progress · ${c.progress}%` : "Not started"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
