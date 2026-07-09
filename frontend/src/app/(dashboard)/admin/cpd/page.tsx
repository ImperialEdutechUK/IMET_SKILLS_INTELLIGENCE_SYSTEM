import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { Award } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { cpdComplianceData, departmentPerformance, DEPARTMENTS } from "@/lib/mock-data";

export default function CpdManagementPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">CPD Management</h1><p className="mt-1 text-sm text-[var(--muted)]">Set and monitor CPD targets across the organisation.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Award} label="Overall Rate" value="78%" delta="9.1% up" deltaPositive />
        <StatCard icon={Award} label="On Track" value={972} delta="78%" deltaPositive />
        <StatCard icon={Award} iconBg="bg-amber-50" label="At Risk" value={198} delta="16%" deltaPositive={false} />
        <StatCard icon={Award} label="Annual Target" value="40 hrs" sub="Per employee" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Compliance Overview</h3>
          <LearnDonutChart data={cpdComplianceData} label="78%" sublabel="Overall" height={160} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Targets by Department</h3>
          <ul className="space-y-3">
            {DEPARTMENTS.map((dept, i) => (
              <li key={dept} className="flex items-center justify-between">
                <span className="text-sm text-[var(--ink)]">{dept}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--ink)]">{departmentPerformance[i]?.value ?? 70}%</span>
                  <div className="w-24 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${departmentPerformance[i]?.value ?? 70}%`}} /></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
