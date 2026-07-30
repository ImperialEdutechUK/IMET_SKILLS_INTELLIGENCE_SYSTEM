import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/verifyToken";
import { refreshDerivedSkillState } from "@/server/skills/refresh";

const LEVEL_LABEL = ["Not Started", "Beginner", "Intermediate", "Advanced", "Expert"];
const label = (n: number) => LEVEL_LABEL[Math.max(0, Math.min(4, n))];

const parseLevel = (n: unknown): number | null => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0 || v > 4) return null;
  return v;
};

// Update the signed-in employee's own self-assessed skill level.
//
// This is how an employee closes a gap: they reach the level they were aiming
// for and record it here. That edit is not cosmetic — UserSkill is the input to
// the whole recommendation pipeline, so the moment it changes we recompute the
// stored derived state (SkillGap, and any course pick whose gaps are now all
// closed) via refreshDerivedSkillState. The next re-recommendation — chat or
// engine — then scores against the new levels rather than the old ones.
//
// Only the owner's own row is writable; the skill itself (name, category,
// taxonomy) is never touched from here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = verifyToken(req);
  if (!authUser) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { currentLevel, targetLevel } = body ?? {};

  if (currentLevel === undefined && targetLevel === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const existing = await prisma.userSkill.findUnique({
    where: { id },
    include: { skill: { include: { category: true } } },
  });
  if (!existing || existing.userId !== authUser.id) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  let nextCurrent = existing.currentLevel;
  if (currentLevel !== undefined) {
    const v = parseLevel(currentLevel);
    if (v === null) return NextResponse.json({ error: "Pick a valid current level." }, { status: 400 });
    nextCurrent = v;
  }

  let nextTarget = existing.targetLevel;
  if (targetLevel !== undefined) {
    const v = parseLevel(targetLevel);
    // "Not Started" is not a goal — a target below Beginner would make the skill
    // permanently "achieved" and silently drop it out of every recommendation.
    if (v === null || v < 1) {
      return NextResponse.json({ error: "Pick a target of Beginner or above." }, { status: 400 });
    }
    nextTarget = v;
  }

  // No-op edits (opening the dialog and saving unchanged values) must not churn
  // the engine — recomputing gaps and clearing picks for nothing.
  if (nextCurrent === existing.currentLevel && nextTarget === existing.targetLevel) {
    return NextResponse.json({
      ok: true,
      changed: false,
      skill: {
        id: existing.id,
        name: existing.skill.name,
        category: existing.skill.category?.name ?? "General",
        currentLevel: existing.currentLevel,
        targetLevel: existing.targetLevel,
        currentLabel: label(existing.currentLevel),
        targetLabel: label(existing.targetLevel),
      },
    });
  }

  const updated = await prisma.userSkill.update({
    where: { id },
    data: { currentLevel: nextCurrent, targetLevel: nextTarget },
  });

  // Best-effort: the level is already saved. A refresh failure (remote DB
  // hiccup, no role profile mid-setup) must not turn a successful edit into an
  // error the employee has to retry — the next recommendation run recomputes
  // from UserSkill anyway, so the worst case is a briefly stale stored pick.
  let refresh: Awaited<ReturnType<typeof refreshDerivedSkillState>> | null = null;
  try {
    refresh = await refreshDerivedSkillState(authUser.id);
  } catch (err) {
    console.error("[me/skills] refresh after level edit failed:", err);
  }

  const achieved = nextCurrent >= nextTarget;

  return NextResponse.json({
    ok: true,
    changed: true,
    achieved,
    skill: {
      id: updated.id,
      name: existing.skill.name,
      category: existing.skill.category?.name ?? "General",
      currentLevel: updated.currentLevel,
      targetLevel: updated.targetLevel,
      currentLabel: label(updated.currentLevel),
      targetLabel: label(updated.targetLevel),
    },
    // What the edit changed downstream, so the UI can say so honestly rather
    // than claiming a refresh that may not have happened.
    refreshed: refresh
      ? {
          gapsRecomputed: refresh.roleGapsRecomputed,
          outstandingGaps: refresh.outstandingGaps,
          recommendationsCleared: refresh.recommendationsCleared,
        }
      : null,
  });
}
