"use client";

import { useEffect, useState } from "react";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BookOpen, Target, BarChart3, Sparkles, Bell } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ProgressRing from "@/components/cpd/ProgressRing";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import { getToken } from "@/lib/authClient";

interface DashboardData {
  fullName: string;
  cpdHours: number;
  cpdPercent: number;
  cpdTarget: number;
  enrolledCount: number;
  skillsImproving: number;
  notifications: { id: string; title: string; body: string }[];
  inProgress: { id: string; title: string; progress: number; externalUrl: string | null }[];
  topRecs: {
    id: string; title: string; source: string; category: string;
    matchLabel: string; reason: string; cpd_hours: number; rating: number | null; externalUrl: string;
  }[];
  monthBuckets: { month: string; hours: number }[];
}

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/dashboard`, {
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
        <p className="text-sm text-[var(--muted)]">Account not found. Please sign in again.</p>
      </div>
    );
  }

  return (
    <div>
      {data.notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-tint)] p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-white">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{n.title}</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {data.fullName.split(" ")[0]}!</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Let&apos;s continue your learning journey today.</p>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">CPD Progress</p>
          <p className="mt-1 text-3xl font-bold text-[var(--brand)]">{data.cpdPercent}%</p>
          <div className="mt-3">
            <ProgressRing percentage={data.cpdPercent} size={80} strokeWidth={7} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">{data.cpdHours} / {data.cpdTarget} hrs completed</p>
        </div>
        <StatCard icon={BookOpen} label="Courses in Progress" value={data.inProgress.length} sub="Continue learning →" />
        <StatCard icon={Target} label="Enrolled Courses" value={data.enrolledCount} sub="Total" />
        <StatCard icon={BarChart3} label="Skills Improving" value={data.skillsImproving} sub="Below target level" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Resume Learning</h3>
            <a href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</a>
          </div>
          {data.inProgress.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No courses in progress. Browse recommendations to start one.</p>
          ) : (
            <ul className="space-y-4">
              {data.inProgress.map((enr) => (
                <li key={enr.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{enr.title}</p>
                      <p className="text-xs text-[var(--brand)]">{enr.progress}% completed</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${enr.progress}%` }} />
                      </div>
                    </div>
                    {enr.externalUrl && (
                      <a href={enr.externalUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-[var(--brand)] px-3 py-1.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-tint)]">
                        Continue
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--brand)]" />
              <h3 className="font-semibold text-[var(--ink)]">AI Recommended for You</h3>
            </div>
            <a href="/me/recommendations" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</a>
          </div>
          {data.topRecs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
          ) : (
            <div className="space-y-3">
              {data.topRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  title={rec.title}
                  source={rec.source}
                  category={rec.category}
                  matchLabel={rec.matchLabel}
                  reason={rec.reason}
                  cpd_hours={rec.cpd_hours}
                  rating={rec.rating ?? undefined}
                  externalUrl={rec.externalUrl}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)]">My Learning Activity</h3>
          <span className="text-xs text-[var(--muted)]">CPD hours, last 6 months</span>
        </div>
        <LearnAreaChart
          data={data.monthBuckets}
          xKey="month"
          dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]}
          unit="hrs"
          height={180}
        />
      </div>
    </div>
  );
}
