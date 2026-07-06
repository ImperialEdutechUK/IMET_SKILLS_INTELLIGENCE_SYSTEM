import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, BookOpen, Award, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTeamSummary, getTeamMembers } from "@/lib/team-queries";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import StatCard from "@/components/dashboard/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

const CATEGORY_COLORS = ["#2e7d5b", "#378add", "#7f77dd", "#f59e0b", "#ef4444", "#9ca3af"];

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) notFound();

  const [summary, members, activities] = await Promise.all([
    getTeamSummary(departmentId),
    getTeamMembers(departmentId),
    prisma.activity.findMany({
      where: { user: { departmentId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: true },
    }),
  ]);

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
      <Link
        href="/manager/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All Departments
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{department.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Team learning, skills, and CPD status for this department.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Team Members" value={summary.teamMembers} />
        <StatCard icon={BookOpen} label="Courses in Progress" value={summary.coursesInProgress} />
        <StatCard icon={Award} label="CPD Completion (avg)" value={`${summary.avgCpd}%`} />
        <StatCard icon={BarChart3} label="Average Skill Level" value={`${summary.avgSkillLevel}/5`} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Course Progress</h3>
          <div className="flex gap-6 text-center">
            {[
              { label: "Completed", value: summary.coursesCompleted, color: "text-[var(--brand)]" },
              { label: "In Progress", value: summary.coursesInProgress, color: "text-blue-600" },
              { label: "Not Started Anything", value: summary.notStarted, color: "text-[var(--muted)]" },
            ].map((s) => (
              <div key={s.label}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[var(--muted)]">{s.label}</p>
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
            <ActivityFeed
              items={activities.map((a) => ({
                id: a.id,
                user: a.user.fullName,
                action: a.type,
                time: a.createdAt.toLocaleDateString(),
              }))}
              title="Recent Activity"
            />
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
          <h3 className="font-semibold text-[var(--ink)]">Team Members</h3>
        </div>
        {members.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No employees are assigned to this department yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 p-4">
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
