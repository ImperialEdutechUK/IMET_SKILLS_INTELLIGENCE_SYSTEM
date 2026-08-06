"use client";

/**
 * Browse Courses — search and filter the whole approved catalogue (~27.6k rows).
 *
 * One page for every role. Employees, managers and admins see the same courses,
 * so there is no reason for three near-identical screens to drift apart; the
 * only per-role difference is where the sidebar links to it from.
 *
 * Two decisions carry the performance of this screen:
 *  • Filters live in the URL, not in component state. Back/forward work, a
 *    filtered view is shareable, and every distinct view is its own SWR cache
 *    key — so paging back to somewhere you have been is instant and silent.
 *  • The search box is debounced. Firing a request per keystroke is what would
 *    actually hurt here: the database is remote, so each request costs a
 *    round-trip regardless of how fast the query itself is.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight, BookOpen, Check, Compass, Loader2, Search, SlidersHorizontal, Star, X,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import { ErrorPanel, RefreshingBadge, Skeleton } from "@/components/ui/DataState";
import { apiSend, useApi, ApiError } from "@/lib/api";

const CARD =
  "rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04),0_10px_26px_-14px_rgba(15,27,45,.12)]";

interface Facet { value: string; label: string; count: number }
interface Facets {
  total: number;
  providers: Facet[];
  providersTruncated: boolean;
  categories: Facet[];
  levels: Facet[];
  sources: Facet[];
}

interface CourseCard {
  id: string;
  title: string;
  provider: string | null;
  level: string | null;
  durationHours: number | null;
  cpdHours: number;
  rating: number | null;
  externalUrl: string | null;
  source: string;
  costType: string | null;
  category: { id: string; name: string } | null;
  skills: { id: string; name: string }[];
}

interface CatalogueData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: string;
  filtered: boolean;
  courses: CourseCard[];
  enrolled: Record<string, string>;
}

/** The filter keys this page owns in the query string. */
const FILTER_KEYS = ["q", "provider", "category", "level", "source"] as const;

const SORT_OPTIONS = [
  { value: "title", label: "Title (A–Z)" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Recently added" },
  { value: "shortest", label: "Shortest first" },
];

export default function BrowseCoursesPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <BrowseCourses />
    </Suspense>
  );
}

function BrowseCourses() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();

  /** Replace the query string, resetting to page 1 for anything but paging. */
  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, search],
  );

  // ── Search box ────────────────────────────────────────────────────────────
  // The input is uncontrolled by the URL while you type, then catches up. The
  // effect below is the debounce; it is also why an external change (a chip
  // being cleared, the back button) has to push back into the draft.
  const urlQuery = params.get("q") ?? "";
  const [draft, setDraft] = useState(urlQuery);
  useEffect(() => setDraft(urlQuery), [urlQuery]);
  useEffect(() => {
    if (draft.trim() === urlQuery) return;
    const timer = setTimeout(() => update({ q: draft.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [draft, urlQuery, update]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: facets } = useApi<Facets>("/api/courses/catalogue/facets");
  const { data, error, isLoading, isRefreshing, refresh } = useApi<CatalogueData>(
    search ? `/api/courses/catalogue?${search}` : "/api/courses/catalogue",
  );

  const activeFilters = useMemo(
    () => FILTER_KEYS.map((key) => [key, params.get(key)] as const).filter(([, v]) => Boolean(v)),
    [params],
  );

  const labelFor = useCallback(
    (key: string, value: string) => {
      const list =
        key === "provider" ? facets?.providers
        : key === "category" ? facets?.categories
        : key === "level" ? facets?.levels
        : key === "source" ? facets?.sources
        : undefined;
      return list?.find((f) => f.value === value)?.label ?? value;
    },
    [facets],
  );

  const clearAll = () => router.replace(pathname, { scroll: false });

  const goToPage = (page: number) => {
    update({ page: page > 1 ? String(page) : null });
    // Paging without this leaves the user at the bottom of the previous page.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHeader
        icon={Compass}
        title="Browse Courses"
        subtitle="Search the full approved catalogue and add anything to your learning."
        meta={<RefreshingBadge show={isRefreshing} />}
        action={
          <Link
            href="/me/learning"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-slate-50"
          >
            <BookOpen className="h-4 w-4" /> My Learning
          </Link>
        }
      />

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <section className={`${CARD} mb-5 p-4`} aria-label="Search and filter">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by course title or provider…"
              aria-label="Search courses"
              className="w-full rounded-xl border border-[var(--border)] py-2.5 pl-10 pr-9 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
            {draft && (
              <button
                type="button"
                onClick={() => setDraft("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 lg:shrink-0">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
            <FilterSelect
              label="Sort by"
              value={params.get("sort") ?? "title"}
              onChange={(v) => update({ sort: v === "title" ? null : v })}
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              allLabel={null}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <FilterSelect label="Category" allLabel="All categories" value={params.get("category") ?? ""} onChange={(v) => update({ category: v || null })} options={facetOptions(facets?.categories)} />
          <FilterSelect label="Provider" allLabel="All providers" value={params.get("provider") ?? ""} onChange={(v) => update({ provider: v || null })} options={facetOptions(facets?.providers)} />
          <FilterSelect label="Platform" allLabel="All platforms" value={params.get("source") ?? ""} onChange={(v) => update({ source: v || null })} options={facetOptions(facets?.sources)} />
          <FilterSelect label="Level" allLabel="Any level" value={params.get("level") ?? ""} onChange={(v) => update({ level: v || null })} options={facetOptions(facets?.levels)} />
        </div>

        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
            {activeFilters.map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => update({ [key]: null })}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-tint)] py-1 pl-3 pr-2 text-xs font-medium text-[var(--brand-dark)] transition-opacity hover:opacity-80"
              >
                {key === "q" ? `“${value}”` : labelFor(key, value as string)}
                <X className="h-3 w-3" aria-hidden />
                <span className="sr-only">Remove this filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-[var(--muted)] underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* ── Result count ─────────────────────────────────────────────────── */}
      <p className="mb-4 text-sm text-[var(--muted)]" aria-live="polite">
        {data ? (
          <>
            <span className="font-semibold text-[var(--ink)]">{data.total.toLocaleString()}</span>{" "}
            {data.total === 1 ? "course" : "courses"}
            {data.filtered ? " match your filters" : " in the catalogue"}
          </>
        ) : (
          "Loading the catalogue…"
        )}
      </p>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <CatalogueSkeleton />
      ) : !data ? (
        <ErrorPanel message={error?.message ?? "Could not load the catalogue."} onRetry={refresh} />
      ) : data.courses.length === 0 ? (
        <EmptyState
          icon={Search}
          heading="No courses match those filters"
          message="Try a broader search term, or clear a filter or two — the catalogue holds tens of thousands of courses."
          action={
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-dark)]"
            >
              Clear all filters
            </button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <CourseTile key={course.id} course={course} enrolledStatus={data.enrolled[course.id]} />
            ))}
          </ul>
          <Pagination
            className="mt-6"
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            onChange={goToPage}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course tile
// ---------------------------------------------------------------------------

function CourseTile({ course, enrolledStatus }: { course: CourseCard; enrolledStatus?: string }) {
  // Optimistic local state so the button confirms instantly; the server list
  // catches up on its own next revalidation.
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const inLearning = Boolean(enrolledStatus) || added;

  const add = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await apiSend("/api/me/enrollments", "POST", { courseId: course.id }, { invalidates: ["/api/me"] });
      setAdded(true);
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : "Could not add this course.");
    } finally {
      setBusy(false);
    }
  };

  const meta = [
    course.level,
    formatHours(course.durationHours),
    course.cpdHours > 0 ? `${formatNumber(course.cpdHours)} CPD` : null,
  ].filter(Boolean);

  return (
    <li className={`${CARD} flex flex-col p-5`}>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
          {SOURCE_LABELS[course.source] ?? course.source}
        </span>
        {course.rating != null && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--ink)]">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {course.rating.toFixed(1)}
            <span className="sr-only">out of 5</span>
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--ink)]" title={course.title}>
        {course.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">
        {[course.provider, course.category?.name].filter(Boolean).join(" · ") || "Provider not listed"}
      </p>

      {course.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {course.skills.map((skill) => (
            <li
              key={skill.id}
              className="rounded-md bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-dark)]"
            >
              {skill.name}
            </li>
          ))}
        </ul>
      )}

      {/* Pushes the footer down so tiles in a row align regardless of content. */}
      <div className="flex-1" />

      {meta.length > 0 && <p className="mt-4 text-xs text-[var(--muted)]">{meta.join(" · ")}</p>}

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        {inLearning ? (
          <Link
            href="/me/learning"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> In my learning
          </Link>
        ) : (
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-dark)] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BookOpen className="h-3.5 w-3.5" aria-hidden />}
            {busy ? "Adding…" : "Add to my learning"}
          </button>
        )}
        {course.externalUrl && (
          <a
            href={course.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-slate-50"
          >
            Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">{course.title} on {SOURCE_LABELS[course.source] ?? course.source}</span>
          </a>
        )}
      </div>

      {failed && <p className="mt-2 text-xs text-rose-600">{failed}</p>}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  coursera: "Coursera",
  edx: "edX",
  linkedin: "LinkedIn Learning",
  internal: "iMET internal",
};

/** Facet list → <option> list, with counts so a filter's yield is visible up front. */
function facetOptions(facets: Facet[] | undefined) {
  return (facets ?? []).map((f) => ({ value: f.value, label: `${f.label} (${f.count.toLocaleString()})` }));
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatHours(hours: number | null): string | null {
  if (hours == null || hours <= 0) return null;
  return `${formatNumber(hours)}h`;
}

function FilterSelect({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  /** Text for the empty/no-filter option. `null` when the control always has a value. */
  allLabel: string | null;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = allLabel !== null && value !== "";
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className={`max-w-[15rem] appearance-none truncate rounded-lg border py-2 pl-3 pr-8 text-xs font-medium outline-none transition-colors focus:ring-2 focus:ring-[var(--brand)]/25 disabled:opacity-50 ${
          active
            ? "border-[var(--brand)] bg-[var(--brand-tint)] text-[var(--brand-dark)]"
            : "border-[var(--border)] bg-white text-[var(--ink)] hover:bg-slate-50"
        }`}
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60"
        viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden
      >
        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

/** Shaped like the real grid so the first paint doesn't reflow when data lands. */
function CatalogueSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className={`${CARD} p-5`}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-1.5 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <div className="mt-4 flex gap-1.5">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mt-5 h-8 w-full" />
        </li>
      ))}
    </ul>
  );
}
