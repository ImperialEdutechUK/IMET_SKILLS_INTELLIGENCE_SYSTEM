"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { cacheProvider, swrCache } from "@/lib/swr-cache";
import { ApiError } from "@/lib/api";

/**
 * Global SWR configuration.
 *
 * The cache provider is the persistent, user-scoped one, so a cold page load
 * paints from disk instead of from a spinner. Everything hydrated that way is
 * revalidated immediately (see `useApi`), so the screen corrects itself within
 * one round trip.
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  // Flush pending cache writes before the tab goes away, so a refresh doesn't
  // lose the last few responses.
  useEffect(() => {
    const flush = () => swrCache.flushNow();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  return (
    <SWRConfig
      value={{
        provider: cacheProvider,
        revalidateOnFocus: true,
        // Coming back to a tab shouldn't hammer the API on every alt-tab.
        focusThrottleInterval: 30_000,
        // Collapse duplicate requests for the same endpoint (several widgets on
        // one screen often want the same payload).
        dedupingInterval: 5_000,
        errorRetryCount: 2,
        errorRetryInterval: 2_000,
        shouldRetryOnError: (err) => {
          // Auth and permission failures will never succeed on retry.
          const status = err instanceof ApiError ? err.status : 0;
          return status !== 401 && status !== 403 && status !== 404;
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
