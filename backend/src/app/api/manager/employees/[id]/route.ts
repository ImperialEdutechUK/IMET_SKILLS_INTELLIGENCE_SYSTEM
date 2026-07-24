import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";
import { parseCpd } from "@/lib/cpd-activity";

// Read-only per-employee view for a manager. Authorization is department-scoped:
// a manager can only open an employee who is in the manager's own department.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "manager") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await params;

  const emp = await prisma.user.findUnique({
    where: { id },
    include: {
      department: true,
      enrollments: { include: { course: { include: { category: true } } }, orderBy: { updatedAt: "desc" } },
      cpdRecords: { orderBy: { loggedAt: "desc" } },
      userSkills: { include: { skill: true } },
      certificates: true,
    },
  });

  // Enforce department isolation — do not leak employees from other departments.
  if (!emp || emp.role !== "employee" || emp.departmentId !== authUser.departmentId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const target = await getCpdTargetHours(emp.departmentId);
  const cpdHours = emp.cpdRecords.reduce((s, r) => s + r.hours, 0);
  const { cpdProgress, status } = cpdRiskStatus(cpdHours, target);

  const avgSkillPercent = emp.userSkills.length
    ? Math.round((emp.userSkills.reduce((s, us) => s + us.currentLevel, 0) / emp.userSkills.length / 4) * 100)
    : 0;

  const skills = emp.userSkills
    .map((us) => ({
      name: us.skill.name,
      current: us.currentLevel,
      target: us.targetLevel,
      gap: Math.max(0, us.targetLevel - us.currentLevel),
    }))
    .sort((a, b) => b.gap - a.gap);

  const enr = emp.enrollments;
  const mapCourse = (e: (typeof enr)[number]) => ({
    id: e.id,
    title: e.course.title,
    category: e.course.category?.name ?? "General",
    progress: e.progress,
    cpdHours: e.course.cpdHours,
  });
  const courses = {
    inProgress: enr.filter((e) => e.status === "in_progress").map(mapCourse),
    completed: enr.filter((e) => e.status === "completed").map(mapCourse),
    notStarted: enr.filter((e) => e.status === "not_started").map(mapCourse),
  };

  const recentActivities = emp.cpdRecords.slice(0, 6).map((r) => {
    const meta = parseCpd(r.description, "CPD activity", r.source === "course" ? "Learning" : "Other");
    return {
      id: r.id,
      title: meta.title,
      type: meta.type,
      hours: r.hours,
      date: r.loggedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    };
  });

  return NextResponse.json({
    id: emp.id,
    fullName: emp.fullName,
    email: emp.email,
    position: emp.position ?? "—",
    department: emp.department?.name ?? "—",
    avgSkillPercent,
    cpd: { hours: Math.round(cpdHours * 10) / 10, target, progress: cpdProgress, status },
    skills,
    gapsCount: skills.filter((s) => s.gap > 0).length,
    courseCounts: {
      inProgress: courses.inProgress.length,
      completed: courses.completed.length,
      notStarted: courses.notStarted.length,
    },
    courses,
    certificates: emp.certificates.length,
    recentActivities,
  });
}
