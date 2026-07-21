import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { teamLearningData } from "@/lib/mock-data";

export default function ManagerReportsPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Reports</h1><p className="mt-1 text-sm text-[var(--muted)]">Performance analytics.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={BarChart3} label="CPD Avg" value="68%" delta="6% up" deltaPositive />
        <StatCard icon={BarChart3} label="Completions" value={156} delta="This month" deltaPositive />
        <StatCard icon={BarChart3} label="Avg Skill Level" value="3.2/5" delta="Up from 2.9" deltaPositive />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning Progress</h3>
        <LearnAreaChart data={teamLearningData} xKey="date" dataKeys={[{key:"progress",label:"progress",color:"#2e7d5b"}]} unit="%" height={200} />
      </div>
    </div>
  );
}
