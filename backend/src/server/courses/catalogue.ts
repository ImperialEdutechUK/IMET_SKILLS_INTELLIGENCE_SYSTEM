/**
 * Shared shape of the browsable course catalogue.
 *
 * One module owns the visibility rule, the filter whitelist and the cache key
 * so the list endpoint and the facet endpoint can never disagree about what
 * "the catalogue" is — a facet offering 40 results for a filter the list route
 * reads differently is the classic way this feature rots.
 *
 * READ-ONLY. Nothing here writes to `Course`; the scraped catalogue is
 * production data.
 */

import type { Prisma } from "@prisma/client";

/**
 * What an ordinary signed-in user is allowed to see.
 *
 * The table is a raw scrape: `approved` and `status` are only flipped by a sync
 * run with the approve/publish flags, and the recommendation engine already
 * filters on `approved`. Browsing must apply the SAME gate, or self-reported
 * "manual-self" courses and un-vetted scrape rows would leak into a page every
 * employee can open. On the live DB this admits 27,581 of 27,587 rows.
 */
export const VISIBLE: Prisma.CourseWhereInput = { approved: true, status: "published" };

/**
 * A character outside the Latin scripts and common punctuation/symbol blocks.
 *
 * Titles matching this are written in another script (Chinese, Arabic, Hebrew,
 * Korean, …) — courses nobody browsing an English catalogue can take. They are
 * hidden from the browse UI for every role, but ONLY at query time: the rows
 * stay untouched in the `Course` table (production data) and reappear the
 * moment this rule is relaxed. Latin-script accents (café), curly quotes,
 * dashes, ™ and Roman numerals (Ⅰ) all stay visible.
 *
 * The same pattern is valid as a Postgres ARE and a JS RegExp, so the unit
 * tests exercise the exact string the database runs.
 */
export const NON_LATIN_TITLE = "[^\\u0000-\\u036f\\u1e00-\\u1eff\\u2000-\\u2bff]";

/** Cards are dense; 24 divides cleanly into 2, 3 and 4 column grids. */
export const PAGE_SIZE = 24;

/** Free-text longer than this is a paste, not a search. */
const MAX_QUERY = 80;

// Enum-backed columns must be whitelisted rather than passed through: an
// unknown value makes Prisma throw at query time, turning a typo in the query
// string into a 500.
const SOURCES = ["coursera", "edx", "linkedin", "internal"] as const;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const COSTS = ["free", "subscription"] as const;
const SORTS = ["title", "rating", "newest", "shortest"] as const;

export type CatalogueSort = (typeof SORTS)[number];

export interface CatalogueFilters {
  q: string;
  provider: string | null;
  categoryId: string | null;
  level: string | null;
  source: (typeof SOURCES)[number] | null;
  cost: (typeof COSTS)[number] | null;
  sort: CatalogueSort;
  page: number;
}

function pick<T extends string>(raw: string | null, allowed: readonly T[]): T | null {
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function parseCatalogueFilters(url: URL): CatalogueFilters {
  const p = url.searchParams;
  const rawPage = Number.parseInt(p.get("page") ?? "1", 10);
  const provider = (p.get("provider") ?? "").trim();
  const categoryId = (p.get("category") ?? "").trim();

  return {
    // A one-character query matches most of the catalogue, so it is worth no
    // more than no query at all — and costs a full scan to prove it.
    q: (p.get("q") ?? "").trim().slice(0, MAX_QUERY),
    provider: provider || null,
    categoryId: categoryId || null,
    level: pick(p.get("level"), LEVELS),
    source: pick(p.get("source"), SOURCES),
    cost: pick(p.get("cost"), COSTS),
    sort: pick(p.get("sort"), SORTS) ?? "title",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

/** True when the user has narrowed the catalogue at all. */
export function isFiltered(f: CatalogueFilters): boolean {
  return Boolean(f.q.length >= 2 || f.provider || f.categoryId || f.level || f.source || f.cost);
}

export function catalogueWhere(
  f: CatalogueFilters,
  hiddenIds: string[] = [],
): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { ...VISIBLE };
  if (hiddenIds.length) where.id = { notIn: hiddenIds };

  if (f.q.length >= 2) {
    // Title and provider only. `description`/`curriculum`/`learningOutcomes` are
    // long TOASTed text — matching them turns a cheap scan into an expensive one
    // for a search nobody asked for.
    where.OR = [
      { title: { contains: f.q, mode: "insensitive" } },
      { provider: { contains: f.q, mode: "insensitive" } },
    ];
  }
  if (f.provider) where.provider = f.provider;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.level) where.level = f.level;
  if (f.source) where.source = f.source;
  if (f.cost) where.costType = f.cost;

  return where;
}

/**
 * Sort orders, each with `title` as the tie-break.
 *
 * Without a deterministic tie-break, rows with equal ratings can swap between
 * pages and the user sees the same course twice while never seeing another.
 * `title` is the only indexed ordering column (it is `@unique`), so the default
 * sort is also the cheapest one.
 */
export function catalogueOrderBy(sort: CatalogueSort): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ rating: { sort: "desc", nulls: "last" } }, { title: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { title: "asc" }];
    case "shortest":
      return [{ durationHours: { sort: "asc", nulls: "last" } }, { title: "asc" }];
    default:
      return [{ title: "asc" }];
  }
}

/** The card fields, and nothing else — no long text columns in a list view. */
export const CARD_SELECT = {
  id: true,
  title: true,
  provider: true,
  level: true,
  durationHours: true,
  cpdHours: true,
  rating: true,
  externalUrl: true,
  source: true,
  costType: true,
  category: { select: { id: true, name: true } },
  courseSkills: { select: { skill: { select: { id: true, name: true } } }, take: 3 },
} satisfies Prisma.CourseSelect;

/**
 * Stable cache key for a filter set. Identical filters from different users must
 * produce the same string or the shared cache never hits.
 */
export function catalogueCacheKey(f: CatalogueFilters, scope: "rows" | "count"): string {
  const parts = [
    f.q.toLowerCase(),
    f.provider ?? "",
    f.categoryId ?? "",
    f.level ?? "",
    f.source ?? "",
    f.cost ?? "",
  ];
  // Rows depend on ordering and position; a count does not.
  if (scope === "rows") parts.push(f.sort, String(f.page));
  return `catalogue:${scope}:${parts.join("|")}`;
}
