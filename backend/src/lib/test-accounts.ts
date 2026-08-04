// Test / onboarding demo accounts that must never pollute team aggregates,
// leaderboards or risk counts. We exclude by name/email pattern rather than a
// schema column: reversible, no production migration, one place to maintain.
//
// An admin-only `includeTest` toggle can reveal them (see excludeTestAccounts).

const TEST_FULL_NAMES = new Set(["test", "onboardtest", "onboard test"]);
const TEST_EMAIL_RE = /(^|[._+-])(onboardtest|test)(@|[._+-])/i;

export interface TestAccountLike {
  fullName?: string | null;
  email?: string | null;
}

/** True when the user is a seeded test/onboarding account, not a real person. */
export function isTestAccount(u: TestAccountLike): boolean {
  const name = (u.fullName ?? "").trim().toLowerCase();
  if (TEST_FULL_NAMES.has(name)) return true;
  const email = (u.email ?? "").trim();
  return email ? TEST_EMAIL_RE.test(email) : false;
}

/**
 * Drop test accounts from a list of users. `includeTest` (admin-only) keeps them.
 * Filtering happens in JS after the query because the match is a name/email
 * pattern, not a stored flag.
 */
export function excludeTestAccounts<T extends TestAccountLike>(users: T[], includeTest = false): T[] {
  return includeTest ? users : users.filter((u) => !isTestAccount(u));
}

/** Read the admin-only `?includeTest=1` toggle from a request URL. */
export function wantsTestAccounts(req: Request, isAdmin: boolean): boolean {
  if (!isAdmin) return false;
  const v = new URL(req.url).searchParams.get("includeTest");
  return v === "1" || v === "true";
}
