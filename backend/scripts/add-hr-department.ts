/**
 * Adds the HR department to the live DB.
 * Purely additive + idempotent: upserts the Department row and its CPD target,
 * exactly matching what the seed lays down for every other department (so HR
 * behaves identically in the CPD/risk roll-ups). Does NOT run the full seed
 * (which would recreate the demo employees that were intentionally removed)
 * and never touches the course catalogue.
 *
 * Run:  npx tsx --env-file=.env scripts/add-hr-department.ts
 * Then: npx tsx --env-file=.env scripts/setup-department-managers.ts  (creates the HR manager)
 */
import { prisma } from "../src/lib/db";

const DEPT_NAME = "HR";
// Same year/hours the seed uses for every other department — parity matters here,
// otherwise HR would resolve its CPD target differently from its peers.
const TARGET_YEAR = 2024;
const HOURS_PER_YEAR = 40;

async function main() {
  const dept = await prisma.department.upsert({
    where: { name: DEPT_NAME },
    update: {},
    create: { name: DEPT_NAME },
  });
  console.log(`✓ Department "${dept.name}" (${dept.id})`);

  await prisma.cpdTarget.upsert({
    where: { departmentId_year: { departmentId: dept.id, year: TARGET_YEAR } },
    update: {},
    create: { departmentId: dept.id, hoursPerYear: HOURS_PER_YEAR, year: TARGET_YEAR },
  });
  console.log(`✓ CPD target ${TARGET_YEAR} · ${HOURS_PER_YEAR}h/year`);

  const all = await prisma.department.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  console.log(`\nDepartments now (${all.length}): ${all.map((d) => d.name).join(", ")}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); }).finally(() => prisma.$disconnect());
