"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Gauge, Star, AlertTriangle, Users, ArrowUpRight } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import BarList from "@/components/charts/BarList";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface SkillOverview { skill: string; avgPercent: number }
interface NeedImprovement { skill: string; membersNeedImprovement: number; avgGapPercent: number }
interface MemberNeed { id: string; fullName: string; position: string | null; avgLevelPercent: number; skills: string[]; priority: string }
interface Data {
  teamMembers: number;
  avgTeamLevel: number;
  strongSkills: number;
  skillsToImprove: number;
  skillOverview: SkillOverview[];
  needImprovement: NeedImprovement[];
  memberNeeds: MemberNeed[];
}

const prioBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
};

export default function TeamSkillsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/manager/team-skills`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Team Skills</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Overview of your team&apos;s skills and areas for improvement.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team skills.</p></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Gauge} label="Average Skill Level" value={`${data.avgTeamLevel}%`} sub="Across your team" />
            <StatCard icon={Star} label="Strong Skills" value={data.strongSkills} sub="At a good level" />
            <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="Skills to Improve" value={data.skillsToImprove} sub="Needs attention" />
            <StatCard icon={Users} label="Team Members" value={data.teamMembers} sub="With tracked skills" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">Skill Level Overview</h3>
              {data.skillOverview.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No skills tracked in this view.</p>
              ) : (
                <BarList items={data.skillOverview.map((s) => ({ name: s.skill, value: s.avgPercent }))} />
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">Skills That Need Improvement</h3>
              {data.needImprovement.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No skill gaps in this view. Nice work!</p>
              ) : (
                <ul className="space-y-4">
                  {data.needImprovement.map((s) => (
                    <li key={s.skill}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-[var(--ink)]">{s.skill}</span>
                        <span className="text-[var(--muted)]">{s.membersNeedImprovement} member{s.membersNeedImprovement === 1 ? "" : "s"}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, s.avgGapPercent)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] p-5">
              <h3 className="font-semibold text-[var(--ink)]">Team Members Who Need Skill Improvement</h3>
            </div>
            {data.memberNeeds.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">Everyone is on target across their tracked skills.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 font-medium">Current Avg Skill Level</th>
                      <th className="px-5 py-3 font-medium">Skills Needing Improvement</th>
                      <th className="px-5 py-3 font-medium">Priority</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.memberNeeds.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <Link href={`/manager/employees/${m.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--brand)]">{m.fullName}</Link>
                          {m.position && <p className="text-xs text-[var(--muted)]">{m.position}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${m.avgLevelPercent}%` }} />
                            </div>
                            <span className="text-xs font-medium text-[var(--muted)]">{m.avgLevelPercent}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {m.skills.map((s) => (
                              <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${prioBadge[m.priority] ?? "bg-slate-100 text-slate-600"}`}>{m.priority}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href="/manager/gaps" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline">
                            View gaps <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
