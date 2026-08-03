"use client";

/**
 * Persistent, user-scoped cache provider for SWR.
 *
 * SWR's own cache is a plain in-memory Map: it makes *navigation* instant but a
 * browser refresh (or a new tab) starts cold, which is exactly when users sit
 * staring at "Loading…". This provider mirrors the cache into localStorage so a
 * cold start can paint last-known data immediately while the real request is
 * still in flight.
 *
 * Two rules keep stale bytes from ever being mistaken for the truth:
 *   1. Everything hydrated from disk is *always* revalidated (see useApi).
 *   2. The cache is bucketed per user id and wiped on logout, so one account can
 *      never paint another account's data.
 */

import type { Cache, State } from "swr";

const BUCKET_PREFIX = "ls_swr:";
/** Entries older than this are dropped rather than shown — a day-old dashboard is not a useful first paint. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** localStorage gives us ~5MB per origin; stay well inside it. */
const MAX_BYTES = 1_500_000;
const FLUSH_DELAY_MS = 400;

type Persisted = Record<string, { d: unknown; t: number }>;

/** Only real API responses are worth persisting — SWR's internal bookkeeping keys are not. */
function isPersistable(key: string) {
  return key.startsWith("/api/");
}

function bucketKey(userId: string) {
  return `${BUCKET_PREFIX}${userId}`;
}

class PersistentCache implements Cache<unknown> {
  private map = new Map<string, State<unknown>>();
  /** Load timestamps, so we can evict oldest-first when we run out of room. */
  private stamps = new Map<string, number>();
  private userId: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- SWR Cache interface -------------------------------------------------

  keys() {
    return this.map.keys();
  }

  get(key: string) {
    return this.map.get(key);
  }

  set(key: string, value: State<unknown>) {
    this.map.set(key, value);
    if (isPersistable(key) && value?.data !== undefined && value.error === undefined) {
      this.stamps.set(key, Date.now());
      this.scheduleFlush();
    }
  }

  delete(key: string) {
    this.map.delete(key);
    this.stamps.delete(key);
    this.scheduleFlush();
  }

  // ---- User scoping --------------------------------------------------------

  /**
   * Point the cache at a user's bucket. Switching users (or going from
   * logged-out to logged-in) throws away everything in memory first, so a
   * previous session's data can never leak into the new one.
   */
  activate(userId: string | null) {
    if (userId === this.userId) return;
    this.flushNow();
    this.map.clear();
    this.stamps.clear();
    this.userId = userId;
    if (userId) this.hydrate(userId);
  }

  /** Wipe memory + disk for the active user. Called on logout. */
  clear() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.map.clear();
    this.stamps.clear();
    if (this.userId && typeof window !== "undefined") {
      try {
        localStorage.removeItem(bucketKey(this.userId));
      } catch {
        /* storage disabled — nothing to clean up */
      }
    }
    this.userId = null;
  }

  /** Drop every bucket we've ever written, including other users'. */
  clearAll() {
    this.clear();
    if (typeof window === "undefined") return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(BUCKET_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage disabled */
    }
  }

  // ---- Persistence ---------------------------------------------------------

  private hydrate(userId: string) {
    if (typeof window === "undefined") return;
    let parsed: Persisted;
    try {
      const raw = localStorage.getItem(bucketKey(userId));
      if (!raw) return;
      parsed = JSON.parse(raw) as Persisted;
    } catch {
      return; // corrupt or unreadable — start cold rather than guess
    }
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.t !== "number" || entry.t < cutoff) continue;
      // isLoading/isValidating stay false: this is a real (if stale) value, and
      // useApi reports staleness separately via `isStale`.
      this.map.set(key, { data: entry.d, error: undefined, isValidating: false, isLoading: false });
      this.stamps.set(key, entry.t);
    }
  }

  private scheduleFlush() {
    if (typeof window === "undefined" || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushNow();
    }, FLUSH_DELAY_MS);
  }

  flushNow() {
    if (typeof window === "undefined" || !this.userId) return;
    // Newest first, so the budget trim below drops the least useful entries.
    const entries = [...this.stamps.entries()].sort((a, b) => b[1] - a[1]);
    const out: Persisted = {};
    let bytes = 0;
    for (const [key, t] of entries) {
      const state = this.map.get(key);
      if (!state || state.data === undefined) continue;
      let chunk: string;
      try {
        chunk = JSON.stringify(state.data);
      } catch {
        continue; // non-serialisable payload — skip it, don't fail the whole flush
      }
      bytes += chunk.length + key.length + 24;
      if (bytes > MAX_BYTES) break;
      out[key] = { d: state.data, t };
    }
    try {
      localStorage.setItem(bucketKey(this.userId), JSON.stringify(out));
    } catch {
      // Quota exceeded or storage disabled. Drop our bucket so we fail cold
      // rather than half-written.
      try {
        localStorage.removeItem(bucketKey(this.userId));
      } catch {
        /* nothing else we can do */
      }
    }
  }
}

export const swrCache = new PersistentCache();

/** SWR calls this once to obtain the cache instance. */
export const cacheProvider = () => swrCache as Cache<unknown>;
