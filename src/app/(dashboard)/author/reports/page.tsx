import LearnAreaChart from "@/components/charts/LearnAreaChart";
import { BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { contentActivityData, authorCourses } from "@/lib/mock-data";

export default function AuthorReportsPage() {
  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">Reports & Analytics</h1><p className="mt-1 text-sm text-[var(--muted)]">Course performance and content analytics.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={BarChart3} label="Total Courses" value={authorCourses.length} />
        <StatCard icon={BarChart3} label="Published" value={authorCourses.filter(c => c.status === "published").length} />
        <StatCard icon={BarChart3} label="Total Enrollments" value={authorCourses.reduce((s,c) => s+c.enrollments, 0)} delta="12% up" deltaPositive />
        <StatCard icon={BarChart3} label="Avg Enrollments" value={Math.round(authorCourses.filter(c=>c.enrollments>0).reduce((s,c) => s+c.enrollments,0)/authorCourses.filter(c=>c.enrollments>0).length)} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h3 className="mb-4 font-semibold text-[var(--ink)]">Content Activity · courses / month</h3>
        <LearnAreaChart data={contentActivityData} xKey="month" dataKeys={[{key:"added",label:"Added",color:"#2e7d5b"},{key:"published",label:"Published",color:"#9fe1cb"}]} unit="" height={200} />
      </div>
    </div>
  );
}
