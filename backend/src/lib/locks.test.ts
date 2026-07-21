import { describe, it, expect } from "vitest";
import { withLock } from "./locks";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("withLock", () => {
  it("serialises critical sections for the same key", async () => {
    const events: string[] = [];
    const task = (name: string) =>
      withLock("k", async () => {
        events.push(`${name}:start`);
        await sleep(20);
        events.push(`${name}:end`);
      });
    await Promise.all([task("a"), task("b"), task("c")]);
    // No task may start before the previous one ended.
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
  });

  it("does not block different keys", async () => {
    const events: string[] = [];
    await Promise.all([
      withLock("k1", async () => {
        await sleep(30);
        events.push("k1");
      }),
      withLock("k2", async () => {
        events.push("k2");
      }),
    ]);
    // k2 finished while k1 was still sleeping — different keys run in parallel.
    expect(events).toEqual(["k2", "k1"]);
  });

  it("keeps the queue usable after a holder throws", async () => {
    await expect(
      withLock("k", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    await expect(withLock("k", async () => "ok")).resolves.toBe("ok");
  });

  it("returns each holder's own result", async () => {
    const [a, b] = await Promise.all([
      withLock("k", async () => "first"),
      withLock("k", async () => "second"),
    ]);
    expect(a).toBe("first");
    expect(b).toBe("second");
  });
});
