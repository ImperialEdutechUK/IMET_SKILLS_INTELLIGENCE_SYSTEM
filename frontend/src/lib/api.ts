"use client";

/**
 * One way to read from the API, everywhere.
 *
 * `useApi` is a thin, typed wrapper over SWR. The important part is the
 * stale-while-revalidate contract it gives every screen:
 *
 *   - If we have a cached response (from this session or a previous one) it is
 *     painted immediately — no spinner, no blank page.
 *   - A real request always goes out anyway, and the UI swaps to the fresh
 *     response the moment it lands.
 *   - `isLoading` means "nothing to show yet"; `isRefreshing` means "showing
 *     something, checking it's still true". Screens should only block on the
 *     first.
 *
 * Writes go through `apiSend`, which invalidates the read caches it affects so
 * the next paint can never be a stale value the user just changed.
 */

import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";
import { clearAuth, getToken } from "@/lib/authClient";
import { swrCache } from "@/lib/swr-cache";

export const API = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  body: unknown;
  /** Seconds to wait, from Retry-After on a 429. Undefined otherwise. */
  retryAfter?: number;
  constructor(message: string, status: number, body?: unknown, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

/**
 * Turn `Retry-After: 893` into "in about 15 minutes".
 *
 * The API rate-limits authentication and password endpoints, so a user who
 * mistypes a password repeatedly now gets a 429. Reporting that as a bare
 * "Request failed (429)" would read as a broken app; telling them roughly how
 * long to wait reads as a rule.
 */
export function formatRetryAfter(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "in a moment";
  if (seconds < 60) return `in about ${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** A 401 means the token is gone or expired — drop the session and its cache. */
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  clearAuth();
  swrCache.clear();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

/** Raw fetch against the API. Throws {@link ApiError} on a non-2xx response. */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: authHeaders(init?.headers) });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();

    const serverMessage =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null;

    if (res.status === 429) {
      const header = Number(res.headers.get("Retry-After"));
      const retryAfter = Number.isFinite(header) ? header : undefined;
      // Append the wait to the server's own wording rather than replacing it —
      // the server knows WHICH limit was hit, we only know how long.
      const base = serverMessage ?? "Too many attempts.";
      throw new ApiError(
        `${base} Try again ${formatRetryAfter(retryAfter)}.`,
        429,
        body,
        retryAfter,
      );
    }

    throw new ApiError(serverMessage ?? `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}

export const fetcher = <T>(path: string) => apiFetch<T>(path);

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface UseApiOptions<T> extends SWRConfiguration<T, ApiError> {
  /** Skip the request entirely (e.g. a route param hasn't resolved yet). */
  enabled?: boolean;
}

export interface UseApiResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** True only when there is nothing at all to paint yet. Block on this. */
  isLoading: boolean;
  /** True when stale data is on screen and a fresh request is in flight. */
  isRefreshing: boolean;
  /** Force a revalidation now (e.g. a "Retry" button). */
  refresh: () => Promise<T | undefined>;
  /** SWR's mutate, for optimistic updates. */
  mutate: ReturnType<typeof useSWR<T, ApiError>>["mutate"];
}

export function useApi<T = unknown>(
  path: string | null | undefined,
  options: UseApiOptions<T> = {},
): UseApiResult<T> {
  const { enabled = true, ...swrOptions } = options;
  const key = enabled && path ? path : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<T, ApiError>(key, fetcher, {
    // Anything restored from localStorage is stale by definition — always
    // check it against the server so the screen self-corrects.
    revalidateIfStale: true,
    revalidateOnMount: true,
    revalidateOnReconnect: true,
    // When the key changes (a filter, a different department), keep showing the
    // last result instead of flashing back to a spinner.
    keepPreviousData: true,
    ...swrOptions,
  });

  return {
    data,
    error,
    isLoading: isLoading && data === undefined,
    isRefreshing: isValidating && data !== undefined,
    refresh: () => mutate(),
    mutate,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Drop cached reads so the next render refetches.
 *
 * Pass path prefixes — `invalidate("/api/me")` clears every `/api/me*` key.
 * Entries are revalidated rather than merely deleted, so screens currently
 * mounted refresh in place instead of falling back to a spinner.
 */
export function invalidate(...prefixes: string[]) {
  return globalMutate(
    (key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)),
    undefined,
    { revalidate: true },
  );
}

export interface ApiSendOptions {
  /** Cache prefixes this write makes stale. Revalidated once it succeeds. */
  invalidates?: string[];
}

/** POST/PATCH/PUT/DELETE with JSON in, JSON out, plus cache invalidation. */
export async function apiSend<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  options: ApiSendOptions = {},
): Promise<T> {
  const result = await apiFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  if (options.invalidates?.length) await invalidate(...options.invalidates);
  return result;
}

/**
 * Warm the cache for routes the user is about to need, without rendering them.
 * Used to prefetch a role's dashboard as soon as we know who they are.
 */
export function prefetch(...paths: string[]) {
  for (const path of paths) {
    globalMutate(path, fetcher(path), { revalidate: false }).catch(() => {
      /* best effort — the real screen will retry */
    });
  }
}
