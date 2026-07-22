"use client";

import { useEffect, useState } from "react";
import { Award, Clock } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ProgressRing from "@/components/cpd/ProgressRing";
import { getToken } from "@/lib/authClient";

interface CpdRecord { id: string; title: string; date: string; source: string; hours: number; }
interface CpdData { target: number; completed: number; remaining: number; pct: number; records: CpdRecord[]; }

export default function MyCpdPage() {
  const [data, setData] = useState<CpdData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me/cpd`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load CPD data.</p></div>;

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-[var(--ink)]">My CPD</h1><p className="mt-1 text-sm text-[var(--muted)]">Track your Continuing Professional Development hours.</p></div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-white p-8">
          <ProgressRing percentage={data.pct} size={140} strokeWidth={12} />
          <p className="mt-4 text-lg font-bold text-[var(--ink)]">{data.completed} / {data.target} Hours</p>
          <p className="text-sm text-[var(--muted)]">Annual CPD Target</p>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={Award} label="Hours Completed" value={data.completed} delta={`${data.pct}% of target`} deltaPositive />
            <StatCard icon={Clock} label="Hours Remaining" value={data.remaining} sub="to reach target" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">CPD Record</h3></div>
        {data.records.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No CPD activity logged yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.records.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Award className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">{r.title}</p>
                  <p className="text-xs text-[var(--muted)]">{r.date} · {r.source}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]">+{r.hours} hrs</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
