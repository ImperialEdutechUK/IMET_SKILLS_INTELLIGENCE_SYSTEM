import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import BarList from "@/components/charts/BarList";
import { learningActivityData, departmentPerformance } from "@/lib/mock-data";

export default function AdminReportsPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Reports & Analytics</h1><p className="mt-1 text-sm text-[var(--muted)]">Organisation-wide learning analytics.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BarChart3} label="Total Employees" value="1,248" delta="8.5% up" deltaPositive />
        <StatCard icon={BarChart3} label="CPD Rate" value="78%" delta="9.1% up" deltaPositive />
        <StatCard icon={BarChart3} label="Completions" value={542} delta="This month" deltaPositive />
        <StatCard icon={BarChart3} label="Certificates" value={542} delta="7.2% up" deltaPositive />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning Activity · completions</h3>
          <LearnAreaChart data={learningActivityData} xKey="month" dataKeys={[{key:"completions",label:"completions",color:"#2e7d5b"}]} unit="" height={200} />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-5">
          <h3 className="mb-4 font-semibold text-[var(--ink)]">Department Performance</h3>
          <BarList items={departmentPerformance} unit="%" />
        </div>
      </div>
    </div>
  );
}
