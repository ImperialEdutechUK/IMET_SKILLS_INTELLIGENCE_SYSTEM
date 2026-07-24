/**
 * One manager account per department, replacing the single shared "Sarah" manager.
 * Idempotent: safe to re-run. Does NOT run the full seed (which would recreate the
 * demo employees that were intentionally removed). Never touches the course catalogue.
 *
 * Run:  npx tsx --env-file=.env scripts/setup-department-managers.ts
 */
import { prisma } from "../src/lib/db";
import { hash } from "bcryptjs";

const MANAGERS: { dept: string; email: string; password: string }[] = [
  { dept: "CDD", email: "cdd.manager@imperiallearning.co.uk", password: "ImetCDD26!" },
  { dept: "Sales", email: "sales.manager@imperiallearning.co.uk", password: "ImetSales26!" },
  { dept: "Marketing", email: "marketing.manager@imperiallearning.co.uk", password: "ImetMktg26!" },
  { dept: "Customer Service", email: "customerservice.manager@imperiallearning.co.uk", password: "ImetCS26!" },
  { dept: "IT", email: "it.manager@imperiallearning.co.uk", password: "ImetIT26!" },
  { dept: "Finance", email: "finance.manager@imperiallearning.co.uk", password: "ImetFin26!" },
  { dept: "Operations", email: "operations.manager@imperiallearning.co.uk", password: "ImetOps26!" },
  { dept: "Academic", email: "academic.manager@imperiallearning.co.uk", password: "ImetAcad26!" },
];

async function main() {
  const depts = await prisma.department.findMany({ select: { id: true, name: true } });
  const deptByName = new Map(depts.map((d) => [d.name, d.id]));

  for (const m of MANAGERS) {
    const deptId = deptByName.get(m.dept);
    if (!deptId) { console.log(`⚠ skip ${m.dept} — no such department`); continue; }
    const passwordHash = await hash(m.password, 12);
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { role: "manager", status: "active", departmentId: deptId, fullName: `${m.dept} Manager` },
      create: { email: m.email, fullName: `${m.dept} Manager`, role: "manager", status: "active", passwordHash, departmentId: deptId },
    });
    // Point every employee in this department at their department manager.
    const r = await prisma.user.updateMany({
      where: { role: "employee", departmentId: deptId },
      data: { managedBy: user.id },
    });
    console.log(`✓ ${m.dept.padEnd(18)} ${m.email}  · ${r.count} employee(s) reassigned`);
  }

  // Remove the old single manager (Sarah / manager@imperiallearning.co.uk).
  const old = await prisma.user.findFirst({
    where: { email: { equals: "manager@imperiallearning.co.uk", mode: "insensitive" } },
    select: { id: true, fullName: true, email: true },
  });
  if (old) {
    await prisma.user.updateMany({ where: { managedBy: old.id }, data: { managedBy: null } });
    await prisma.notification.deleteMany({ where: { userId: old.id } });
    await prisma.user.delete({ where: { id: old.id } });
    console.log(`✗ Removed old manager: ${old.fullName} (${old.email})`);
  } else {
    console.log("• Old manager (manager@imperiallearning.co.uk) not found — nothing to remove.");
  }

  const managers = await prisma.user.findMany({
    where: { role: "manager" },
    select: { email: true, department: { select: { name: true } } },
    orderBy: { department: { name: "asc" } },
  });
  console.log(`\nManagers now (${managers.length}):`);
  for (const mgr of managers) console.log(`  ${(mgr.department?.name ?? "—").padEnd(18)} ${mgr.email}`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); }).finally(() => prisma.$disconnect());
