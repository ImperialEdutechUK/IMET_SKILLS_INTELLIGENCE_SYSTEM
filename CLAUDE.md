# CLAUDE.md — LearnSmart AI (iMET Skills Intelligence System)

Read `PROJECT_HANDOFF.md` for full detail. This file is the quick reference + hard rules.

## What it is
Full-stack skills-intelligence app for iMET. Tracks employee skills, computes gaps vs role requirements, recommends courses from a scraped catalog. Built by two developers sharing one DB: **you** (frontend/dashboards, branch `yenushka-features`) and **Nandika** (AI recommendation engine + scrapers, merged via PRs).

Gap formula: `Gap = RoleProfile required level − UserSkill current level`. Courses matched from **22,965 scraped courses**.

## Stack
- Monorepo: `/Users/kalindibandara/Downloads/learnsmart-ai/`
- `frontend/` (Next.js, port 3000, no Prisma) + `backend/` (Next.js API + Prisma, port 3001)
- Next.js 16.2.10, Prisma 7.8.0, PostgreSQL on Railway, JWT bearer auth
- Repo: `github.com/ImperialEdutechUK/IMET_SKILLS_INTELLIGENCE_SYSTEM`

## HARD RULES (never break)
1. **Only push to `yenushka-features`. NEVER `main`.**
2. **NEVER touch the 22,965 scraped courses** (no delete/bulk-edit/overwrite). Real production data.
3. **NEVER run destructive DB ops** (`migrate reset`, `db push` altering columns, bulk deletes) without explicit OK. `db pull` + `generate` are safe.
4. **NEVER commit secrets.** Keys/passwords only in `.env` (gitignored). The pasted OpenRouter key must be revoked.
5. **Backend & frontend in SEPARATE terminals.** Commands in the `npm run dev` tab kill the server. Empty curl + `JSONDecodeError` = backend down → `lsof -ti:3001 | xargs kill -9` then `npm run dev`.
6. **CLI commands as numbered steps**, one per line.
7. **Unexpected zeros → check data (re-seed) before assuming a code bug.**

## Schema notes
- Schema is **Nandika's version** — relations are **camelCase** (`requirements`, `roleProfile`, `skill`, `department`), not PascalCase.
- Key models: RoleProfile, RoleSkillRequirement, SkillGap (engine output), SkillAlias, CpdTarget (annual `hoursPerYear`, default 40), CpdRecord, Course (the 22,965), CourseSkill, Notification (exists, no CPD alerts yet).
- `User.position` (nullable String) is the ONLY link to `RoleProfile.title` (no FK).

## Demo logins (plaintext for testing)
- admin@imperiallearning.co.uk / ImA7xK92pQr
- author@imperiallearning.co.uk / ImT6bL74qXe
- **Managers — one per department (department-scoped; each sees only their own dept). Provisioned by `scripts/setup-department-managers.ts`:**
  - **CDD** (data-rich — use this for demos): cdd.manager@imperiallearning.co.uk / `Cdd@Imet#2026Kx`
  - Sales: sales.manager@imperiallearning.co.uk / `Sales@Imet#2026Qr`
  - Marketing: marketing.manager@imperiallearning.co.uk / `Mktg@Imet#2026Lz`
  - Customer Service: customerservice.manager@imperiallearning.co.uk / `Cs@Imet#2026Nv`
  - IT: it.manager@imperiallearning.co.uk / `It@Imet#2026Bw`
  - Finance: finance.manager@imperiallearning.co.uk / `Fin@Imet#2026Ty`
  - Operations: operations.manager@imperiallearning.co.uk / `Ops@Imet#2026Hs`
  - Academic: academic.manager@imperiallearning.co.uk / `Acad@Imet#2026Pm`
- The old single manager (`manager@`, Sarah) and the `employee@` (Emma) demo account were **removed**. Real employee data now lives with **Nandika (CDD)**; employees self-register and are approved.
- CDD id: `cmr3k8ghy0001b3gq417f0kkn` · Marketing id: `cmr3k8gjm0005b3gqrbw5q0r1`
- ⚠️ Re-provision managers with `npx tsx --env-file=.env scripts/setup-department-managers.ts` (idempotent). Do NOT run `npx prisma db seed` on the live demo DB — it recreates the removed demo employees and the old single manager.

## Get a test token
```
# CDD manager (department-scoped, data-rich). employee@ demo account was removed.
MTOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"cdd.manager@imperiallearning.co.uk","password":"Cdd@Imet#2026Kx"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

## AI keys are OPTIONAL
Nandika's core pipeline (gap analysis, scoring, recommendations) is deterministic and needs NO key. Keys only enable doc skill-extraction + chat reasoning. Set `AI_PROVIDER` + matching key in `.env`.

## DO NOT MODIFY
`frontend/src/app/(dashboard)/me/recommendations/page.tsx` — Nandika's complete grounded recommendation chatbot.

## Highest-value pending work
1. Per-employee course detail (managers see counts, not which courses) — row or page, read-only.
2. At-risk on the main manager dashboard (currently only on drill-down).
3. CPD notification system — FIRST fix the threshold: current flat 50%/75% is time-blind (flags on-pace employees early in an annual cycle). Use time-aware: `expected = (days elapsed / 365) × target`.
4. Remove dead pages (author/courses/new, admin/learning, admin/skills, admin/cpd — no manual courses).
5. Reports ×4 — mock, no backing — spec or drop.
6. Revoke leaked key, rotate secrets, review 11 npm vulns, plan Railway scaling.

## The CPD risk engine
`backend/src/lib/team-queries.ts` ~L21-28. `cpdProgress = min(100, round(cpdHours/targetHours*100))`; `<50%` = at_risk, `<75%` = attention. Computed live, never stored. No notification exists. Target is ANNUAL.
