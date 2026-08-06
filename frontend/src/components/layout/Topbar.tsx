"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Menu } from "lucide-react";
import ProfileMenu from "@/components/layout/ProfileMenu";
import NotificationBell from "@/components/layout/NotificationBell";
import GamificationPill from "@/components/gamification/GamificationPill";
import type { SessionUser } from "@/types";

export default function Topbar({ user, onMenu }: { user: SessionUser; onMenu?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  // Reflect the active query when landing on the results page. Read from
  // window.location (not useSearchParams) to avoid a Suspense boundary in the
  // shared layout — the same convention BackToReports uses.
  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
  }, [pathname]);
  // Only managers/admins can search people; employees/authors see a scope that
  // matches what their role can actually reach.
  const canSearchPeople = user.role === "manager" || user.role === "admin";
  // Everyone who learns carries their level/XP in the header on every page.
  const showGame = user.role !== "admin";

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length >= 2) router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[var(--ink)] transition-colors hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <form onSubmit={submit} role="search" data-tour="topbar-search" className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={canSearchPeople ? "Search courses, skills and people" : "Search courses and skills"}
          placeholder={canSearchPeople ? "Search courses, skills, people…" : "Search courses, skills…"}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--page)] py-2 pl-9 pr-3 text-sm text-[var(--ink)] outline-none placeholder:text-slate-400 focus:border-[var(--brand)]"
        />
      </form>
      <div className="flex items-center gap-3">
        {showGame && <GamificationPill />}
        <NotificationBell />
        <ProfileMenu user={user} variant="topbar" />
      </div>
    </header>
  );
}
