/**
 * The course ids hidden from the browse catalogue: rows whose title is written
 * in a non-Latin script (see `NON_LATIN_TITLE`). ~45 of ~27.6k rows on the live
 * DB, so an id exclusion list is cheaper and simpler than rewriting the list,
 * count and facet queries as raw SQL.
 *
 * READ-ONLY — the `Course` table is never written; hiding happens per query.
 * Cached and single-flighted like every other catalogue read, and the key
 * shares the `catalogue:` prefix so an importer's invalidation sweeps it too.
 */

import { prisma } from "@/lib/db";
import { cached } from "@/lib/query-cache";
import { NON_LATIN_TITLE } from "./catalogue";

/** The set only changes on a sync; ten minutes matches the facets cache. */
const TTL_MS = 10 * 60_000;

export async function hiddenCourseIds(): Promise<string[]> {
  return cached("catalogue:hidden-ids", TTL_MS, async () => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Course" WHERE title ~ ${NON_LATIN_TITLE}`;
    return rows.map((r) => r.id);
  });
}
