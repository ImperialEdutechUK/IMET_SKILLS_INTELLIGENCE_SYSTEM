/**
 * Per-user course dislikes ("never recommend this to me again").
 *
 * A dislike is a PERMANENT, PER-USER block. Every candidate query in the
 * recommendation engine — the manager-run `recommend.ts` path and the
 * employee-facing `recommendChat.ts` path — filters disliked courses out via
 * `dislikeFilter`, and the stored-recommendation readers drop any that slipped
 * through, so a disliked course can never reach that employee again. No other
 * employee is affected and the catalogue row itself is never touched.
 *
 * The block is stored in its own table rather than as a flag on Recommendation:
 * Recommendation rows are deleted and rewritten on every generation, so a flag
 * there would be wiped by the next run.
 */
import { prisma } from "@/lib/db";

export class CourseDislikeError extends Error {}

/**
 * Prisma `where` fragment excluding courses this user has disliked.
 * Spread into any `course.findMany` that feeds the engine.
 */
export const dislikeFilter = (userId: string) => ({
  dislikes: { none: { userId } },
});

/**
 * Record a dislike and clear the course out of this employee's stored picks.
 *
 * Deleting the Recommendation row is what makes the slot free: the caller then
 * regenerates, and because the course is now filtered out of the candidate set,
 * the next-best course in the ranking backfills the slot. It also clears the
 * course from every other surface that reads stored recommendations (e.g. the
 * "Recommended for you" card on the employee dashboard) immediately.
 *
 * Idempotent — disliking twice is a no-op rather than a unique-key error.
 */
export async function dislikeCourse(userId: string, courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new CourseDislikeError("Course not found.");

  await prisma.$transaction([
    prisma.courseDislike.createMany({ data: [{ userId, courseId }], skipDuplicates: true }),
    prisma.recommendation.deleteMany({ where: { userId, courseId } }),
  ]);
}

/** Lift a dislike (the undo behind a mis-clicked thumbs-down). */
export async function undislikeCourse(userId: string, courseId: string): Promise<void> {
  await prisma.courseDislike.deleteMany({ where: { userId, courseId } });
}

/** Course ids this user has disliked — for UIs that want to show the state. */
export async function listDislikedCourseIds(userId: string): Promise<string[]> {
  const rows = await prisma.courseDislike.findMany({
    where: { userId },
    select: { courseId: true },
  });
  return rows.map((r) => r.courseId);
}
