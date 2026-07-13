import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const [employees, activeCourses, certificatesEarned, departments, allEnrollments, allCpd, userSkills, activities] =
    await Promise.all([
      prisma.user.count({ where: { role: "employee" } }),
      prisma.course.count({ where: { status: "published" } }),
      prisma.certificate.count(),
      prisma.department.findMany({ include: { users: { where: { role: "employee" }, include: { cpdRecords: true } } } }),
      prisma.enrollment.findMany({ where: { status: "completed" }, select: { completedAt: true } }),
      prisma.cpdRecord.findMany({ select: { userId: true, hours: true } }),
      prisma.userSkill.findMany({ include: { skill: true } }),
      prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { user: true } }),
    ]);

  // 6-month learning activity (completions by month)
  const now = new Date();
  const months: { month: string; completions: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.toLocaleDateString("en-GB", { month: "short" }), completions: 0 });
  }
  for (const e of allEnrollments) {
    if (!e.completedAt) continue;
    const diff = (now.getFullYear() - e.completedAt.getFullYear()) * 12 + (now.getMonth() - e.completedAt.getMonth());
    if (diff >= 0 && diff < 6) months[5 - diff].completions += 1;
  }

  // Department performance (avg CPD % per dept)
  const cpdByUser = new Map<string, number>();
  for (const r of allCpd) cpdByUser.set(r.userId, (cpdByUser.get(r.userId) ?? 0) + r.hours);
  const departmentPerformance = await Promise.all(
    departments.map(async (dept) => {
      const target = await getCpdTargetHours(dept.id);
      const emps = dept.users;
      const avg = emps.length
        ? Math.round(emps.reduce((s, u) => s + Math.min(100, (u.cpdRecords.reduce((a, r) => a + r.hours, 0) / target) * 100), 0) / emps.length)
        : 0;
      return { name: dept.name, value: avg };
    })
  );

  // Skills gap (top by avg gap)
  const gapAgg = new Map<string, { sumGap: number; count: number }>();
  for (const us of userSkills) {
    const key = us.skill.name;
    if (!gapAgg.has(key)) gapAgg.set(key, { sumGap: 0, count: 0 });
    const a = gapAgg.get(key)!;
    a.sumGap += Math.max(0, us.targetLevel - us.currentLevel);
    a.count += 1;
  }
  const skillsGap = Array.from(gapAgg.entries())
    .map(([name, a]) => ({ name, gap: a.sumGap / a.count }))
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 8)
    .map((s) => ({ name: s.name }));

  // CPD compliance (on-track vs at-risk across all employees)
  let onTrack = 0, atRisk = 0;
  for (const dept of departments) {
    const target = await getCpdTargetHours(dept.id);
    for (const u of dept.users) {
      const hrs = u.cpdRecords.reduce((a, r) => a + r.hours, 0);
      if ((hrs / target) * 100 >= 60) onTrack++; else atRisk++;
    }
  }
  const totalEmp = onTrack + atRisk;
  const compliancePct = totalEmp ? Math.round((onTrack / totalEmp) * 100) : 0;

  return NextResponse.json({
    totalEmployees: employees,
    activeCourses,
    cpdCompletionRate: compliancePct,
    certificatesEarned,
    learningActivity: months,
    departmentPerformance,
    skillsGap,
    cpdCompliance: [
      { name: "On Track", value: onTrack },
      { name: "At Risk", value: atRisk },
    ],
    compliancePct,
    recentActivities: activities.map((a) => {
      const payload = (a.payload ?? {}) as Record<string, unknown>;
      return {
        id: a.id,
        type: a.type,
        user: a.user?.fullName ?? "",
        action: typeof payload.action === "string" ? payload.action : a.type,
        time: a.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      };
    }),
  });
}
