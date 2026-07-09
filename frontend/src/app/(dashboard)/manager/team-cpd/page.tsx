import { Award } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { mockTeamMembers } from "@/lib/mock-data";

export default function TeamCpdPage() {
  const onTrack = mockTeamMembers.filter(m => m.cpdProgress >= 60).length;
  const atRisk = mockTeamMembers.length - onTrack;
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Team CPD</h1><p className="mt-1 text-sm text-[var(--muted)]">Monitor CPD progress across your team.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Award} label="Team CPD Avg" value="68%" delta="6% vs last month" deltaPositive />
        <StatCard icon={Award} label="On Track" value={onTrack} sub="members" />
        <StatCard icon={Award} iconBg="bg-amber-50" label="At Risk" value={atRisk} delta="Needs attention" deltaPositive={false} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Individual CPD Progress</h3></div>
        <ul className="divide-y divide-[var(--border)]">
          {mockTeamMembers.map((m) => (
            <li key={m.id} className="flex items-center gap-4 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">
                {m.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
              </div>
              <span className={`shrink-0 text-sm font-semibold ${m.cpdProgress >= 60 ? "text-[var(--brand)]" : "text-amber-600"}`}>{m.cpdProgress}%</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${m.cpdProgress >= 60 ? "bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "bg-amber-50 text-amber-700"}`}>{m.cpdProgress >= 60 ? "On Track" : "At Risk"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
