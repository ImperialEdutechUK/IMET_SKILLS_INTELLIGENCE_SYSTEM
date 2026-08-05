"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, BookOpen, Sparkles, Users, ChevronRight, ArrowUpRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useApi } from "@/lib/api";
import { PageSkeleton, RefreshingBadge, ErrorPanel } from "@/components/ui/DataState";

interface Course { id: string; title: string; provider: string | null; level: string | null; externalUrl: string | null; category: { name: string } | null }
interface Skill { id: string; name: string; category: { name: string } | null }
interface Person { id: string; fullName: string; email: string; position: string | null; department: { name: string } | null }
interface SearchData { query: string; role: string; courses: Course[]; skills: Skill[]; people: Person[] }

// One calm card surface — the same token every dashboard screen uses.
const CARD = "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

export default function SearchPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={3} />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const enabled = q.length >= 2;
  const { data, error, isLoading, isRefreshing, refresh } = useApi<SearchData>(
    enabled ? `/api/search?q=${encodeURIComponent(q)}` : null,
  );

  const total = data ? data.courses.length + data.skills.length + data.people.length : 0;
  const personHref = (id: string) => (data?.role === "admin" ? `/admin/employee/${id}` : `/manager/employees/${id}`);

  return (
    <div>
      <PageHeader
        icon={Search}
        title="Search"
        subtitle={q ? `Results for "${q}"` : "Find courses, skills and people"}
        meta={<RefreshingBadge show={isRefreshing} />}
      />

      {!enabled ? (
        <div className={`${CARD} flex flex-col items-center gap-2 px-6 py-16 text-center`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Search className="h-6 w-6" /></span>
          <p className="mt-1 font-semibold text-[var(--ink)]">Type at least two characters</p>
          <p className="max-w-sm text-sm text-[var(--muted)]">Search the course catalogue, tracked skills{data?.role === "admin" || data?.role === "manager" ? " and people" : ""} from the box at the top.</p>
        </div>
      ) : isLoading ? (
        <PageSkeleton cards={3} />
      ) : !data ? (
        <ErrorPanel message={error?.message ?? "Could not run the search."} onRetry={refresh} />
      ) : total === 0 ? (
        <div className={`${CARD} flex flex-col items-center gap-2 px-6 py-16 text-center`}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Search className="h-6 w-6" /></span>
          <p className="mt-1 font-semibold text-[var(--ink)]">No matches for &ldquo;{q}&rdquo;</p>
          <p className="max-w-sm text-sm text-[var(--muted)]">Try a different word — a course title, provider, skill or person&rsquo;s name.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Courses */}
          {data.courses.length > 0 && (
            <Section icon={BookOpen} title="Courses" count={data.courses.length}>
              <ul className="divide-y divide-[var(--border)]">
                {data.courses.map((c) => {
                  const meta = [c.provider, c.level, c.category?.name].filter(Boolean).join(" · ");
                  const inner = (
                    <>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-4.5 w-4.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{c.title}</p>
                        {meta && <p className="truncate text-xs text-[var(--muted)]">{meta}</p>}
                      </div>
                      {c.externalUrl
                        ? <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[var(--brand)] group-hover:text-[var(--brand-dark)] sm:inline-flex">Open course <ArrowUpRight className="h-3.5 w-3.5" /></span>
                        : <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">Internal</span>}
                    </>
                  );
                  return (
                    <li key={c.id}>
                      {c.externalUrl ? (
                        <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">{inner}</a>
                      ) : (
                        <div className="flex items-center gap-3 px-5 py-3.5">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Skills */}
          {data.skills.length > 0 && (
            <Section icon={Sparkles} title="Skills" count={data.skills.length}>
              <div className="flex flex-wrap gap-2 p-5">
                {data.skills.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                    <span className="font-medium text-[var(--ink)]">{s.name}</span>
                    {s.category?.name && <span className="text-xs text-[var(--muted)]">{s.category.name}</span>}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* People */}
          {data.people.length > 0 && (
            <Section icon={Users} title="People" count={data.people.length}>
              <ul className="divide-y divide-[var(--border)]">
                {data.people.map((p) => (
                  <li key={p.id}>
                    <Link href={personHref(p.id)} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand-tint)] text-xs font-semibold text-[var(--brand-dark)]">{p.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink)]">{p.fullName}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{[p.position, p.department?.name].filter(Boolean).join(" · ") || p.email}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: typeof BookOpen; title: string; count: number; children: React.ReactNode }) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-dark)]"><Icon className="h-4.5 w-4.5" /></span>
        <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
        <span className="ml-auto text-xs text-[var(--muted)]">{count} {count === 1 ? "result" : "results"}</span>
      </div>
      {children}
    </section>
  );
}
