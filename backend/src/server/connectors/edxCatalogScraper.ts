/**
 * edX catalogue scraper — the whole public edX course catalogue.
 *
 * The official Discovery API (`edx.ts`) needs OAuth credentials and, as wired,
 * only pulls one page. The public site is a better, credential-free source:
 *
 *   - `https://www.edx.org/sitemap.xml` lists every course page
 *     (`/learn/{topic}/{slug}`) — ~5k of them.
 *   - each course page server-renders the course's full catalogue object into
 *     its Next.js flight data (`self.__next_f`), including a nested
 *     `activeCourseRun` (language, effort) and a Lightcast `skills` array.
 *
 * So, like the LinkedIn scraper, this is two halves: enumerate URLs from the
 * sitemap, then read the embedded object from each page.
 *
 * Picking the *right* object is the subtlety: a page embeds its own course plus
 * a carousel of recommendations, all the same shape. The page's own course is
 * the one whose `productName` is the tail of the page `og:title`
 * ("HarvardX: CS50's Introduction to Computer Science"), so we match on that and
 * brace-match the enclosing object out of the flight data.
 *
 * Only English, currently-offered `Course` products with skills are kept — a
 * non-English, archived, or skill-less row is not a useful recommendation.
 */
import { fetchWithRetry, mapLimit } from "./net";
import type { CourseCatalogueInput } from "./types";

const SITEMAP = "https://www.edx.org/sitemap.xml";
const ORIGIN = "https://www.edx.org";

export interface EdxScrapedCourse {
  externalId: string; // productUuid
  title: string;
  description?: string;
  provider?: string;
  skills: string[];
  level?: string;
  durationHours?: number;
  language: string; // always "English" here
  category?: string;
  url: string;
  costType?: string;
}

export interface ScrapeOptions {
  concurrency?: number;
  delayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, detail?: EdxScrapedCourse) => void;
  onError?: (url: string, err: Error) => void;
}

/** Every `/learn/{topic}/{slug}` course URL in the sitemap (deduped). */
export async function enumerateCourseUrls(opts: { signal?: AbortSignal } = {}): Promise<string[]> {
  const res = await fetchWithRetry(SITEMAP, { timeoutMs: 60_000, signal: opts.signal });
  if (!res.ok) throw new Error(`edX sitemap fetch failed (${res.status})`);
  const xml = await res.text();
  const urls = new Set<string>();
  const re = /<loc>(https:\/\/www\.edx\.org\/learn\/[^<]+\/[^<]+)<\/loc>/gi;
  for (let m = re.exec(xml); m; m = re.exec(xml)) urls.add(m[1].trim());
  return [...urls];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#x27": "'" };
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    const c = code.toLowerCase();
    if (ENTITIES[c]) return ENTITIES[c];
    if (c[0] === "#") {
      const n = c[1] === "x" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** The course name from the page's og:title ("Org: Course Name" → "Course Name" is a suffix). */
function ogTitle(html: string): string | null {
  const m = /property="og:title"\s+content="([^"]+)"/.exec(html) || /<title>([^<]+)<\/title>/.exec(html);
  if (!m) return null;
  const t = decodeEntities(m[1]).replace(/\s*\|\s*edX\s*$/, "").trim();
  return t && t !== "edX" ? t : null;
}

/** Undo one layer of Next.js flight-data escaping so the objects parse as JSON. */
function unescapeFlight(html: string): string {
  return html.replace(/\\\\/g, "\\").replace(/\\"/g, '"').replace(/\\\//g, "/");
}

/** From a between-fields index, the index of the enclosing object's closing brace. */
function objectEnd(text: string, idx: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let j = idx; j < text.length; j++) {
    const c = text[j];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth < 0) return j;
  }
  return -1;
}

/** Walking back from a closing brace, the index of its matching open brace. */
function objectStart(text: string, endIdx: number): number {
  let depth = 0, inStr = false;
  for (let i = endIdx; i >= 0; i--) {
    const c = text[i];
    if (c === '"') {
      let k = i - 1, bs = 0;
      while (k >= 0 && text[k] === "\\") { bs++; k--; }
      if (bs % 2 === 0) inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === "}") depth++;
    else if (c === "{" && --depth === 0) return i;
  }
  return -1;
}

interface EdxRun {
  languageId?: string;
  minEffort?: number;
  maxEffort?: number;
  weeksToComplete?: number;
  shortDescription?: string;
}
interface EdxSkill { skill?: string }
interface EdxProduct {
  productUuid?: string;
  productName?: string;
  productType?: string;
  productUrl?: string;
  productUrlSlug?: string;
  productShortDescription?: string;
  productOverview?: string;
  levelType?: string;
  availability?: string[];
  onlyArchivedCourseRuns?: boolean;
  skills?: (EdxSkill | string)[];
  partners?: { name?: string }[];
  partnerNameOverride?: string;
  subjects?: { name?: string; languageCode?: string }[];
  weeksToComplete?: number;
  activeCourseRun?: EdxRun;
  courseRuns?: EdxRun[];
}

/** The page's own course object, matched via og:title. Exported for tests. */
export function extractProduct(html: string): EdxProduct | null {
  const title = ogTitle(html);
  if (!title) return null;
  const text = unescapeFlight(html);

  // Candidate productNames that are a tail of the title; prefer the longest.
  const names = new Set<string>();
  const re = /"productName":"((?:[^"\\]|\\.)*)"/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    try { names.add(JSON.parse(`"${m[1]}"`)); } catch { /* skip */ }
  }
  const dec = [...names].filter((n) => title.endsWith(n)).sort((a, b) => b.length - a.length)[0];
  if (!dec) return null;

  const key = `"productName":"${dec.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const idx = text.indexOf(key);
  if (idx < 0) return null;
  const end = objectEnd(text, idx);
  const start = end < 0 ? -1 : objectStart(text, end);
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as EdxProduct;
  } catch {
    return null;
  }
}

function normaliseLevel(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes("introduc") || v.includes("begin")) return "Beginner";
  if (v.includes("intermediate")) return "Intermediate";
  if (v.includes("advanced")) return "Advanced";
  return undefined;
}

function estimateHours(o: EdxProduct): number | undefined {
  const run = o.activeCourseRun ?? o.courseRuns?.[0];
  const weeks = run?.weeksToComplete ?? o.weeksToComplete;
  const lo = run?.minEffort;
  const hi = run?.maxEffort;
  const effort = lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi);
  if (!weeks || !effort) return undefined;
  const hours = weeks * effort;
  return hours > 0 && hours <= 2000 ? Math.round(hours * 100) / 100 : undefined;
}

/** Map a page to a scraped course, or null if it isn't worth importing. */
export function parseCoursePage(html: string): EdxScrapedCourse | null {
  const o = extractProduct(html);
  if (!o?.productUuid || !o.productName?.trim()) return null;

  // Courses only (not Programs / Boot Camps / Executive Education bundles).
  if ((o.productType || "").toLowerCase() !== "course") return null;

  // English-only: the run's languageId is the language of instruction.
  const langId = (o.activeCourseRun?.languageId ?? o.courseRuns?.[0]?.languageId ?? "").toLowerCase();
  if (!langId.startsWith("en")) return null;

  // Currently offered only — an archived-only course can't be enrolled in.
  if (o.onlyArchivedCourseRuns === true) return null;
  const avail = (o.availability ?? []).map((a) => a.toLowerCase());
  if (avail.length > 0 && !avail.some((a) => a.includes("current") || a.includes("upcoming") || a.includes("soon"))) {
    return null;
  }

  const skills = [
    ...new Set(
      (o.skills ?? [])
        .map((s) => (typeof s === "string" ? s : s.skill))
        .map((s) => s?.trim())
        .filter((s): s is string => !!s)
    ),
  ];
  if (skills.length === 0) return null;

  const desc = (o.productShortDescription ?? o.activeCourseRun?.shortDescription ?? o.productOverview)
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    externalId: o.productUuid,
    title: o.productName.trim(),
    description: desc || undefined,
    provider: o.partners?.[0]?.name || o.partnerNameOverride || "edX",
    skills,
    level: normaliseLevel(o.levelType),
    durationHours: estimateHours(o),
    language: "English",
    category: o.subjects?.find((s) => s.languageCode === "en")?.name || o.subjects?.[0]?.name,
    url: o.productUrl || (o.productUrlSlug ? `${ORIGIN}/${o.productUrlSlug.replace(/^\//, "")}` : `${ORIGIN}/learn`),
    costType: "free", // edX audits are free; verified certificates are paid
  };
}

export async function scrapeCourse(url: string, opts: ScrapeOptions = {}): Promise<EdxScrapedCourse | null> {
  const res = await fetchWithRetry(url, {
    timeoutMs: opts.timeoutMs ?? 30_000,
    signal: opts.signal,
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return parseCoursePage(await res.text());
}

export async function scrapeCourses(
  urls: readonly string[],
  opts: ScrapeOptions = {}
): Promise<Map<string, EdxScrapedCourse>> {
  const out = new Map<string, EdxScrapedCourse>();
  let done = 0;
  await mapLimit(
    urls,
    opts.concurrency ?? 4,
    opts.delayMs ?? 350,
    async (url) => {
      const detail = await scrapeCourse(url, opts);
      done++;
      if (detail) out.set(detail.externalId, detail); // dedupe by productUuid
      opts.onProgress?.(done, urls.length, detail ?? undefined);
      return detail;
    },
    (url, _i, err) => {
      done++;
      opts.onError?.(url, err);
    }
  );
  return out;
}

export function toCatalogueInput(c: EdxScrapedCourse): CourseCatalogueInput {
  return {
    title: c.title,
    description: c.description,
    provider: c.provider ?? "edX",
    source: "edx",
    externalSource: "edx",
    externalId: c.externalId,
    externalUrl: c.url,
    level: c.level,
    durationHours: c.durationHours,
    cpdHours: c.durationHours ?? 0,
    costType: c.costType,
    language: "English",
    category: c.category,
    approved: false, // the sync flips this on via approveAll
    preferredProvider: false,
    availableToOrg: false,
    skills: c.skills,
  };
}
