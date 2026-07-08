import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BookOpen, Target, BarChart3, Sparkles, Bell } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ProgressRing from "@/components/cpd/ProgressRing";
import RecommendationCard from "@/components/dashboard/RecommendationCard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CPD_TARGET_HOURS = 40;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function EmployeeDashboardPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id! },
    include: {
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: true,
      recommendations: {
        where: { dismissed: false },
        orderBy: { matchScore: "desc" },
        include: { course: { include: { category: true } } },
      },
    },
  });

  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">Account not found. Please sign in again.</p>
      </div>
    );
  }

  // Unread notifications: fetch, then mark read so they show only once
  const unreadNotifications = await prisma.notification.findMany({
    where: { userId: user.id, readAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (unreadNotifications.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  const inProgress = user.enrollments.filter((e) => e.status === "in_progress");
  const cpdHours = user.cpdRecords.reduce((sum, r) => sum + r.hours, 0);
  const cpdPercent = Math.min(100, Math.round((cpdHours / CPD_TARGET_HOURS) * 100));
  const skillsImproving = user.userSkills.filter((s) => s.currentLevel < s.targetLevel).length;
  const topRecs = user.recommendations.slice(0, 2);

  const now = new Date();
  const monthBuckets: { month: string; hours: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ month: MONTHS[d.getMonth()], hours: 0 });
  }
  for (const rec of user.cpdRecords) {
    const logged = new Date(rec.loggedAt);
    const monthsAgo = (now.getFullYear() - logged.getFullYear()) * 12 + (now.getMonth() - logged.getMonth());
    if (monthsAgo >= 0 && monthsAgo <= 5) {
      const idx = 5 - monthsAgo;
      monthBuckets[idx].hours += rec.hours;
    }
  }

  return (
    <div>
      {unreadNotifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {unreadNotifications.map((n) => (
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
        <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back, {user.fullName.split(" ")[0]}!</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Let&apos;s continue your learning journey today.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">CPD Progress</p>
          <p className="mt-1 text-3xl font-bold text-[var(--brand)]">{cpdPercent}%</p>
          <div className="mt-3">
            <ProgressRing percentage={cpdPercent} size={80} strokeWidth={7} />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">{cpdHours} / {CPD_TARGET_HOURS} hrs completed</p>
        </div>
        <StatCard icon={BookOpen} label="Courses in Progress" value={inProgress.length} sub="Continue learning →" />
        <StatCard icon={Target} label="Enrolled Courses" value={user.enrollments.length} sub="Total" />
        <StatCard icon={BarChart3} label="Skills Improving" value={skillsImproving} sub="Below target level" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--ink)]">Resume Learning</h3>
            <a href="/me/learning" className="text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-dark)]">View all</a>
          </div>
          {inProgress.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No courses in progress. Browse recommendations to start one.</p>
          ) : (
            <ul className="space-y-4">
              {inProgress.map((enr) => (
                <li key={enr.id} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{enr.course.title}</p>
                      <p className="text-xs text-[var(--brand)]">{enr.progress}% completed</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${enr.progress}%` }} />
                      </div>
                    </div>
                    {enr.course.externalUrl && (
                      <a href={enr.course.externalUrl} target="_blank" rel="noopener noreferrer"
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
          {topRecs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No recommendations yet.</p>
          ) : (
            <div className="space-y-3">
              {topRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  title={rec.course.title}
                  source={rec.course.source}
                  category={rec.course.category?.name ?? "General"}
                  matchLabel={rec.matchLabel}
                  reason={rec.reason}
                  cpd_hours={rec.course.cpdHours}
                  rating={rec.course.rating ?? undefined}
                  externalUrl={rec.course.externalUrl ?? "#"}
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
          data={monthBuckets}
          xKey="month"
          dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]}
          unit="hrs"
          height={180}
        />
      </div>
    </div>
  );
}
