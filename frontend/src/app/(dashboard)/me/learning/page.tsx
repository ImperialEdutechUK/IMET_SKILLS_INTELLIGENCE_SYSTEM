"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Clock, Trophy, Search, Map, Award, CheckCircle2, PlayCircle } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Course {
  id: string; courseId: string; title: string; description: string; level: string;
  durationHours: number | null; category: string; provider: string | null; cpdHours: number;
  progress: number; status: string; externalUrl: string | null;
  createdAt: string; completedAt: string | null; certificateId: string | null;
}
interface PathItem {
  id: string; name: string; description: string; totalCourses: number; completedCourses: number; progress: number; status: string;
}
interface LearningData {
  stats: { inProgress: number; completed: number; notStarted: number; certificatesEarned: number; hoursThisMonth: number };
  inProgress: Course[]; notStarted: Course[]; completed: Course[]; learningPaths: PathItem[];
}

type Tab = "in_progress" | "not_started" | "completed" | "paths";
const TABS: { key: Tab; label: string }[] = [
  { key: "in_progress", label: "In Progress" },
  { key: "not_started", label: "Not Started" },
  { key: "completed", label: "Completed" },
  { key: "paths", label: "Learning Paths" },
];

export default function MyLearningPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>}>
      <MyLearningInner />
    </Suspense>
  );
}

function MyLearningInner() {
  const params = useSearchParams();
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("in_progress");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/learning`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (params.get("tab") === "paths") setTab("paths"); }, [params]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy((s) => ({ ...s, [id]: true }));
    try {
      const r = await fetch(`${API}/api/me/enrollments/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) await load();
    } catch { /* ignore */ }
    setBusy((s) => ({ ...s, [id]: false }));
  };

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your courses.</p></div>;

  const filter = (list: Course[]) => list.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">My Learning</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track your courses, learning paths and progress.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..."
            className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Courses in Progress" value={data.stats.inProgress} sub="Keep going!" />
        <StatCard icon={Clock} label="Hours Spent" value={`${data.stats.hoursThisMonth}h`} sub="This month" />
        <StatCard icon={Trophy} label="Courses Completed" value={data.stats.completed} sub="Great job!" />
        <StatCard icon={Award} label="Certificates" value={data.stats.certificatesEarned} sub="Earned" />
      </div>

      {/* Tab content */}
      {tab === "in_progress" && (
        <Section title="In Progress Courses" empty={filter(data.inProgress).length === 0} emptyText="No courses in progress. Start one from the Not Started tab or enrol from your dashboard.">
          {filter(data.inProgress).map((c) => (
            <div key={c.id} className="flex flex-col gap-4 border-b border-[var(--border)] p-5 last:border-0 md:flex-row md:items-center">
              <CourseIcon />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ink)]">{c.title}</p>
                {c.description && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{c.description}</p>}
                <p className="mt-1 text-[11px] text-[var(--muted)]">{c.level}{c.durationHours ? ` · ${c.durationHours}h` : ""} · {c.category}</p>
              </div>
              <div className="w-full md:w-56">
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-[var(--brand)]">{c.progress}%</span><span className="text-[var(--muted)]">progress</span></div>
                <input type="range" min={0} max={100} defaultValue={c.progress} disabled={busy[c.id]}
                  onMouseUp={(e) => patch(c.id, { progress: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => patch(c.id, { progress: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-[var(--brand)]" />
              </div>
              <div className="flex shrink-0 gap-2">
                {c.externalUrl && <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">Continue</a>}
                <button onClick={() => patch(c.id, { progress: 100 })} disabled={busy[c.id]} className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">Mark Complete</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {tab === "not_started" && (
        <Section title="Courses you haven't started yet" empty={filter(data.notStarted).length === 0} emptyText="Nothing waiting. Enrol in a recommended course from your dashboard.">
          {filter(data.notStarted).map((c) => (
            <div key={c.id} className="flex flex-col gap-3 border-b border-[var(--border)] p-5 last:border-0 md:flex-row md:items-center">
              <CourseIcon />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ink)]">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{c.level}{c.durationHours ? ` · ${c.durationHours}h` : ""} · {c.category} · enrolled {c.createdAt}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {c.externalUrl && <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">Preview</a>}
                <button onClick={() => patch(c.id, { status: "in_progress" })} disabled={busy[c.id]} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"><PlayCircle className="h-3.5 w-3.5" /> Start Learning</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {tab === "completed" && (
        <Section title="Completed Courses" empty={filter(data.completed).length === 0} emptyText="No completed courses yet. Finish an in-progress course to earn a certificate.">
          {filter(data.completed).map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-b border-[var(--border)] p-5 last:border-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><CheckCircle2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ink)]">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{c.level} · {c.category}{c.completedAt ? ` · completed ${c.completedAt}` : ""}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]">+{c.cpdHours} CPD</span>
              {c.certificateId && <Link href="/me/certificates" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">View Certificate</Link>}
            </div>
          ))}
        </Section>
      )}

      {tab === "paths" && (
        <Section title="Learning Paths" empty={data.learningPaths.length === 0} emptyText="No learning paths available yet. Learning paths group courses into a step-by-step route and appear here once created.">
          {data.learningPaths.map((p) => (
            <div key={p.id} className="flex flex-col gap-4 border-b border-[var(--border)] p-5 last:border-0 md:flex-row md:items-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600"><Map className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ink)]">{p.name}</p>
                {p.description && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{p.description}</p>}
                <p className="mt-1 text-[11px] text-[var(--muted)]">{p.completedCourses}/{p.totalCourses} courses completed</p>
              </div>
              <div className="w-full md:w-48">
                <p className="mb-1 text-xs font-semibold text-[var(--brand)]">{p.progress}%</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${p.progress}%` }} /></div>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, empty, emptyText }: { title: string; children: React.ReactNode; empty: boolean; emptyText: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">{title}</h3></div>
      {empty ? <p className="p-5 text-sm text-[var(--muted)]">{emptyText}</p> : children}
    </div>
  );
}

function CourseIcon() {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>;
}
