# Course ingestion

How external courses get into the catalogue, and why each source works the way
it does.

## Sources at a glance

| Source | Mechanism | Coverage | Credentials |
| --- | --- | --- | --- |
| **Coursera** | Public Catalog API + page scraper | ~22.7k courses (all of it) | none |
| **LinkedIn Learning** | Official admin CSV/XLSX export | your licensed library | admin console |
| **edX** | Official Discovery API (OAuth2) | catalogue | `EDX_CLIENT_ID` / `EDX_CLIENT_SECRET` |
| **Manual** | CSV / XLSX / JSON upload | whatever you upload | none |
| **Apify** | Generic crawler → dataset | unreliable, see below | `APIFY_TOKEN` |

---

## Coursera

Two phases, because the two halves of the data live in different places.

### Phase 1 — catalogue (API, no scraping)

`https://api.coursera.org/api/courses.v1` is public and unauthenticated. It
paginates up to `limit=1000`, so the **entire ~22,727-course catalogue is about
23 requests**. It returns title, description, workload, language, partner ids,
and a domain taxonomy.

A crawler over 22k HTML pages would be slower, more fragile, and return *less*
structured data. So this half is an API client, not a scraper.

Mapping decisions:

- `partnerIds` → `provider` via `partners.v1` (so a course reads "Google Cloud",
  not "Coursera" — Coursera is the platform, the partner is the teacher).
- `domainTypes[].domainId` (`business`) → **Category**. It is not a skill.
- `domainTypes[].subdomainId` (`machine-learning`) → **Skill**. Coarse, but real.
- `workload` → `durationHours` via `duration.ts`. Only ~55% of courses set it,
  and the text is multilingual free-form (`"4h 30m"`, `"2 heures"`,
  `"4 weeks of study, 2-4 hours a week"`). A weekly *rate* with no week count
  (`"4-8 hours/week"`) yields `undefined` — `cpdHours` feeds recommendation
  scoring, so an absent value beats an invented one.
- `costType` is left unset. Coursera courses are typically free to audit and
  paid to certify; the API exposes no price, so we assert nothing.

### Phase 2 — enrichment (the scraper)

The Catalog API returns **no skill tags, no difficulty, no rating**. The course
page does. `/learn/{slug}` embeds them in its server-rendered JSON:

```json
{"skills":["Supervised Learning","NumPy","Feature Engineering", ...],
 "difficultyLevel":"BEGINNER",
 "averageFiveStarRating":4.895,"reviewCount":32638}
```

That is why a scraper exists. Skills go from ~2 coarse tags to 7–20 precise
ones, and `level` is worth +15 in `courses/scoring.ts`.

Politeness is structural, not incidental:

- `/learn/` is permitted by `coursera.org/robots.txt` for `User-agent: *`.
  `/lecture/` — which robots.txt disallows for AI crawlers — is never requested.
- honest, contactable User-Agent (override with `SCRAPER_USER_AGENT`)
- bounded concurrency (default 4) and a delay per request (default 400ms)
- exponential backoff honouring `Retry-After` on 429/5xx

> One caveat worth knowing: `api.coursera.org/robots.txt` carries
> `Disallow: /api/`. That directive addresses crawlers, and the Catalog API is a
> documented public API intended for programmatic clients — but the ambiguity is
> real. Rate limits stay conservative and the User-Agent stays honest.

### Running it

Full syncs take minutes (catalogue) to hours (enrichment), well past any HTTP
timeout, so they belong on the CLI:

```bash
# fetch + report, never touches the database
npm run sync:coursera -- --dry-run --limit 200

# whole catalogue, no page scraping (~23 API calls)
npm run sync:coursera -- --approve --publish

# whole English catalogue + page skills/level/rating (hours; resumable)
npm run sync:coursera -- --languages en --enrich --approve --publish
```

| Flag | Meaning |
| --- | --- |
| `--dry-run` | fetch and summarise; no database connection at all |
| `--limit N` | stop after N courses |
| `--languages en,es` | filter by primary language (default: all) |
| `--query python` | substring filter on title/description |
| `--enrich` | scrape `/learn/{slug}` for skills, level, rating |
| `--concurrency N` | parallel page fetches (default 4) |
| `--delay MS` | pause before each page fetch (default 400) |
| `--no-resume` | ignore the scrape cache and re-fetch every page |
| `--approve` / `--publish` | make courses immediately recommendable |

Enrichment checkpoints every page to `.cache/coursera-enrich.jsonl`, so an
interrupted run resumes instead of re-scraping thousands of pages.

There is also `POST /api/courses/sync/coursera` for small, bounded syncs
(`limit` ≤ 2000; ≤ 200 with `enrich`). It exists for the admin UI, not for a
full catalogue pull.

---

## LinkedIn Learning

**LinkedIn Learning cannot be scraped, and this connector does not pretend to.**
Measured, not assumed:

- `linkedin.com/learning/<course>` returns **HTTP 404 behind an auth wall** to
  any client that is not signed in — a browser User-Agent changes nothing.
- there is **no public learning sitemap** (`/learning-sitemap.xml` → 404).
- `robots.txt` **disallows `/learning/search?`**, the only endpoint that could
  enumerate the catalogue.

Crawling it would mean driving a logged-in session past bot detection: it breaks
LinkedIn's terms, risks the account, and still could not enumerate the full
catalogue.

Instead, an admin exports the library from the **LinkedIn Learning admin console**
(Content → Library → Export) and uploads it:

```bash
curl -X POST /api/courses/sync/linkedin-learning \
  -H "Authorization: Bearer $TOKEN" \
  -F file=@linkedin-learning-export.csv
```

Column matching is tolerant (`Course Title` / `Content Title` / `Title`, and so
on) because export headers vary by version and locale. `Duration (seconds)` is
converted to hours; a bare `Duration` column is read as hours; `01:30:00` works.

Rows import as `approved: true, availableToOrg: true` — an admin exported them
from the organisation's own licensed library.

If you later obtain a LinkedIn Learning API agreement, `fetchCourses()` in
`connectors/linkedin.ts` is the single place to swap in the API call.

---

## Apify — why it under-delivers

The Apify connector reads whatever a generic crawler pushed into a dataset. In
practice that crawl harvested navigation and legal pages as if they were
courses:

```
"edX Courses | View all online courses on edX.org"  → edx.org/search
"Trademark policy | edX"                            → edx.org/trademarks
"UK modern slavery and human trafficking statement" → edx.org/modern-slavery-statement
"edX Site map"                                      → edx.org/sitemap
```

A generic crawler has no notion of "is this a course", so it takes `<title>` from
every page it reaches. Prefer a real source: the Coursera API, the edX Discovery
API, or a supported export.

Coursera courses previously captured by Apify are **adopted** rather than
duplicated: `bulkImporter` matches an incoming course to an existing row by
`externalUrl` when `(externalSource, externalId)` misses, then upgrades that row
in place to the canonical Coursera identity.

---

## Write path

`importCourses` (per-course, ~5 queries each) is fine for uploads. Whole-catalogue
syncs use **`importCoursesBulk`**, which:

1. resolves every distinct category once (~11)
2. resolves every distinct skill once, in memory (~45 coarse, a few thousand once
   enriched) instead of once per course-skill pair
3. writes in chunks with bounded concurrency
4. links skills with one `createMany({ skipDuplicates })` per chunk

Course identity, in order: `(externalSource, externalId)` → `externalUrl`. It
**never** matches on `title`. Two unrelated courses can share a title, and
`Course.title` is globally unique, so ~0.2% of Coursera titles collide. Those are
disambiguated (`"Title (Provider)"`) rather than dropped or silently overwritten.
