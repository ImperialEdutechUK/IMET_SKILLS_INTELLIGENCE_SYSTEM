"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Target, Award, Sparkles, Bell, Check, ScrollText, Trophy } from "lucide-react";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import HeroRing from "@/components/dashboard/HeroRing";
import StatTile from "@/components/dashboard/StatTile";
import { computeGamification } from "@/lib/gamification";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Rec {
  id: string; courseId: string; title: string; source: string; category: string;
  matchLabel: string; reason: string; cpd_hours: number; rating: number | null; externalUrl: string;
}
interface DashboardData {
  fullName: string;
  cpdHours: number;   // retained: an internal input to XP, not shown as CPD
  completedCount: number; inProgressCount: number; notStartedCount: number;
  gapCount: number;
  topGap: { skill: string; currentLabel: string; requiredLabel: string } | null;
  notifications: { id: string; title: string; body: string }[];
  inProgress: { id: string; title: string; progress: number; status: string; externalUrl: string | null }[];
  topRecs: Rec[];
}

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

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Account not found. Please sign in again.</p></div>;

  const g = computeGamification({ certificates: certCount, coursesCompleted: data.completedCount, cpdHours: data.cpdHours });

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

      {/* HERO — one clear ring: your level and XP at a glance. */}
      <HeroRing
        percent={g.levelPct}
        ringColor="var(--brand)"
        ringLabel={`Level ${g.level}`}
        ringSublabel={`${g.xpIntoLevel}/${g.xpForLevel} XP`}
        title={`Welcome back, ${data.fullName.split(" ")[0]} 👋`}
        subtitle={`${g.title} · ${g.xp} XP · ${g.toNext > 0 && g.next ? `${g.toNext} to ${g.next.emoji} ${g.next.label}` : "all badges earned 🏆"}`}
        metrics={[
          { label: "Certificates", value: String(certCount), color: "#16a34a" },
          { label: "Completed", value: String(data.completedCount), color: "#7c3aed" },
          { label: "Skill gaps", value: String(data.gapCount), color: data.gapCount > 0 ? "#d97706" : "#16a34a" },
        ]}
      >
        <Link href="/me/certificates" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-dark)]">
          <Trophy className="h-3.5 w-3.5" /> Achievements
        </Link>
      </HeroRing>

      {/* WHERE AM I? — four vivid tiles, one fact each. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile index={0} tone="green" icon={ScrollText} href="/me/certificates" label="Certificates earned"
          value={certCount} sub={g.next ? `${g.toNext} to ${g.next.emoji} ${g.next.label}` : "all badges earned 🏆"} />
        <StatTile index={1} tone="sky" icon={BookOpen} href="/me/learning" label="In progress"
          value={data.inProgressCount} sub={data.notStartedCount > 0 ? `${data.notStartedCount} not started` : "keep the streak going"} />
        <StatTile index={2} tone="violet" icon={Award} href="/me/learning" label="Courses completed"
          value={data.completedCount} sub={data.completedCount > 0 ? "nice work" : "add a course to start"} />
        <StatTile index={3} tone="amber" icon={Target} href="/me/skills" label="Skill gaps"
          value={data.gapCount} sub={data.topGap ? `top: ${data.topGap.skill}` : "on target across skills"} />
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
