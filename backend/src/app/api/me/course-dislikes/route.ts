/**
 * Course dislikes — "never recommend this course to me again".
 *
 *   GET    /api/me/course-dislikes  → { courseIds: string[] }
 *   POST   /api/me/course-dislikes  → block a course, then hand back a refreshed
 *          recommendation list with the freed slot backfilled.
 *          Body: { courseId, answers?, limit? }
 *   DELETE /api/me/course-dislikes  → lift the block (undo a mis-clicked
 *          thumbs-down) and refresh the list the same way.
 *          Body: { courseId, answers?, limit? }
 *
 * Always scoped to the signed-in user: a dislike blocks the course for THEM
 * alone. Nobody else's recommendations change and the catalogue is untouched.
 *
 * Both writes re-run the advisor before responding because the disliked course
 * has left a hole in the ranked list. Regenerating (rather than just dropping
 * the row) is what pulls the next-best course up into the slot. `answers` is
 * the same preference set the chat collected, passed back so the replacement is
 * ranked on the same basis as the picks around it.
 */
import { route, requireAuth, ok, notFound, readJson } from "@/server/http";
import { courseDislikeBodySchema } from "@/server/validation/schemas";
import {
  dislikeCourse,
  undislikeCourse,
  listDislikedCourseIds,
  CourseDislikeError,
} from "@/server/courses/dislikes";
import { generateChatRecommendations } from "@/server/courses/recommendChat";

export const GET = route(async (req: Request) => {
  const auth = requireAuth(req);
  return ok({ courseIds: await listDislikedCourseIds(auth.id) });
});

export const POST = route(async (req: Request) => {
  const auth = requireAuth(req);
  const body = courseDislikeBodySchema.parse(await readJson(req));
  try {
    await dislikeCourse(auth.id, body.courseId);
  } catch (err) {
    if (err instanceof CourseDislikeError) throw notFound(err.message);
    throw err;
  }
  const result = await generateChatRecommendations(auth.id, {
    answers: body.answers,
    limit: body.limit,
  });
  return ok({ ...result, dislikedCourseId: body.courseId });
});

export const DELETE = route(async (req: Request) => {
  const auth = requireAuth(req);
  const body = courseDislikeBodySchema.parse(await readJson(req));
  await undislikeCourse(auth.id, body.courseId);
  const result = await generateChatRecommendations(auth.id, {
    answers: body.answers,
    limit: body.limit,
  });
  return ok({ ...result, restoredCourseId: body.courseId });
});
