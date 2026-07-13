"use client";

import { useEffect, useState, useCallback } from "react";
import { Library, BookOpen, AlertCircle, Users, Eye, Search } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { getToken } from "@/lib/authClient";

const statusConfig: Record<string, string> = {
  published: "bg-[var(--brand-tint)] text-[var(--brand-dark)]",
  draft: "bg-slate-100 text-slate-600",
};

interface Course { id: string; title: string; source: string; category: string; enrollments: number; status: string; incomplete: boolean; }
interface Data { total: number; published: number; draft: number; totalEnrollments: number; page: number; totalPages: number; matchCount: number; courses: Course[]; }

export default function CourseLibraryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("search", query);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/author/library?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  const runSearch = () => { setPage(1); setQuery(search); };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--ink)]">Course Library</h1><p className="mt-1 text-sm text-[var(--muted)]">All courses in the platform.</p></div>
        <a href="/author/courses/new" className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"><BookOpen className="h-4 w-4" /> Add Course</a>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Library} label="Total Courses" value={data ? data.total.toLocaleString() : "—"} />
        <StatCard icon={BookOpen} label="Published" value={data ? data.published.toLocaleString() : "—"} />
        <StatCard icon={AlertCircle} iconBg="bg-amber-50" label="Draft" value={data ? data.draft.toLocaleString() : "—"} />
        <StatCard icon={Users} label="Total Enrollments" value={data ? data.totalEnrollments.toLocaleString() : "—"} />
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-5 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} placeholder="Search courses..." className="w-full rounded-lg border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]" />
          </div>
          <button onClick={runSearch} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]">Search</button>
          {data && <span className="ml-auto text-xs text-[var(--muted)]">{data.matchCount.toLocaleString()} results</span>}
        </div>
        {loading ? (
          <p className="p-5 text-sm text-[var(--muted)]">Loading…</p>
        ) : !data ? (
          <p className="p-5 text-sm text-[var(--muted)]">Could not load courses.</p>
        ) : data.courses.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">No courses match your search.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.courses.map((course) => (
              <li key={course.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-dark)]"><BookOpen className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink)]">{course.title}</p>
                  <p className="text-xs text-[var(--muted)]">{course.source} · {course.category} · {course.enrollments} enrolled</p>
                </div>
                {course.incomplete && <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Incomplete</span>}
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[course.status] ?? "bg-slate-100 text-slate-600"}`}>{course.status}</span>
                <button className="shrink-0"><Eye className="h-4 w-4 text-[var(--muted)]" /></button>
              </li>
            ))}
          </ul>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] p-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">Previous</button>
            <span className="text-sm text-[var(--muted)]">Page {data.page} of {data.totalPages.toLocaleString()}</span>
            <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
