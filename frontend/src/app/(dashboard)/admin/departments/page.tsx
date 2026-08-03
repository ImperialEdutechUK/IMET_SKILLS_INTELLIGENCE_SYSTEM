"use client";

import Link from "next/link";
import { Building2, ChevronRight, ShieldCheck, AlertTriangle } from "lucide-react";
import Icon3D, { TONES } from "@/components/dashboard/Icon3D";
import { useApi } from "@/lib/api";
import { CardGridSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

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

export default function AdminDepartmentsPage() {
  // Same endpoint the admin dashboard uses — SWR serves it from cache, so
  // switching between the two views costs no request at all.
  const { data, error, isLoading, isRefreshing, refresh } = useApi<{ departments: Dept[] }>("/api/admin/dashboard");
  const departments = data?.departments;

  if (isLoading) return <CardGridSkeleton />;
  if (!departments) return <ErrorPanel message={error?.message ?? "Could not load departments."} onRetry={refresh} />;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Departments</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">Open a department to see its members, courses, badges and certificates.</p>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No departments yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => <DepartmentCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}

function DepartmentCard({ d }: { d: Dept }) {
  const behind = d.atRisk + d.attention;
  const tone = d.atRisk > 0 ? TONES.rose : d.attention > 0 ? TONES.amber : d.teamMembers === 0 ? TONES.slate : TONES.emerald;
  const badge = d.teamMembers === 0
    ? { cls: "bg-slate-100 text-slate-600", label: "No members" }
    : d.atRisk > 0
      ? { cls: "bg-red-50 text-red-700", label: `${d.atRisk} at risk` }
      : d.attention > 0
        ? { cls: "bg-amber-50 text-amber-700", label: `${d.attention} behind` }
        : { cls: "bg-emerald-50 text-emerald-700", label: "On track" };
  return (
    <Link
      href={`/admin/departments/${d.id}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon3D icon={behind > 0 ? AlertTriangle : d.teamMembers === 0 ? Building2 : ShieldCheck} tone={tone} size="sm" />
          <h3 className="font-semibold text-[var(--ink)]">{d.name}</h3>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
      </div>
      <span className={`mb-4 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold leading-none text-[var(--ink)]">{d.teamMembers}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Members</p>
        </div>
        <div>
          <p className="text-lg font-bold leading-none text-[var(--brand)]">{d.coursesCompleted}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Completed</p>
        </div>
        <div>
          <p className="text-lg font-bold leading-none text-blue-600">{d.coursesInProgress}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">In progress</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Avg CPD</span><span className="font-medium text-[var(--ink)]">{d.avgCpd}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.avgCpd)}%`, background: behind > 0 ? (d.atRisk > 0 ? "#e11d48" : "#f59e0b") : "var(--brand)" }} />
        </div>
      </div>
    </Link>
  );
}
