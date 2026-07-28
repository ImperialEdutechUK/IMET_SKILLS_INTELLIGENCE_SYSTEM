"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, CheckCircle2, PlayCircle, Plus, ExternalLink, X, History } from "lucide-react";
import Stat3D from "@/components/dashboard/Stat3D";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import { getToken } from "@/lib/authClient";

const API = process.env.NEXT_PUBLIC_API_URL;

interface EnrollmentEvent {
  id: string; type: string; hours: number | null; note: string | null; at: string;
}
interface Course {
  id: string; courseId: string; title: string; description: string; level: string;
  durationHours: number | null; category: string; provider: string | null; cpdHours: number;
  progress: number; status: string; externalUrl: string | null;
  // Progress is derived server-side from hoursLogged vs targetHours — it is not
  // something the learner can set. progressKnown is false when the course publishes
  // no duration, in which case we show hours logged instead of a percentage.
  progressKnown: boolean; targetHours: number | null; hoursLogged: number;
  // What the scraped catalogue claims, vs the learner's own correction to it.
  catalogueHours: number | null; targetHoursOverride: number | null;
  lastActivityAt: string | null; daysSinceActivity: number | null;
  events: EnrollmentEvent[];
  createdAt: string; completedAt: string | null; certificateId: string | null;
}
interface LearningData {
  stats: { inProgress: number; completed: number; notStarted: number; certificatesEarned: number; hoursThisMonth: number };
  inProgress: Course[]; notStarted: Course[]; completed: Course[];
}

type Tab = "in_progress" | "not_started" | "completed";
const TABS: { key: Tab; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

export default function MyLearningPage() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("not_started");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [logOpen, setLogOpen] = useState<Record<string, boolean>>({});
  const [logVal, setLogVal] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [trailOpen, setTrailOpen] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Course | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/me/learning`, { headers: { Authorization: `Bearer ${getToken()}` } });
    setData(r.ok ? await r.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Land the user on content, not an empty state: once data arrives, select the first
  // non-empty tab (respecting tab order). A manual click wins.
  const didInit = useRef(false);
  useEffect(() => {
    if (!data || didInit.current) return;
    didInit.current = true;
    const counts: Record<Tab, number> = {
      not_started: data.stats.notStarted,
      in_progress: data.stats.inProgress,
      completed: data.stats.completed,
    };
    const order: Tab[] = ["not_started", "in_progress", "completed"];
    const firstNonEmpty = order.find((k) => counts[k] > 0);
    if (firstNonEmpty) setTab(firstNonEmpty);
  }, [data]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy((s) => ({ ...s, [id]: true }));
    setErr((s) => ({ ...s, [id]: "" }));
    let ok = false;
    try {
      const r = await fetch(`${API}/api/me/enrollments/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      ok = r.ok;
      if (r.ok) await load();
      else {
        const j = await r.json().catch(() => null);
        setErr((s) => ({ ...s, [id]: j?.error ?? "Could not save that." }));
      }
    } catch {
      setErr((s) => ({ ...s, [id]: "Could not reach the server." }));
    }
    setBusy((s) => ({ ...s, [id]: false }));
    return ok;
  };

  const logHours = async (id: string) => {
    const n = Number(logVal[id]);
    if (!n || n <= 0) {
      setErr((s) => ({ ...s, [id]: "Enter how many hours you spent." }));
      return;
    }
    const ok = await patch(id, { addHours: n });
    if (!ok) return;
    setLogVal((s) => ({ ...s, [id]: "" }));
    setLogOpen((s) => ({ ...s, [id]: false }));
  };

  if (loading) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load your courses.</p></div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon3D icon={BookOpen} tone={TONES.blue} />
          <div>
            <h1 className="text-2xl font-bold text-[var(--ink)]">My Learning</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Log the hours you spend — progress is calculated from them.</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">
          <Plus className="h-4 w-4" /> Add Course
        </button>
      </div>

      {/* Tabs — counts live in the labels, so no separate stat card row is needed */}
      <div className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {TABS.map((t) => {
          const counts: Record<Tab, number> = {
            not_started: data.stats.notStarted,
            in_progress: data.stats.inProgress,
            completed: data.stats.completed,
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
        <Stat3D icon={Clock} tone={TONES.amber} label="Hours Spent" value={`${data.stats.hoursThisMonth}h`} sub="This month" />
      </div>

      {/* Tab content */}
      {tab === "in_progress" && (
        <Section title="In Progress Courses" empty={data.inProgress.length === 0} emptyText="No courses in progress. Start one from the Not Started tab or enrol from your dashboard.">
          {data.inProgress.map((c) => (
            <div key={c.id} className="border-b border-[var(--border)] p-5 last:border-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <CourseIcon />
                <div className="min-w-0 flex-1">
                  <button onClick={() => setDetail(c)} className="text-left">
                    <p className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand)] hover:underline">{c.title}</p>
                  </button>
                  {c.description && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{c.description}</p>}
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {c.level}{c.targetHours ? ` · ${c.targetHours}h` : ""} · {c.category}
                    {c.targetHoursOverride !== null && <span className="text-[var(--brand)]"> · adjusted by you</span>}
                  </p>
                </div>

                {/* Read-only: progress is computed from the hours logged below. */}
                <div className="w-full md:w-56">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    {c.progressKnown ? (
                      <>
                        <span className="font-semibold text-[var(--brand)]">{c.progress}%</span>
                        <span className="text-[var(--muted)]">{c.hoursLogged}h of {c.targetHours}h</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-[var(--brand)]">{c.hoursLogged}h</span>
                        <span className="text-[var(--muted)]">logged</span>
                      </>
                    )}
                  </div>
                  {c.progressKnown && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar"
                      aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100}
                      aria-label={`${c.title} progress`}>
                      <div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500" style={{ width: `${c.progress}%` }} />
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {c.hoursLogged === 0
                      ? "No time logged yet"
                      : c.daysSinceActivity !== null && c.daysSinceActivity > 21
                        ? <span className="text-amber-600">Last activity {c.lastActivityAt}</span>
                        : `Last activity ${c.lastActivityAt}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {logOpen[c.id] ? (
                    <>
                      <input type="number" min={0} max={24} step={0.5} value={logVal[c.id] ?? ""} autoFocus
                        onChange={(e) => setLogVal((s) => ({ ...s, [c.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") logHours(c.id); }}
                        placeholder="hrs"
                        className="w-16 rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--brand)]" />
                      <button onClick={() => logHours(c.id)} disabled={busy[c.id]} className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">Add</button>
                      <button onClick={() => { setLogOpen((s) => ({ ...s, [c.id]: false })); setErr((s) => ({ ...s, [c.id]: "" })); }} className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-slate-50">✕</button>
                    </>
                  ) : (
                    <button onClick={() => setLogOpen((s) => ({ ...s, [c.id]: true }))} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)]"><Clock className="h-3.5 w-3.5" /> Log Hours</button>
                  )}
                  {c.externalUrl && <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">Continue</a>}
                  <button onClick={() => patch(c.id, { status: "completed" })} disabled={busy[c.id]} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60">Mark Complete</button>
                </div>
              </div>

              {err[c.id] && <p className="mt-2 text-xs text-rose-600">{err[c.id]}</p>}

              {c.events.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setTrailOpen((s) => ({ ...s, [c.id]: !s[c.id] }))}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--ink)]">
                    <History className="h-3 w-3" /> Activity{trailOpen[c.id] ? "" : ` (${c.events.length})`}
                  </button>
                  {trailOpen[c.id] && (
                    <ul className="mt-2 space-y-1 border-l-2 border-[var(--border)] pl-3">
                      {c.events.map((ev) => (
                        <li key={ev.id} className="text-[11px] text-[var(--muted)]">
                          <span className="text-[var(--ink)]">{ev.note ?? ev.type.replace("_", " ")}</span> · {ev.at}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === "not_started" && (
        <Section title="Courses you haven't started yet" empty={data.notStarted.length === 0} emptyText="Nothing waiting. Enrol in a recommended course from your dashboard.">
          {data.notStarted.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 border-b border-[var(--border)] p-5 last:border-0 md:flex-row md:items-center">
              <CourseIcon />
              <div className="min-w-0 flex-1">
                <button onClick={() => setDetail(c)} className="text-left">
                  <p className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--brand)] hover:underline">{c.title}</p>
                </button>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {c.level}{c.targetHours ? ` · ${c.targetHours}h` : ""} · {c.category} · enrolled {c.createdAt}
                  {c.targetHoursOverride !== null && <span className="text-[var(--brand)]"> · adjusted by you</span>}
                </p>
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
        <Section title="Completed Courses" empty={data.completed.length === 0} emptyText="No completed courses yet. Finish an in-progress course to earn a certificate.">
          {data.completed.map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-b border-[var(--border)] p-5 last:border-0">
              <Icon3D icon={CheckCircle2} tone={TONES.emerald} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--ink)]">{c.title}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{c.level} · {c.category}{c.completedAt ? ` · completed ${c.completedAt}` : ""}{c.hoursLogged > 0 ? ` · ${c.hoursLogged}h logged` : ""}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]">+{c.cpdHours} CPD</span>
              {c.certificateId && <Link href="/me/certificates" className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">View Certificate</Link>}
            </div>
          ))}
        </Section>
      )}

      {detail && (
        <CourseDetailModal
          course={detail}
          onClose={() => setDetail(null)}
          onSaved={async () => { setDetail(null); await load(); }}
        />
      )}

      {showAdd && <AddCourseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); setLoading(true); load(); }} />}
    </div>
  );
}

// Read-only course details, with ONE editable field: the total hours.
//
// Catalogue durations come from the source's own free-text estimate of study time
// (Coursera's "workload"), which often overstates the real course. This lets a
// learner correct the denominator their progress is measured against. The edit is
// stored on their enrollment — the shared course catalogue is never modified, so
// nobody else's progress or recommendations shift because of it.
function CourseDetailModal({ course, onClose, onSaved }: { course: Course; onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState(course.targetHours != null ? String(course.targetHours) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (value: number | null) => {
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/api/me/enrollments/${course.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ targetHours: value }),
      });
      if (r.ok) { onSaved(); return; }
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Could not save the course length.");
    } catch {
      setError("Could not save the course length.");
    }
    setSaving(false);
  };

  const submit = () => {
    const n = Number(hours);
    if (!n || n <= 0) { setError("Enter the total hours for this course."); return; }
    save(n);
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span className="text-right text-xs font-medium text-[var(--ink)]">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold leading-snug text-[var(--ink)]">{course.title}</h2>
          <button onClick={onClose} className="shrink-0 text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
        </div>

        {course.description && (
          <p className="mb-4 line-clamp-4 text-xs leading-relaxed text-[var(--muted)]">{course.description}</p>
        )}

        <div className="mb-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-3 py-1">
          <Row label="Provider" value={course.provider ?? "—"} />
          <Row label="Level" value={course.level} />
          <Row label="Category" value={course.category} />
          <Row label="CPD on completion" value={`${course.cpdHours}h`} />
          <Row label="Time you've logged" value={`${course.hoursLogged}h`} />
        </div>

        <label className="mb-1 block text-xs font-medium text-[var(--ink)]">Total hours to complete</label>
        <p className="mb-2 text-[11px] text-[var(--muted)]">
          Your progress bar is this many hours divided into the time you log. Only you see this change.
        </p>
        <div className="flex items-center gap-2">
          <input type="number" min={0.5} step={0.5} value={hours} autoFocus
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="w-24 rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
          <span className="text-xs text-[var(--muted)]">hours</span>
          <button onClick={submit} disabled={saving}
            className="ml-auto rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {course.catalogueHours !== null && (
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {course.provider ?? "The catalogue"} says {course.catalogueHours}h.
            {course.targetHoursOverride !== null && (
              <button onClick={() => save(null)} disabled={saving} className="ml-1 font-medium text-[var(--brand)] hover:underline disabled:opacity-60">
                Reset to {course.catalogueHours}h
              </button>
            )}
          </p>
        )}

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

        {course.externalUrl && (
          <a href={course.externalUrl} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline">
            Open the course <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function AddCourseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [provider, setProvider] = useState("");
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
        <p className="mb-4 text-xs text-[var(--muted)]">For a course you&apos;re doing (or did) outside the recommended list. It&apos;s tracked here in your learning.</p>
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
          {status === "completed" && <p className="text-xs text-[var(--muted)]">Marking it completed issues a certificate automatically.</p>}
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
    <div className="rounded-2xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">{title}</h3></div>
      {empty ? <p className="p-5 text-sm text-[var(--muted)]">{emptyText}</p> : children}
    </div>
  );
}

function CourseIcon() {
  return <Icon3D icon={BookOpen} tone={TONES.blue} size="sm" />;
}
