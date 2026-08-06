/**
 * In-process read cache with single-flight de-duplication.
 *
 * Built for the course catalogue, whose data is effectively immutable between
 * `npm run sync:*` runs: ~27.6k rows that nobody edits at request time. Two
 * distinct wins, and the second matters more than the first:
 *
 *  1. TTL cache — a repeated browse of page 1 costs nothing.
 *  2. Single-flight — if fifty users ask for the same page in the same instant,
 *     ONE query goes to Postgres and all fifty await it. Without this the cache
 *     is useless exactly when it matters, because a cold key under load turns
 *     into fifty concurrent queries each holding a connection from Railway's
 *     pool. Pool exhaustion, not row count, is what degrades this app.
 *
 * Scope, honestly: one Node process, in memory — the same trade-off already
 * accepted in `rate-limit.ts`. Behind N instances you get N caches, which is
 * fine (they converge on the same immutable rows) and needs no Redis, no new
 * service, no recurring cost. Values are plain JSON-able query results; never
 * cache anything user-specific under a shared key.
 */

interface Entry<T> {
  value: T;
  /** Epoch ms after which this value must be re-read. */
  expiresAt: number;
}

// Survives Next.js dev-mode hot reloads, like the prisma singleton in db.ts.
const globalForCache = globalThis as unknown as {
  __queryCache?: Map<string, Entry<unknown>>;
  __queryCacheInflight?: Map<string, Promise<unknown>>;
};
const store = (globalForCache.__queryCache ??= new Map<string, Entry<unknown>>());
const inflight = (globalForCache.__queryCacheInflight ??= new Map<string, Promise<unknown>>());

/** Cached pages are small (~24 rows of card fields), so this is a few MB at worst. */
const MAX_ENTRIES = 400;

function evict(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  // Still full of live entries: drop the oldest half. Map iterates in insertion
  // order, so this is a rough LRU without the bookkeeping of a real one.
  if (store.size >= MAX_ENTRIES) {
    let toDrop = Math.ceil(store.size / 2);
    for (const key of store.keys()) {
      if (toDrop-- <= 0) break;
      store.delete(key);
    }
  }
}

/**
 * Return `key`'s cached value, or run `load` once and cache it for `ttlMs`.
 *
 * A rejected load is never cached and never poisons the key — the next caller
 * retries against the database.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();

  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then((value) => {
      if (store.size >= MAX_ENTRIES) evict(Date.now());
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Drop every cached entry whose key starts with `prefix`.
 *
 * Catalogue TTLs are short enough that a sync's new courses surface on their
 * own within minutes; call this from an importer to make them appear at once.
 */
export function invalidateCache(prefix: string): number {
  let dropped = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      dropped++;
    }
  }
  return dropped;
}
