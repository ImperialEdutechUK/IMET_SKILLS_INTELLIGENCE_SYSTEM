/**
 * POST /api/recommendations/generate/:employeeId
 * Generate course recommendations: gaps → score approved courses → (AI explain)
 * → persist. Body (optional): { limit?, explain?, rerunGaps? }
 */
import { route, requireAuth, ok, notFound, badRequest } from "@/server/http";
import { readJson } from "@/server/http";
import { generateRecommendationsBodySchema } from "@/server/validation/schemas";
import { generateRecommendations, RecommendationError } from "@/server/courses/recommend";
import { GapAnalysisError } from "@/server/gaps/gapAnalysis";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request, ctx: { params: Promise<{ employeeId: string }> }) => {
  requireAuth(req, WRITE_ROLES);
  const { employeeId } = await ctx.params;

  const body = generateRecommendationsBodySchema.parse(await readJson(req).catch(() => ({})));

  try {
    const result = await generateRecommendations(employeeId, {
      limit: body.limit,
      explain: body.explain,
      rerunGaps: body.rerunGaps,
    });
    return ok(result);
  } catch (err) {
    if (err instanceof RecommendationError || err instanceof GapAnalysisError) {
      if (err.message.includes("not found")) throw notFound(err.message);
      throw badRequest(err.message);
    }
    throw err;
  }
});
