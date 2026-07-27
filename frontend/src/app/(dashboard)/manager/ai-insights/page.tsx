"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Sparkles, AlertTriangle, TrendingUp, Target, GraduationCap, CheckCircle2, ChevronRight } from "lucide-react";
import Stat3D from "@/components/dashboard/Stat3D";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import Dropdown from "@/components/dashboard/Dropdown";
import ProgressRing from "@/components/cpd/ProgressRing";
import AttentionList from "@/components/dashboard/AttentionList";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Stats {
  topPriority: number;
  recommendedTrainings: number;
  skillGapsIdentified: number;
  learningTrend: "Positive" | "Steady" | "Needs Focus";
  engagementScore: number;
}
interface SkillGapRow { skill: string; gapLevel: "High" | "Medium" | "Low"; membersAffected: number }
interface AttentionMember { id: string; fullName: string; reason: string; status: "at_risk" | "attention" | "inactive" }
interface Data {
  employeeCount: number;
  stats: Stats;
  teamHealth: { score: number; label: string; points: string[] };
  topSkillGaps: SkillGapRow[];
  membersNeedingAttention: AttentionMember[];
  aiSummary: string[];
}

const gapBadge: Record<string, string> = {
  High: "bg-red-50 text-red-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
};
const gapBar: Record<string, { color: string; width: string }> = {
  High: { color: "bg-red-500", width: "100%" },
  Medium: { color: "bg-amber-500", width: "66%" },
  Low: { color: "bg-[var(--brand)]", width: "33%" },
};

export default function AiInsightsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [gapFilter, setGapFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/manager/ai-insights`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasData = data && (data.topSkillGaps.length > 0 || data.membersNeedingAttention.length > 0 || data.stats.skillGapsIdentified > 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={Sparkles} tone={TONES.violet} />
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">AI Insights</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">AI-powered insights and recommendations to help your team learn and grow.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load insights.</p></div>
      ) : !hasData ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Not enough data yet — insights appear once skill gaps are analysed.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Stat3D icon={AlertTriangle} tone={TONES.rose} label="Top Priority" value={data.stats.topPriority} sub="Members need improvement" href="/manager/gaps" />
            <Stat3D icon={GraduationCap} tone={TONES.blue} label="Recommended Trainings" value={data.stats.recommendedTrainings} href="/manager/team-learning" />
            <Stat3D icon={Target} tone={TONES.amber} label="Skill Gaps Identified" value={data.stats.skillGapsIdentified} href="/manager/gaps" />
            <Stat3D icon={TrendingUp} tone={TONES.emerald} label="Learning Trend" value={data.stats.learningTrend} sub="Team momentum" href="/manager/team-learning" />
            <Stat3D icon={Sparkles} tone={TONES.violet} label="Engagement Score" value={`${data.stats.engagementScore}%`} href="/manager/team-cpd" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="mb-4 flex items-center gap-3"><Icon3D icon={TrendingUp} tone={TONES.emerald} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Team Learning Health</h3></div>
              <div className="flex flex-col items-center">
                <ProgressRing percentage={data.teamHealth.score} label={`${data.teamHealth.score}%`} sublabel={data.teamHealth.label} />
              </div>
              <ul className="mt-5 space-y-2.5">
                {data.teamHealth.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-[var(--ink)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" /> {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
              <div className="mb-1 flex items-center gap-3">
                <Icon3D icon={Target} tone={TONES.amber} size="sm" />
                <h3 className="flex-1 font-semibold text-[var(--ink)]">Top Skill Gaps</h3>
                <Dropdown
                  value={gapFilter}
                  onChange={setGapFilter}
                  options={[
                    { value: "all", label: "All levels" },
                    { value: "High", label: "High" },
                    { value: "Medium", label: "Medium" },
                    { value: "Low", label: "Low" },
                  ]}
                />
              </div>
              <p className="mb-4 ml-[52px] text-xs text-[var(--muted)]">Skills where the most team members need to improve. Click one to view the gap breakdown.</p>
              {(() => {
                const gaps = gapFilter === "all" ? data.topSkillGaps : data.topSkillGaps.filter((s) => s.gapLevel === gapFilter);
                if (gaps.length === 0) return <p className="text-sm text-[var(--muted)]">No skill gaps at this level.</p>;
                return (
                  <ul className="space-y-2">
                    {gaps.map((s) => (
                      <li key={s.skill}>
                        <Link href="/manager/gaps" className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-[var(--ink)]">{s.skill}</span>
                              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${gapBadge[s.gapLevel]}`}>{s.gapLevel}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${gapBar[s.gapLevel].color}`} style={{ width: gapBar[s.gapLevel].width }} />
                            </div>
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs text-[var(--muted)]">{s.membersAffected} {s.membersAffected === 1 ? "member" : "members"}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {data.membersNeedingAttention.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                <div className="mb-4 flex items-center gap-3"><Icon3D icon={AlertTriangle} tone={TONES.rose} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Members Who Need Attention</h3></div>
                <p className="text-sm text-[var(--muted)]">No members need attention right now.</p>
              </div>
            ) : (
              <AttentionList items={data.membersNeedingAttention} title="Members Who Need Attention" viewAllHref="/manager/team-cpd" />
            )}

            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <Icon3D icon={Sparkles} tone={TONES.violet} size="sm" />
                <h3 className="font-semibold text-[var(--ink)]">AI Summary</h3>
              </div>
              {data.aiSummary.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No summary available yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.aiSummary.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
                        <Sparkles className="h-3 w-3" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
