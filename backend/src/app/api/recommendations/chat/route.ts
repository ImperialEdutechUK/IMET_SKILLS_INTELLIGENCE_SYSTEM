/**
 * Recommendation chat.
 *
 *   GET  /api/recommendations/chat  → the hard-coded questions + this employee's
 *        context (role, gap count, uploaded documents, active AI provider).
 *   POST /api/recommendations/chat  → generate recommendations from the answers.
 *        Body: { answers: { timeCommitment?, providers?[], goal?, difficulty? }, limit? }
 *
 * Always scoped to the signed-in user — this is the employee's own advisor.
 */
import { route, requireAuth, ok, notFound, badRequest, readJson } from "@/server/http";
import { recommendationChatBodySchema } from "@/server/validation/schemas";
import {
  generateChatRecommendations,
  getChatContext,
  RecommendationChatError,
} from "@/server/courses/recommendChat";

export const GET = route(async (req: Request) => {
  const auth = requireAuth(req);
  try {
    return ok(await getChatContext(auth.id));
  } catch (err) {
    if (err instanceof RecommendationChatError) throw notFound(err.message);
    throw err;
  }
});

export const POST = route(async (req: Request) => {
  const auth = requireAuth(req);
  const body = recommendationChatBodySchema.parse(await readJson(req).catch(() => ({})));
  try {
    return ok(await generateChatRecommendations(auth.id, { answers: body.answers, limit: body.limit }));
  } catch (err) {
    if (err instanceof RecommendationChatError) {
      if (err.message.includes("not found")) throw notFound(err.message);
      throw badRequest(err.message);
    }
    throw err;
  }
});
