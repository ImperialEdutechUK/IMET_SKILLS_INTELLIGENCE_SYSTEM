/**
 * In-process keyed mutex.
 *
 * Serialises short critical sections that must not interleave for the same
 * key — e.g. the delete+create "replace this user's rows" transactions in gap
 * analysis and recommendation persistence. Two concurrent requests for the
 * same employee otherwise interleave as T1-delete → T2-delete → T1-insert →
 * T2-insert, and the second insert violates the unique constraint (P2002) or
 * stalls on row locks until the transaction dies (P2028).
 *
 * Scope: one Node process. That covers the realistic collision source (the
 * same user double-clicking / two tabs hitting one server); cross-instance
 * races are additionally absorbed by `skipDuplicates` on the createMany calls
 * this lock protects.
 */

// Survives Next.js dev-mode hot reloads, like the prisma singleton in db.ts.
const globalForLocks = globalThis as unknown as { __keyedLocks?: Map<string, Promise<unknown>> };
const locks = (globalForLocks.__keyedLocks ??= new Map<string, Promise<unknown>>());

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  // Chain after the previous holder regardless of how it finished.
  const run = prev.then(fn, fn);
  // Park a settled-safe tail so an error in `run` doesn't reject later waiters.
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}
