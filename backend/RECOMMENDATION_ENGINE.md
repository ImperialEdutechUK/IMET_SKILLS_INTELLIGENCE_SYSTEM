# iMET Skills Intelligence — Recommendation Engine

AI-assisted, **deterministic-core** course recommendation engine for the iMET /
Imperial Edutech L&D platform. It ingests messy employee & role documents,
extracts and normalises skills, computes skill gaps with pure arithmetic, and
recommends only from the **approved course catalogue** — with the AI used strictly
for extraction and manager-friendly explanations, never for the gap or ranking
decisions.

> Built on the existing stack: **Next.js 16 App Router · TypeScript · Prisma 7 ·
> PostgreSQL · JWT bearer auth**. **DeepSeek by default for AI** (one env var
> switches to Anthropic Sonnet or Gemini), Apify for scraped course import, Zod
> for validation.

---

## Pipeline

```
upload → parse (xlsx/csv/docx/pdf) → AI extract (strict JSON + Zod + 1 repair)
      → normalise skills (exact / clean / alias / AI) → store UserSkill + RoleProfile
      → deterministic GAP ANALYSIS → match approved courses → deterministic SCORING
      → (optional) Gemini EXPLAINS top 3–5 using DB facts only → store Recommendations → API
```

The AI can fail or be absent at any AI step and the engine still runs: extraction
falls back to `NEEDS_REVIEW`, explanations fall back to deterministic reason text.

---

## Folder structure

```
backend/
├── prisma/
│   ├── schema.prisma          # + Document, RoleProfile, RoleSkillRequirement,
│   │                          #   SkillGap, SkillAlias, Course/Recommendation fields
│   └── seed.ts                # + Amali "Digital Marketing Executive" demo
├── src/
│   ├── lib/
│   │   ├── levels.ts          # 0–4 level system, gap classification, priority, course-fit
│   │   ├── levels.test.ts
│   │   └── db.ts / verifyToken.ts
│   ├── server/
│   │   ├── http.ts            # auth guard + error boundary + JSON helpers
│   │   ├── validation/schemas.ts   # Zod: AI outputs + request bodies
│   │   ├── ai/
│   │   │   ├── geminiClient.ts      # Gemini REST abstraction (isConfigured/generate/generateJson)
│   │   │   ├── prompts.ts           # all prompt templates
│   │   │   └── skillExtraction.ts   # extract → validate → repair once → NEEDS_REVIEW
│   │   ├── parsing/documentParser.ts
│   │   ├── skills/normalize.ts      # exact / clean / alias table / AI fallback
│   │   ├── gaps/gapAnalysis.ts      # deterministic gap engine + store extracted data
│   │   ├── courses/
│   │   │   ├── scoring.ts           # deterministic course scoring (pure)
│   │   │   ├── scoring.test.ts
│   │   │   └── recommend.ts         # orchestration + AI explanation + persistence
│   │   ├── connectors/
│   │   │   ├── types.ts             # CourseSourceConnector interface
│   │   │   ├── importer.ts          # single catalogue write path (idempotent upsert)
│   │   │   ├── coerce.ts            # loose CSV/Excel/JSON row → ExternalCourse
│   │   │   ├── manual.ts · edx.ts · coursera.ts · linkedin.ts · apify.ts
│   │   │   └── registry.ts
│   │   └── documents/service.ts     # upload persistence + process pipeline
│   └── app/api/                     # routes (below)
└── apify-actor/                     # standalone Apify Actor (scrapes → dataset, no DB)
```

---

## Level system

`None=0 · Basic=1 · Intermediate=2 · Advanced=3 · Expert=4`

```
gapValue = requiredLevel − currentLevel
gapValue <= 0                      → MEETS_REQUIREMENT
gapValue === 1                     → NEEDS_IMPROVEMENT
gapValue >= 2                      → CRITICAL_GAP
current missing or 0 (req > 0)     → MISSING_SKILL
```

**Priority** (deterministic): `gap×30 + missingBoost(15) + importance(5/15/25/35) +
confidence×10 + departmentPriority(0–10)` → `LOW / MEDIUM / HIGH / CRITICAL`.

## Course scoring

| Rule | Points |
|------|-------:|
| Covers a missing/weak skill | **+50** |
| Covers more than one gap | **+20** |
| Level suitable for the learner | **+15** |
| Duration short/reasonable (≤ 40h) | **+10** |
| Preferred provider | **+10** |
| Already available to the org | **+10** |
| Too advanced for the learner | **−20** |
| Not approved | **−30** |

Score is clamped to 0–100; ≥ 75 ⇒ `high` match, else `good`. **Recommended course
levels**: None/Basic → Beginner/Intermediate; Intermediate → Intermediate/Advanced;
Advanced courses are penalised for Basic learners.

**Tie-breaks** (applied in order, only when the score above is equal — so they can
never outrank actual gap coverage): combined priority of covered gaps → number of
gaps covered → **relevance** (`coveredGaps ÷ total course skills`: a course focused
on what the learner needs beats one that closes the gap only incidentally among many
off-domain topics) → **quality** (0–10 from catalogue `rating` and enrollment reach,
`computeQualityScore`) → course title. Relevance and quality are pure/deterministic
and role-agnostic, and are surfaced to — but never overridden by — the AI selector,
which additionally reads each course's title/description to prefer role-appropriate
courses over ones aimed at a different profession.

---

## API endpoints

All require `Authorization: Bearer <jwt>`. Write endpoints require role
`manager | admin | author`. `GET /recommendations/:id` also allows the employee.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/documents/upload` | Upload a document (multipart) |
| POST | `/api/documents/:id/process` | Parse + AI-extract + store |
| GET  | `/api/recommendations/chat` | Chat questions + this employee's context |
| POST | `/api/recommendations/chat` | Generate recs from chat answers (self) |
| GET  | `/api/me/documents` | The employee's own uploaded documents |
| POST | `/api/me/documents` | Employee self-uploads a skill matrix/CPD/daily report |
| POST | `/api/gaps/run/:employeeId` | Run deterministic gap analysis |
| POST | `/api/recommendations/generate/:employeeId` | Generate recommendations |
| GET  | `/api/recommendations/:employeeId` | Read stored recommendations |
| GET  | `/api/dashboard/department/:departmentId/skill-gaps` | Dept gap summary |
| POST | `/api/courses/import` | Import catalogue (JSON or CSV/XLSX/JSON file) |
| POST | `/api/courses/sync/edx` | Sync from edX (if configured) |
| POST | `/api/courses/sync/apify` | Import from an Apify dataset |
| POST | `/api/courses/sync/coursera` | Placeholder (needs Business API) |
| POST | `/api/courses/sync/linkedin-learning` | Placeholder (needs API/export) |

### Examples

**Upload** — `POST /api/documents/upload` (multipart form-data)
```
fields: file=<daily_report.xlsx>, type=DAILY_REPORT, userId=<optional>
→ 201 { "id":"doc_…", "type":"DAILY_REPORT", "status":"UPLOADED",
        "nextStep":"POST /api/documents/doc_…/process" }
```

**Process** — `POST /api/documents/:id/process`  `{ "userId":"usr_…" }`
```
→ 200 { "documentId":"doc_…","status":"PROCESSED","type":"DAILY_REPORT",
        "stored":4,"extraction":{ "employeeName":"Amali Fernando",
          "detectedSkills":[{"skill":"GA4","estimatedLevel":"Basic","evidence":"…","confidence":0.8}] } }
# invalid AI output after one repair → 422 { "status":"NEEDS_REVIEW", "message":"…" }
```

**Gap analysis** — `POST /api/gaps/run/:employeeId`
```json
{
  "employeeName": "Amali Fernando",
  "roleTitle": "Digital Marketing Executive",
  "summary": { "total": 3, "meets": 1, "needsImprovement": 2, "criticalGaps": 0, "missing": 0 },
  "gaps": [
    { "skill": "Google Analytics", "requiredLevelName": "Intermediate", "currentLevelName": "Basic",
      "gapValue": 1, "status": "NEEDS_IMPROVEMENT", "priority": "HIGH" },
    { "skill": "Campaign Reporting", "requiredLevelName": "Intermediate", "currentLevelName": "Basic",
      "gapValue": 1, "status": "NEEDS_IMPROVEMENT", "priority": "HIGH" },
    { "skill": "AI Marketing", "requiredLevelName": "Basic", "currentLevelName": "Basic",
      "gapValue": 0, "status": "MEETS_REQUIREMENT", "priority": "LOW" }
  ]
}
```

**Generate recommendations** — `POST /api/recommendations/generate/:employeeId`  `{ "explain": true }`
```json
{
  "employeeName": "Amali Fernando",
  "generated": 3,
  "aiExplained": true,
  "recommendations": [
    { "rank": 1, "title": "Marketing Analytics Foundation", "matchScore": 100, "matchLabel": "high",
      "reason": "Covers multiple skill gaps: Google Analytics and Campaign Reporting.",
      "gapsCovered": [ {"skill":"Google Analytics","from":"Basic","to":"Intermediate"},
                       {"skill":"Campaign Reporting","from":"Basic","to":"Intermediate"} ] },
    { "rank": 2, "title": "Google Analytics for Beginners", "matchScore": 85, "matchLabel": "high",
      "reason": "Focused improvement for Google Analytics — moves from Basic toward the required Intermediate." },
    { "rank": 3, "title": "Business Report Writing", "matchScore": 75, "matchLabel": "high",
      "reason": "Focused improvement for Campaign Reporting — moves from Basic toward the required Intermediate." }
  ]
}
```

**Course import (JSON)** — `POST /api/courses/import`
```json
{ "approveAll": true, "publish": true,
  "courses": [ { "title":"GA4 Deep Dive", "provider":"edX", "level":"Intermediate",
                 "durationHours":8, "category":"Marketing",
                 "skills":["GA4","website analytics"] } ] }
→ 201 { "mode":"json", "created":1, "updated":0, "courses":[{ "id":"…","approved":true,"status":"published" }] }
```
(*`GA4` and `website analytics` normalise to the canonical **Google Analytics** skill.*)

**Apify sync** — `POST /api/courses/sync/apify`  `{ "datasetId":"…", "approveAll":false, "publish":true }`
```
→ 201 { "source":"apify","fetched":37,"created":30,"updated":7,"skipped":0 }
```

---

## Recommendation chat

A guided, **preference-aware** layer on the deterministic core, surfaced to the
employee as a chat screen (`/me/recommendations`). It is deliberately narrow:
the user answers a few fixed questions with buttons — there is **no free-text
box**, so the interface can only ever recommend courses.

```
upload skill matrix / CPD log / daily report (Excel, optional)
   → (re)run deterministic GAP ANALYSIS  → score approved courses (deterministic)
   → apply preference boosts (brand · length · difficulty · goal)
   → AI SELECTS + EXPLAINS the top 3–5 from that safe candidate set
   → display: course name, details, link, and WHY it was recommended
```

- **Self-service uploads** — `POST /api/me/documents` lets an employee upload
  their own skill matrix / CPD log / daily report; it is parsed and AI-analysed
  against *their* profile, feeding their skill gaps. (The manager-only
  `/api/documents/upload` route is unchanged.)
- **Hard-coded questions** (`recommendChat.ts` → `PREFERENCE_QUESTIONS`): time
  commitment, preferred brands (Microsoft/Google/AWS/IBM/…), goal, difficulty.
  The chat renders whatever the API returns, so questions live in one place.
- **AI picks from a safe set only** — the AI receives the role, the gaps (from
  the documents), the preferences, and a scored candidate list; it returns
  `courseId`s from that list plus a one–two sentence reason. Invalid ids are
  dropped; if the AI is unavailable the engine falls back to the deterministic
  top picks with template reasons. The AI never invents courses.
- Recommendations persist with `source: "ai"`, kept separate from the
  manager-run `source: "engine"` recommendations so both can coexist.

## AI provider

`server/ai/aiClient.ts` is the single AI entry point for the whole engine
(extraction, normalisation, chat reasoning). `AI_PROVIDER` chooses the model —
`deepseek` (default, cost-effective), `anthropic` (Sonnet), or `gemini` — and
with no key set the engine runs fully deterministic. Switching provider is an
env change, no code change. See `.env.example` for the keys.

## Course source connectors

All implement `CourseSourceConnector { sourceName; isConfigured(); fetchCourses(); normalizeCourse() }`.

- **ManualCourseImportConnector** — curated CSV/Excel/JSON import (approved by default).
- **EdxCourseCatalogConnector** — official edX Discovery API (OAuth2 client credentials).
- **CourseraBusinessConnector** / **LinkedInLearningConnector** — placeholders; return
  `501` until official partner API credentials exist.
- **ApifyAllowedSitesConnector** — reads an Apify dataset; imports only items whose
  URL host is on `APIFY_ALLOWED_DOMAINS`. Scraped courses are **unapproved** until a
  human approves them.

### Apify flow (DB credentials stay out of the Actor)

```
Apify Actor crawls course sites  →  pushes structured items to the Actor dataset
        →  POST /api/courses/sync/apify reads the dataset  →  importer writes Postgres
```

See `apify-actor/` for the Actor. Item shape: `{ id, title, provider, url,
description, skills[], level, duration, price, language }`.

---

## Environment variables

The deterministic core needs only `DATABASE_URL` + `AUTH_SECRET`. Everything else is
optional and feature-gated — see `.env.example`. Key ones: `AI_PROVIDER`,
`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`,
`GEMINI_API_KEY`, `UPLOAD_DIR`, `APIFY_TOKEN`, `APIFY_DATASET_ID`,
`APIFY_ALLOWED_DOMAINS`, `EDX_CLIENT_ID`/`EDX_CLIENT_SECRET`.

## Running & testing

```bash
npm install
npx prisma db push        # sync schema (additive)
npx prisma db seed        # loads the Amali demo
npm run dev               # http://localhost:3001
npm test                  # 27 unit tests: gap classification + course scoring
```

Demo account: `amali@imperiallearning.co.uk` / `ImAmali2026!`.
