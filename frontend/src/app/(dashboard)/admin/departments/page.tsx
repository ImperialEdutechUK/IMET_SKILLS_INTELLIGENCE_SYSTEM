"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { TableSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface Dept {
  id: string;
  name: string;
  teamMembers: number;
  coursesInProgress: number;
  coursesCompleted: number;
  notStarted: number;
  atRisk: number;
  attention: number;
  avgCpd: number;
  avgSkillLevel: number;
}

const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

type Health = "at_risk" | "behind" | "on_track";
const health = (d: Dept): Health => (d.atRisk > 0 ? "at_risk" : d.attention > 0 ? "behind" : "on_track");
const DOT: Record<Health, string> = { at_risk: "bg-rose-500", behind: "bg-amber-500", on_track: "bg-emerald-500" };
const BAR: Record<Health, string> = { at_risk: "bg-rose-500", behind: "bg-amber-500", on_track: "bg-emerald-500" };
const LABEL: Record<Health, string> = { at_risk: "At risk", behind: "Behind pace", on_track: "On track" };

export default function AdminDepartmentsPage() {
  // Same endpoint the dashboard uses — SWR serves it from cache, no extra request.
  const { data, error, isLoading, isRefreshing, refresh } = useApi<{ departments: Dept[] }>("/api/admin/dashboard");

  if (isLoading) return <TableSkeleton rows={6} />;
  if (!data?.departments) return <ErrorPanel message={error?.message ?? "Could not load departments."} onRetry={refresh} />;

  const rank: Record<Health, number> = { at_risk: 0, behind: 1, on_track: 2 };
  const staffed = data.departments.filter((d) => d.teamMembers > 0)
    .sort((a, b) => rank[health(a)] - rank[health(b)] || a.name.localeCompare(b.name));
  const empty = data.departments.filter((d) => d.teamMembers === 0).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="-m-6 min-h-full bg-white p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center gap-2.5">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--ink)]">Departments</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>
        <p className="mb-7 text-sm text-[var(--muted)]">Open a department to see its people, courses, badges and certificates.</p>

        {staffed.length === 0 && empty.length === 0 ? (
          <div className={`${CARD} p-6`}><p className="text-sm text-[var(--muted)]">No departments yet.</p></div>
        ) : (
          <>
            {staffed.length > 0 && (
              <div className={`${CARD} mb-6 overflow-hidden`}>
                <ul className="divide-y divide-[var(--border)]">
                  {staffed.map((d) => {
                    const hl = health(d);
                    return (
                      <li key={d.id}>
                        <Link href={`/admin/departments/${d.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[hl]}`} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">{d.name}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{d.teamMembers} {d.teamMembers === 1 ? "member" : "members"} · {d.coursesCompleted} completed · {d.coursesInProgress} in progress</p>
                          </div>
                          <div className="hidden w-44 shrink-0 sm:block">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
                              <span>{LABEL[hl]}</span><span className="font-medium text-[var(--ink)]">{d.avgCpd}% CPD</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${BAR[hl]}`} style={{ width: `${Math.min(100, d.avgCpd)}%` }} />
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {empty.length > 0 && (
              <>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">No members yet</p>
                <div className={`${CARD} overflow-hidden`}>
                  <ul className="divide-y divide-[var(--border)]">
                    {empty.map((d) => (
                      <li key={d.id}>
                        <Link href={`/admin/departments/${d.id}`} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50/80">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                          <p className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{d.name}</p>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
