"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// The one pager for every long list. Given the total item count and page size it
// renders "Showing X–Y of N" plus prev/next and numbered pages. Keyboard/focus
// come from the global focus-visible ring. Callers keep the current page in
// state and slice their data with pageSlice().
export function pageCountOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Slice a list for the given 1-based page. */
export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default function Pagination({
  page,
  total,
  pageSize,
  onChange,
  className = "",
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const pageCount = pageCountOf(total, pageSize);
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // A compact window of page numbers around the current one.
  const nums: number[] = [];
  const win = 1;
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - win && p <= page + win)) nums.push(p);
  }

  const btn = "grid h-9 min-w-9 place-items-center rounded-lg border border-[var(--border)] px-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:hover:bg-white";

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-[var(--muted)]">
        Showing <span className="font-medium text-[var(--ink)]">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="font-medium text-[var(--ink)]">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className={`${btn} text-[var(--ink)] hover:bg-slate-50`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((p, i) => {
          const gap = i > 0 && p - nums[i - 1] > 1;
          const active = p === page;
          return (
            <span key={p} className="flex items-center gap-1.5">
              {gap && <span className="px-0.5 text-[var(--muted)]">…</span>}
              <button
                type="button"
                onClick={() => onChange(p)}
                aria-current={active ? "page" : undefined}
                className={`${btn} ${active ? "border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand)]" : "text-[var(--ink)] hover:bg-slate-50"}`}
              >
                {p}
              </button>
            </span>
          );
        })}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Next page" className={`${btn} text-[var(--ink)] hover:bg-slate-50`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
