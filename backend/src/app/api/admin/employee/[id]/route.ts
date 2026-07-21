import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { getCpdTargetHours } from "@/lib/cpd-target";
import { cpdRiskStatus } from "@/lib/cpd-risk";

// Read-only per-employee detail for admin / HR / Director:
// courses, skill gaps (role requirement vs current level), and CPD status.
// Touches only user-owned data — never writes, never reads/edits the Course catalog.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = verifyToken(req);
  if (!authUser || authUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      department: true,
      enrollments: { include: { course: { include: { category: true } } } },
      cpdRecords: true,
      userSkills: { include: { skill: true } },
      skillGaps: { include: { skill: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  // CPD (time-aware status via the shared engine)
  const targetHours = await getCpdTargetHours(user.departmentId);
  const cpdHours = user.cpdRecords.reduce((s, r) => s + r.hours, 0);
  const { cpdProgress, status: cpdStatus } = cpdRiskStatus(cpdHours, targetHours);

  const courses = user.enrollments.map((e) => ({
    id: e.id,
    title: e.course.title,
    provider: e.course.provider,
    category: e.course.category?.name ?? null,
    status: e.status,
    progress: e.progress,
    externalUrl: e.course.externalUrl,
  }));

  // Skill gaps: required level (from the employee's role profile) vs current level.
  let roleTitle: string | null = null;
  let skillGaps: {
    skill: string;
    required: number;
    current: number;
    gap: number;
    importance: string;
  }[] = [];

  if (user.position) {
    const role = await prisma.roleProfile.findUnique({
      where: { title: user.position },
      include: { requirements: { include: { skill: true } } },
    });
    if (role) {
      roleTitle = role.title;
      const currentBySkill = new Map(user.userSkills.map((us) => [us.skill.name, us.currentLevel]));
      skillGaps = role.requirements
        .map((rq) => {
          const current = currentBySkill.get(rq.skill.name) ?? 0;
          return {
            skill: rq.skill.name,
            required: rq.requiredLevel,
            current,
            gap: Math.max(0, rq.requiredLevel - current),
            importance: rq.importance,
          };
        })
        .sort((a, b) => b.gap - a.gap);
    }
  }

  // Fallback: if no role-based gaps, surface the engine's stored SkillGap rows.
  if (skillGaps.length === 0 && user.skillGaps.length > 0) {
    skillGaps = user.skillGaps
      .map((g) => ({
        skill: g.skill.name,
        required: g.requiredLevel,
        current: g.currentLevel,
        gap: Math.max(0, g.gapValue),
        importance: g.importance,
      }))
      .sort((a, b) => b.gap - a.gap);
  }

  return NextResponse.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department?.name ?? "—",
    position: user.position,
    roleTitle,
    cpd: { hours: cpdHours, target: targetHours, pct: cpdProgress, status: cpdStatus },
    counts: {
      completed: courses.filter((c) => c.status === "completed").length,
      inProgress: courses.filter((c) => c.status === "in_progress").length,
    },
    courses,
    skillGaps,
  });
}
