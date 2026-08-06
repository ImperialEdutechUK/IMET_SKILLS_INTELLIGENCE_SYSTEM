import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { cached } from "@/lib/query-cache";
import { VISIBLE } from "@/server/courses/catalogue";
import { hiddenCourseIds } from "@/server/courses/hidden-courses";

/**
 * The filter options for the catalogue browser, with a live count beside each.
 *
 * Counts matter: a filter that silently returns nothing reads as a broken page,
 * whereas "Coursera (3,135)" tells the user what they are about to get.
 *
 * The whole payload is one cached value shared by every user and refreshed at
 * most once every ten minutes. Aggregating 27.6k rows six ways is a real query;
 * doing it per page-load would be the most expensive thing on the screen, and
 * doing it once per ten minutes makes it free.
 *
 * PROVIDERS ARE CAPPED. The live catalogue has 2,193 distinct providers — a
 * long tail of single-course universities. Shipping all of them is ~40KB of
 * JSON on every load for a `<select>` nobody can scroll. We send the top 60 by
 * course count, which covers the providers people actually filter by; the
 * long tail stays reachable because the free-text search matches `provider`
 * as well as `title`.
 */

const TTL_MS = 10 * 60_000;
const MAX_PROVIDERS = 60;

interface Facet {
  value: string;
  label: string;
  count: number;
}

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const facets = await cached("catalogue:facets", TTL_MS, async () => {
    // The same non-Latin-title exclusion the list route applies, so a facet
    // count can never promise courses the list would then hide.
    const hidden = await hiddenCourseIds();
    const where = hidden.length ? { ...VISIBLE, id: { notIn: hidden } } : VISIBLE;

    const [total, providerRows, levelRows, sourceRows, costRows, categoryRows] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.groupBy({
        by: ["provider"],
        where,
        _count: { _all: true },
        orderBy: { _count: { provider: "desc" } },
        take: MAX_PROVIDERS,
      }),
      prisma.course.groupBy({ by: ["level"], where, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["source"], where, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["costType"], where, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["categoryId"], where, _count: { _all: true } }),
    ]);

    // Category names live on another table; resolve only the ids actually in use.
    const categoryIds = categoryRows.map((r) => r.categoryId).filter((id): id is string => Boolean(id));
    const categories = categoryIds.length
      ? await prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const byCountThenLabel = (a: Facet, b: Facet) =>
      b.count - a.count || a.label.localeCompare(b.label);

    // `null` is not a filter — "unspecified" is a gap in the scrape, not a
    // choice a user would make. Those rows stay visible under "All".
    const providers: Facet[] = providerRows
      .filter((r) => r.provider)
      .map((r) => ({ value: r.provider as string, label: r.provider as string, count: r._count._all }));

    const levels: Facet[] = levelRows
      .filter((r) => r.level)
      .map((r) => ({ value: r.level as string, label: r.level as string, count: r._count._all }))
      // Difficulty reads as a progression, never as a popularity ranking.
      .sort((a, b) => ["Beginner", "Intermediate", "Advanced"].indexOf(a.value) - ["Beginner", "Intermediate", "Advanced"].indexOf(b.value));

    const SOURCE_LABELS: Record<string, string> = {
      coursera: "Coursera",
      edx: "edX",
      linkedin: "LinkedIn Learning",
      internal: "iMET internal",
    };
    const sources: Facet[] = sourceRows
      .map((r) => ({ value: r.source, label: SOURCE_LABELS[r.source] ?? r.source, count: r._count._all }))
      .sort(byCountThenLabel);

    const COST_LABELS: Record<string, string> = { free: "Free", subscription: "Subscription" };
    const costs: Facet[] = costRows
      .filter((r) => r.costType && COST_LABELS[r.costType])
      .map((r) => ({ value: r.costType as string, label: COST_LABELS[r.costType as string], count: r._count._all }))
      .sort(byCountThenLabel);

    const categoryFacets: Facet[] = categoryRows
      .filter((r) => r.categoryId && nameById.has(r.categoryId))
      .map((r) => ({
        value: r.categoryId as string,
        label: nameById.get(r.categoryId as string) as string,
        count: r._count._all,
      }))
      .sort(byCountThenLabel);

    return {
      total,
      providers,
      providersTruncated: providerRows.length >= MAX_PROVIDERS,
      categories: categoryFacets,
      levels,
      sources,
      costs,
    };
  });

  return NextResponse.json(facets, {
    // Identical for every user, but the endpoint needs a bearer token, so keep
    // it out of shared caches and let the browser hold it for five minutes.
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
