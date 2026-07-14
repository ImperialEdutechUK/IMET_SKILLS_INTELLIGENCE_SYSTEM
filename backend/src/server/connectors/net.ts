/**
 * Shared networking helpers for catalogue connectors and scrapers.
 *
 * Every outbound request identifies itself honestly, times out, and backs off
 * when the upstream asks it to (429 / 5xx / Retry-After). Crawls are throttled
 * by a bounded-concurrency map rather than firing thousands of parallel fetches.
 */

/** Honest, contactable User-Agent. Override with SCRAPER_USER_AGENT. */
export function userAgent(): string {
  return (
    process.env.SCRAPER_USER_AGENT ||
    "iMET-Skills-Intelligence/1.0 (course catalogue sync; +https://imperiallearning.co.uk)"
  );
}

export interface FetchOptions {
  /** Per-attempt timeout in ms (default 30000). */
  timeoutMs?: number;
  /** Attempts before giving up, including the first (default 4). */
  retries?: number;
  /** Base delay for exponential backoff in ms (default 500). */
  backoffMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** `Retry-After` may be seconds or an HTTP date; returns ms, or null. */
function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

/**
 * Fetch with a timeout and exponential backoff on transient failures.
 * Non-retryable responses (e.g. 404) are returned as-is for the caller to judge.
 */
export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, retries = 4, backoffMs = 500 } = opts;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (opts.signal?.aborted) throw new Error("Aborted.");

    const timer = new AbortController();
    const timeout = setTimeout(() => timer.abort(), timeoutMs);
    // Abort the in-flight request if the caller cancels the whole crawl.
    const onAbort = () => timer.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: "*/*", ...opts.headers },
        signal: timer.signal,
        redirect: "follow",
      });

      if (!RETRYABLE_STATUS.has(res.status)) return res;

      lastError = new Error(`HTTP ${res.status} from ${url}`);
      if (attempt === retries - 1) return res; // out of attempts: let caller see it
      await sleep(retryAfterMs(res) ?? backoffMs * 2 ** attempt + Math.random() * 250);
    } catch (err) {
      lastError = err as Error;
      if (opts.signal?.aborted) throw new Error("Aborted.");
      if (attempt === retries - 1) break;
      await sleep(backoffMs * 2 ** attempt + Math.random() * 250);
    } finally {
      clearTimeout(timeout);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new Error(`Request failed after ${retries} attempts: ${url} — ${lastError?.message}`);
}

/** Fetch and parse JSON, raising on a non-2xx response. */
export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetchWithRetry(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/**
 * Map over items with at most `concurrency` in flight, pausing `delayMs`
 * between each task start so a crawl stays polite. Results keep input order;
 * a failing item yields `undefined` rather than sinking the whole batch.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>,
  onError?: (item: T, index: number, err: Error) => void
): Promise<(R | undefined)[]> {
  const results = new Array<R | undefined>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const i = cursor++;
      if (delayMs > 0) await sleep(delayMs);
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        onError?.(items[i], i, err as Error);
        results[i] = undefined;
      }
    }
  };

  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  return results;
}

/** Split an array into fixed-size chunks (for batched DB writes). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
