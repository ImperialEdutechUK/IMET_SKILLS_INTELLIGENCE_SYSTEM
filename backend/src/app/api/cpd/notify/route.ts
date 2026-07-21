import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";

// On-demand CPD alerting. A manager or admin triggers a scan; every employee
// who is time-aware "at_risk" (see lib/cpd-risk) generates an in-app
// Notification for the employee AND for their manager (User.managedBy) when set.
// Idempotent per run: an identical unread notification is not duplicated.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "manager" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const departmentId = new URL(req.url).searchParams.get("departmentId");
  const employees = await prisma.user.findMany({
    where: { role: "employee", ...(departmentId ? { departmentId } : {}) },
    include: { cpdRecords: true, department: true },
  });

  const targetCache = new Map<string | null, number>();
  async function target(deptId: string | null) {
    if (!targetCache.has(deptId)) targetCache.set(deptId, await getCpdTargetHours(deptId));
    return targetCache.get(deptId)!;
  }

  // Create a notification only if an identical unread one does not already exist.
  async function createIfNew(userId: string, title: string, body: string) {
    const existing = await prisma.notification.findFirst({
      where: { userId, title, body, readAt: null },
      select: { id: true },
    });
    if (existing) return false;
    await prisma.notification.create({ data: { userId, title, body } });
    return true;
  }

  let atRisk = 0;
  let employeesNotified = 0;
  let managersNotified = 0;
  let atRiskWithoutManager = 0;

  for (const e of employees) {
    const targetHours = await target(e.departmentId);
    const cpdHours = e.cpdRecords.reduce((s, r) => s + r.hours, 0);
    const { cpdProgress, status } = cpdRiskStatus(cpdHours, targetHours);
    if (status !== "at_risk") continue;
    atRisk++;

    const empBody =
      `You've logged ${cpdHours} of ${targetHours} CPD hours (${cpdProgress}% of your annual target) ` +
      `and are behind the pace expected by this point in the year. Book a course to catch up.`;
    if (await createIfNew(e.id, "Your CPD is behind pace", empBody)) employeesNotified++;

    if (e.managedBy) {
      const deptName = e.department?.name ?? "their department";
      const mgrBody =
        `${e.fullName} (${deptName}) has logged ${cpdHours} of ${targetHours} CPD hours ` +
        `(${cpdProgress}%) and is behind pace on CPD. Consider a check-in.`;
      if (await createIfNew(e.managedBy, "Team member behind on CPD", mgrBody)) managersNotified++;
    } else {
      atRiskWithoutManager++;
    }
  }

  return NextResponse.json({
    scanned: employees.length,
    atRisk,
    employeesNotified,
    managersNotified,
    atRiskWithoutManager,
  });
}
