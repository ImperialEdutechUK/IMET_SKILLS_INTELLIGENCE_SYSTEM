import { Target, Plus } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { mySkills, CATEGORIES, skillsGap } from "@/lib/mock-data";

export default function SkillsManagementPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">Skills Management</h1><p className="mt-1 text-sm text-[var(--muted)]">Manage skills and track gaps across the organisation.</p></div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><Plus className="h-4 w-4" /> Add Skill</button>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Total Skills" value={mySkills.length} />
        <StatCard icon={Target} label="Categories" value={CATEGORIES.length} />
        <StatCard icon={Target} iconBg="bg-amber-50" label="Critical Gaps" value={skillsGap.length} delta="Needs courses" deltaPositive={false} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Skill Gaps</h3>
          <ul className="space-y-3">
            {skillsGap.map((s) => (
              <li key={s.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
                <span className="text-sm text-[var(--ink)]">{s.name}</span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">{s.count} employees</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">All Skills</h3>
          <ul className="space-y-2">
            {mySkills.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-sm text-[var(--ink)]">{s.name}</span>
                <span className="text-xs text-[var(--muted)]">{s.category}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
