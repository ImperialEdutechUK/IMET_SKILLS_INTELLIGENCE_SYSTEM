"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Target, Award, BookOpen, ScrollText, TrendingUp } from "lucide-react";
import ProgressRing from "@/components/cpd/ProgressRing";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;
const LEVELS = ["None", "Basic", "Intermediate", "Advanced", "Expert"];

interface Skill { name: string; current: number; target: number; gap: number }
interface Course { id: string; title: string; category: string; progress: number; cpdHours: number }
interface Activity { id: string; title: string; type: string; hours: number; date: string }
interface EmpData {
  id: string; fullName: string; email: string; position: string; department: string;
  avgSkillPercent: number;
  cpd: { hours: number; target: number; progress: number; status: string | null };
  skills: Skill[]; gapsCount: number;
  courseCounts: { inProgress: number; completed: number; notStarted: number };
  courses: { inProgress: Course[]; completed: Course[]; notStarted: Course[] };
  certificates: number; recentActivities: Activity[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700" },
  attention: { label: "Needs attention", cls: "bg-amber-50 text-amber-700" },
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700" },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EmpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/manager/employees/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => { if (r.status === 404 || r.status === 403) { setNotFound(true); return null; } return r.ok ? r.json() : null; })
      .then((d) => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (notFound) return (
    <div>
      <BackLink />
      <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">This employee isn&apos;t in your department, or doesn&apos;t exist.</p></div>
    </div>
  );
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load this employee.</p></div>;

  const status = data.cpd.status ?? "on_track";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.on_track;
  const topSkills = data.skills.slice(0, 8);

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-lg font-bold text-[var(--brand-dark)]">
            {data.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">{data.fullName}</h1>
            <p className="text-sm text-[var(--muted)]">{data.position} · {data.department}</p>
            <p className="text-xs text-[var(--muted)]">{data.email}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={TrendingUp} tint="bg-amber-50 text-amber-600" label="Avg Skill Level" value={`${data.avgSkillPercent}%`} sub={`${data.gapsCount} gap${data.gapsCount === 1 ? "" : "s"} to close`} />
        <Tile icon={Award} tint="bg-[var(--brand-tint)] text-[var(--brand-dark)]" label="CPD Progress" value={`${data.cpd.progress}%`} sub={`${data.cpd.hours} / ${data.cpd.target} hrs`} />
        <Tile icon={BookOpen} tint="bg-blue-50 text-blue-600" label="Courses" value={data.courseCounts.completed} sub={`${data.courseCounts.inProgress} in progress`} />
        <Tile icon={ScrollText} tint="bg-purple-50 text-purple-600" label="Certificates" value={data.certificates} sub="Earned" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Skills & gaps — bar per skill (current vs target) */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Skills & Gaps</h3></div>
          {topSkills.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No skills recorded yet.</p>
          ) : (
            <ul className="space-y-3.5">
              {topSkills.map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--ink)]">{s.name}</span>
                    <span className="text-[var(--muted)]">{LEVELS[s.current]} → {LEVELS[s.target]}{s.gap > 0 ? <span className="ml-1 font-semibold text-amber-600">(gap {s.gap})</span> : <span className="ml-1 font-semibold text-emerald-600">✓</span>}</span>
                  </div>
                  {/* track shows target (light), fill shows current */}
                  <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${(s.target / 4) * 100}%` }} />
                    <div className={`absolute inset-y-0 left-0 rounded-full ${s.gap > 0 ? "bg-[var(--brand)]" : "bg-emerald-500"}`} style={{ width: `${(s.current / 4) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CPD ring + recent activity */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Progress</h3>
            <div className="flex items-center gap-4">
              <ProgressRing percentage={data.cpd.progress} size={84} strokeWidth={8} />
              <div>
                <p className="text-lg font-bold text-[var(--ink)]">{data.cpd.hours} <span className="text-sm font-medium text-[var(--muted)]">/ {data.cpd.target} hrs</span></p>
                <p className="text-xs text-[var(--muted)]">{Math.max(0, Math.round((data.cpd.target - data.cpd.hours) * 10) / 10)} hrs to go</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-3 font-semibold text-[var(--ink)]">Recent Activity</h3>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No CPD activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentActivities.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{a.title}</span>
                    <span className="shrink-0 text-[var(--muted)]">{a.date}</span>
                    <span className="w-10 shrink-0 text-right font-semibold text-[var(--brand)]">{a.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Courses */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CourseList title="In Progress" courses={data.courses.inProgress} showProgress />
        <CourseList title="Completed" courses={data.courses.completed} />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/manager/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
      <ArrowLeft className="h-4 w-4" /> Back to team dashboard
    </Link>
  );
}

function Tile({ icon: Icon, tint, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; tint: string; label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tint}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-[var(--ink)]">{value}</p>
          <p className="text-xs text-[var(--muted)]">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function CourseList({ title, courses, showProgress }: { title: string; courses: Course[]; showProgress?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">{title} <span className="text-sm font-normal text-[var(--muted)]">({courses.length})</span></h3></div>
      {courses.length === 0 ? (
        <p className="p-5 text-sm text-[var(--muted)]">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--ink)]" title={c.title}>{c.title}</p>
                <p className="text-xs text-[var(--muted)]">{c.category}</p>
              </div>
              {showProgress ? (
                <span className="shrink-0 text-xs font-semibold text-[var(--brand)]">{c.progress}%</span>
              ) : (
                <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-dark)]">+{c.cpdHours} CPD</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
