"use client";
import { Search, Bell, Settings } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { SessionUser } from "@/types";

export default function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-6">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search courses, skills, employees…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--page)] py-2 pl-9 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
        />
      </div>
      <div className="flex items-center gap-3">
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-slate-50">
          <Bell className="h-4 w-4" />
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-slate-50">
          <Settings className="h-4 w-4" />
        </button>
        <Avatar name={user.fullName} size={36} />
      </div>
    </header>
  );
}
