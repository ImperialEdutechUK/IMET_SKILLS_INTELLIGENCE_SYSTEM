"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Map, TrendingUp, Sparkles, Bell, CalendarClock, ArrowRight, Check } from "lucide-react";
import ProgressRing from "@/components/cpd/ProgressRing";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Rec {
  id: string; courseId: string; title: string; source: string; category: string;
  matchLabel: string; reason: string; cpd_hours: number; rating: number | null; externalUrl: string;
}
interface DashboardData {
  fullName: string;
  cpdHours: number; cpdPercent: number; cpdTarget: number;
  enrolledCount: number; learningPathsInProgress: number; skillsImproving: number;
  notifications: { id: string; title: string; body: string }[];
  inProgress: { id: string; title: string; progress: number; externalUrl: string | null }[];
  topRecs: Rec[];
}

function daysToYearEnd(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), 11, 31);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API}/api/me/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const enrol = async (courseId: string) => {
    setEnrolling((s) => ({ ...s, [courseId]: true }));
    try {
      const r = await fetch(`${API}/api/me/enrollments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (r.ok) setEnrolled((s) => ({ ...s, [courseId]: true }));
    } catch { /* ignore */ }
    setEnrolling((s) => ({ ...s, [courseId]: false }));
  };

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Account not found. Please sign in again.</p></div>;

  const yearDays = daysToYearEnd();
  const cpdRemaining = Math.max(0, Math.round((data.cpdTarget - data.cpdHours) * 10) / 10);

  return (
    <div>
      {data.notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-tint)] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white"><Bell className="h-4 w-4" /></span>
              <div><p className="text-sm font-semibold text-[var(--ink)]">{n.title}</p><p className="mt-0.5 text-sm text-[var(--muted)]">{n.body}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {data.fullName.split(" ")[0]}! <span aria-hidden="true">👋</span></h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Let&apos;s continue your learning journey today.</p>
      </div>

      {/* Where am I? — CPD status carries one numeral (in the ring), plus two tiles.
          Zero-value cards become a call to action rather than a bare "0". */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--muted)]">CPD Progress</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{data.cpdHours} / {data.cpdTarget} hrs · {cpdRemaining} to go</p>
              <Link href="/me/cpd" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View CPD <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <ProgressRing percentage={data.cpdPercent} size={72} strokeWidth={7} />
          </div>
        </div>

        {data.learningPathsInProgress > 0 ? (
          <DashTile icon={Map} iconClass="bg-purple-50 text-purple-600" label="Learning Path"
            value={data.learningPathsInProgress} caption="In Progress" href="/me/learning?tab=paths" linkText="View path" />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600"><Map className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-sm text-[var(--muted)]">Learning Paths</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--ink)]">Explore structured routes</p>
              </div>
            </div>
            <Link href="/me/learning?tab=paths" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">Explore paths <ArrowRight className="h-3 w-3" /></Link>
          </div>
        )}

        <DashTile icon={TrendingUp} iconClass="bg-amber-50 text-amber-600" label="Skills Improving"
          value={data.skillsImproving} caption="Skills in progress" href="/me/skills" linkText="View skills" />
      </div>

      {/* What do I continue? — one module merging resume-learning + the CPD deadline */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)]">Continue Learning</h3>
          <Link href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
        </div>
        {data.inProgress.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No courses in progress. Enrol in a recommendation below to get started.</p>
        ) : (
          <ul className="space-y-4">
            {data.inProgress.map((enr) => (
              <li key={enr.id} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={enr.title}>{enr.title}</p>
                  <p className="text-xs text-[var(--brand)]">{enr.progress < 5 ? "Just started" : `${enr.progress}% completed`}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(enr.progress, 2)}%` }} /></div>
                </div>
                <Link href="/me/learning" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">Continue</Link>
              </li>
            ))}
          </ul>
        )}
        {/* CPD deadline context, shown once */}
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><CalendarClock className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--ink)]">CPD target</p>
            <p className="text-xs text-[var(--muted)]">{data.cpdTarget} hrs annually · {data.cpdHours}/{data.cpdTarget} done</p>
          </div>
          <span className={`shrink-0 text-xs font-semibold ${yearDays < 45 ? "text-red-600" : "text-amber-600"}`}>{yearDays} days left</span>
        </div>
      </div>

      {/* AI Recommended */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">AI Recommendations</h3></div>
          <Link href="/me/recommendations" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
        </div>
        {data.topRecs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.topRecs.map((rec) => {
              const isEnrolled = enrolled[rec.courseId];
              return (
                <li key={rec.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600"><Sparkles className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={rec.title}>{rec.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-[var(--muted)]">{rec.category} · {rec.cpd_hours} CPD hrs</p>
                      <span className="rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-dark)]">{rec.matchLabel} match</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => enrol(rec.courseId)} disabled={isEnrolled || enrolling[rec.courseId]}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isEnrolled ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"} disabled:opacity-70`}>
                      {isEnrolled ? <><Check className="h-3.5 w-3.5" /> Added</> : enrolling[rec.courseId] ? "Adding…" : "Add to My Learning"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DashTile({ icon: Icon, iconClass, label, value, caption, href, linkText }: {
  icon: React.ComponentType<{ className?: string }>; iconClass: string; label: string; value: number; caption: string; href: string; linkText: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconClass}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-[var(--ink)]">{value}</p>
          <p className="text-xs text-[var(--muted)]">{caption}</p>
        </div>
      </div>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">{linkText} <ArrowRight className="h-3 w-3" /></Link>
    </div>
  );
}
