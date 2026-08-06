import { describe, it, expect, vi } from "vitest";
import { cached, invalidateCache } from "./query-cache";

/** Entries live on globalThis; give every test its own key space. */
let counter = 0;
const freshKey = () => `qc-test-${counter++}-${Math.random()}`;

describe("cached", () => {
  it("runs the loader once and serves the cached value after", async () => {
    const key = freshKey();
    const load = vi.fn().mockResolvedValue("value");

    expect(await cached(key, 60_000, load)).toBe("value");
    expect(await cached(key, 60_000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("re-reads once the TTL has passed", async () => {
    const key = freshKey();
    const load = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    expect(await cached(key, 1, load)).toBe("first");
    await new Promise((r) => setTimeout(r, 5));
    expect(await cached(key, 1, load)).toBe("second");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("single-flights a cold key — N concurrent callers cause ONE load", async () => {
    // The whole reason this module exists: without de-duplication a burst of
    // users on the same page opens a database connection each and drains the
    // pool. Concurrency, not row count, is the failure mode.
    const key = freshKey();
    let resolve: (v: string) => void = () => {};
    const load = vi.fn().mockImplementation(() => new Promise<string>((r) => { resolve = r; }));

    const inflight = Promise.all(Array.from({ length: 25 }, () => cached(key, 60_000, load)));
    resolve("shared");

    expect(await inflight).toEqual(Array(25).fill("shared"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps separate keys independent", async () => {
    const a = freshKey();
    const b = freshKey();
    expect(await cached(a, 60_000, async () => "a")).toBe("a");
    expect(await cached(b, 60_000, async () => "b")).toBe("b");
    expect(await cached(a, 60_000, async () => "changed")).toBe("a");
  });

  it("does not cache a rejected load, and lets the next caller retry", async () => {
    const key = freshKey();
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("recovered");

    await expect(cached(key, 60_000, load)).rejects.toThrow("db down");
    expect(await cached(key, 60_000, load)).toBe("recovered");
  });

  it("invalidateCache drops only the matching prefix", async () => {
    const stamp = Math.random();
    const kept = `qc-keep-${stamp}`;
    const dropped = `qc-drop-${stamp}`;

    await cached(kept, 60_000, async () => "kept");
    await cached(dropped, 60_000, async () => "dropped");

    expect(invalidateCache(`qc-drop-${stamp}`)).toBe(1);
    expect(await cached(kept, 60_000, async () => "reloaded")).toBe("kept");
    expect(await cached(dropped, 60_000, async () => "reloaded")).toBe("reloaded");
  });
});
