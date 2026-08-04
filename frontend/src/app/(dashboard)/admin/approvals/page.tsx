"use client";

import { useState } from "react";
import { UserCheck, Check, X, Mail, Briefcase, Building2, Clock } from "lucide-react";
import { useApi, apiSend, invalidate } from "@/lib/api";
import { TableSkeleton, RefreshingBadge } from "@/components/ui/DataState";

interface Pending {
  id: string;
  fullName: string;
  email: string;
  position: string | null;
  department: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const { data, isLoading, isRefreshing, mutate } = useApi<Pending[]>("/api/admin/approvals");
  const pending = Array.isArray(data) ? data : [];
  const [acting, setActing] = useState<string | null>(null);

  async function act(userId: string, action: "approve" | "reject") {
    setActing(userId);
    try {
      // Drop the row straight away, then confirm against the server. If the
      // request fails, SWR rolls the row back rather than leaving a lie on screen.
      await mutate(
        async () => {
          await apiSend("/api/admin/approvals", "POST", { userId, action });
          return pending.filter((p) => p.id !== userId);
        },
        {
          optimisticData: pending.filter((p) => p.id !== userId),
          rollbackOnError: true,
          revalidate: true,
        },
      );
      // An approval creates a real user and changes the headcount everywhere.
      await invalidate("/api/admin/users", "/api/admin/dashboard");
    } catch {
      // Row is restored by the rollback above.
    }
    setActing(null);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--ink)]">Pending Approvals</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">Review and approve new employee registrations before they can sign in.</p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : pending.length === 0 ? (
        // data-tour on both branches: the onboarding tour points at whichever
        // one is on screen. No behaviour change.
        <div data-tour="adm-approvals" className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-tint)] text-[var(--brand-dark)]">
            <UserCheck className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--ink)]">No pending registrations</p>
          <p className="mt-1 text-sm text-[var(--muted)]">New employee registrations will appear here for approval.</p>
        </div>
      ) : (
        <div data-tour="adm-approvals" className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-sm font-semibold text-[var(--brand-dark)]">
                    {p.fullName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--ink)]">{p.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                      {p.position && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {p.position}</span>}
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.department}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(p.id, "approve")}
                    disabled={acting === p.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => act(p.id, "reject")}
                    disabled={acting === p.id}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
