"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, TrendingUp, CheckCircle2, AlertTriangle, BookOpen } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface BehindMember {
  id: string;
  fullName: string;
  position: string | null;
  cpdHours: number;
  cpdProgress: number;
  gapHours: number;
  status: "at_risk" | "attention" | null;
}
interface Submission { id: string; member: string; activity: string; hours: number; date: string; }
interface Segment { name: string; value: number; color: string; }
interface TeamCpdData {
  totalCpdHours: number;
  avgPerMember: number;
  onTrack: number;
  atRisk: number;
  attention: number;
  targetSummary: Segment[];
  totalMembers: number;
  behindTarget: BehindMember[];
  recentSubmissions: Submission[];
}

export default function TeamCpdPage() {
  const [data, setData] = useState<TeamCpdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/manager/team-cpd`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendAlerts() {
    setNotifying(true); setNotifyMsg(null);
    try {
      const r = await fetch(`${API}/api/cpd/notify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      let msg = `Scanned ${d.scanned} · ${d.atRisk} at risk · notified ${d.employeesNotified} employee(s), ${d.managersNotified} manager(s).`;
      if (d.atRiskWithoutManager > 0) msg += ` ${d.atRiskWithoutManager} at-risk employee(s) had no manager linked.`;
      setNotifyMsg(msg);
    } catch { setNotifyMsg("Could not send CPD alerts."); }
    finally { setNotifying(false); }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Team CPD</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track and manage your team&apos;s CPD progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sendAlerts} disabled={notifying}
            className="shrink-0 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
            {notifying ? "Sending…" : "Send CPD alerts"}
          </button>
        </div>
      </div>
      {notifyMsg && <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--brand-tint)] px-4 py-2.5 text-sm text-[var(--brand-dark)]">{notifyMsg}</div>}

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>
      ) : !data ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load team CPD.</p></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Clock} label="Total CPD Hours" value={`${data.totalCpdHours}`} sub="Logged across team" />
            <StatCard icon={TrendingUp} label="Average CPD / Member" value={`${data.avgPerMember}`} sub="Hours per member" />
            <StatCard icon={CheckCircle2} label="Members On Track" value={data.onTrack} sub={`of ${data.totalMembers} members`} />
            <StatCard icon={AlertTriangle} iconBg="bg-amber-50" label="Members Behind Target" value={data.atRisk + data.attention} sub="Need attention" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Members Behind Target */}
            <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white">
              <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Members Behind Target</h3></div>
              {data.behindTarget.length === 0 ? (
                <p className="p-5 text-sm text-[var(--muted)]">Everyone is on track. No members behind target.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.behindTarget.map((m) => (
                    <li key={m.id} className="flex items-center gap-4 p-4">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">
                        {m.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{m.position ?? "—"}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${m.status === "at_risk" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${m.cpdProgress}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${m.status === "at_risk" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {m.status === "at_risk" ? "At Risk" : "Attention"}
                        </span>
                        <p className="mt-1 text-xs text-[var(--muted)]">{m.gapHours}h to target</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* CPD Target Summary donut */}
            <div className="rounded-xl border border-[var(--border)] bg-white p-5">
              <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Target Summary</h3>
              {data.totalMembers === 0 ? (
                <p className="text-sm text-[var(--muted)]">No members in this view.</p>
              ) : (
                <LearnDonutChart data={data.targetSummary} label={`${data.totalMembers}`} sublabel="Members" height={160} />
              )}
            </div>
          </div>

          {/* Recent CPD Submissions */}
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Recent CPD Submissions</h3></div>
            {data.recentSubmissions.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">No CPD submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Member</th>
                      <th className="px-5 py-3 font-medium">Activity</th>
                      <th className="px-5 py-3 font-medium text-right">Hours</th>
                      <th className="px-5 py-3 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.recentSubmissions.map((s) => (
                      <tr key={s.id}>
                        <td className="px-5 py-3 font-medium text-[var(--ink)]">{s.member}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 text-[var(--ink)]">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-3.5 w-3.5" /></span>
                            {s.activity}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[var(--brand)]">{s.hours}h</td>
                        <td className="px-5 py-3 text-right text-[var(--muted)]">{s.date}</td>
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
