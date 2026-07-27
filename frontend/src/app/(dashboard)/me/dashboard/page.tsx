"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Target, Award, Sparkles, Bell, ArrowRight, Check } from "lucide-react";
import ProgressRing from "@/components/cpd/ProgressRing";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import AchievementsCard from "@/components/gamification/AchievementsCard";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

type CpdStatus = "complete" | "ahead" | "on_track" | "slightly_behind" | "behind";

interface Rec {
  id: string; courseId: string; title: string; source: string; category: string;
  matchLabel: string; reason: string; cpd_hours: number; rating: number | null; externalUrl: string;
}
interface DashboardData {
  fullName: string;
  cpdHours: number; cpdPercent: number; cpdTarget: number;
  cpdExpected: number; cpdDelta: number; cpdDaysLeft: number; cpdStatus: CpdStatus;
  completedCount: number; inProgressCount: number; notStartedCount: number;
  gapCount: number;
  topGap: { skill: string; currentLabel: string; requiredLabel: string } | null;
  notifications: { id: string; title: string; body: string }[];
  inProgress: { id: string; title: string; progress: number; status: string; externalUrl: string | null }[];
  topRecs: Rec[];
}

// Pace, not raw percentage — an annual target read as a flat % is time-blind.
const PACE: Record<CpdStatus, { text: (d: number) => string; ring: string; chip: string; chipText: string }> = {
  complete:        { text: () => "Annual target met", ring: "var(--brand)", chip: "bg-[var(--brand-tint)]", chipText: "text-[var(--brand-dark)]" },
  ahead:           { text: (d) => `${d} hrs ahead of pace`, ring: "var(--brand)", chip: "bg-[var(--brand-tint)]", chipText: "text-[var(--brand-dark)]" },
  on_track:        { text: () => "On track for the year", ring: "var(--brand)", chip: "bg-[var(--brand-tint)]", chipText: "text-[var(--brand-dark)]" },
  slightly_behind: { text: (d) => `${d} hrs behind pace`, ring: "#f59e0b", chip: "bg-amber-50", chipText: "text-amber-700" },
  behind:          { text: (d) => `${d} hrs behind pace`, ring: "#e11d48", chip: "bg-rose-50", chipText: "text-rose-700" },
};

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [certCount, setCertCount] = useState(0);
  const [enrolled, setEnrolled] = useState<Record<string, boolean>>({});
  const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API}/api/me/dashboard`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    // Same certificate count that drives the Achievements widget elsewhere, so
    // the badge/level shown here matches the Certificates page exactly.
    fetch(`${API}/api/me/certificates`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCertCount(d?.certificates?.length ?? 0))
      .catch(() => {});
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

  const pace = PACE[data.cpdStatus] ?? PACE.on_track;
  const paceText = pace.text(Math.abs(data.cpdDelta));

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

      {/* Gamification — dedicated widget, connected to the same badges/XP the
          Certificates page shows (keeps it visible across the app). */}
      <AchievementsCard certificates={certCount} coursesCompleted={data.completedCount} cpdHours={data.cpdHours} />

      {/* WHERE AM I? — three stats, each stating one fact once:
          the annual CPD target (with pace), the biggest skill gap, and courses finished. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* CPD — the labelled ring is the only place the hours numeral appears. */}
        <Link href="/me/cpd" className="block rounded-2xl border border-[var(--border)] p-5 transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: "#e8f1ed" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-[var(--muted)]">CPD Progress</p>
              <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${pace.chip} ${pace.chipText}`}>{paceText}</span>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{data.cpdDaysLeft} days left this year</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)]">View CPD <ArrowRight className="h-3 w-3" /></span>
            </div>
            <ProgressRing percentage={data.cpdPercent} size={88} strokeWidth={7} color={pace.ring}
              label={String(data.cpdHours)} sublabel={`of ${data.cpdTarget} hrs`} />
          </div>
        </Link>

        {/* Priority skill gap — the product's core answer to "what am I missing?" */}
        <StatCard icon={Target} tone={data.gapCount > 0 ? TONES.amber : TONES.emerald} label="Priority Skill Gap"
          bg="#e3eefb"
          href="/me/skills"
          linkText={data.gapCount > 0 ? "View skill gaps" : "View skills"}
          headline={data.topGap ? data.topGap.skill : "No gaps to close"}
          caption={
            data.topGap
              ? `${data.topGap.currentLabel} → ${data.topGap.requiredLabel}${data.gapCount > 1 ? ` · ${data.gapCount - 1} more to close` : ""}`
              : "You're at target across your skills"
          } />

        {/* Momentum — completed is the number people actually care about. */}
        <StatCard icon={Award} tone={TONES.violet} label="Courses Completed"
          bg="#ece9fb"
          href="/me/learning"
          linkText={data.completedCount > 0 ? "View my learning" : "Browse courses"}
          headline={data.completedCount > 0 ? String(data.completedCount) : "None yet"}
          caption={
            data.inProgressCount > 0
              ? `${data.inProgressCount} in progress`
              : data.completedCount > 0 ? "Nothing in progress right now" : "Add a course to get started"
          } />
      </div>

      {/* WHAT DO I CONTINUE? — one module, in-progress first then queued. */}
      <div className="mb-6 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Icon3D icon={BookOpen} tone={TONES.blue} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Continue Learning</h3></div>
          <Link href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</Link>
        </div>
        {data.inProgress.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No courses yet. Add a recommendation below to get started.</p>
        ) : (
          <ul className="space-y-4">
            {data.inProgress.map((enr) => {
              const notStarted = enr.status === "not_started";
              return (
                <li key={enr.id} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-[var(--ink)]" title={enr.title}>{enr.title}</p>
                    <p className="text-xs text-[var(--brand)]">{notStarted ? "Not started" : enr.progress < 5 ? "Just started" : `${enr.progress}% completed`}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${notStarted ? 0 : Math.max(enr.progress, 2)}%` }} /></div>
                  </div>
                  <Link href="/me/learning" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">{notStarted ? "Start" : "Continue"}</Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* WHAT NEXT? — AI recommendations */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3"><Icon3D icon={Sparkles} tone={TONES.violet} size="sm" /><h3 className="font-semibold text-[var(--ink)]">AI Recommendations</h3></div>
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

// Stat card that leads with a short phrase rather than a bare number, so a zero
// value reads as a call to action instead of an empty slot.
function StatCard({ icon, tone, label, headline, caption, href, linkText, bg = "#ffffff" }: {
  icon: React.ComponentProps<typeof Icon3D>["icon"];
  tone: React.ComponentProps<typeof Icon3D>["tone"];
  label: string; headline: string; caption: string; href: string; linkText: string; bg?: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-[var(--border)] p-5 transition hover:-translate-y-0.5 hover:shadow-md" style={{ background: bg }}>
      <div className="flex items-start gap-3">
        <Icon3D icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-0.5 truncate text-lg font-bold leading-snug text-[var(--ink)]" title={headline}>{headline}</p>
          <p className="text-xs text-[var(--muted)]">{caption}</p>
        </div>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)]">{linkText} <ArrowRight className="h-3 w-3" /></span>
    </Link>
  );
}
