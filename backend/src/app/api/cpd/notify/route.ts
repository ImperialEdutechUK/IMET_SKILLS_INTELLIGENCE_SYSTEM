import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";

// On-demand learning reminders. A manager or admin triggers a scan; every
// employee who is behind pace (time-aware "at_risk" OR "attention", see
// lib/cpd-risk) gets an in-app Notification on their own dashboard, and their
// manager (User.managedBy) gets a heads-up when set.
// Idempotent per run: an identical unread notification is not duplicated.
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "manager" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Managers are locked to their own department; admins may target one via ?departmentId.
  const departmentId =
    authUser.role === "manager"
      ? authUser.departmentId
      : new URL(req.url).searchParams.get("departmentId");
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

  let behind = 0;
  let employeesNotified = 0;
  let managersNotified = 0;
  let behindWithoutManager = 0;

  for (const e of employees) {
    const targetHours = await target(e.departmentId);
    const cpdHours = e.cpdRecords.reduce((s, r) => s + r.hours, 0);
    const { status } = cpdRiskStatus(cpdHours, targetHours);
    if (status === null) continue;   // on pace → no reminder needed
    behind++;

    const empBody =
      "Your manager sent you a reminder to keep up with your learning this year. " +
      "Pick a course from your recommendations to stay on track.";
    if (await createIfNew(e.id, "Learning reminder from your manager", empBody)) employeesNotified++;

    if (e.managedBy) {
      const deptName = e.department?.name ?? "their department";
      const mgrBody = `${e.fullName} (${deptName}) is behind pace on their learning. Consider a check-in.`;
      if (await createIfNew(e.managedBy, "Team member needs a nudge", mgrBody)) managersNotified++;
    } else {
      behindWithoutManager++;
    }
  }

  return NextResponse.json({
    scanned: employees.length,
    behind,
    employeesNotified,
    managersNotified,
    behindWithoutManager,
  });
}
