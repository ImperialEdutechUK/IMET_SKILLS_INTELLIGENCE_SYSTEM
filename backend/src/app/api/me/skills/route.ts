import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { resolveSkill } from "@/server/skills/normalize";

const LEVEL_LABEL = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];
const label = (n: number) => LEVEL_LABEL[Math.max(0, Math.min(4, n))];
const clampLevel = (n: unknown, fallback: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : fallback;
};

// Add (or update) a self-assessed skill for the signed-in employee.
// Reuses resolveSkill so the skill name is normalised against the existing
// taxonomy (dedupes via aliases; creates a Skill only if genuinely new).
export async function POST(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { name, currentLevel, targetLevel } = body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Skill name is required." }, { status: 400 });
  }

  const resolved = await resolveSkill(name, { createIfMissing: true, useAI: false });
  if (!resolved) return NextResponse.json({ error: "Could not add that skill." }, { status: 400 });

  const cur = clampLevel(currentLevel, 1);
  const tgt = clampLevel(targetLevel, 3);

  const saved = await prisma.userSkill.upsert({
    where: { userId_skillId: { userId: authUser.id, skillId: resolved.skill.id } },
    update: { currentLevel: cur, targetLevel: tgt },
    create: { userId: authUser.id, skillId: resolved.skill.id, currentLevel: cur, targetLevel: tgt },
  });

  return NextResponse.json({ ok: true, id: saved.id, skill: resolved.skill.name });
}

const IMPACT: Record<string, string> = { CRITICAL: "High Impact", HIGH: "High Impact", MEDIUM: "Medium Impact", LOW: "Low Impact" };
const PRIORITY: Record<string, string> = { CRITICAL: "High", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export async function GET(req: Request) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [userSkills, gaps] = await Promise.all([
    prisma.userSkill.findMany({
      where: { userId: authUser.id },
      include: { skill: { include: { category: true } } },
      orderBy: { skill: { name: "asc" } },
    }),
    prisma.skillGap.findMany({
      where: { userId: authUser.id },
      include: { skill: true },
      orderBy: { priorityScore: "desc" },
    }),
  ]);

  const skills = userSkills.map((us) => ({
    id: us.id,
    name: us.skill.name,
    category: us.skill.category?.name ?? "General",
    currentLevel: us.currentLevel,
    targetLevel: us.targetLevel,
    currentLabel: label(us.currentLevel),
    targetLabel: label(us.targetLevel),
    updatedAt: us.updatedAt,
  }));

  const now = Date.now();
  const strengths = skills.filter((s) => s.currentLevel >= 3);
  const improving = skills.filter((s) => s.currentLevel < s.targetLevel);
  const newSkills = skills.filter((s) => now - new Date(s.updatedAt).getTime() <= 30 * 86400000);

  // Skill distribution
  const bucket = { Advanced: 0, Intermediate: 0, Beginner: 0, "Not Started": 0 };
  for (const s of skills) {
    if (s.currentLevel >= 3) bucket.Advanced++;
    else if (s.currentLevel === 2) bucket.Intermediate++;
    else if (s.currentLevel === 1) bucket.Beginner++;
    else bucket["Not Started"]++;
  }
  const distribution = [
    { name: "Advanced", value: bucket.Advanced, color: "#2e7d5b" },
    { name: "Intermediate", value: bucket.Intermediate, color: "#3b82f6" },
    { name: "Beginner", value: bucket.Beginner, color: "#f59e0b" },
    { name: "Not Started", value: bucket["Not Started"], color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  // Skills to Improve — own skills below target, priority from gap size
  const toImprove = improving
    .map((s) => {
      const g = s.targetLevel - s.currentLevel;
      const priority = g >= 2 ? "High" : g === 1 ? "Medium" : "Low";
      return { name: s.name, category: s.category, current: s.currentLevel, target: s.targetLevel, currentLabel: s.currentLabel, targetLabel: s.targetLabel, gap: g, priority };
    })
    .sort((a, b) => b.gap - a.gap);

  // AI Suggested Skills — from the deterministic gap engine, ranked by priority
  const maxScore = gaps.reduce((m, g) => Math.max(m, g.priorityScore), 1);
  const aiSuggested = gaps.map((g) => ({
    skill: g.skill.name,
    currentLevel: g.currentLevel,
    requiredLevel: g.requiredLevel,
    currentLabel: label(g.currentLevel),
    requiredLabel: label(g.requiredLevel),
    relevance: Math.min(99, Math.max(50, Math.round((g.priorityScore / maxScore) * 100))),
    impact: IMPACT[g.importance] ?? "Medium Impact",
    priority: PRIORITY[g.importance] ?? "Medium",
  }));

  return NextResponse.json({
    overview: {
      total: skills.length,
      strengths: strengths.length,
      toImprove: improving.length,
      newSkills: newSkills.length,
    },
    skills,
    distribution,
    topStrengths: strengths.slice(0, 6).map((s) => s.name),
    recentlyAdded: [...skills]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)
      .map((s) => ({ name: s.name, date: new Date(s.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) })),
    toImprove,
    aiSuggested,
  });
}
