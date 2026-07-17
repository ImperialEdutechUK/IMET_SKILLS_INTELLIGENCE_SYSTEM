/**
 * Slug enumeration for the LinkedIn Learning scrape.
 *
 * The one thing a course page cannot give us is the *list* of course pages:
 * `/learning/search?` is disallowed by robots.txt and gated behind login, so
 * there is no first-party way to list the catalogue anonymously. We assemble it
 * from two independent, public sources and take the union:
 *
 *   1. Wayback Machine CDX index — Internet Archive has captured LinkedIn
 *      Learning for years. Its CDX API does an unauthenticated prefix scan over
 *      every archived `www.linkedin.com/learning/*` URL (course pages *and*
 *      lesson pages, both of which carry the course slug as their first path
 *      segment). One pass yields ~9k distinct slugs. This is the bulk source.
 *
 *   2. Guest topic tree — `/learning/browse` lists ~260 topics; each
 *      `/learning/topics/{topic}` server-renders ~20 current courses to
 *      anonymous visitors. Both pages are permitted by robots.txt. This catches
 *      recent courses the archive has not seen yet.
 *
 * Enumeration only produces *candidate* slugs; the scraper is the source of
 * truth. Retired or mistyped slugs simply 404 there and are dropped, so it is
 * safe (and desirable) for this step to over-collect.
 */
import { fetchWithRetry, sleep } from "./net";

const CDX = "http://web.archive.org/cdx/search/cdx";
const LEARNING = "https://www.linkedin.com/learning";

/** Path segments under /learning/ that are features, not courses. */
const NON_COURSE = new Set([
  "search", "me", "settings", "topics", "paths", "browse", "login", "instructors",
  "certificates", "subscription", "signup", "start", "share", "embed", "articles",
  "courses", "career", "collections", "home", "onboarding", "notifications",
  "trending", "author", "enterprise", "lms",
]);

/**
 * A plausible course slug: lowercase, hyphen-joined words (every real course
 * slug is multi-word), 6–150 chars, not a known feature path. Deliberately
 * permissive — the scraper rejects anything that isn't a live course.
 */
export function isCandidateSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return (
    /^[a-z0-9][a-z0-9-]{5,149}$/.test(s) &&
    s.includes("-") &&
    !NON_COURSE.has(s)
  );
}

/** Extract the course slug (first path segment) from any /learning/ URL. */
function slugFromLearningUrl(url: string): string | undefined {
  const m = /linkedin\.com\/learning\/([A-Za-z0-9][A-Za-z0-9-]{5,150})(?:[/?#]|$)/i.exec(url);
  const s = m?.[1]?.toLowerCase();
  return s && isCandidateSlug(s) ? s : undefined;
}

export interface EnumerateOptions {
  /** Include the Wayback CDX source (default true). */
  wayback?: boolean;
  /** Include the guest topic-tree source (default true). */
  topics?: boolean;
  /** Stop once this many distinct slugs are collected (default: no cap). */
  limit?: number;
  signal?: AbortSignal;
  delayMs?: number;
  onProgress?: (source: string, found: number, total: number) => void;
}

/** Rows per CDX block. The API streams the whole result otherwise; blocks keep
 *  each request bounded and resumable. */
const WAYBACK_BLOCK = 20_000;
/** A runaway safety valve — the real result is a few hundred blocks at most. */
const WAYBACK_MAX_BLOCKS = 500;

/**
 * Walk the Wayback CDX index for archived course URLs using `resumeKey`
 * pagination: each request returns up to `WAYBACK_BLOCK` rows followed by a
 * blank line and an opaque resume key, which is fed back to fetch the next
 * block. (`collapse=urlkey` de-duplicates captures server-side; it is
 * incompatible with the numbered-page API, hence resume keys.)
 */
export async function enumerateFromWayback(opts: EnumerateOptions = {}): Promise<Set<string>> {
  const slugs = new Set<string>();
  const base =
    `${CDX}?url=www.linkedin.com/learning/&matchType=prefix&collapse=urlkey` +
    `&fl=original&output=text&limit=${WAYBACK_BLOCK}&showResumeKey=true`;

  let resumeKey = "";
  for (let block = 0; block < WAYBACK_MAX_BLOCKS; block++) {
    if (opts.signal?.aborted) break;

    let text: string;
    try {
      const url = resumeKey ? `${base}&resumeKey=${encodeURIComponent(resumeKey)}` : base;
      const res = await fetchWithRetry(url, { timeoutMs: 180_000, signal: opts.signal });
      if (!res.ok) break;
      text = await res.text();
    } catch {
      break; // a flaky block ends the scan with what we have, rather than aborting
    }

    // The API appends a blank line + an opaque resume key after the data, but
    // only when more blocks remain. A URL is never the key, so the last
    // non-empty line counts as a key only if it isn't itself a capture line.
    const lines = text.split("\n");
    let nextKey = "";
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (!t) continue;
      if (!t.includes("linkedin.com/")) {
        nextKey = t;
        lines.splice(i); // drop the key line from the data
      }
      break;
    }

    for (const line of lines) {
      const slug = slugFromLearningUrl(line.trim());
      if (slug) slugs.add(slug);
      if (opts.limit && slugs.size >= opts.limit) return slugs;
    }
    opts.onProgress?.("wayback", slugs.size, WAYBACK_MAX_BLOCKS);

    if (!nextKey || nextKey === resumeKey) break; // no more blocks
    resumeKey = nextKey;
    await sleep(opts.delayMs ?? 250);
  }
  return slugs;
}

/** Course slugs linked from a single rendered guest page. */
function courseSlugsInHtml(html: string): string[] {
  const out: string[] = [];
  const re = /\/learning\/([A-Za-z0-9][A-Za-z0-9-]{5,150})(?:[/"?#])/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const s = m[1].toLowerCase();
    if (isCandidateSlug(s)) out.push(s);
  }
  return out;
}

/** Topic slugs linked from the browse page (and any topic page). */
function topicSlugsInHtml(html: string): string[] {
  const out = new Set<string>();
  const re = /\/learning\/topics\/([a-z0-9][a-z0-9-]{1,70})/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) out.add(m[1].toLowerCase());
  return [...out];
}

/**
 * Crawl the guest topic tree: browse page → topic pages → course slugs. Every
 * page here is permitted by robots.txt and rendered to anonymous visitors.
 */
export async function enumerateFromTopics(opts: EnumerateOptions = {}): Promise<Set<string>> {
  const slugs = new Set<string>();
  const delay = opts.delayMs ?? 300;

  let topics: string[] = [];
  try {
    const res = await fetchWithRetry(`${LEARNING}/browse`, {
      timeoutMs: 30_000,
      signal: opts.signal,
      headers: { Accept: "text/html" },
    });
    const html = await res.text();
    topics = topicSlugsInHtml(html);
    for (const s of courseSlugsInHtml(html)) slugs.add(s);
  } catch {
    return slugs;
  }

  for (let i = 0; i < topics.length; i++) {
    if (opts.signal?.aborted) break;
    if (opts.limit && slugs.size >= opts.limit) break;
    try {
      const res = await fetchWithRetry(`${LEARNING}/topics/${topics[i]}`, {
        timeoutMs: 30_000,
        signal: opts.signal,
        headers: { Accept: "text/html" },
      });
      if (res.ok) for (const s of courseSlugsInHtml(await res.text())) slugs.add(s);
    } catch {
      // skip a flaky topic
    }
    opts.onProgress?.("topics", slugs.size, topics.length);
    await sleep(delay);
  }
  return slugs;
}

/** Union of every enabled source, capped at `limit` if given. */
export async function enumerateSlugs(opts: EnumerateOptions = {}): Promise<string[]> {
  const all = new Set<string>();

  if (opts.wayback !== false) {
    for (const s of await enumerateFromWayback(opts)) all.add(s);
  }
  if (opts.topics !== false && !(opts.limit && all.size >= opts.limit)) {
    for (const s of await enumerateFromTopics(opts)) all.add(s);
  }

  const list = [...all];
  return opts.limit ? list.slice(0, opts.limit) : list;
}
