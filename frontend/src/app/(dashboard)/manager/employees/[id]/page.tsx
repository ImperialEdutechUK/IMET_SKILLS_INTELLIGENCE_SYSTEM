"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Target, BookOpen, ScrollText, TrendingUp, Activity, Award, ExternalLink, FileText, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Icon3D, { TONES, type Icon3DTone } from "@/components/dashboard/Icon3D";
import AchievementsSummary from "@/components/gamification/AchievementsSummary";
import type { LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

const LEVELS = ["None", "Basic", "Intermediate", "Advanced", "Expert"];
const SKILLS_PER_PAGE = 5;
const CERTS_PER_PAGE = 5;

interface Skill { name: string; current: number; target: number; gap: number }
interface Course {
  id: string; title: string; category: string; progress: number; cpdHours: number; cpdCredited: number;
  // Progress is derived server-side from hours logged vs the course duration.
  progressKnown: boolean; hoursLogged: number; targetHours: number | null;
  daysSinceActivity: number | null;
}
interface Activity { id: string; title: string; type: string; hours: number; date: string }
interface CertItem { id: string; title: string; issuer: string; issuedDate: string; fileUrl: string | null; certificateUrl: string | null; status: string }
interface EmpData {
  id: string; fullName: string; email: string; position: string; department: string;
  avgSkillPercent: number;
  cpd: { hours: number; target: number; progress: number; status: string | null };
  skills: Skill[]; gapsCount: number;
  courseCounts: { inProgress: number; completed: number; notStarted: number };
  courses: { inProgress: Course[]; completed: Course[]; notStarted: Course[] };
  certificates: number; recentActivities: Activity[];
  coursesCompleted: number; cpdHours: number; certificateList: CertItem[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  at_risk: { label: "At risk", cls: "bg-red-50 text-red-700" },
  attention: { label: "Needs attention", cls: "bg-amber-50 text-amber-700" },
  on_track: { label: "On track", cls: "bg-emerald-50 text-emerald-700" },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading, isRefreshing, refresh } = useApi<EmpData>(
    id ? `/api/manager/employees/${id}` : null,
    // Different employee = different person's data. Never show the last one's
    // numbers under this one's name while the new request is in flight.
    { keepPreviousData: false },
  );
  const notFound = error?.status === 404 || error?.status === 403;

  // Paging / tab state lives above the early returns so hook order stays stable.
  const [skillPage, setSkillPage] = useState(0);
  const [certPage, setCertPage] = useState(0);
  const [courseTab, setCourseTab] = useState<"inProgress" | "completed">("inProgress");

  const skills = useMemo(() => data?.skills ?? [], [data]);
  const skillPageCount = Math.max(1, Math.ceil(skills.length / SKILLS_PER_PAGE));
  const skillPageIdx = Math.min(skillPage, skillPageCount - 1);
  const pagedSkills = skills.slice(skillPageIdx * SKILLS_PER_PAGE, skillPageIdx * SKILLS_PER_PAGE + SKILLS_PER_PAGE);

  const certs = useMemo(() => data?.certificateList ?? [], [data]);
  const certPageCount = Math.max(1, Math.ceil(certs.length / CERTS_PER_PAGE));
  const certPageIdx = Math.min(certPage, certPageCount - 1);
  const pagedCerts = certs.slice(certPageIdx * CERTS_PER_PAGE, certPageIdx * CERTS_PER_PAGE + CERTS_PER_PAGE);

  if (isLoading) return <PageSkeleton />;
  if (notFound) return (
    <div>
      <BackLink />
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">This employee isn&apos;t in your department, or doesn&apos;t exist.</p></div>
    </div>
  );
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load this employee."} onRetry={refresh} />;

  const status = data.cpd.status ?? "on_track";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.on_track;

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-tint)] text-lg font-bold text-[var(--brand-dark)]">
            {data.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--ink)]">{data.fullName}</h1>
              <RefreshingBadge show={isRefreshing} />
            </div>
            <p className="text-sm text-[var(--muted)]">{data.position} · {data.department}</p>
            <p className="text-xs text-[var(--muted)]">{data.email}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${badge.cls}`}>{badge.label}</span>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={TrendingUp} tone={TONES.emerald} label="Avg Skill Level" value={`${data.avgSkillPercent}%`} sub={`${data.gapsCount} gap${data.gapsCount === 1 ? "" : "s"} to close`} />
        <Tile icon={BookOpen} tone={TONES.blue} label="Courses" value={data.courseCounts.completed} sub={`${data.courseCounts.inProgress} in progress`} />
        <Tile icon={ScrollText} tone={TONES.violet} label="Certificates" value={data.certificates} sub="Earned" />
        <Tile icon={Clock} tone={TONES.amber} label="Total CPD Hours" value={`${data.cpd.hours}h`} sub={`${data.cpd.progress}% of ${data.cpd.target}h target`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Skills & gaps — bar per skill (current vs target) */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <Icon3D icon={Target} tone={TONES.emerald} size="sm" />
            <h3 className="font-semibold text-[var(--ink)]">Skills &amp; Gaps</h3>
            {skills.length > 0 && <span className="text-sm text-[var(--muted)]">({skills.length})</span>}
          </div>
          {pagedSkills.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No skills recorded yet.</p>
          ) : (
            <ul className="space-y-3.5">
              {pagedSkills.map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--ink)]">{s.name}</span>
                    <span className="text-[var(--muted)]">{LEVELS[s.current]} → {LEVELS[s.target]}{s.gap > 0 ? <span className="ml-1 font-semibold text-amber-600">(gap {s.gap})</span> : <span className="ml-1 font-semibold text-emerald-600">✓</span>}</span>
                  </div>
                  {/* track shows target (light), fill shows current */}
                  <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${(s.target / 4) * 100}%` }} />
                    <div className={`absolute inset-y-0 left-0 rounded-full ${s.gap > 0 ? "bg-[var(--brand)]" : "bg-emerald-500"}`} style={{ width: `${(s.current / 4) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pager
            page={skillPageIdx}
            pageCount={skillPageCount}
            total={skills.length}
            perPage={SKILLS_PER_PAGE}
            noun="skills"
            onChange={setSkillPage}
          />
        </div>

        {/* Recent activity */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="mb-3 flex items-center gap-3"><Icon3D icon={Activity} tone={TONES.violet} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Recent Activity</h3></div>
            {data.recentActivities.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {data.recentActivities.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{a.title}</span>
                    <span className="shrink-0 text-[var(--muted)]">{a.date}</span>
                    <span className="w-10 shrink-0 text-right font-semibold text-[var(--brand)]">{a.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Courses — one card, two tabs, so only one list is on screen at a time. */}
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 pt-4">
          <Tab active={courseTab === "inProgress"} onClick={() => setCourseTab("inProgress")} label="In Progress" count={data.courses.inProgress.length} />
          <Tab active={courseTab === "completed"} onClick={() => setCourseTab("completed")} label="Completed" count={data.courses.completed.length} />
        </div>
        <CourseList
          courses={courseTab === "inProgress" ? data.courses.inProgress : data.courses.completed}
          showProgress={courseTab === "inProgress"}
        />
      </div>

      {/* Achievements & badges — condensed: level, trophy badge, certificate count. */}
      <div className="mt-8 mb-6">
        <div className="mb-4 flex items-center gap-3"><Icon3D icon={Award} tone={TONES.violet} size="sm" /><h3 className="font-semibold text-[var(--ink)]">Achievements &amp; Badges</h3></div>
        <AchievementsSummary certificates={data.certificates} coursesCompleted={data.coursesCompleted} cpdHours={data.cpdHours} />
      </div>

      {/* Certificates — read-only list with links, 5 at a time */}
      <div className="rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5"><h3 className="font-semibold text-[var(--ink)]">Certificates <span className="text-sm font-normal text-[var(--muted)]">({certs.length})</span></h3></div>
        {pagedCerts.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No certificates yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pagedCerts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <Icon3D icon={Award} tone={TONES.violet} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink)]" title={c.title}>{c.title}</p>
                  <p className="text-xs text-[var(--muted)]">{c.issuer}{c.issuedDate ? ` · ${c.issuedDate}` : ""}</p>
                </div>
                <CertStatusBadge status={c.status} />
                {c.fileUrl && (
                  <a href={c.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> View
                  </a>
                )}
                {c.certificateUrl && (
                  <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-slate-50">
                    <ExternalLink className="h-3.5 w-3.5" /> Verify
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="px-5 pb-1">
          <Pager
            page={certPageIdx}
            pageCount={certPageCount}
            total={certs.length}
            perPage={CERTS_PER_PAGE}
            noun="certificates"
            onChange={setCertPage}
          />
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 pb-3 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--brand)] text-[var(--ink)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label} <span className="font-normal text-[var(--muted)]">({count})</span>
    </button>
  );
}

// Shared 5-per-view pager. Hidden entirely when everything already fits.
function Pager({ page, pageCount, total, perPage, noun, onChange }: {
  page: number; pageCount: number; total: number; perPage: number; noun: string;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const from = page * perPage + 1;
  const to = Math.min(total, from + perPage - 1);
  return (
    <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
      <span className="text-xs text-[var(--muted)]">{from}–{to} of {total} {noun}</span>
      <div className="flex items-center gap-1">
        <PagerBtn disabled={page === 0} onClick={() => onChange(page - 1)} label={`Previous ${noun}`}><ChevronLeft className="h-4 w-4" /></PagerBtn>
        <span className="px-1 text-xs font-medium text-[var(--ink)]">{page + 1} / {pageCount}</span>
        <PagerBtn disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)} label={`Next ${noun}`}><ChevronRight className="h-4 w-4" /></PagerBtn>
      </div>
    </div>
  );
}

function PagerBtn({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--border)] text-[var(--ink)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function CertStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-700",
  };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

function BackLink() {
  return (
    <Link href="/manager/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
      <ArrowLeft className="h-4 w-4" /> Back to team dashboard
    </Link>
  );
}

function Tile({ icon: Icon, tone, label, value, sub }: { icon: LucideIcon; tone: Icon3DTone; label: string; value: string | number; sub: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl p-5" style={{ background: `${tone.to}14` }}>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/70"><Icon className="h-5 w-5" style={{ color: tone.to }} /></span>
      <p className="mt-3 text-[2rem] font-extrabold leading-none" style={{ color: tone.to }}>{value}</p>
      <p className="mt-1.5 text-sm font-medium" style={{ color: tone.to, opacity: 0.85 }}>{label}</p>
      <p className="mt-0.5 text-xs" style={{ color: tone.to, opacity: 0.7 }}>{sub}</p>
    </div>
  );
}

function CourseList({ courses, showProgress }: { courses: Course[]; showProgress?: boolean }) {
  return (
    <>
      {courses.length === 0 ? (
        <p className="p-5 text-sm text-[var(--muted)]">Nothing here yet.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
          {courses.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--ink)]" title={c.title}>{c.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {c.category}
                  {showProgress && ` · ${c.hoursLogged}h${c.targetHours ? ` of ${c.targetHours}h` : ""} logged`}
                  {/* Stale = claimed as underway but no hours logged for 3+ weeks. */}
                  {showProgress && c.daysSinceActivity !== null && c.daysSinceActivity > 21 && (
                    <span className="text-amber-600"> · idle {c.daysSinceActivity}d</span>
                  )}
                </p>
              </div>
              {showProgress ? (
                <span className="shrink-0 text-xs font-semibold text-[var(--brand)]">
                  {c.progressKnown ? `${c.progress}%` : `${c.hoursLogged}h`}
                </span>
              ) : (
                /* The CPD this course actually banked, not the catalogue's scraped
                   estimate — these add up to the Total CPD Hours tile above. */
                <span
                  className="shrink-0 rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-dark)]"
                  title={`${c.hoursLogged}h logged · credited ${c.cpdCredited}h on completion`}
                >
                  +{c.cpdCredited} CPD
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
