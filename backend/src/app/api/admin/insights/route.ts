/**
 * GET /api/admin/insights
 * System-wide skill-gap aggregation across all departments (read-only).
 */
import { route, requireAuth, ok } from "@/server/http";
import { prisma } from "@/lib/db";

export const GET = route(async (req: Request) => {
  requireAuth(req, ["admin"]);

  const gaps = await prisma.skillGap.findMany({
    include: {
      skill: true,
      user: { select: { id: true, fullName: true, department: { select: { id: true, name: true } } } },
    },
  });

  const totalEmployeesAnalysed = new Set(gaps.map((g) => g.userId)).size;

  const statusCounts = { MEETS_REQUIREMENT: 0, NEEDS_IMPROVEMENT: 0, CRITICAL_GAP: 0, MISSING_SKILL: 0 };
  for (const g of gaps) statusCounts[g.status]++;

  // Per-skill aggregation (outstanding gaps only).
  const perSkill = new Map<string, { skill: string; employeesWithGap: number; totalGap: number; critical: number; maxPriority: number }>();
  // Per-department aggregation.
  const perDept = new Map<string, { id: string; name: string; employeesWithGap: Set<string>; gaps: number; critical: number }>();

  for (const g of gaps) {
    const isGap = g.status !== "MEETS_REQUIREMENT";
    if (isGap) {
      const s = perSkill.get(g.skillId) ?? { skill: g.skill.name, employeesWithGap: 0, totalGap: 0, critical: 0, maxPriority: 0 };
      s.employeesWithGap++;
      s.totalGap += g.gapValue;
      if (g.status === "CRITICAL_GAP" || g.status === "MISSING_SKILL") s.critical++;
      s.maxPriority = Math.max(s.maxPriority, g.priorityScore);
      perSkill.set(g.skillId, s);

      const dept = g.user.department;
      if (dept) {
        const d = perDept.get(dept.id) ?? { id: dept.id, name: dept.name, employeesWithGap: new Set<string>(), gaps: 0, critical: 0 };
        d.employeesWithGap.add(g.user.id);
        d.gaps++;
        if (g.status === "CRITICAL_GAP" || g.status === "MISSING_SKILL") d.critical++;
        perDept.set(dept.id, d);
      }
    }
  }

  const topSkillGaps = [...perSkill.values()]
    .map((s) => ({ skill: s.skill, employeesWithGap: s.employeesWithGap, avgGap: Number((s.totalGap / s.employeesWithGap).toFixed(2)), criticalGaps: s.critical, priorityScore: s.maxPriority }))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.employeesWithGap - a.employeesWithGap)
    .slice(0, 10);

  const departments = [...perDept.values()]
    .map((d) => ({ id: d.id, name: d.name, employeesWithGap: d.employeesWithGap.size, totalGaps: d.gaps, criticalGaps: d.critical }))
    .sort((a, b) => b.criticalGaps - a.criticalGaps || b.totalGaps - a.totalGaps);

  return ok({
    totalEmployeesAnalysed,
    totalGaps: gaps.filter((g) => g.status !== "MEETS_REQUIREMENT").length,
    statusCounts,
    topSkillGaps,
    departments,
  });
});
