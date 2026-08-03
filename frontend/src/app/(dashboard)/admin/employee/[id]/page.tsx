"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Target, Award, ExternalLink, FileText } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import AchievementsBento from "@/components/gamification/AchievementsBento";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Course {
  id: string;
  title: string;
  provider: string | null;
  category: string | null;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  externalUrl: string | null;
}
interface Gap {
  skill: string;
  required: number;
  current: number;
  gap: number;
  importance: string;
}
interface CertItem { id: string; title: string; issuer: string; issuedDate: string; fileUrl: string | null; certificateUrl: string | null; status: string }
interface EmployeeDetail {
  id: string;
  fullName: string;
  email: string;
  department: string;
  position: string | null;
  roleTitle: string | null;
  cpd: { hours: number; target: number; pct: number; status: "at_risk" | "attention" | null };
  counts: { completed: number; inProgress: number };
  courses: Course[];
  skillGaps: Gap[];
  coursesCompleted: number;
  cpdHours: number;
  certificates: number;
  certificateList: CertItem[];
}

const importanceColor: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  HIGH: "bg-amber-50 text-amber-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  LOW: "bg-slate-100 text-slate-600",
};

export default function AdminEmployeeDetailPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/employee/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load this employee.</p></div>;

  return (
    <div>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-3.5 w-3.5" /> All Users
      </Link>
      <div className="mb-6 flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-sm font-semibold text-[var(--brand-dark)]">{data.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">{data.fullName}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{data.department}{data.position ? ` · ${data.position}` : ""} · {data.email}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={BookOpen} label="Courses Completed" value={data.counts.completed} />
        <StatCard icon={BookOpen} label="Courses In Progress" value={data.counts.inProgress} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Courses */}
        <div className="rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
            <h3 className="font-semibold text-[var(--ink)]">Courses</h3>
          </div>
          {data.courses.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">No enrolled courses.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.courses.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
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

        {/* Skill gaps */}
        <div className="rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
            <h3 className="font-semibold text-[var(--ink)]">Skill Gaps</h3>
            {data.roleTitle && <span className="text-xs text-[var(--muted)]">{data.roleTitle}</span>}
          </div>
          {data.skillGaps.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">{data.position ? "No role profile matched — no skill requirements to compare against." : "No role assigned."}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.skillGaps.map((g) => (
                <li key={g.skill} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{g.skill}</p>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${importanceColor[g.importance] ?? "bg-slate-100 text-slate-600"}`}>{g.importance.toLowerCase()}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Current {g.current} / Required {g.required}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${g.gap > 0 ? "text-amber-600" : "text-[var(--brand)]"}`}>{g.gap > 0 ? `−${g.gap}` : "✓"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Achievements & badges — the same trophy shelf the employee sees. Read-only. */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-3"><Icon3D icon={Award} tone={TONES.violet} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Achievements &amp; Badges</h3></div>
        <AchievementsBento certificates={data.certificates} coursesCompleted={data.coursesCompleted} cpdHours={data.cpdHours} />
      </div>

      {/* Certificates — read-only list with links */}
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Certificates <span className="text-sm font-normal text-[var(--muted)]">({data.certificateList.length})</span></h3></div>
        {data.certificateList.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No certificates yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.certificateList.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Icon3D icon={Award} tone={TONES.violet} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink)]" title={c.title}>{c.title}</p>
                  <p className="text-xs text-[var(--muted)]">{c.issuer}{c.issuedDate ? ` · ${c.issuedDate}` : ""}</p>
                </div>
                <CertStatusBadge status={c.status} />
                {c.fileUrl && (
                  <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> View
                  </a>
                )}
                {c.certificateUrl && (
                  <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" /> Verify
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CertStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-700",
  };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}
