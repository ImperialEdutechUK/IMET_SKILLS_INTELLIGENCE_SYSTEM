"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, Award, TrendingUp } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnAreaChart from "@/components/charts/LearnAreaChart";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import AttentionList from "@/components/dashboard/AttentionList";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import DepartmentFilter from "@/components/manager/DepartmentFilter";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface DashData {
  fullName: string;
  stats: { teamMembers: number; coursesInProgress: number; coursesCompleted: number; notStarted: number; cpdCompletion: number; avgSkillLevel: number; atRisk: number; attention: number };
  progressOverTime: { label: string; hours: number }[];
  attention: { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "inactive" }[];
  recentActivity: { id: string; user: string; action: string; type: string; time: string }[];
  categoryBreakdown: { name: string; value: number; color: string }[];
}

export default function ManagerDashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const q = dept ? `?departmentId=${dept}` : "";
    const r = await fetch(`${API}/api/manager/dashboard${q}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, [dept]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Welcome back{data ? `, ${data.fullName.split(" ")[0]}` : ""}! 👋</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Here&apos;s what&apos;s happening with your team.</p>
        </div>
        <DepartmentFilter value={dept} onChange={setDept} />
      </div>

      {loading || !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">{loading ? "Loading…" : "Could not load dashboard."}</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Team Members" value={data.stats.teamMembers} sub="Active learners" />
            <StatCard icon={BookOpen} label="Courses in Progress" value={data.stats.coursesInProgress} sub={`${data.stats.coursesCompleted} completed`} />
            <StatCard icon={Award} label="CPD Completion" value={`${data.stats.cpdCompletion}%`} sub="Team average" />
            <StatCard icon={TrendingUp} label="Average Skill Level" value={`${data.stats.avgSkillLevel}%`} sub="Across the team" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-[var(--ink)]">Team Learning Progress</h3>
                <span className="text-xs text-[var(--muted)]">CPD hours · last 8 weeks</span>
              </div>
              <LearnAreaChart data={data.progressOverTime} xKey="label" dataKeys={[{ key: "hours", label: "hours", color: "#2e7d5b" }]} unit="h" height={220} />
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white">
              <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
                <h3 className="font-semibold text-[var(--ink)]">Employees Needing Attention</h3>
                <Link href="/manager/team-cpd" className="text-xs font-medium text-[var(--brand)]">View All</Link>
              </div>
              {data.attention.length === 0 ? (
                <p className="p-5 text-sm text-[var(--muted)]">Everyone is on track. 🎉</p>
              ) : (
                <div className="p-3"><AttentionList items={data.attention} title="" /></div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.recentActivity.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <h3 className="mb-4 font-semibold text-[var(--ink)]">Recent Team Activity</h3>
                <p className="text-sm text-[var(--muted)]">No team activity yet. It appears here as employees enrol, complete courses and log CPD.</p>
              </div>
            ) : (
              <ActivityFeed items={data.recentActivity} title="Recent Team Activity" />
            )}
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">Learning by Category</h3>
              {data.categoryBreakdown.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No enrolments yet.</p>
              ) : (
                <LearnDonutChart data={data.categoryBreakdown} label={`${data.stats.coursesInProgress + data.stats.coursesCompleted}`} sublabel="Courses" height={200} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
