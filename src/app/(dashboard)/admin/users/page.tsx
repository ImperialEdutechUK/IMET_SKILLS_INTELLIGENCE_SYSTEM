"use client";
import { useState } from "react";
import { Users, UserPlus, Search } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { allEmployees, DEPARTMENTS } from "@/lib/mock-data";

const roleConfig: Record<string, string> = {
  employee: "bg-blue-50 text-blue-700",
  manager: "bg-purple-50 text-purple-700",
  admin: "bg-red-50 text-red-700",
  author: "bg-amber-50 text-amber-700",
};

const statusConfig: Record<string, string> = {
  active: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  at_risk: "bg-amber-50 text-amber-700",
  inactive: "bg-slate-100 text-slate-600",
};

export default function UserManagementPage() {
  const [search, setSearch] = useState("");
  const filtered = allEmployees.filter(e => e.fullName.toLowerCase().includes(search.toLowerCase()) || e.department.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">User Management</h1><p className="mt-1 text-sm text-[var(--muted)]">Create, manage, and monitor all platform users.</p></div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><UserPlus className="h-4 w-4" /> Create User</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={allEmployees.length} />
        <StatCard icon={Users} label="Active" value={allEmployees.filter(e => e.status === "active").length} delta="This month" deltaPositive />
        <StatCard icon={Users} iconBg="bg-amber-50" label="At Risk" value={allEmployees.filter(e => e.status === "at_risk").length} delta="Needs attention" deltaPositive={false} />
        <StatCard icon={Users} label="Departments" value={DEPARTMENTS.length} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5">
          <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" /></div>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {filtered.map((user) => (
            <li key={user.id} className="flex items-center gap-4 px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{user.fullName.split(" ").map((p: string) => p[0]).join("").toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)]">{user.fullName}</p>
                <p className="text-xs text-[var(--muted)]">{user.department} · Last active: {user.lastActive}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${roleConfig[user.role]}`}>{user.role}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[user.status]}`}>{user.status}</span>
              <button className="shrink-0 text-xs text-[var(--brand)] hover:text-[var(--brand-dark)]">Edit</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
