/**
 * GET /api/dashboard/department/:departmentId/skill-gaps
 * Department-level skill-gap summary aggregated from stored SkillGap rows.
 */
import { route, requireAuth, ok, notFound } from "@/server/http";
import { prisma } from "@/lib/db";
import { assertDepartmentAccess } from "@/lib/authz";
import { numberToLevel, type GapStatus } from "@/lib/levels";

// Authors are content-only: they curate the course catalogue and have no
// business reading named employees' skill gaps, which is what this endpoint
// returns. They were included here alongside manager/admin; they are not any more.
const PRIVILEGED = ["manager", "admin"];

export const GET = route(async (req: Request, ctx: { params: Promise<{ departmentId: string }> }) => {
  const auth = requireAuth(req, PRIVILEGED);
  const { departmentId } = await ctx.params;

  // Per-employee gap detail for a whole department, named. A manager may only
  // pull their own; previously any manager could pull any department's.
  assertDepartmentAccess(auth, departmentId);

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) throw notFound("Department not found.");

  const gaps = await prisma.skillGap.findMany({
    where: { user: { departmentId } },
    include: { skill: true, user: { select: { id: true, fullName: true, position: true } } },
  });

  const employeeCount = await prisma.user.count({ where: { departmentId } });

  // Per-skill aggregation (only outstanding gaps count towards "gap" metrics).
  const perSkill = new Map<
    string,
    { skill: string; employeesWithGap: number; totalGapValue: number; critical: number; missing: number; needs: number; maxPriority: number }
  >();
  const statusCounts: Record<GapStatus, number> = {
    MEETS_REQUIREMENT: 0,
    NEEDS_IMPROVEMENT: 0,
    CRITICAL_GAP: 0,
    MISSING_SKILL: 0,
  };
  const perEmployee = new Map<string, { id: string; fullName: string; position: string | null; gaps: number; critical: number; topPriority: number }>();

  for (const g of gaps) {
    statusCounts[g.status]++;

    const isGap = g.status !== "MEETS_REQUIREMENT";
    const s = perSkill.get(g.skillId) ?? {
      skill: g.skill.name,
      employeesWithGap: 0,
      totalGapValue: 0,
      critical: 0,
      missing: 0,
      needs: 0,
      maxPriority: 0,
    };
    if (isGap) {
      s.employeesWithGap++;
      s.totalGapValue += g.gapValue;
      if (g.status === "CRITICAL_GAP") s.critical++;
      if (g.status === "MISSING_SKILL") s.missing++;
      if (g.status === "NEEDS_IMPROVEMENT") s.needs++;
      s.maxPriority = Math.max(s.maxPriority, g.priorityScore);
    }
    perSkill.set(g.skillId, s);

    const e = perEmployee.get(g.user.id) ?? {
      id: g.user.id,
      fullName: g.user.fullName,
      position: g.user.position,
      gaps: 0,
      critical: 0,
      topPriority: 0,
    };
    if (isGap) {
      e.gaps++;
      if (g.status === "CRITICAL_GAP" || g.status === "MISSING_SKILL") e.critical++;
      e.topPriority = Math.max(e.topPriority, g.priorityScore);
    }
    perEmployee.set(g.user.id, e);
  }

  const skillGaps = [...perSkill.values()]
    .filter((s) => s.employeesWithGap > 0)
    .map((s) => ({
      skill: s.skill,
      employeesWithGap: s.employeesWithGap,
      avgGap: Number((s.totalGapValue / s.employeesWithGap).toFixed(2)),
      avgGapLevel: numberToLevel(Math.round(s.totalGapValue / s.employeesWithGap)),
      criticalGaps: s.critical,
      missingSkill: s.missing,
      needsImprovement: s.needs,
      priorityScore: s.maxPriority,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.employeesWithGap - a.employeesWithGap);

  const employees = [...perEmployee.values()].sort((a, b) => b.topPriority - a.topPriority);

  return ok({
    department: { id: department.id, name: department.name, priority: department.priority },
    employeeCount,
    analysedEmployees: perEmployee.size,
    statusCounts,
    topSkillGaps: skillGaps.slice(0, 10),
    skillGaps,
    employees,
  });
});
