/**
 * GET /api/recommendations/:employeeId
 * Return the stored recommendations for an employee. Employees may read their
 * own; managers/admins/authors may read anyone's.
 */
import { route, requireAuth, ok, forbidden, notFound } from "@/server/http";
import { getRecommendations, RecommendationError } from "@/server/courses/recommend";

const PRIVILEGED = ["manager", "admin", "author"];

export const GET = route(async (req: Request, ctx: { params: Promise<{ employeeId: string }> }) => {
  const auth = requireAuth(req);
  const { employeeId } = await ctx.params;

  if (auth.id !== employeeId && !PRIVILEGED.includes(auth.role)) {
    throw forbidden("You can only view your own recommendations.");
  }

  try {
    return ok(await getRecommendations(employeeId));
  } catch (err) {
    if (err instanceof RecommendationError) throw notFound(err.message);
    throw err;
  }
});
