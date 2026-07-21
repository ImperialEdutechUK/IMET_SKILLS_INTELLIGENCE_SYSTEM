"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus, Search } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const roleConfig: Record<string, string> = {
  employee: "bg-blue-50 text-blue-700",
  manager: "bg-purple-50 text-purple-700",
  admin: "bg-red-50 text-red-700",
  author: "bg-amber-50 text-amber-700",
};
const statusConfig: Record<string, string> = {
  active: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  pending_approval: "bg-amber-50 text-amber-700",
  invited: "bg-blue-50 text-blue-700",
  inactive: "bg-slate-100 text-slate-600",
};

interface User { id: string; fullName: string; department: string; lastActive: string; role: string; status: string; }
interface Data { total: number; active: number; pending: number; departmentCount: number; users: User[]; }

export default function UserManagementPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Loading…</p></div>;
  if (!data) return <div className="rounded-xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">Could not load users.</p></div>;

  const filtered = data.users.filter((u) => u.fullName.toLowerCase().includes(search.toLowerCase()) || u.department.toLowerCase().includes(search.toLowerCase()));

  // Group users by department so the list is organised and scannable.
  const groups = filtered.reduce((acc, u) => {
    const dept = u.department && u.department !== "—" ? u.department : "Unassigned";
    (acc[dept] ??= []).push(u);
    return acc;
  }, {} as Record<string, User[]>);
  const departments = Object.keys(groups).sort((a, b) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">User Management</h1><p className="mt-1 text-sm text-[var(--muted)]">Create, manage, and monitor all platform users.</p></div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><UserPlus className="h-4 w-4" /> Create User</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={data.total} />
        <StatCard icon={Users} label="Active" value={data.active} sub="accounts" />
        <StatCard icon={Users} iconBg="bg-amber-50" label="Pending" value={data.pending} sub="awaiting approval" />
        <StatCard icon={Users} label="Departments" value={data.departmentCount} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5">
          <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" /></div>
        </div>
        {filtered.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No users match your search.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {departments.map((dept) => (
              <div key={dept}>
                <div className="flex items-center justify-between bg-slate-50/70 px-5 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{dept}</h3>
                  <span className="text-xs font-medium text-[var(--muted)]">{groups[dept].length}</span>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {groups[dept].map((user) => (
                    <li key={user.id} className="flex items-center gap-4 px-5 py-4">
                      {user.role === "employee" ? (
                        <Link href={`/admin/employee/${user.id}`} className="group flex min-w-0 flex-1 items-center gap-4">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{user.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--ink)] group-hover:text-[var(--brand)]">{user.fullName}</p>
                            <p className="text-xs text-[var(--muted)]">Last active: {user.lastActive}</p>
                          </div>
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{user.fullName.split(" ").map((p) => p[0]).join("").toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--ink)]">{user.fullName}</p>
                            <p className="text-xs text-[var(--muted)]">Last active: {user.lastActive}</p>
                          </div>
                        </div>
                      )}
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${roleConfig[user.role] ?? "bg-slate-100 text-slate-600"}`}>{user.role}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[user.status] ?? "bg-slate-100 text-slate-600"}`}>{user.status.replace("_", " ")}</span>
                      <button className="shrink-0 text-xs text-[var(--brand)] hover:text-[var(--brand-dark)]">Edit</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
