"use client";

import Link from "next/link";
import { Trophy, Zap, ChevronRight, GraduationCap, BookOpen } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useApi } from "@/lib/api";
import { TableSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface Row {
  id: string; fullName: string; position: string; rank: number;
  xp: number; level: number; title: string;
  certCount: number; coursesCompleted: number; cpdHours: number;
}

// Metal colours for the top three. The podium is ORDINAL — rank badge + XP value
// carry the quantity; there are no proportional-looking bars that would imply a
// spread the heights don't actually encode.
const PODIUM = [
  { from: "#ffdf6e", to: "#e0a005", ring: "#eab308" }, // 1st gold
  { from: "#dfe6ec", to: "#9aa7b4", ring: "#94a3b8" }, // 2nd silver
  { from: "#e8b06b", to: "#a9691f", ring: "#b7791f" }, // 3rd bronze
];

export default function LeaderboardPage() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi<{ members: Row[] }>("/api/manager/leaderboard");
  const rows = data?.members ?? [];

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  // Podium display order: 2nd, 1st, 3rd.
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as Row[];

  return (
    <div>
      <PageHeader
        icon={Trophy}
        title="Team leaderboard"
        subtitle="Who's earning the most XP — certificates and completed courses all count."
        meta={<RefreshingBadge show={isRefreshing} />}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error && !data ? (
        <ErrorPanel message={error.message} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6"><p className="text-sm text-[var(--muted)]">No team members to rank yet.</p></div>
      ) : (
        <>
          {/* Podium */}
          <div className="mb-6 overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #2e7d5b 0%, #123f2b 100%)" }}>
            <div className="flex items-end justify-center gap-4 sm:gap-8">
              {podiumOrder.map((m) => {
                const style = PODIUM[m.rank - 1];
                return (
                  <Link key={m.id} href={`/manager/employees/${m.id}`} className="group flex w-24 flex-col items-center sm:w-32">
                    <div className="relative mb-2">
                      <span className="grid h-16 w-16 place-items-center rounded-full text-2xl font-extrabold text-white shadow-lg ring-4 ring-white/20" style={{ background: `linear-gradient(145deg, ${style.from}, ${style.to})` }}>
                        {m.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-extrabold shadow" style={{ color: style.to }}>{m.rank}</span>
                    </div>
                    <p className="w-full truncate text-center text-sm font-semibold text-white group-hover:underline">{m.fullName}</p>
                    <p className="inline-flex items-center gap-1 text-xs font-bold text-lime-200"><Zap className="h-3 w-3 fill-current" />{m.xp} XP</p>
                    <p className="text-[11px] text-white/70">Level {m.level} · {m.title}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Ranked list */}
          <div className="rounded-2xl border border-[var(--border)] bg-white">
            <div className="hidden gap-3 border-b border-[var(--border)] bg-slate-50/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink)] sm:grid sm:grid-cols-[auto_2fr_1fr_auto]">
              <span className="w-8">#</span><span>Member</span>
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" aria-hidden /> Certificates</span>
                <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden /> Courses</span>
              </span>
              <span className="text-right">XP</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {(rest.length ? rest : []).length === 0 && rows.length <= 3 && (
                <li className="px-5 py-4 text-sm text-[var(--muted)]">That&apos;s the whole team — top ranks shown above.</li>
              )}
              {rest.map((m) => (
                <li key={m.id}>
                  <Link href={`/manager/employees/${m.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 sm:grid-cols-[auto_2fr_1fr_auto]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-bold text-[var(--muted)]">{m.rank}</span>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{m.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{m.fullName}</p>
                        <p className="truncate text-xs text-[var(--muted)]">Level {m.level} · {m.title}</p>
                      </div>
                    </div>
                    <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
                      <span className="inline-flex items-center gap-1" aria-label={`${m.certCount} certificate${m.certCount === 1 ? "" : "s"}`}><GraduationCap className="h-3.5 w-3.5" aria-hidden />{m.certCount}</span>
                      <span className="inline-flex items-center gap-1" aria-label={`${m.coursesCompleted} completed course${m.coursesCompleted === 1 ? "" : "s"}`}><BookOpen className="h-3.5 w-3.5" aria-hidden />{m.coursesCompleted}</span>
                    </div>
                    <span className="flex items-center justify-end gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--brand)]"><Zap className="h-3.5 w-3.5 fill-current" />{m.xp}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
