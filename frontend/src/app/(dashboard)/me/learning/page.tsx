"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Clock, Search, Map, CheckCircle2, PlayCircle, Plus, ExternalLink, X } from "lucide-react";
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
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
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
  const [tab, setTab] = useState<Tab>("not_started");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [logOpen, setLogOpen] = useState<Record<string, boolean>>({});
  const [logVal, setLogVal] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/learning`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Land the user on content, not an empty state: once data arrives, select the first
  // non-empty tab (respecting tab order). A ?tab= deep-link or a manual click wins.
  const didInit = useRef(false);
  useEffect(() => {
    if (!data || didInit.current) return;
    didInit.current = true;
    const deep = params.get("tab");
    if (deep === "paths") { setTab("paths"); return; }
    const counts: Record<Tab, number> = {
      not_started: data.stats.notStarted,
      in_progress: data.stats.inProgress,
      completed: data.stats.completed,
      paths: data.learningPaths.length,
    };
    const order: Tab[] = ["not_started", "in_progress", "completed", "paths"];
    const firstNonEmpty = order.find((k) => counts[k] > 0);
    if (firstNonEmpty) setTab(firstNonEmpty);
  }, [data, params]);

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

  const logHours = async (id: string) => {
    const n = Number(logVal[id]);
    if (!n || n <= 0) return;
    await patch(id, { addHours: n });
    setLogVal((s) => ({ ...s, [id]: "" }));
    setLogOpen((s) => ({ ...s, [id]: false }));
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
        <div className="flex w-full max-w-xl items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter your courses…"
              className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" />
          </div>
          <button onClick={() => setShowAdd(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
            <Plus className="h-4 w-4" /> Add Course
          </button>
        </div>
      </div>

      {/* Tabs — counts live in the labels, so no separate stat card row is needed */}
      <div className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {TABS.map((t) => {
          const counts: Record<Tab, number> = {
            not_started: data.stats.notStarted,
            in_progress: data.stats.inProgress,
            completed: data.stats.completed,
            paths: data.learningPaths.length,
          };
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>
              {t.label}{counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}
            </button>
          );
        })}
      </div>

      {/* One stat only — hours spent. Course counts are in the tab labels above;
          certificates are homed on the Certificates page. */}
      <div className="mb-6 max-w-xs">
        <StatCard icon={Clock} label="Hours Spent" value={`${data.stats.hoursThisMonth}h`} sub="This month" />
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
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {logOpen[c.id] ? (
                  <>
                    <input type="number" min={0} step={0.5} value={logVal[c.id] ?? ""} autoFocus
                      onChange={(e) => setLogVal((s) => ({ ...s, [c.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") logHours(c.id); }}
                      placeholder="hrs"
                      className="w-16 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--brand)]" />
                    <button onClick={() => logHours(c.id)} disabled={busy[c.id]} className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">Add</button>
                    <button onClick={() => setLogOpen((s) => ({ ...s, [c.id]: false }))} className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-slate-50">✕</button>
                  </>
                ) : (
                  <button onClick={() => setLogOpen((s) => ({ ...s, [c.id]: true }))} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50"><Clock className="h-3.5 w-3.5" /> Log Hours</button>
                )}
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

      {showAdd && <AddCourseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); setLoading(true); load(); }} />}
    </div>
  );
}

function AddCourseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [cpdHours, setCpdHours] = useState("");
  const [status, setStatus] = useState<"in_progress" | "completed">("in_progress");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!title.trim()) { setError("Course name is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/api/me/enrollments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: true,
          title: title.trim(),
          externalUrl: externalUrl.trim() || undefined,
          provider: provider.trim() || undefined,
          cpdHours: cpdHours ? Number(cpdHours) : undefined,
          status,
        }),
      });
      if (r.ok) { onSaved(); return; }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Could not add the course.");
    } catch {
      setError("Could not add the course.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">Add a Course</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">For a course you&apos;re doing (or did) outside the recommended list. It&apos;s tracked here and counts towards your CPD.</p>
        <div className="space-y-4">
          <ModalField label="Course name" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced React Patterns"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          </ModalField>
          <ModalField label="Course link (URL)">
            <div className="relative">
              <ExternalLink className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://…"
                className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" />
            </div>
          </ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Provider">
              <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Udemy"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            </ModalField>
            <ModalField label="CPD hours">
              <input value={cpdHours} onChange={(e) => setCpdHours(e.target.value)} type="number" min={0} step={0.5} placeholder="e.g. 5"
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
            </ModalField>
          </div>
          <ModalField label="Status">
            <div className="flex gap-2">
              {(["in_progress", "completed"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${status === s ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand-dark)]" : "border-[var(--border)] text-[var(--ink)] hover:bg-slate-50"}`}>
                  {s === "in_progress" ? "In Progress" : "Completed"}
                </button>
              ))}
            </div>
          </ModalField>
          {status === "completed" && <p className="text-xs text-[var(--muted)]">Marking it completed logs your CPD hours and issues a certificate automatically.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">{saving ? "Saving…" : "Add Course"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
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
