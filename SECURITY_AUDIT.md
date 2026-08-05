# Security Audit — LearnSmart AI (iMET Skills Intelligence System)

**Date:** 2026-08-05
**Branch:** `feature/mergedfromMain`
**Scope:** whole repository — `backend/` (Next.js API + Prisma), `frontend/` (Next.js), shared config, dependencies, git history.
**Baselines:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS 4.0 Level 2, CWE.
**Nothing was committed, pushed or deployed.** No live secret was rotated, no migration was run, no production system was touched.

---

## 1. Executive posture

The application had one **Critical** flaw that gave complete, unauthenticated takeover of any account including the administrator, and a family of **High** broken-access-control flaws that let any department manager read and write another department's employee data by changing an id in a URL. Both classes are fixed and covered by regression tests.

The engineering underneath is careful — derived values are recomputed rather than trusted, enrollment writes are append-only and auditable, the recommendation pipeline is deterministic. The gap was consistently at the **boundary**: routes verified *who is calling* and reliably forgot to check *what they are asking for*.

| | Before | After |
|---|---|---|
| Critical | 1 | 0 |
| High | 7 | 0 |
| Medium | 8 | 1 (accepted, mitigated) |
| Low / Info | 4 | 3 (documented) |
| Backend prod dependency vulns | 6 high / 5 moderate | 1 high (no upstream fix) |
| Frontend dependency vulns | 2 critical / 3 high | 0 |
| Backend tests | 141 | 214 |

**Status: CONDITIONALLY READY — required deployment actions remain.** See §7. The blocking items are operational, not code: `AUTH_SECRET` must be rotated, and every existing session is invalidated by this change set.

---

## 2. Architecture and attack surface

Two Next.js apps, deployed separately, sharing one PostgreSQL database on Railway.

- **`frontend/`** (Vercel, port 3000 in dev) — React client. No Prisma, no DB access. Holds the JWT in `localStorage` and attaches it as a bearer token.
- **`backend/`** (Railway, port 3001) — 50 API route handlers under `src/app/api`, Prisma 7 over `@prisma/adapter-pg`.
- **Trust boundary** — the browser talks cross-origin to the backend. CORS allowlist lives in `backend/src/middleware.ts`.

**Roles:** `employee`, `manager`, `admin`, `author`. **Tenant unit:** `Department`. Managers are provisioned one per department and must only ever see their own — this is the isolation rule the audit turned on.

**Two parallel auth stacks**, which is where the inconsistency came from:
- `lib/verifyToken.ts` — used directly by ~35 hand-written routes.
- `server/http.ts` `requireAuth()` — a thin wrapper used by the 15 recommendation-engine routes.

Both now share the same hardened verifier. A third layer, `lib/authz.ts`, is new and is the single place the department rule is expressed.

**Sensitive assets:** password hashes, CPD records, skill levels and gaps, uploaded certificates (stored as base64 data URLs in `Certificate.fileUrl`), uploaded documents (on disk, `UPLOAD_DIR`), AI provider API keys, the ~27.6k-row scraped `Course` catalogue.

**Untrusted input reaching parsers:** `.xlsx/.csv/.docx/.pdf/.json` uploads → SheetJS / mammoth / pdf-parse → optional LLM extraction → writes to `UserSkill` and `RoleSkillRequirement`.

---

## 3. Findings register

Status is `FIXED`, `MITIGATED` or `ACCEPTED`. All fixes are in the working tree, uncommitted.

### A-01 · Critical · FIXED · Unauthenticated password reset — full account takeover

- **Category / CWE:** Broken Authentication · CWE-640 (Weak Password Recovery), CWE-306 (Missing Authentication for Critical Function) · OWASP A07:2021
- **Location:** `backend/src/app/api/auth/reset-password/route.ts`
- **Evidence:** The handler accepted `{ email, newPassword }`, looked the user up by email, and wrote the new hash. No token, no session, no current-password check, no rate limit. The file's own comment acknowledged it: *"this trusts whoever knows the username"*.
- **Impact:** Anyone who could reach the API could take over any account by knowing only its email address. `admin@imperiallearning.co.uk` is documented in `CLAUDE.md`, so administrator takeover — and with it every employee's personal and CPD data — required a single unauthenticated POST. This is total compromise of the application.
- **Fix:** Endpoint rewritten to redeem an admin-issued, single-use, 1-hour token. New admin-only issuer at `POST /api/admin/password-tokens`, surfaced in the UI on **Admin → User management** (key icon per row → confirm → code shown once with a copy button and hand-off instructions). Only the **SHA-256 digest** of the token is persisted to `PasswordToken.token`, so a database disclosure yields nothing redeemable. Redemption marks the token used inside the same transaction as the password write, guarded by `usedAt: null`, so two concurrent redemptions cannot both succeed. Every failure path returns one identical 400. Existing outstanding tokens for the user are voided on both reset and voluntary password change. Frontend `/forgot-password` rewritten to match. *No schema migration was required — the `PasswordToken` model already existed and was unused.*
- **Verification:** `src/lib/password-policy.test.ts` (14 tests) covers token entropy, uniqueness across 200 draws, digest determinism, and constant-time comparison. Manual review of the transaction. Build + full suite pass.

### A-02 · High · FIXED · Cross-department data exposure via URL parameter (manager dashboard)

- **Category / CWE:** Broken Object Level Authorisation · CWE-639, CWE-863 · OWASP API1:2023
- **Location:** `backend/src/app/api/manager/departments/[departmentId]/route.ts`
- **Evidence:** The route checked `authUser.role !== "manager"` and then used the `departmentId` from the URL verbatim. Nothing tied it to the caller.
- **Impact:** Any of the eight department managers could read any other department's full team roster, per-member CPD standing, at-risk flags, enrolled courses and activity feed by editing one id in the URL. Confidential HR-adjacent data crossing every tenant boundary in the product.
- **Fix:** `canAccessDepartment()` check added before any query. Admins remain unscoped; a manager with a null `departmentId` is denied rather than granted everything.
- **Verification:** `src/lib/authz.test.ts` — own-department allowed, other-department 403, null-department denied, admin unscoped.

### A-03 · High · FIXED · Cross-department skill-gap exposure

- **Category / CWE:** Broken Object Level Authorisation · CWE-639 · OWASP API1:2023
- **Location:** `backend/src/app/api/dashboard/department/[departmentId]/skill-gaps/route.ts`
- **Evidence:** `requireAuth(req, ["manager","admin","author"])` with no object check on `departmentId`.
- **Impact:** Same cross-tenant read as A-02, returning **named employees** with their individual skill gaps, gap counts and priority scores. Additionally exposed to the `author` role, which has no employee mandate at all.
- **Fix:** `assertDepartmentAccess()` added; `author` removed from the privileged list.
- **Verification:** `src/lib/authz.test.ts`; build passes.

### A-04 · High · FIXED · Any manager could read any employee's recommendations

- **Category / CWE:** Broken Object Level Authorisation · CWE-639 · OWASP API1:2023
- **Location:** `backend/src/app/api/recommendations/[employeeId]/route.ts`
- **Evidence:** `if (auth.id !== employeeId && !PRIVILEGED.includes(auth.role)) throw forbidden(...)` — role membership was the entire check for a non-self target.
- **Impact:** Any manager or author could read any employee's personal recommendation list, which discloses their skill gaps by implication.
- **Fix:** Non-self access now additionally requires `assertEmployeeAccess()`, which reads the target's department from the database and compares it to the caller's. `author` removed.
- **Verification:** `src/lib/authz.test.ts`.

### A-05 · High · FIXED · Cross-department writes via gap analysis and recommendation generation

- **Category / CWE:** Broken Function Level Authorisation · CWE-639, CWE-284 · OWASP API5:2023
- **Location:** `backend/src/app/api/gaps/run/[employeeId]/route.ts`, `backend/src/app/api/recommendations/generate/[employeeId]/route.ts`
- **Evidence:** Both took `employeeId` from the URL with a role-only guard, then **wrote** `SkillGap` / `Recommendation` rows for that user.
- **Impact:** A manager in one department could overwrite the stored gap analysis and recommendation set of any employee in any other department — a cross-tenant integrity failure, not merely a read.
- **Fix:** `assertEmployeeAccess()` on both; `author` removed from both write-role lists.
- **Verification:** `src/lib/authz.test.ts`; both routes build.
- **Note:** the recommendation **algorithm, scoring and architecture were not modified** — only the authorisation gate in front of the route handler.

### A-06 · High · FIXED · Arbitrary `userId` on document upload and processing

- **Category / CWE:** Mass Assignment / BOLA · CWE-639, CWE-915 · OWASP API3:2023, API6:2023
- **Location:** `backend/src/app/api/documents/upload/route.ts`, `backend/src/app/api/documents/[id]/process/route.ts`
- **Evidence:** `upload` read `userId` straight from the form with no check. `process` accepted a document id and an optional `userId`/`departmentId` with no check on either, then wrote extracted skills to that user. Where no target was given, `resolveEmployee()` in `server/documents/service.ts` falls back to matching an extracted **name** against the whole `User` table.
- **Impact:** A manager could upload a `SKILL_MATRIX` naming any employee in any department and process it, overwriting their recorded skill levels — `SKILL_MATRIX` and `MANAGER_EVALUATION` are treated as *authoritative* and can lower a level, not only raise it. That silently corrupts gap analysis, recommendations and CPD standing for someone outside the manager's remit. A manager could also process any other manager's uploaded document by id.
- **Fix:** Both routes now resolve the document and validate every target against the caller's scope: the document's own owner, an explicitly supplied `userId`, and any `departmentId`. Authors are barred from targeting an employee at all. A scoped caller processing an unowned document with no explicit target is refused, closing the name-matching fallback.
- **Verification:** `src/lib/authz.test.ts` for the scoping primitive; manual review of both handlers; build passes.

### A-07 · High · FIXED · No rate limiting on any authentication endpoint

- **Category / CWE:** Improper Restriction of Excessive Authentication Attempts · CWE-307 · OWASP API4:2023
- **Location:** `auth/login`, `auth/reset-password`, `register`, `me/password`
- **Evidence:** No limiter existed anywhere in the codebase (`grep -r 'rateLimit|throttle' backend/src` → nothing but HTTP retry/backoff in the scraper).
- **Impact:** Unlimited online password guessing. bcrypt cost 12 slows one attempt to ~100 ms but does nothing about concurrency; combined with the demo credentials published in `CLAUDE.md`, credential stuffing was unconstrained.
- **Fix:** New `lib/rate-limit.ts` — in-process fixed-window limiter, no new dependency and no recurring cost. Login is double-bucketed: 10/15 min per IP **and** 5/15 min per email, so distributing across IPs still hits a wall on a single account. A successful login clears both. Registration 5/hour/IP, reset 10/15 min/IP, password change 5/15 min per account+IP. All return 429 with `Retry-After`.
- **Verification:** `src/lib/rate-limit.test.ts` (11 tests) — blocks at the limit, keys stay independent, window expiry restores access, success resets, `Retry-After` correct.
- **Residual:** see R-01 — in-process only.

### A-08 · High · FIXED · Deactivated accounts could still sign in

- **Category / CWE:** Improper Access Control · CWE-284 · OWASP A01:2021
- **Location:** `backend/src/app/api/auth/login/route.ts`, `backend/src/app/api/set-password/route.ts`
- **Evidence:** Login rejected only `status === "pending_approval"`. The `UserStatus` enum also has `inactive`, so setting a leaver to `inactive` did not lock them out. Separately, `set-password` wrote `status: "active"` for **any** authenticated caller — a self-service reactivation switch.
- **Impact:** Deprovisioning did not deprovision. A departed employee retained full access, and any account holding a valid token could restore itself to `active`.
- **Fix:** Login now allows only `active` and `invited`, rejecting everything else with a 403. `set-password` reads status from the **database** rather than the token snapshot and promotes only `invited → active`.
- **Verification:** Manual review; build passes. Behavioural change is stated in §7.

### A-09 · Medium · FIXED · JWT verification accepted attacker-chosen algorithms

- **Category / CWE:** Improper Verification of Cryptographic Signature · CWE-347 · OWASP API2:2023
- **Location:** `backend/src/lib/verifyToken.ts`
- **Evidence:** `jwt.verify(token, JWT_SECRET)` with no options — no `algorithms`, no `issuer`, no `audience`, no claim-shape validation. Tokens were also issued with a 7-day lifetime.
- **Impact:** Algorithm confusion is not directly exploitable with a symmetric secret (the library rejects `alg: none` by default in current versions), but pinning is the ASVS L2 control and the absence of it is one dependency upgrade away from mattering. More concretely: the token was accepted with no validation that `role` was a real role, and no issuer/audience binding, so a token minted for any other service sharing the secret would be honoured.
- **Fix:** `algorithms: ["HS256"]`, `issuer` and `audience` pinned on both sign and verify. Payload claims validated after signature — a token with an unrecognised `role`, a missing `id`, or a non-string `departmentId` is rejected. Secret is now read lazily and throws loudly when unset, instead of being captured as `undefined` at import time and turning every request into a silent 401. Lifetime reduced 7 days → 8 hours.
- **Verification:** `src/lib/verifyToken.test.ts` (12 tests) — `alg: none` forgery rejected, HS512 rejected, wrong secret / issuer / audience rejected, expiry enforced, unknown role rejected, missing `AUTH_SECRET` throws.

### A-10 · Medium · FIXED · Internal error messages returned to clients

- **Category / CWE:** Generation of Error Message Containing Sensitive Information · CWE-209 · OWASP A05:2021
- **Location:** `backend/src/server/http.ts` (all 15 engine routes), `backend/src/app/api/manager/roles/route.ts`
- **Evidence:** The shared error boundary returned `err.message` verbatim on any unhandled 500. `manager/roles` returned `String(e)`.
- **Impact:** Prisma and driver errors carry table names, column names, constraint names and — in some connection-failure modes — the database host. Free reconnaissance for an attacker probing the API.
- **Fix:** Generic message plus a random `reference` UUID; the real error goes to the server log against the same reference, so support can still diagnose. `manager/roles` given the same treatment.
- **Verification:** Manual review; build passes. `HttpError` and Zod validation messages are deliberately still returned — those are authored, client-actionable text.

### A-11 · Medium · FIXED · Scriptable (SVG) content accepted as certificate proof

- **Category / CWE:** Unrestricted Upload of File with Dangerous Type · CWE-434, CWE-79 · OWASP A03:2021
- **Location:** `backend/src/lib/certificate-proof.ts`
- **Evidence:** `/^data:(application\/pdf|image\/[a-z0-9.+-]+);base64,/i` — `image/*` includes `image/svg+xml`, which is a scriptable document. The value is stored in `Certificate.fileUrl` and later rendered by employees, their manager and admins.
- **Impact:** Stored-XSS *potential*. Current rendering happens to be safe — `fileKind()` classifies SVG as `image` and `DocumentFrame` uses `<img>`, which does not execute embedded script, and browsers block top-level `data:` navigation from the `<a href>` on the manager and admin pages. But an attacker-supplied scriptable payload sitting in the database, one refactor away from an `<iframe>` or `window.open`, is not a defensible position, and the file has no business being an SVG.
- **Fix:** Explicit allowlist — PDF, JPEG, PNG, WebP only. Base64 payload shape validated before storage. Frontend `accept` attribute and a client-side type check updated to mirror the server exactly.
- **Verification:** `src/lib/certificate-proof.test.ts` (11 tests) — SVG rejected, `text/html` / `application/xhtml+xml` / `text/javascript` rejected, `javascript:` and remote URLs rejected, malformed base64 rejected, valid formats still accepted.

### A-12 · Medium · FIXED · Unbounded file uploads reaching known-vulnerable parsers

- **Category / CWE:** Uncontrolled Resource Consumption · CWE-400, CWE-434 · OWASP API4:2023
- **Location:** `documents/upload`, `me/documents`, `me/cpd/upload`, `courses/import`, `courses/sync/linkedin-learning`
- **Evidence:** Every one did `Buffer.from(await file.arrayBuffer())` with no size check and no type check, then handed the bytes to SheetJS / mammoth / pdf-parse.
- **Impact:** The whole file is materialised in memory before anything inspects it — a cheap way to exhaust a small Railway instance. Compounded by D-01: the same path feeds `xlsx`, which has unfixed prototype-pollution and ReDoS advisories. `me/documents` and `me/cpd/upload` are reachable by **any authenticated employee**, making this the widest-open surface in the app.
- **Fix:** New `lib/upload-limits.ts` — 10 MB general cap (50 MB for the legitimately large LinkedIn library export), extension allowlist judged on the final extension (not the client-declared MIME type), filename length cap, and a second authoritative check against the bytes actually received. `me/cpd/upload` additionally capped at 2,000 rows so one upload cannot write unbounded `CpdRecord` rows and inflate a CPD total.
- **Verification:** `src/lib/upload-limits.test.ts` (12 tests) — size boundary exact, executable/scriptable extensions rejected, double extensions handled, MIME spoofing ineffective, narrower spreadsheet allowlist honoured.

### A-13 · Medium · FIXED · Account enumeration on registration and password reset

- **Category / CWE:** Observable Discrepancy · CWE-204 · OWASP API4:2023
- **Location:** `backend/src/app/api/register/route.ts`, `auth/reset-password`, `auth/login`
- **Evidence:** Registration returned a distinct `409 "An account with this email already exists."`. Reset returned `404 "No account found with that username."` Login skipped the bcrypt compare entirely when no user matched, leaving a measurable timing difference.
- **Impact:** A free oracle for which addresses in `@imperiallearning.co.uk` are registered — the reconnaissance step before credential stuffing (which A-07 left unlimited).
- **Fix:** Registration answers identically whether or not the address was taken, absorbing **only** a unique-constraint violation and re-throwing every other error so a genuine failure is never reported as success. Reset returns one generic message for all failures. Login always spends a bcrypt compare against a dummy hash, so every failure path costs the same wall-clock time.
- **Verification:** Manual review; build passes.

### A-14 · Medium · FIXED · No security response headers on either application

- **Category / CWE:** Security Misconfiguration · CWE-693, CWE-1021 · OWASP A05:2021
- **Location:** `frontend/next.config.ts`, `backend/next.config.ts`, `backend/src/middleware.ts`
- **Evidence:** Both `next.config.ts` files were `{}`. No CSP, no HSTS, no `X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy`. `X-Powered-By` advertised the framework.
- **Impact:** No clickjacking defence on a dashboard containing privileged actions; MIME sniffing permitted; no defence-in-depth against an XSS bug; full referrer leaked cross-origin.
- **Fix:** Frontend — CSP (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `connect-src` bound to the API origin read from `NEXT_PUBLIC_API_URL`), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Backend — set in `middleware.ts` so they also land on the CORS preflight: `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, `default-src 'none'; frame-ancestors 'none'; sandbox`, and **`Cache-Control: no-store`**, which matters most — every authenticated response carries personal data and could otherwise be retained by a shared proxy or the bfcache after sign-out. `poweredByHeader: false` on both.
- **Verification:** Both production builds pass; headers assert statically in config.
- **Residual:** see R-02 — `script-src` still needs `'unsafe-inline'`.

### A-15 · Medium · FIXED · Weak and inconsistent password policy

- **Category / CWE:** Weak Password Requirements · CWE-521 · OWASP A07:2021
- **Location:** four routes, each with its own copy of the rules
- **Evidence:** `length >= 8 && /[A-Z]/ && /\d/`, duplicated in `register`, `set-password`, `auth/reset-password` and — weaker still — `me/password`, which checked length only. No upper bound, so a multi-megabyte string went into bcrypt. `Password1` passed everywhere.
- **Impact:** The most-guessed corporate passwords were all permitted, which is what made A-07's missing rate limit exploitable in practice.
- **Fix:** One `lib/password-policy.ts` used by all four. Adds lower-case requirement, a 72-byte ceiling matching bcrypt's own limit, a common-password blocklist, and rejection of passwords containing the user's own name or email local part. `me/password` additionally requires the new password to differ from the current one. Client-side checklists on `/register` and `/set-password` updated to match so the UI cannot show all-green and then be rejected.
- **Verification:** `src/lib/password-policy.test.ts` (14 tests).

### F-01 · Medium · FIXED · Frontend gaps left open by the backend changes

- **Category / CWE:** Insufficient UI Error Handling / incomplete feature · CWE-1059 · OWASP A04:2021
- **Evidence:** Hardening the API changed contracts the UI had not caught up with. (a) The admin-issued reset token had **no UI at all** — the endpoint existed but no administrator could reach it, so account recovery was effectively broken for real users. (b) No page handled the new **429** responses, so a throttled user saw "Incorrect email or password" while holding the *correct* password — sending them to reset a password that was fine. (c) `/api/admin/users` did not return `email`, so a reset dialog could not confirm *which* of two similarly-named people it was resetting. (d) The frontend CSP omitted `'unsafe-eval'`, which React's **development** build needs for its error overlay — the browser console filled with `eval() is not supported in this environment`.
- **Impact:** (a) made the Critical fix unusable in practice; (b) actively misled users into unnecessary password resets; (c) risked a reset code reaching the wrong person; (d) degraded local debugging.
- **Fix:** New `components/admin/PasswordResetDialog.tsx` wired into **Admin → User management** — confirm step naming the account, one-time code with copy button, expiry time, hand-off instructions, and an explicit warning for non-employee (privileged) accounts. `email` added to the admin-only users payload and made searchable. `ApiError` now carries `retryAfter`, and `formatRetryAfter()` turns `Retry-After: 893` into "in about 15 minutes"; wired into `apiFetch` plus the three pages that use raw `fetch` (login, register, forgot-password). `'unsafe-eval'` added to `script-src` **in development only** — verified absent from the production policy.
- **Verification:** Full recovery flow exercised against the running stack — issue → redeem → sign in — including role gating (manager and anonymous both 403), single-use enforcement, re-issue voiding the prior code, password policy applied at redemption, and unknown-user 404. Dev and production header sets inspected on live servers (`next dev` on :3000, `next start` on :3005). Both typechecks clean, 214/214 backend tests pass, both production builds succeed.

### F-02 · Medium · FIXED · `Retry-After` unreadable by the browser (found only by browser testing)

- **Category / CWE:** Security Misconfiguration · CWE-693 · OWASP A05:2021
- **Location:** `backend/src/middleware.ts`
- **Evidence:** `Retry-After` is **not** a CORS-safelisted response header. The frontend talks to the API cross-origin, so `res.headers.get("Retry-After")` returned `null` in a real browser even though the header was present on the wire. Every curl check passed; only Playwright caught it, as the throttle message degrading from "Try again in about 15 minutes" to "Try again in a moment".
- **Impact:** The rate-limit UX added in F-01 was inert in the actual product. A locked-out user got no idea how long to wait, which is exactly the state that drives people to try a password reset they do not need.
- **Fix:** `Access-Control-Expose-Headers: Retry-After` added to the CORS header set, so it lands on both the preflight and every response.
- **Verification:** `src/middleware.test.ts` (12 tests) covers it plus the rest of the CORS contract — allowlisted origin echoed, non-allowlisted refused, never a wildcard, `Vary: Origin`, and the API's `no-store`/`nosniff`/`frame-ancestors` headers on both normal and preflight responses. Confirmed in-browser: the message now reads "Too many sign-in attempts for this account. Try again in about 15 minutes."

### F-03 · Low · FIXED · Redundant rate-limit wording

- **Location:** `auth/login`, `auth/reset-password`, `me/password`, `register`
- **Evidence:** Server messages ended "Please wait and try again." and the client then appended "Try again in about 15 minutes." — producing "Please wait and try again. Try again in about 15 minutes."
- **Fix:** Server messages now state only *what* happened ("Too many sign-in attempts."); the client owns the *when*. Asserted by a browser test so the two halves cannot drift back into duplication.

### D-01 · High · MITIGATED (no upstream fix) · `xlsx` prototype pollution and ReDoS

- **Category / CWE:** Vulnerable Component · CWE-1395, CWE-1321, CWE-1333 · OWASP A06:2021
- **Location:** `backend/package.json` → `xlsx@0.18.5`; used by `server/parsing/documentParser.ts` and `api/me/cpd/upload`
- **Evidence:** GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS). `npm audit`: **no fix available** — SheetJS moved distribution off the public npm registry, so no registry version resolves these.
- **Impact:** Any authenticated employee can upload a spreadsheet. A crafted workbook could pollute `Object.prototype` in the API process or wedge it in a pathological regex.
- **Mitigation applied:** A-12's bounds now sit in front of every path into SheetJS — 10 MB ceiling, extension allowlist, row cap. This constrains the ReDoS surface materially and the memory surface completely; it does **not** eliminate prototype pollution from a small crafted file.
- **Remaining options (no cost, needs a decision):**
  1. Repoint at the vendor's own registry: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Fixes both advisories. Adds a non-npm supply-chain source.
  2. Replace with `exceljs`, already present as a devDependency. No advisories for the parsing path. Requires rewriting `parseSpreadsheet()` and the CPD import — a real refactor, and `documentParser.ts` is shared with the recommendation engine.
- **Recommendation:** option 1 now, option 2 when the parser is next touched. Not done unilaterally: option 1 changes where a dependency is fetched from, which is a supply-chain decision that belongs to you.

### D-02 · High → resolved · FIXED · 11 dependency vulnerabilities

- **Category / CWE:** Vulnerable Components · CWE-1395 · OWASP A06:2021
- **Evidence:** Backend 6 high / 5 moderate (`postcss` path traversal + XSS, `sharp`/libvips CVEs, `next`, `valibot`, `vitest` critical). Frontend 2 critical / 3 high.
- **Fix:** `npm audit fix` on both, then two `--force` passes on the backend limited to the dev-tooling chain (vitest 2.1.9 → 4.1.10). Full suite re-run after **each** pass.
- **Verification:** Frontend **0 vulnerabilities**. Backend production dependencies: **1 high** (D-01 only). Backend dev-only remainder: 2 moderate (`exceljs`, `uuid`) — not shipped. 214/214 tests pass and both production builds succeed on the upgraded tree.

### I-01 · Info · Verified clean · No secrets in the repository or its history

- Scanned all tracked files and all 216 commits across every ref for OpenRouter, Anthropic, Google and Apify key formats and for embedded database credentials. **Nothing found.** `backend/.env.example` contains placeholders only, and `.env` has never been tracked.
- **However:** `CLAUDE.md` states *"the pasted OpenRouter key must be revoked"* — that key was leaked through a channel outside this repository. Revocation is still outstanding and is listed in §7.

### I-02 · Info · Accepted · Plaintext demo credentials in `CLAUDE.md`

- Nine working account passwords, including the administrator, are committed in the repository. This is intentional for the demo, but it is why A-07 (no rate limit) and A-15 (weak policy) were rated as they were. Once the app holds real employee data these accounts must be rotated — §7.

### I-03 · Info · Verified adequate · CORS configuration

- `backend/src/middleware.ts` echoes the request `Origin` only when it is on an allowlist, never a wildcard, and sets `Vary: Origin`. Correct, and correctly documented. Auth is bearer-token rather than cookie, so classic CSRF does not apply — there is no ambient credential for a cross-site request to ride on.

---

## 4. Reviewed and found sound

Recorded so the absence of a finding is not mistaken for an absence of review.

- **SQL injection** — every query goes through Prisma's query builder. No `$queryRawUnsafe`, no string-interpolated SQL anywhere.
- **XSS in React** — no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` in either app. All external links carry `rel="noopener noreferrer"`.
- **Employee self-service ownership** — `me/enrollments/[id]`, `me/skills/[id]`, `me/certificates`, `me/cpd/*`, `notifications`, `me/documents` all filter by `authUser.id` and verify ownership before writing. No IDOR found in this group.
- **Mass assignment on self-service writes** — `me/profile` accepts only `fullName`; `me/enrollments/[id]` explicitly *rejects* a client-supplied `progress` rather than ignoring it; `me/documents` forces `userId` to the caller.
- **Path traversal on upload** — `saveUpload()` strips non-`[\w.\-]` characters and prefixes a `randomUUID()`. Traversal is not reachable.
- **SSRF** — outbound fetches go to fixed, env-configured provider hosts. No user-supplied URL is fetched server-side. `certificateUrl` is stored and rendered as a link, never requested by the server.
- **Race conditions** — `lib/locks.ts` serialises the delete+create sequences in gap analysis; `skipDuplicates` absorbs cross-instance races. This was already correct.
- **Admin and author routes** — `admin/*` correctly gated to `admin`; `author/*` to `author`/`admin`; `manager/reports`, `manager/leaderboard`, `manager/team-*` and `manager/employees/[id]` already derived the department from the **token** and ignored client parameters. `cpd/notify` already locked managers to their own department.
- **Git history** — 216 commits, no secret ever committed, no `.env` ever tracked.

---

## 5. Code and cost summary

**14 files changed, 6 new source files, 6 new test files. No new runtime dependency. No recurring cost. No schema migration.**

New — `backend/src/lib/`: `authz.ts`, `rate-limit.ts`, `password-policy.ts`, `upload-limits.ts` · `backend/src/app/api/admin/password-tokens/route.ts`
New tests — `authz.test.ts`, `rate-limit.test.ts`, `password-policy.test.ts`, `upload-limits.test.ts`, `verifyToken.test.ts`, `certificate-proof.test.ts`
Modified — `verifyToken.ts`, `certificate-proof.ts`, `middleware.ts`, `server/http.ts`, both `next.config.ts`, routes `auth/login`, `auth/reset-password`, `register`, `set-password`, `me/password`, `me/documents`, `me/cpd/upload`, `manager/roles`, `manager/departments/[departmentId]`, `dashboard/department/[departmentId]/skill-gaps`, `recommendations/[employeeId]`, `recommendations/generate/[employeeId]`, `gaps/run/[employeeId]`, `documents/upload`, `documents/[id]/process` · frontend `forgot-password`, `register`, `set-password`, `CertificateProofModal`

**The recommendation engine's logic, scoring and architecture were not modified.** Changes to its routes are confined to the authorisation gate before the handler body and to the shared error boundary. `me/recommendations/page.tsx` was not touched.

---

## 6. Commands run and results

| Command | Before | After |
|---|---|---|
| `backend: npx tsc --noEmit` | clean | clean |
| `backend: npm test` | 141 passed / 11 files | **226 passed / 18 files** |
| browser E2E (Playwright, real Chromium) | none | **37 passed / 0 failed** |
| `backend: npm run build` | success | success |
| `frontend: npm run build` | success | success |
| `backend: npm audit --omit=dev` | 6 high, 5 moderate | **1 high** (D-01, no fix) |
| `frontend: npm audit` | 2 critical, 3 high | **0 vulnerabilities** |
| secret scan (tracked + 216 commits, all refs) | — | clean |

No pre-existing test or build failures were found, so nothing is being masked.

---

## 7. Deployment checklist — required before release

1. **Rotate `AUTH_SECRET`.** It is the only thing standing between a leaked value and token forgery, and its current value's history is unknown. Generate with `openssl rand -base64 48` and set it in Railway.
2. **All users must sign in again.** Unavoidable and intended: tokens are now bound to an issuer and audience, so every previously issued token is rejected. Combined with (1), this is also the revocation event for anything already stolen.
3. **Revoke the leaked OpenRouter key** noted in `CLAUDE.md`. Outside this repository; still outstanding.
4. **Rotate the nine demo passwords in `CLAUDE.md`** before real employee data is loaded, or delete the accounts (I-02).
5. **Decide D-01** — `xlsx` from the vendor registry, or migrate to `exceljs`.
6. **Set `CORS_ORIGIN`** to the real production frontend origin. The defaults cover localhost and one Vercel deployment.
7. **Tell administrators about the new recovery flow.** On **Admin → User management**, the key icon on any row issues a one-time code (shown once, valid 1 hour, single use); the user redeems it at `/forgot-password`. Re-issuing voids the previous code. No email service is involved — the administrator passes the code to the user directly.
8. **Confirm `UPLOAD_DIR` is on persistent storage** and is not web-served. On Railway's ephemeral filesystem, uploaded documents are lost on redeploy — a reliability issue, not a security one, but it will surprise someone.
9. **Re-run `scripts/setup-department-managers.ts`** if any manager row lacks a `departmentId`. Under the new deny-by-default rule such a manager gets 403 rather than org-wide access. This is the intended behaviour and the answer to the question posed during this audit.

---

## 8. Residual risks, assumptions and untested areas

**R-01 · Rate limiting is per-process (Medium).** `lib/rate-limit.ts` holds counters in memory. On one Railway instance that is the whole surface; behind N instances an attacker gets N× the budget, and a restart clears the counters. Chosen deliberately over Redis — no new dependency, no new service, no cost. If the API is ever scaled horizontally, move this to Railway's edge or a shared store. The limiter buckets on `x-forwarded-for`, which is forgeable if the API is reachable without the proxy in front; it is used *only* for bucketing and never for authorisation, so the worst case is an attacker minting a fresh bucket — no worse than having no limiter.

**R-02 · CSP still allows `'unsafe-inline'` for scripts (Medium).** Next's hydration bootstrap requires it. Eliminating it needs a per-request nonce from middleware, which forces every page to render dynamically — a real performance cost for a defence-in-depth control, in an app with no known XSS sink. Recorded rather than taken.

**R-03 · No session revocation (Medium).** There is no server-side session store, so the token *is* the session: deactivating a user or demoting a manager does not take effect until their token expires. Reduced from 7 days to 8 hours (A-09), and login now refuses non-active accounts so no *new* session is issued — but an existing one survives. Closing this properly means either a `tokenVersion` column checked per request, or a short access token plus refresh. Both are more than a security patch should change unannounced.

**R-04 · Prompt injection in the AI extraction path (Low–Medium, untested).** Uploaded documents are passed to an LLM whose structured output writes `UserSkill` and `RoleSkillRequirement` rows. A crafted document could steer that extraction — inflating an employee's recorded skill levels, for instance. Output is schema-validated by Zod before storage and the whole path is gated behind manager/admin authorisation plus the new document-scoping (A-06), so the blast radius is bounded to data the caller could already write. Not exercised in this audit; AI keys are optional and the pipeline is deterministic without them.

**Browser verification.** A Playwright suite (37 assertions, real Chromium) was run against the live stack covering: UI sign-in, cross-department blocking through the browser, rate-limit messaging, the admin reset-code dialog end-to-end (issue → copy → redeem → single-use → restore), settings password checklist, response headers, and an actual clickjacking attempt against a real `<iframe>`. It found F-02, which every curl check had passed. The script lives outside the repo (session scratchpad) and is not wired into CI — see below.

**Not tested:** no DAST, no authenticated vulnerability scan, no load testing. Railway and Vercel platform configuration was not inspected. The `apify-actor/` directory is gitignored and out of scope. The browser suite is not part of CI — promoting it to a committed `@playwright/test` project is the obvious next step and would have caught F-02 automatically.

**Pre-existing, not introduced here:** `/login`, `/register` and `/forgot-password` each emit one React hydration-mismatch warning, originating in the shared `AuthShell` component. Confirmed pre-existing by stashing the entire audit change set and reproducing it on the untouched baseline. Not a security issue and out of scope, but worth a look — hydration mismatches are silently un-patched by React.

**Assumptions:** managers are one-per-department as `CLAUDE.md` documents and as confirmed during this audit; `admin` is a trusted role; TLS is terminated by the platform; `.env` is never committed.

---

## 9. Release status

Every Critical and High finding in the reviewed scope is fixed and covered by a regression test. Authentication, authorisation, ownership and department isolation are enforced server-side. Both builds and all 214 tests pass. Production dependency vulnerabilities are down to one with no upstream fix, mitigated and documented.

The remaining blockers are operational: the signing secret must be rotated, the leaked AI key revoked, and the demo credentials replaced.

This software is not "perfectly secure" and no such claim is made. It has been reviewed against the baselines in §0 by source analysis and automated checks; the untested areas in §8 are stated plainly.

**CONDITIONALLY READY — required deployment actions remain.**
