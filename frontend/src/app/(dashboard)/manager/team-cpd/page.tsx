"use client";

import { useEffect, useState, useCallback } from "react";
import { Award } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

interface Member { id: string; fullName: string; cpdProgress: number; status: "at_risk" | "attention" | null; }
interface TeamCpdData { avg: number; onTrack: number; atRisk: number; members: Member[]; }
interface Dept { id: string; name: string; }

const API = process.env.NEXT_PUBLIC_API_URL;

export default function TeamCpdPage() {
  const [data, setData] = useState<TeamCpdData | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/departments`).then(r => r.ok ? r.json() : []).then(setDepts).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = deptId ? `?departmentId=${deptId}` : "";
    fetch(`${API}/api/manager/team-cpd${q}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  async function sendAlerts() {
    setNotifying(true); setNotifyMsg(null);
    try {
      const q = deptId ? `?departmentId=${deptId}` : "";
      const r = await fetch(`${API}/api/cpd/notify${q}`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">CPD</h1><p className="mt-1 text-sm text-[var(--muted)]">Monitor CPD progress across your team.</p></div>
        <div className="flex items-center gap-2">
          <select value={deptId} onChange={e => setDeptId(e.target.value)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]">
            <option value="">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={sendAlerts} disabled={notifying} className="shrink-0 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
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
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Award} label="Team CPD Avg" value={`${data.avg}%`} />
            <StatCard icon={Award} label="On Track" value={data.onTrack} sub="members" />
            <StatCard icon={Award} iconBg="bg-amber-50" label="At Risk" value={data.atRisk} sub="needs attention" />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Individual CPD Progress</h3></div>
            {data.members.length === 0 ? (
              <p className="p-5 text-sm text-[var(--muted)]">No team members in this view.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-4 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{width:`${m.cpdProgress}%`}} /></div>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${m.status ? "text-amber-600" : "text-[var(--brand)]"}`}>{m.cpdProgress}%</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${m.status === "at_risk" ? "bg-red-50 text-red-700" : m.status === "attention" ? "bg-amber-50 text-amber-700" : "bg-[var(--brand-tint)] text-[var(--brand-dark)]"}`}>{m.status === "at_risk" ? "At Risk" : m.status === "attention" ? "Attention" : "On Track"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
