import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser || (authUser.role !== "manager" && authUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const departmentId = url.searchParams.get("departmentId");

    // Roles with their required skills
    const roles = await prisma.roleProfile.findMany({
      include: { RoleSkillRequirement: { include: { Skill: true } } },
    });
    const roleByTitle = new Map(roles.map((r) => [r.title, r]));

    // Employees (optionally department-filtered) with a position + their skills
    const employees = await prisma.user.findMany({
      where: {
        role: "employee",
        position: { not: null },
        ...(departmentId ? { departmentId } : {}),
      },
      include: {
        department: true,
        userSkills: { include: { skill: true } },
      },
      orderBy: { fullName: "asc" },
    });

    const results = [];
    let withRole = 0;

    for (const emp of employees) {
      const role = emp.position ? roleByTitle.get(emp.position) : undefined;
      if (!role) {
        results.push({
          id: emp.id,
          fullName: emp.fullName,
          department: emp.department?.name ?? "—",
          position: emp.position,
          hasRole: false,
          totalGap: 0,
          criticalGaps: 0,
          gaps: [],
        });
        continue;
      }
      withRole++;

      const currentBySkill = new Map(emp.userSkills.map((us) => [us.skill.name, us.currentLevel]));
      const gaps = role.RoleSkillRequirement.map((rq) => {
        const current = currentBySkill.get(rq.Skill.name) ?? 0;
        const gap = Math.max(0, rq.requiredLevel - current);
        return {
          skill: rq.Skill.name,
          required: rq.requiredLevel,
          current,
          gap,
          importance: rq.importance,
        };
      }).sort((a, b) => b.gap - a.gap || (a.importance === "CRITICAL" ? -1 : 1));

      const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
      const criticalGaps = gaps.filter((g) => g.gap > 0 && g.importance === "CRITICAL").length;

      results.push({
        id: emp.id,
        fullName: emp.fullName,
        department: emp.department?.name ?? "—",
        position: emp.position,
        hasRole: true,
        roleTitle: role.title,
        totalGap,
        criticalGaps,
        gaps,
      });
    }

    return NextResponse.json({
      totalEmployees: employees.length,
      withRoleProfile: withRole,
      withoutRoleProfile: employees.length - withRole,
      employees: results,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
