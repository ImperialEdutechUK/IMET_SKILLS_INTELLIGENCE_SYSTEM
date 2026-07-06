import { BookOpen, CheckCircle, BarChart3, Users } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { mockTeamMembers } from "@/lib/mock-data";

export default function TeamLearningPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Team Learning</h1><p className="mt-1 text-sm text-[var(--muted)]">Track your team's learning progress.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Team Members" value={6} />
        <StatCard icon={BookOpen} label="In Progress" value={14} delta="8 this week" deltaPositive />
        <StatCard icon={CheckCircle} label="Completed" value={8} delta="This month" deltaPositive />
        <StatCard icon={BarChart3} label="Avg Completion" value="68%" delta="5% vs last month" deltaPositive />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Team Members</h3></div>
        <ul className="divide-y divide-[var(--border)]">
          {mockTeamMembers.map((m) => (
            <li key={m.id} className="flex items-center gap-4 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">
                {m.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                <p className="text-xs text-[var(--muted)]">{m.department} · {m.coursesCompleted} courses</p>
              </div>
              <div className="w-32">
                <div className="mb-1 flex justify-between text-xs"><span className="text-[var(--muted)]">CPD</span><span className="font-medium">{m.cpdProgress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
