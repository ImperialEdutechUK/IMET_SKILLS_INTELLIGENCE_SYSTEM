import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BarChart3, Award, BookOpen, Target } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";

const myLearningOverTime = [
  { month: "Jan", hours: 4 }, { month: "Feb", hours: 6 }, { month: "Mar", hours: 5 },
  { month: "Apr", hours: 8 }, { month: "May", hours: 7 }, { month: "Jun", hours: 9 },
];

export default function MyReportsPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">My Reports</h1><p className="mt-1 text-sm text-[var(--muted)]">Your personal learning analytics.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="Completed" value={5} delta="This year" deltaPositive />
        <StatCard icon={Award} label="CPD Hours" value={24} sub="of 40 target" />
        <StatCard icon={Target} label="Skills Updated" value={3} delta="This month" deltaPositive />
        <StatCard icon={BarChart3} label="Certificates" value={3} delta="This year" deltaPositive />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning Hours Over Time</h3>
        <LearnAreaChart data={myLearningOverTime} xKey="month" dataKeys={[{key:"hours",label:"hours",color:"#2e7d5b"}]} unit="hrs" height={200} />
      </div>
    </div>
  );
}
