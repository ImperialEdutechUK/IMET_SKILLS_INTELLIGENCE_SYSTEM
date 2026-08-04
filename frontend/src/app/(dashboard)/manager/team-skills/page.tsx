"use client";

import Link from "next/link";
import { Gauge, Star, AlertTriangle, Users, ArrowUpRight, BarChart3 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import ProgressBar from "@/components/ui/ProgressBar";
import BackToReports from "@/components/dashboard/BackToReports";
import { useApi } from "@/lib/api";
import { CardGridSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface SkillOverview { skill: string; avgPercent: number }
interface NeedImprovement { skill: string; membersNeedImprovement: number; avgGapPercent: number }
interface MemberNeed { id: string; fullName: string; position: string | null; avgLevelPercent: number; skills: string[]; priority: string }
interface Data {
  avgTeamLevel: number;
  avgSkillTracked: number;
  avgSkillTotal: number;
  totalMembers: number;
  membersWithTrackedSkills: number;
  strongSkills: number;
  skillsToImprove: number;
  skillOverview: SkillOverview[];
  needImprovement: NeedImprovement[];
  memberNeeds: MemberNeed[];
  definitions: { avgSkillLevel: string };
}

const prioBadge: Record<string, string> = {
  High: "bg-rose-50 text-rose-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
};

const PANEL = "rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

export default function TeamSkillsPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<Data>("/api/manager/team-skills");

  return (
    <div>
      <BackToReports />
      <PageHeader
        icon={Gauge}
        title="Team skills"
        subtitle="Your team's skill levels and where the biggest gaps are."
        meta={<RefreshingBadge show={isRefreshing} />}
      />

      {isLoading ? (
        <CardGridSkeleton />
      ) : !data ? (
        <ErrorPanel message={error?.message ?? "Could not load team skills."} onRetry={refresh} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard icon={Gauge} label="Average skill level" value={`${data.avgTeamLevel}%`} sublabel={`${data.avgSkillTracked} of ${data.avgSkillTotal} members tracked`} definition={data.definitions.avgSkillLevel} />
            <KpiCard icon={Star} label="Strong skills" value={data.strongSkills} sublabel="At a good level" />
            <KpiCard icon={AlertTriangle} label="Skills to improve" value={data.skillsToImprove} sublabel="Have an average gap" />
            <KpiCard icon={Users} label="Members with tracked skills" value={data.membersWithTrackedSkills} sublabel={`of ${data.totalMembers} on the team`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Longer bar = HIGHER current level (better). */}
            <div className={PANEL}>
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--brand)]" />
                <h3 className="font-semibold text-[var(--ink)]">Current skill level</h3>
              </div>
              <p className="mb-4 text-xs text-[var(--muted)]">Longer bar = higher average level across the team.</p>
              {data.skillOverview.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No skills tracked in this view.</p>
              ) : (
                <ul className="space-y-3.5">
                  {data.skillOverview.map((s) => (
                    <li key={s.skill}>
                      <ProgressBar label={s.skill} value={s.avgPercent} tone="brand" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Longer bar = BIGGER gap (worse) — a distinct amber tone + explicit caption
                so a long bar never reads as "good" like the panel on the left. */}
            <div data-tour="mgr-skills-gaps" className={PANEL}>
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-[var(--ink)]">Biggest skill gaps</h3>
              </div>
              <p className="mb-4 text-xs text-[var(--muted)]">Longer bar = bigger average gap to target (needs the most work).</p>
              {data.needImprovement.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No skill gaps in this view.</p>
              ) : (
                <ul className="space-y-3.5">
                  {data.needImprovement.map((s) => (
                    <li key={s.skill}>
                      <ProgressBar
                        label={`${s.skill} · ${s.membersNeedImprovement} member${s.membersNeedImprovement === 1 ? "" : "s"}`}
                        value={s.avgGapPercent}
                        tone="warning"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]">
            <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Users className="h-4.5 w-4.5" /></span>
              <h3 className="font-semibold text-[var(--ink)]">Members who need skill improvement</h3>
            </div>
            {data.memberNeeds.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">Everyone is on target across their tracked skills.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 font-medium">Current average level</th>
                      <th className="px-5 py-3 font-medium">Skills needing improvement</th>
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
                          <div className="w-40"><ProgressBar label={`${m.fullName} average skill level`} value={m.avgLevelPercent} tone="brand" hideLabel /></div>
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
                          <Link href={`/manager/team-learning?member=${m.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand)] hover:underline">
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
