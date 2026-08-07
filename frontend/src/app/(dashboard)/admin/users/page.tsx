"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, KeyRound, Trash2, Users, UserCheck, Building2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useApi } from "@/lib/api";
import { getUser } from "@/lib/authClient";
import { TableSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";
import PasswordResetDialog, { type ResetTarget } from "@/components/admin/PasswordResetDialog";
import DeleteUserDialog, { type DeleteTarget } from "@/components/admin/DeleteUserDialog";
import Pagination, { pageSlice } from "@/components/ui/Pagination";
import KpiCard from "@/components/ui/KpiCard";

const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";
const PAGE_SIZE = 12;

const roleConfig: Record<string, string> = {
  employee: "bg-slate-100 text-slate-600",
  manager: "bg-violet-50 text-violet-700",
  admin: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  author: "bg-amber-50 text-amber-700",
};
const statusConfig: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  invited: "bg-blue-50 text-blue-700",
  inactive: "bg-slate-100 text-slate-500",
};

interface User { id: string; fullName: string; email?: string; department: string; lastActive: string; role: string; status: string; }
interface Data { total: number; active: number; departmentCount: number; users: User[]; }

export default function UserManagementPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<Data>("/api/admin/users");
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [page, setPage] = useState(1);
  // A new search resets to the first page.
  useEffect(() => { setPage(1); }, [search]);

  if (isLoading) return <TableSkeleton rows={8} />;
  if (!data) return <ErrorPanel message={error?.message ?? "Could not load users."} onRetry={refresh} />;

  // The signed-in admin cannot delete their own account (the API refuses too).
  const myId = getUser()?.id;

  const q = search.trim().toLowerCase();
  const filtered = data.users.filter((u) => u.fullName.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q) || u.department.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  const paged = pageSlice(filtered, page, PAGE_SIZE);

  // Group the current page by department so the roster is organised and scannable.
  const groups = paged.reduce((acc, u) => {
    const dept = u.department && u.department !== "—" ? u.department : "Unassigned";
    (acc[dept] ??= []).push(u);
    return acc;
  }, {} as Record<string, User[]>);
  const departments = Object.keys(groups).sort((a, b) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        <div className="mb-1 flex items-center gap-2.5">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--ink)]">User management</h1>
          <RefreshingBadge show={isRefreshing} />
        </div>
        <p className="mb-6 text-sm text-[var(--muted)]">Everyone on the platform, grouped by department. New people self-register and can sign in straight away. Use the key icon to issue a one-time password reset code for someone who is locked out.</p>

        {/* Summary — one polished KPI tile per figure. data-tour:
            onboarding-tour anchor only. */}
        <div data-tour="adm-users-summary" className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard icon={Users} label="Total users" value={data.total} sublabel="On the platform" />
          <KpiCard icon={UserCheck} label="Active" value={data.active} status="positive" sublabel="Can sign in" />
          <KpiCard icon={Building2} label="Departments" value={data.departmentCount} sublabel="Across the org" />
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, department or role…"
            className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
          />
        </div>

        {/* Roster */}
        <div data-tour="adm-users-roster" className={`${CARD} overflow-hidden`}>
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-[var(--muted)]">No users match your search.</p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {departments.map((dept) => (
                <div key={dept}>
                  <div className="flex items-center justify-between bg-slate-50/70 px-5 py-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{dept}</h2>
                    <span className="text-[11px] font-medium text-[var(--muted)]">{groups[dept].length}</span>
                  </div>
                  <ul className="divide-y divide-[var(--border)]">
                    {groups[dept].map((user) => {
                      const rowInner = (
                        <>
                          <Avatar name={user.fullName} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--ink)]">{user.fullName}</p>
                            <p className="truncate text-xs text-[var(--muted)]">{user.email ?? `Last active ${user.lastActive}`}</p>
                          </div>
                          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize sm:inline ${roleConfig[user.role] ?? "bg-slate-100 text-slate-600"}`}>{user.role}</span>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusConfig[user.status] ?? "bg-slate-100 text-slate-600"}`}>{user.status.replace("_", " ")}</span>
                        </>
                      );
                      // The reset action is a SIBLING of the row link, never inside
                      // it — a <button> nested in an <a> is invalid, and it would
                      // also mean a mis-aimed click navigated instead of resetting.
                      return (
                        <li key={user.id} className="flex items-center transition-colors hover:bg-slate-50/80">
                          {user.role === "employee" ? (
                            <Link href={`/admin/employee/${user.id}`} className="group flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-5">
                              {rowInner}
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                            </Link>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-5">
                              {rowInner}
                              <span className="h-4 w-4 shrink-0" aria-hidden />
                            </div>
                          )}
                          <button
                            onClick={() => setResetTarget(user)}
                            title={`Issue a password reset code for ${user.fullName}`}
                            className="ml-3 shrink-0 rounded-lg border border-transparent p-2 text-slate-400 transition-colors hover:border-[var(--border)] hover:bg-white hover:text-[var(--brand-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Reset password for {user.fullName}</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(user)}
                            disabled={user.id === myId}
                            title={user.id === myId ? "You cannot delete the account you are signed in with" : `Delete ${user.fullName} permanently`}
                            className="mr-3 shrink-0 rounded-lg border border-transparent p-2 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete {user.fullName}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {filtered.length > PAGE_SIZE && (
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} className="mt-5" />
        )}
      </div>

      {resetTarget && (
        <PasswordResetDialog target={resetTarget} onClose={() => setResetTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteUserDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
