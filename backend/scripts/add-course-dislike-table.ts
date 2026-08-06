/**
 * Adds the CourseDislike table (see prisma/schema.prisma).
 *
 * This repo has no prisma/migrations directory, so schema changes normally go
 * through `prisma db push`. That is avoided here on purpose: db push reconciles
 * the WHOLE schema, so any unrelated drift between the local schema.prisma and
 * the shared Railway database would be applied at the same time. This script
 * instead issues only the statements the change actually needs.
 *
 * Safety properties:
 *   · ADDITIVE ONLY. It creates one new table and its indexes. No existing
 *     table, column, constraint or row is altered or deleted. The Course
 *     catalogue is referenced by foreign key but never written to.
 *   · IDEMPOTENT. Every statement uses IF NOT EXISTS, so re-running is a no-op.
 *
 * Run:
 *   1. cd backend
 *   2. npx tsx --env-file=.env scripts/add-course-dislike-table.ts
 *   3. npx prisma generate
 *   4. restart `npm run dev` (a running server holds a stale Prisma client)
 */

import { Client } from "pg";

// Prisma generates cuid()s client-side, so the id column needs no DB default.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "CourseDislike" (
     "id"        TEXT NOT NULL,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "userId"    TEXT NOT NULL,
     "courseId"  TEXT NOT NULL,
     CONSTRAINT "CourseDislike_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CourseDislike_userId_courseId_key"
     ON "CourseDislike" ("userId", "courseId")`,
  `CREATE INDEX IF NOT EXISTS "CourseDislike_userId_idx"
     ON "CourseDislike" ("userId")`,
];

// Foreign keys have no IF NOT EXISTS form, so they are added only when the
// table was freshly created (see main()).
const FOREIGN_KEYS = [
  `ALTER TABLE "CourseDislike"
     ADD CONSTRAINT "CourseDislike_userId_fkey"
     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "CourseDislike"
     ADD CONSTRAINT "CourseDislike_courseId_fkey"
     FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Run with: npx tsx --env-file=.env scripts/add-course-dislike-table.ts"
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (await tableExists(client)) {
      console.log('"CourseDislike" already exists. Nothing to do.');
      return;
    }

    for (const sql of STATEMENTS) await client.query(sql);
    for (const sql of FOREIGN_KEYS) await client.query(sql);

    const after = await tableExists(client);
    console.log(
      after
        ? 'Created "CourseDislike" (unique on userId+courseId, cascading FKs to User and Course).'
        : "Table still missing after CREATE."
    );
    if (!after) process.exit(1);
  } finally {
    await client.end();
  }
}

async function tableExists(client: Client): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'CourseDislike'`
  );
  return rows.length > 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
