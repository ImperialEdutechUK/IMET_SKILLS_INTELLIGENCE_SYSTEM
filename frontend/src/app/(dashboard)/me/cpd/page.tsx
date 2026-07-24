"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Upload, BookOpen, Download, ChevronDown } from "lucide-react";
import ProgressRing from "@/components/cpd/ProgressRing";
import LearnDonutChart from "@/components/charts/LearnDonutChart";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Activity { id: string; title: string; type: string; category: string; provider: string | null; date: string; hours: number; note: string | null; source: string }
interface Category { name: string; hours: number; pct: number; color: string }
interface CpdData {
  target: number; completed: number; remaining: number; pct: number;
  activitiesCompleted: number; streak: number;
  goals: { hoursGoal: number; hoursDone: number; hoursPct: number; activitiesGoal: number; activitiesDone: number; activitiesPct: number };
  categories: Category[];
  activities: Activity[];
}

const typeBadge: Record<string, string> = {
  Learning: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  Webinar: "bg-purple-50 text-purple-700",
  Conference: "bg-amber-50 text-amber-700",
  Reading: "bg-blue-50 text-blue-700",
  Coaching: "bg-pink-50 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
};

export default function MyCpdPage() {
  const [data, setData] = useState<CpdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/cpd`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/me/cpd/upload`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const d = await r.json();
      if (r.ok) { setUploadMsg(`Imported ${d.imported} CPD record${d.imported > 1 ? "s" : ""}.`); await load(); }
      else setUploadMsg(d.error ?? "Import failed.");
    } catch { setUploadMsg("Import failed."); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load CPD data.</p></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">My CPD</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track, record and manage your Continuing Professional Development.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          {/* One primary action; template + Excel import tucked into a single menu */}
          <div className="relative">
            <button onClick={() => setImportOpen((v) => !v)} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60">
              <Upload className="h-4 w-4" /> {uploading ? "Importing…" : "Import"}
              <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />
            </button>
            {importOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setImportOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-lg">
                  <button onClick={() => { setImportOpen(false); fileRef.current?.click(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-slate-50">
                    <Upload className="h-4 w-4 text-[var(--muted)]" /> Import Excel / CSV
                  </button>
                  <a href="/templates/cpd-log-template.xlsx" download onClick={() => setImportOpen(false)}
                    className="flex w-full items-center gap-2 border-t border-[var(--border)] px-4 py-2.5 text-left text-sm text-[var(--ink)] hover:bg-slate-50">
                    <Download className="h-4 w-4 text-[var(--muted)]" /> Download template
                  </a>
                </div>
              </>
            )}
          </div>
          <Link href="/me/cpd/record" className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
            <Plus className="h-4 w-4" /> Record CPD Activity
          </Link>
        </div>
      </div>
      {uploadMsg && <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--brand-tint)] px-4 py-2.5 text-sm text-[var(--brand-dark)]">{uploadMsg}</div>}

      {/* Hero — the single home for CPD status. Folds the former four stat cards
          (progress %, total hours, activities, streak) and the hours goal. */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-white p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProgressRing percentage={data.pct} size={104} strokeWidth={9} />
          <div className="flex-1">
            <p className="text-sm text-[var(--muted)]">CPD Progress · annual target</p>
            <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{data.completed} <span className="text-base font-medium text-[var(--muted)]">of {data.target} hrs</span></p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{data.remaining} hrs to go · {data.activitiesCompleted} activit{data.activitiesCompleted === 1 ? "y" : "ies"} recorded · {data.streak} wk streak</p>
          </div>
        </div>
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <GoalBar label="Learning Activities Goal" value={`${data.goals.activitiesDone} / ${data.goals.activitiesGoal}`} pct={data.goals.activitiesPct} color="bg-purple-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activities */}
        <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Recent Activity</h3></div>
          {data.activities.length === 0 ? (
            <p className="p-5 text-sm text-[var(--muted)]">No CPD activities yet. Record one or import your CPD log.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {data.activities.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">{a.title}</p>
                    <p className="text-xs text-[var(--muted)]">{a.provider ? `${a.provider} · ` : ""}{a.category}</p>
                  </div>
                  <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${typeBadge[a.type] ?? typeBadge.Other}`}>{a.type}</span>
                  <span className="w-24 shrink-0 text-right text-xs text-[var(--muted)]">{a.date}</span>
                  <span className="w-16 shrink-0 text-right text-sm font-semibold text-[var(--brand)]">{a.hours}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: categories only (hours + activities goals now live in the hero) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-4 font-semibold text-[var(--ink)]">CPD Categories</h3>
            {/* A donut only earns its place with 2+ categories; a lone 100% slice says nothing. */}
            {data.categories.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No categories yet.</p>
            ) : data.categories.length === 1 ? (
              <p className="text-sm text-[var(--ink)]">All <span className="font-semibold">{data.completed} hrs</span> in <span className="font-semibold">{data.categories[0].name}</span>. More categories will chart here as you diversify.</p>
            ) : (
              <LearnDonutChart data={data.categories.map((c) => ({ name: c.name, value: c.hours, color: c.color }))} label={`${data.completed}`} sublabel="hrs" height={150} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-[var(--ink)]">{label}</span><span className="text-[var(--muted)]">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-right text-[11px] font-medium text-[var(--muted)]">{pct}%</p>
    </div>
  );
}
