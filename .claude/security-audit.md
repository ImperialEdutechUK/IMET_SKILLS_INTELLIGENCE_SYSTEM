Production Web Application Security Audit and Remediation

Act as a senior application-security engineer, software architect, QA engineer and reliability engineer. Inspect the entire repository, identify real bugs and vulnerabilities, implement professional fixes, add regression tests and verify the final application.

Optional user scope: $ARGUMENTS

Required outcome

Treat this as a real application used by real users. Do not stop after reporting findings. Continue through remediation and verification until:

no known Critical or High issue remains within the reviewed scope;

authentication, authorisation, ownership and tenant isolation are enforced server-side;

untrusted input and output are handled safely;

sensitive data, credentials, sessions and files are protected;

repaired issues have regression tests;

builds, tests and security checks pass; and

remaining risks, assumptions and deployment actions are documented.

Never claim that software is “perfectly secure”. Report production readiness based on evidence and clearly state anything not tested.

Use OWASP Top 10, OWASP API Security Top 10, OWASP ASVS Level 2, OWASP Cheat Sheets, NIST SSDF and current CWE guidance as baselines. Also consider project-specific threats and business logic.

Safety and change controls

Work only inside this authorised repository and its local/test environments.

Do not attack production, third-party services or real users.

Check Git status first. Preserve all uncommitted work; never reset, discard or overwrite user changes.

Do not commit, push, deploy, rotate live secrets, alter cloud resources or run destructive migrations without explicit approval.

Never print complete secrets, tokens, cookies, private keys or personal data. Redact evidence.

Use harmless local tests and non-destructive proofs of concept.

Prefer small, reviewable changes. Do not rewrite working architecture merely by preference.

Do not weaken security, tests or validation to make checks pass.

Ask before deciding

Ask the user when ambiguity materially affects security, business behaviour, compatibility, cost or data migration, including:

intended roles, permissions, ownership or cross-tenant access;

whether an endpoint/file is intentionally public;

password, MFA, session, retention or account-recovery policy;

breaking API/schema changes;

irreversible migrations or live credential rotation;

a paid service, recurring cost or major infrastructure change.

Give a recommended option, security effect, cost, trade-offs and the decision required. Continue all work that is not blocked. For ordinary implementation details, use the safest compatible default instead of repeatedly asking.

Workflow

1. Establish the baseline

Inspect repository structure, documentation, lockfiles, environment examples, CI/CD and Git status.

Detect languages, frameworks, services, databases, roles, entry points and available commands.

Run the existing formatter/linter, type checker, tests and production build before changing code.

Record pre-existing failures separately.

2. Map the attack surface

Identify:

public, authenticated, administrative and internal routes;

REST, GraphQL, RPC, WebSocket, mobile and webhook interfaces;

authentication/session flows and every role;

sensitive data, files, payments and privileged actions;

trust boundaries, tenants/workspaces and ownership rules;

databases, caches, queues, jobs and scheduled tasks;

third-party services, outbound requests and deployment assumptions.

3. Audit bugs and reliability

Check for incorrect business rules, null/type errors, async failures, race conditions, missing transactions, duplicate processing, unsafe retries, idempotency failures, data loss, cache inconsistency, stale state, pagination/filter/sort errors, date/time-zone errors, currency/rounding errors, resource leaks, unsafe migrations, invalid state transitions, frontend/backend contract mismatches, misleading error handling, skipped/flaky tests and development behaviour exposed in production.

4. Audit security

Review every applicable category below, including equivalent framework-specific weaknesses.

Identity and access

Authentication bypass, weak password storage/policy, enumeration, credential stuffing, missing rate limits, insecure reset/magic-link/MFA/OAuth/OIDC/SAML flows.

Session fixation, missing rotation/revocation/expiry, insecure cookies, unsafe browser token storage, JWT algorithm/key/issuer/audience/type/expiry failures.

Broken access control, IDOR/BOLA/BFLA, horizontal/vertical escalation, client-only checks, mass assignment, forced browsing, hidden admin routes, ownership failures and cross-tenant leakage.

Enforce deny-by-default authorisation on every object and operation, including jobs, exports, files, WebSockets, GraphQL resolvers and caches.

Injection and unsafe parsing

SQL/NoSQL, command, code, template, expression, LDAP, XPath, GraphQL, header/CRLF, email-header and log injection.

XSS: stored, reflected and DOM; unsafe HTML/Markdown/SVG, innerHTML, scriptable uploads and prototype pollution reaching dangerous sinks.

Path traversal, arbitrary file read/write, unsafe archive extraction, local/remote file inclusion and symlink attacks.

XXE, unsafe YAML/XML/object deserialisation, parser bombs, ReDoS and unbounded recursive/deep input.

Use parameterised queries, safe APIs, strict schemas, allowlists, contextual encoding and maintained sanitisation only where rich HTML is required. Never create custom cryptography.

Browser and HTTP controls

CSRF on all cookie-authenticated state changes, login/logout CSRF and state-changing GET routes.

Unsafe CORS, missing CSP, clickjacking, MIME sniffing, weak referrer/permissions policies, open redirects, host-header injection, unsafe caching and missing HTTPS/HSTS where appropriate.

Validate proxy/trusted-header configuration against the actual deployment model.

APIs and resource abuse

Missing schema validation, excessive data/property exposure, shadow/legacy endpoints, unrestricted pagination/filtering, request-size gaps and inconsistent errors.

Missing rate, concurrency, timeout, query-depth/complexity, upload-size, queue and cost controls.

GraphQL introspection where inappropriate, resolver authorisation gaps, WebSocket/subscription authentication and message-level authorisation.

SSRF through URL imports, previews, webhooks or fetchers; block unsafe schemes, redirects, ports, loopback, private, link-local and metadata destinations.

Files, data and secrets

Upload type/content/size validation, double extensions, executable or scriptable content, unsafe names, public storage, predictable URLs, missing ownership checks and unsafe download headers.

Hardcoded or committed credentials, secrets in frontend bundles, logs, examples, images, build output or Git history.

Weak randomness, obsolete encryption, static IVs/nonces, disabled TLS verification, unnecessary sensitive-data collection and keys stored beside encrypted data.

PII, passwords, tokens, cookies, payment data or stack traces in logs/errors. Ensure failures are secure and diagnosable without exposing internals.

Business logic and integrations

Price/quantity/currency manipulation, negative values, coupon/trial/referral abuse, duplicate payments/refunds, workflow or approval bypass, invalid state transitions and race-condition abuse.

Use authoritative server-side pricing/state, transactions, constraints, explicit state machines and idempotency keys.

Verify webhook signatures and timestamps; prevent replay, duplicate processing and unsafe retries; validate event type and schema.

Verify payment state with the provider, not redirects or frontend state.

Check email recipient selection, account recovery, verification changes, unsubscribe links and notification spam/leakage.

Supply chain, configuration and infrastructure

Vulnerable, abandoned, duplicate or unnecessary dependencies; unsafe install scripts, registries, CDN scripts, CI actions, container images and build plugins.

Debug mode, default accounts, source maps, test/admin endpoints, directory listing, broad IAM, public management ports, insecure storage, root containers, excessive privileges and secrets copied into image layers.

CI secret exposure, unsafe shell interpolation and untrusted pull-request code receiving privileged tokens.

Use supported patch/minor upgrades where sufficient; review breaking changes before major upgrades.

AI/LLM features, when present

Prompt injection, indirect injection, cross-user leakage, insecure retrieval permissions, confidential prompt logging, exposed API keys, unbounded spend and model output used as trusted code, HTML, URLs or security decisions.

Treat model output as untrusted input and enforce normal authentication, authorisation, validation, encoding, tool permissions and cost limits.

5. Remediate professionally

For every confirmed issue:

Identify root cause, affected paths and similar patterns elsewhere.

Implement the smallest complete fix using framework-native, maintained patterns.

Add a test that demonstrates the unsafe case is blocked and legitimate behaviour still works.

Run focused tests, then the relevant broader suite and production build.

Review the diff for regressions, compatibility and accidental secret exposure.

Record residual risk and required deployment/configuration work.

Never “fix” an issue by hiding UI, relying on client validation, swallowing errors, broadening admin access, disabling TLS/CSRF/tests, allowing all CORS origins, using fragile blacklists or adding suppression directives without documented justification.

Cost policy

Prefer, in order:

correct logic and secure configuration;

standard-library/framework capabilities;

existing project dependencies;

maintained free/open-source libraries;

existing hosting controls;

paid services only when a material risk cannot reasonably be controlled otherwise and the user approves.

Avoid unnecessary APIs, commercial scanners, microservices, databases, caches and security products. For any recurring cost, present a free/lower-cost alternative and its security and operational trade-offs.

Verification

Use existing ecosystem-native tools where available. Run applicable checks:

format, lint, type check and compile/build;

unit, integration and end-to-end tests;

authentication, authorisation, denied-access and tenant-isolation tests;

dependency audit, secret scan and static analysis using existing or free tooling;

migration validation and production/container build;

focused manual review of high-risk flows.

A scanner result is evidence, not proof. Confirm findings manually and eliminate false positives. Do not install system-wide tools or major dependencies without approval.

Findings and progress

Maintain SECURITY_AUDIT.md with:

ID

Severity

Status

Category

CWE/OWASP

Location

Evidence

Impact

Fix

Verification

Use Critical, High, Medium, Low or Informational. Prioritise exploitability, impact, exposure and affected users. Never include weaponised production instructions or complete secret values.

Work in batches: Critical/High access, injection, secret and data-isolation issues first; then configuration, dependencies, integrity/reliability, Medium and Low hardening. After each batch, summarise findings fixed, files changed, tests run, behaviour changes and decisions still required.

Final release gate

Before completion, re-run all relevant tests and builds, recheck every Critical/High finding, confirm denied access and tenant isolation, verify secrets are absent from tracked/runtime client files, confirm safe logs/errors, resource limits, cookies, sessions, CORS, CSRF, headers, migrations and deployment configuration, and review the complete diff.

Deliver:

executive security posture and release readiness;

architecture/attack-surface summary;

completed findings register;

code-change and cost summary;

commands/tests and results;

deployment and secret-rotation checklist;

residual risks, assumptions and untested areas.

End with exactly one status:

NOT READY — unresolved Critical vulnerabilities

NOT READY — unresolved High vulnerabilities

CONDITIONALLY READY — required deployment actions remain

READY FOR STAGING SECURITY VALIDATION

READY FOR PRODUCTION RELEASE WITH DOCUMENTED RESIDUAL RISKS

Start now with Git status, stack discovery, architecture mapping, baseline tests/build and a prioritised initial findings list. Then remediate and verify; do not stop at recommendations.