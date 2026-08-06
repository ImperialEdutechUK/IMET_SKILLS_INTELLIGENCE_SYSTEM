import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cached } from "@/lib/query-cache";
import {
  CARD_SELECT,
  PAGE_SIZE,
  catalogueCacheKey,
  catalogueOrderBy,
  catalogueWhere,
  isFiltered,
  parseCatalogueFilters,
} from "@/server/courses/catalogue";
import { hiddenCourseIds } from "@/server/courses/hidden-courses";

/**
 * Browse the approved course catalogue: search + filter + paginate.
 *
 * Open to every signed-in role — employees, managers, admins and authors all
 * get the same read-only view of the same rows, so there is one endpoint rather
 * than three that drift apart. Nothing here is department-scoped: a course is
 * not somebody's data.
 *
 * Cost control, in the order it matters:
 *  • Rows and counts are cached and single-flighted (`query-cache`), so a burst
 *    of users landing on page 1 costs one query, not one query each. The
 *    catalogue only changes on a sync, so a short TTL is free correctness.
 *  • The unfiltered total is cached far longer — it is the same number for
 *    everyone and only moves when new courses are ingested.
 *  • Only card fields are selected; the long text columns never leave Postgres.
 *  • Enrollment state is per-user, so it is cached under its own per-user key —
 *    a learner has tens of enrollments, not thousands, so reading the whole set
 *    once beats one lookup per page view. With this, a warm request touches the
 *    database zero times.
 *
 * Read-only: the scraped catalogue is never written by this route.
 */

/** Catalogue rows are immutable between syncs; a minute of staleness is invisible. */
const ROWS_TTL_MS = 60_000;
const COUNT_TTL_MS = 60_000;
const TOTAL_TTL_MS = 10 * 60_000;
/** Short: a course the learner just added should show as theirs almost at once.
 *  The tile also flips optimistically, so this window is never user-visible. */
const ENROLLED_TTL_MS = 15_000;

/** Generous — this is a browse screen, not an auth endpoint. It exists so one
 *  runaway client cannot drain the connection pool for everybody else. */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const limit = rateLimit(`catalogue:${authUser.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit, "Too many requests. Slow down and try again.");

  const filters = parseCatalogueFilters(new URL(req.url));
  // Non-Latin-script titles are hidden for every role; the rows themselves are
  // never touched. The id list is cached, so this is free on a warm request.
  const where = catalogueWhere(filters, await hiddenCourseIds());
  const filtered = isFiltered(filters);

  const total = await cached(
    filtered ? catalogueCacheKey(filters, "count") : "catalogue:count:all",
    filtered ? COUNT_TTL_MS : TOTAL_TTL_MS,
    () => prisma.course.count({ where }),
  );

  // Clamp into range so a hand-typed ?page=9999 returns the last page of results
  // instead of an empty screen the user has no way to interpret.
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const courses = await cached(
    catalogueCacheKey({ ...filters, page }, "rows"),
    ROWS_TTL_MS,
    () =>
      prisma.course.findMany({
        where,
        select: CARD_SELECT,
        orderBy: catalogueOrderBy(filters.sort),
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
  );

  // Which of these 24 is the viewer already taking? Read the learner's whole
  // enrollment set once (indexed by userId, and small — tens of rows) and cache
  // it under a key nobody else can share, then intersect in memory. Doing it
  // per page instead would put a database round-trip back on every request,
  // which is the only cost that actually matters here.
  const enrolledAll = await cached(`catalogue:enrolled:${authUser.id}`, ENROLLED_TTL_MS, () =>
    prisma.enrollment.findMany({
      where: { userId: authUser.id },
      select: { courseId: true, status: true },
    }),
  );
  const enrolledByCourse = new Map(enrolledAll.map((e) => [e.courseId, e.status]));

  return NextResponse.json(
    {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      sort: filters.sort,
      filtered,
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        provider: c.provider,
        level: c.level,
        durationHours: c.durationHours,
        cpdHours: c.cpdHours,
        rating: c.rating,
        externalUrl: c.externalUrl,
        source: c.source,
        costType: c.costType,
        category: c.category,
        skills: c.courseSkills.map((cs) => cs.skill),
      })),
      enrolled: Object.fromEntries(
        courses.flatMap((c) => {
          const status = enrolledByCourse.get(c.id);
          return status ? [[c.id, status] as const] : [];
        }),
      ),
    },
    // Private: the payload carries the viewer's own enrollment state, so it must
    // never be held in a shared proxy cache.
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
