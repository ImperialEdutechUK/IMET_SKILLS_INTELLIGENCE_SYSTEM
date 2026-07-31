/**
 * Clears the guided-tour flag for one user so they are offered the tour again.
 *
 * Surgical on purpose: it removes only the `tour` key from User.onboardingState
 * using the same jsonb merge the API uses, so any other onboarding state the
 * column may hold later is left untouched. Nothing else about the user changes,
 * and no other table is read or written.
 *
 * Run:
 *   1. cd backend
 *   2. npx tsx --env-file=.env scripts/reset-onboarding-tour.ts <email>
 */

import { prisma } from "../src/lib/db";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx --env-file=.env scripts/reset-onboarding-tour.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true, role: true, onboardingState: true },
  });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  console.log(`before: ${JSON.stringify(user.onboardingState)}`);

  // `|| '{"tour":null}'` sets the key to null, `jsonb_strip_nulls` then drops it.
  const rows = await prisma.$queryRaw<{ onboardingState: unknown }[]>`
    UPDATE "User"
       SET "onboardingState" = jsonb_strip_nulls(
             COALESCE("onboardingState", '{}'::jsonb) || '{"tour": null}'::jsonb
           )
     WHERE "id" = ${user.id}
    RETURNING "onboardingState"
  `;

  console.log(`after:  ${JSON.stringify(rows[0]?.onboardingState)}`);
  console.log(`${user.email} (${user.role}) will be offered the tour again on their next dashboard visit.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
