import { Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import BarList from "@/components/charts/BarList";
import { skillsGap } from "@/lib/mock-data";

const teamSkillMatrix = [
  { skill: "Data Analysis", avgLevel: 3.2 },
  { skill: "Leadership", avgLevel: 2.5 },
  { skill: "Project Management", avgLevel: 2.8 },
  { skill: "Communication", avgLevel: 3.8 },
  { skill: "AI Literacy", avgLevel: 1.5 },
];

export default function TeamSkillsPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Team Skills</h1><p className="mt-1 text-sm text-[var(--muted)]">Skill levels and gaps across your team.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Target} label="Skills Tracked" value={5} />
        <StatCard icon={Target} label="Avg Team Level" value="2.8/5" sub="Across all skills" />
        <StatCard icon={Target} iconBg="bg-amber-50" label="Critical Gaps" value={2} delta="Needs attention" deltaPositive={false} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Top Skill Gaps</h3>
          <BarList items={skillsGap.map(s => ({name: s.name, value: s.count, max: 15}))} unit="" />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Team Average Levels</h3>
          <ul className="space-y-4">
            {teamSkillMatrix.map((s) => (
              <li key={s.skill}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-[var(--ink)]">{s.skill}</span><span className="text-[var(--muted)]">{s.avgLevel}/5</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${(s.avgLevel/5)*100}%`}} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
