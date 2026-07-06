# LearnSmart AI — Complete Standalone Project

This is a full, self-contained Next.js project. It does NOT require any existing
project — unzip, install, run.

Verified: `npm run build` compiles all 33 routes with the exact versions in
package-lock.json (Next 16.2.10, React 19.2, Tailwind 4.3, recharts 3.9,
lucide-react 1.23, TypeScript 6).

## Run it

```bash
cd ~/learnsmart-ai
npm install
npm run dev
```

Open http://localhost:3000

## Hero image (optional)

The landing page expects `public/hero.png`. If you still have the original:

```bash
cp ~/Desktop/Hero.png ~/learnsmart-ai/public/hero.png
```

Without it, the landing page renders with a broken-image placeholder on the
right; everything else works.

## Routes

- `/` landing · `/login` · `/set-password` · `/forgot-password`
- Role switcher pill (bottom-right of any dashboard) toggles between all four
  roles without auth: employee, manager, admin, author.
- Employee: /me/{dashboard,learning,skills,cpd,certificates,recommendations,reports,settings}
- Manager: /manager/{dashboard,team-learning,team-skills,team-cpd,ai-insights,reports}
- Admin: /admin/{dashboard,users,learning,skills,cpd,recommendations,reports}
- Author: /author/{dashboard,library,courses/new,review,taxonomy,reports}

## Phase 1.5 — Backend (later, in order)

1. PostgreSQL: local install or a Railway Postgres instance → get a connection URL.
2. `.env` in project root: `DATABASE_URL="postgresql://..."`
3. `npm install prisma @prisma/client bcryptjs && npm install -D @types/bcryptjs tsx`
4. Add to package.json: `"prisma": { "seed": "tsx prisma/seed.ts" }`
5. `npx prisma db push` (creates all 20 tables)
6. `npx prisma db seed` (departments, users, courses, enrollments — credentials printed at end)
7. Auth.js: real login replaces the role-switcher pill; role-based route middleware.
8. AI recommendation engine (OpenRouter) — after auth works.

Seed credentials: admin@imet.lk / Admin@1234 · sarah.johnson@imet.lk / Manager@1234 ·
chris.author@imet.lk / Author@1234 · emma.watson@imet.lk / Employee@1234
