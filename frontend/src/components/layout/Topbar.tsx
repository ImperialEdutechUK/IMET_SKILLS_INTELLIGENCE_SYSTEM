"use client";
import { Search } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import NotificationBell from "@/components/layout/NotificationBell";
import GamificationPill from "@/components/gamification/GamificationPill";
import type { SessionUser } from "@/types";

export default function Topbar({ user }: { user: SessionUser }) {
  // Only managers/admins can search people; employees/authors see a scope that
  // matches what their role can actually reach.
  const canSearchPeople = user.role === "manager" || user.role === "admin";
  // Everyone who learns carries their level/XP in the header on every page.
  const showGame = user.role !== "admin";
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] bg-white px-6">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder={canSearchPeople ? "Search courses, skills, people…" : "Search courses, skills…"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--page)] py-2 pl-9 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
        />
      </div>
      <div className="flex items-center gap-3">
        {showGame && <GamificationPill />}
        <NotificationBell />
        <Avatar name={user.fullName} size={36} />
      </div>
    </header>
  );
}
