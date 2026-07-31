/**
 * Adds User.onboardingState (see prisma/schema.prisma).
 *
 * This repo has no prisma/migrations directory, so schema changes normally go
 * through `prisma db push`. That is avoided here on purpose: db push reconciles
 * the WHOLE schema, so any unrelated drift between the local schema.prisma and
 * the shared Railway database would be applied at the same time. This script
 * instead issues the one statement the change actually needs.
 *
 * Safety properties:
 *   · ADDITIVE ONLY. It adds a column and nothing else. No existing column,
 *     constraint, index or row is read, altered or deleted. It never touches the
 *     Course catalogue or any other table.
 *   · IDEMPOTENT. `IF NOT EXISTS` means running it twice is a no-op.
 *   · NO TABLE REWRITE. Postgres 11+ stores a non-volatile DEFAULT in the
 *     catalogue, so adding NOT NULL DEFAULT '{}' does not rewrite existing rows.
 *     It is fast whatever the size of the User table and takes only a brief lock.
 *
 * Run:
 *   1. cd backend
 *   2. npx tsx --env-file=.env scripts/add-onboarding-state-column.ts
 *   3. npx prisma generate
 */

import { Client } from "pg";

const SQL = `
  ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "onboardingState" JSONB NOT NULL DEFAULT '{}'::jsonb
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Run with: npx tsx --env-file=.env scripts/add-onboarding-state-column.ts");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const before = await columnExists(client);
    if (before) {
      console.log('"User"."onboardingState" already exists. Nothing to do.');
      return;
    }

    await client.query(SQL);
    const after = await columnExists(client);
    console.log(after ? 'Added "User"."onboardingState" (jsonb, not null, default {}).' : "Column still missing after ALTER.");
    if (!after) process.exit(1);
  } finally {
    await client.end();
  }
}

async function columnExists(client: Client): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'User' AND column_name = 'onboardingState'`,
  );
  return rows.length > 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
