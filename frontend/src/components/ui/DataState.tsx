"use client";

import { RefreshCw, AlertCircle } from "lucide-react";

/**
 * The three states a stale-while-revalidate screen can be in, rendered
 * consistently everywhere.
 *
 * - Skeleton: genuinely nothing to show yet (first ever visit).
 * - RefreshingBadge: cached data is on screen and being checked. Deliberately
 *   quiet — the whole point is that the user carries on reading.
 * - ErrorPanel: the request failed and we have nothing cached to fall back on.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

/** Placeholder shaped like a stat/summary card grid. */
export function CardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder shaped like a page: header, stat row, two panels. */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80" />
      </div>
      <CardGridSkeleton cards={cards} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

/** Placeholder shaped like a table. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] p-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shown while cached data is being revalidated. Keep it out of the layout flow
 * of the content itself — it must never cause a reflow when it appears.
 */
export function RefreshingBadge({ show, className = "" }: { show: boolean; className?: string }) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--muted)] transition-opacity duration-200 ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      } ${className}`}
    >
      <RefreshCw className="h-3 w-3 animate-spin" />
      Updating…
    </span>
  );
}

export function ErrorPanel({
  message = "Could not load this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{message}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            The server didn&apos;t respond as expected. Your connection may be down.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-slate-50"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
