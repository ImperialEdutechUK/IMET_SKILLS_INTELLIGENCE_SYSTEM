"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Clock, CheckCircle2, ChevronRight, PlayCircle, Plus, ExternalLink, X, History, Award } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import { tabKeyDown } from "@/lib/tabKeys";
import Pagination, { pageSlice } from "@/components/ui/Pagination";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import AchievementsBento from "@/components/gamification/AchievementsBento";
import CertificateProofModal, { CertificateFileField } from "@/components/certificates/CertificateProofModal";
import CertificateGallery from "@/components/certificates/CertificateGallery";
import { useApi, apiSend, ApiError, invalidate } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

/**
 * Every enrollment write moves numbers on all three of these reads (course
 * counts, certificate list, dashboard XP), so they're invalidated together.
 */
const LEARNING_KEYS = ["/api/me/learning", "/api/me/certificates", "/api/me/dashboard"];

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
  // CPD this course has actually banked. A completed course earns its FULL length
  // (the learner's corrected figure when they set one), so this is normally higher
  // than hoursLogged — the two are shown side by side, never one as the other.
  cpdCredited: number;
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
interface Certificate {
  id: string; title: string; issuer: string; issuedDate: string; cpdHours: number;
  fileUrl: string | null; certificateUrl: string | null; status: string;
}

type Tab = "in_progress" | "not_started" | "completed" | "certificates";
const TABS: { key: Tab; label: string }[] = [
  { key: "not_started", label: "Not Started" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "certificates", label: "Certificates" },
];
const PAGE_SIZE = 8;

export default function MyLearningPage() {
  const { data, error, isLoading, isRefreshing, mutate } = useApi<LearningData>("/api/me/learning");
  const { data: certData } = useApi<{ certificates: Certificate[] }>("/api/me/certificates");
  const { data: dashData } = useApi<{ cpdHours: number }>("/api/me/dashboard");
  const certificates = certData?.certificates ?? [];
  const cpdHours = dashData?.cpdHours ?? 0;
  const [tab, setTab] = useState<Tab>("not_started");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [logOpen, setLogOpen] = useState<Record<string, boolean>>({});
  const [logVal, setLogVal] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [trailOpen, setTrailOpen] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<Course | null>(null);
  // The course awaiting proof of completion. Closing this without a successful
  // upload leaves the enrollment untouched — it stays In Progress at the same %.
  const [completing, setCompleting] = useState<Course | null>(null);
  const didInit = useRef(false);

  /** Re-read everything an enrollment write touches. */
  const load = useCallback(async () => { await invalidate(...LEARNING_KEYS); }, []);

  useEffect(() => {
    // Open the Certificates tab directly when linked with ?tab=certificates.
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "certificates") { setTab("certificates"); didInit.current = true; }
  }, []);

  // Switching tabs starts the new list at page one.
  useEffect(() => { setPage(1); }, [tab]);

  // Land the user on content, not an empty state: once data arrives, select the first
  // non-empty tab (respecting tab order). A manual click wins.
  useEffect(() => {
    if (!data || didInit.current) return;
    didInit.current = true;
    const counts: Record<Tab, number> = {
      not_started: data.stats.notStarted,
      in_progress: data.stats.inProgress,
      completed: data.stats.completed,
      certificates: certificates.length,
    };
    const order: Tab[] = ["not_started", "in_progress", "completed"];
    const firstNonEmpty = order.find((k) => counts[k] > 0);
    if (firstNonEmpty) setTab(firstNonEmpty);
  }, [data, certificates.length]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy((s) => ({ ...s, [id]: true }));
    setErr((s) => ({ ...s, [id]: "" }));
    let ok = false;
    try {
      await apiSend(`/api/me/enrollments/${id}`, "PATCH", body, { invalidates: LEARNING_KEYS });
      ok = true;
    } catch (e) {
      setErr((s) => ({ ...s, [id]: e instanceof ApiError ? e.message : "Could not reach the server." }));
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

  if (isLoading) return <PageSkeleton cards={1} />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load your courses."} onRetry={() => mutate()} />;

  return (
    <div>
      <PageHeader
        icon={BookOpen}
        title="My learning"
        subtitle={tab === "certificates"
          ? "Your certificates and badges — earned as you complete courses."
          : "Log the hours you spend — progress is calculated from them."}
        meta={<RefreshingBadge show={isRefreshing} />}
        action={tab !== "certificates" && (
          <button data-tour="learning-add" onClick={() => setShowAdd(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-dark)]">
            <Plus className="h-4 w-4" /> Add course
          </button>
        )}
      />

      {/* Tabs — counts live in the labels, so no separate stat card row is needed */}
      <div data-tour="learning-tabs" role="tablist" aria-label="My learning views" onKeyDown={(e) => tabKeyDown(e, TABS.map((t) => t.key), tab, setTab)} className="mb-6 flex flex-wrap gap-6 border-b border-[var(--border)]">
        {TABS.map((t) => {
          const counts: Record<Tab, number> = {
            not_started: data.stats.notStarted,
            in_progress: data.stats.inProgress,
            completed: data.stats.completed,
            certificates: certificates.length,
          };
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} tabIndex={tab === t.key ? 0 : -1} onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === t.key ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}>
              {t.label}{counts[t.key] > 0 ? ` (${counts[t.key]})` : ""}
            </button>
          );
        })}
      </div>

      {/* One stat only — hours spent. Course counts are in the tab labels above.
          Hidden on the Certificates tab, where the trophy shelf carries the stats. */}
      {tab !== "certificates" && (
        <div className="mb-6 max-w-xs">
          <KpiCard icon={Clock} label="Hours logged" value={`${data.stats.hoursThisMonth}h`} sublabel="This month" />
        </div>
      )}

      {/* Tab content */}
      {tab === "in_progress" && (
        <Section title="In Progress Courses" empty={data.inProgress.length === 0} emptyText="No courses in progress. Start one from the Not Started tab or enrol from your dashboard.">
          {pageSlice(data.inProgress, page, PAGE_SIZE).map((c) => (
            <div key={c.id} className="border-b border-[var(--border)] p-5 last:border-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <CourseIcon />
                <div className="min-w-0 flex-1">
                  <CourseTitleButton course={c} onOpen={() => setDetail(c)} />
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
                  <button onClick={() => { setErr((s) => ({ ...s, [c.id]: "" })); setCompleting(c); }} disabled={busy[c.id]} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50 disabled:opacity-60">Mark Complete</button>
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
          {data.inProgress.length > PAGE_SIZE && (
            <div className="p-5"><Pagination page={page} total={data.inProgress.length} pageSize={PAGE_SIZE} onChange={setPage} /></div>
          )}
        </Section>
      )}

      {tab === "not_started" && (
        <Section title="Courses you haven't started yet" empty={data.notStarted.length === 0} emptyText="Nothing waiting. Enrol in a recommended course from your dashboard.">
          {pageSlice(data.notStarted, page, PAGE_SIZE).map((c) => (
            <div key={c.id} className="flex flex-col gap-3 border-b border-[var(--border)] p-5 last:border-0 md:flex-row md:items-center">
              <CourseIcon />
              <div className="min-w-0 flex-1">
                <CourseTitleButton course={c} onOpen={() => setDetail(c)} />
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
          {data.notStarted.length > PAGE_SIZE && (
            <div className="p-5"><Pagination page={page} total={data.notStarted.length} pageSize={PAGE_SIZE} onChange={setPage} /></div>
          )}
        </Section>
      )}

      {tab === "completed" && (
        <Section title="Completed Courses" empty={data.completed.length === 0} emptyText="No completed courses yet. Finish an in-progress course to earn a certificate.">
          {pageSlice(data.completed, page, PAGE_SIZE).map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-b border-[var(--border)] p-5 last:border-0">
              <Icon3D icon={CheckCircle2} tone={TONES.emerald} size="sm" />
              <div className="min-w-0 flex-1">
                {/* Clickable here too, so the title behaves the same in every tab —
                    and a completed course is exactly where someone re-measures its
                    length, which now re-credits the CPD. */}
                <CourseTitleButton course={c} onOpen={() => setDetail(c)} />
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{c.level} · {c.category}{c.completedAt ? ` · completed ${c.completedAt}` : ""}{c.hoursLogged > 0 ? ` · ${c.hoursLogged}h logged` : ""}</p>
              </div>
              {/* CPD earned is the course's full length — the learner's own corrected
                  figure when they set one, never a scraped estimate they disagreed
                  with. Same number the CPD ledger and the certificate carry. */}
              <span
                className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2.5 py-1 text-xs font-medium text-[var(--brand-dark)]"
                title={
                  c.cpdCredited > c.hoursLogged
                    ? `Completing this course earns its full ${c.cpdCredited}h — you logged ${c.hoursLogged}h along the way.`
                    : "CPD hours banked for this course."
                }
              >
                +{c.cpdCredited} CPD
              </span>
              {c.certificateId && <button onClick={() => setTab("certificates")} className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">View Certificate</button>}
            </div>
          ))}
          {data.completed.length > PAGE_SIZE && (
            <div className="p-5"><Pagination page={page} total={data.completed.length} pageSize={PAGE_SIZE} onChange={setPage} /></div>
          )}
        </Section>
      )}

      {/* Certificates + badges — read-only. New certificates are earned by completing
          a course (the proof upload lives in the completion flow), never minted here. */}
      {tab === "certificates" && (
        <>
          <AchievementsBento certificates={certificates.length} coursesCompleted={data.stats.completed} cpdHours={cpdHours} />
          {certificates.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
              <div className="mx-auto w-fit"><Icon3D icon={Award} tone={TONES.violet} /></div>
              <p className="mt-3 text-sm font-medium text-[var(--ink)]">No certificates yet.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Complete a course above and upload its certificate — it lands here, with the CPD hours and XP that come with it.</p>
              <button onClick={() => setTab("in_progress")} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-slate-50">
                <BookOpen className="h-4 w-4" /> Go to my courses
              </button>
            </div>
          ) : (
            <CertificateGallery certificates={certificates} />
          )}
        </>
      )}

      {detail && (
        <CourseDetailModal
          course={detail}
          onClose={() => setDetail(null)}
          onSaved={async () => { setDetail(null); await load(); }}
        />
      )}

      {completing && (
        <CertificateProofModal
          heading="Mark course complete"
          intro={`Upload the certificate you earned for this course. It only moves to Completed once the proof is saved. ${
            completing.targetHours
              ? `Completing it earns the full ${Math.max(completing.hoursLogged, completing.targetHours)}h of CPD${
                  completing.hoursLogged > 0 ? ` — you've logged ${completing.hoursLogged}h so far` : ""
                }, nothing to re-enter.`
              : completing.hoursLogged > 0
                ? `This course publishes no length, so it banks the ${completing.hoursLogged}h you logged.`
                : "This course publishes no length and you've logged no hours, so it earns no CPD. Log your time first if you want it to count."
          }`}
          submitLabel="Complete & save certificate"
          initialTitle={completing.title}
          titleLocked
          initialProvider={completing.provider}
          onClose={() => setCompleting(null)}
          onSubmit={async (payload) => {
            // status + certificate go in one request: the backend rejects the whole
            // thing if the proof is missing or invalid, so a failure here leaves the
            // course In Progress with its progress bar exactly where it was.
            try {
              await apiSend(`/api/me/enrollments/${completing.id}`, "PATCH", {
                status: "completed",
                certificate: {
                  fileUrl: payload.fileUrl,
                  certificateUrl: payload.certificateUrl,
                  issuer: payload.issuer,
                  issuedDate: payload.issuedDate || undefined,
                },
              }, { invalidates: LEARNING_KEYS });
              setCompleting(null);
              setTab("completed");
              return null;
            } catch (e) {
              return e instanceof ApiError ? e.message : "Could not reach the server.";
            }
          }}
        />
      )}

      {showAdd && <AddCourseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
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
      await apiSend(`/api/me/enrollments/${course.id}`, "PATCH", { targetHours: value }, { invalidates: LEARNING_KEYS });
      onSaved();
      return;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the course length.");
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
          <Row label="Time you've logged" value={`${course.hoursLogged}h`} />
          {/* Completing the course banks its full length, using the learner's own
              corrected figure ahead of the scraped catalogue value. Logging more than
              that keeps the larger number — over-delivering is never rounded away. */}
          {course.status === "completed" ? (
            <Row label="CPD earned" value={`${course.cpdCredited}h`} />
          ) : (
            <Row
              label="CPD on completion"
              value={
                course.targetHours
                  ? `${Math.max(course.hoursLogged, course.targetHours)}h — the full course`
                  : `${course.hoursLogged}h — the time you log`
              }
            />
          )}
        </div>

        <label className="mb-1 block text-xs font-medium text-[var(--ink)]">
          {course.status === "completed" ? "Total hours for this course" : "Total hours to complete"}
        </label>
        <p className="mb-2 text-[11px] text-[var(--muted)]">
          {course.status === "completed"
            ? // Editing this on a finished course re-credits the ledger, so say so
              // plainly rather than letting the CPD total change unannounced.
              "Your figure, not the catalogue's — changing it re-credits the CPD for this course and updates your certificate. Only your own record changes."
            : "Your progress bar is this many hours divided into the time you log, and it's what the course credits when you complete it. Only you see this change."}
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

// Adding a course you did outside the recommended list. Choosing "Completed" here
// skips the whole log-hours-as-you-go loop, so it has to carry the same evidence a
// completion normally earns: the certificate, its link, and — since there are no
// logged hours to draw on — the CPD hours typed by hand. Choosing "In Progress"
// changes nothing: none of those fields appear and none are sent.
function AddCourseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<"in_progress" | "completed">("in_progress");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Completed-only fields.
  const [cpdHours, setCpdHours] = useState("");
  const [fileData, setFileData] = useState("");
  const [fileName, setFileName] = useState("");
  const [certificateUrl, setCertificateUrl] = useState("");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().slice(0, 10));
  const done = status === "completed";

  const submit = async () => {
    if (!title.trim()) { setError("Course name is required."); return; }
    if (done) {
      const n = Number(cpdHours);
      if (!n || n <= 0) { setError("Enter the CPD hours for this course."); return; }
      if (!fileData) { setError("Upload the certificate PDF or image — it's required."); return; }
      if (!certificateUrl.trim()) { setError("Paste the certificate link (URL) — it's required."); return; }
    }
    setSaving(true); setError("");
    try {
      await apiSend("/api/me/enrollments", "POST", {
        manual: true,
        title: title.trim(),
        externalUrl: externalUrl.trim() || undefined,
        provider: provider.trim() || undefined,
        status,
        ...(done
          ? {
              cpdHours: Number(cpdHours),
              certificate: {
                fileUrl: fileData,
                certificateUrl: certificateUrl.trim(),
                // The provider typed above is the certificate's issuer — no point
                // asking for the same name twice in one dialog.
                issuer: provider.trim() || undefined,
                issuedDate: issuedDate || undefined,
              },
            }
          : {}),
      }, { invalidates: LEARNING_KEYS });
      onSaved();
      return;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add the course.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      {/* The Completed branch adds four fields, so the dialog has to be able to
          scroll on a short viewport rather than run off the bottom. */}
      <div data-tour="learning-add-modal" className="my-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">Add a Course</h2>
          <button data-tour="learning-add-close" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X className="h-5 w-5" /></button>
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
          {done && (
            <div className="space-y-4 rounded-xl border border-[var(--border)] bg-slate-50/60 p-4">
              <p className="text-xs text-[var(--muted)]">
                A completed course needs its certificate. These hours count towards your CPD and the certificate is saved to your Certificates page.
              </p>
              <ModalField label="CPD hours" required>
                <input type="number" min={0.5} step={0.5} value={cpdHours} onChange={(e) => setCpdHours(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
                <p className="mt-1 text-[11px] text-[var(--muted)]">You can find this on the course page you enrolled in.</p>
              </ModalField>
              <ModalField label="Upload certificate (PDF or image)" required>
                <CertificateFileField
                  fileName={fileName}
                  onPicked={(data, name) => { setFileData(data); setFileName(name); }}
                  onError={setError}
                />
              </ModalField>
              <ModalField label="Certificate link (URL)" required>
                <input value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} placeholder="https://…"
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
              </ModalField>
              <ModalField label="Date completed">
                <input type="date" value={issuedDate} max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
              </ModalField>
            </div>
          )}
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

// The course title opens the detail dialog, which nothing about a bold line of text
// says on its own. It gets the full set of affordances: a hand cursor, a colour and
// underline on hover, a chevron that slides in to name the action, a keyboard focus
// ring, and a tooltip — so the title reads as a control at a glance and by keyboard.
function CourseTitleButton({ course, onOpen }: { course: Course; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open details for "${course.title}"`}
      aria-label={`Open details for ${course.title}`}
      className="group -mx-1 flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--brand-tint)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
    >
      <span className="truncate text-sm font-semibold text-[var(--ink)] underline-offset-2 transition-colors group-hover:text-[var(--brand)] group-hover:underline">
        {course.title}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--brand)] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </button>
  );
}
