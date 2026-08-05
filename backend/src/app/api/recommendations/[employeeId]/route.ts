/**
 * GET /api/recommendations/:employeeId
 * Return the stored recommendations for an employee. Employees may read their
 * own; managers/admins/authors may read anyone's.
 */
import { route, requireAuth, ok, forbidden, notFound } from "@/server/http";
import { assertEmployeeAccess } from "@/lib/authz";
import { getRecommendations, RecommendationError } from "@/server/courses/recommend";

// Authors curate the catalogue; they have no reason to read a named employee's
// personal recommendations, so they are no longer privileged here.
const PRIVILEGED = ["manager", "admin"];

export const GET = route(async (req: Request, ctx: { params: Promise<{ employeeId: string }> }) => {
  const auth = requireAuth(req);
  const { employeeId } = await ctx.params;

  if (auth.id !== employeeId) {
    if (!PRIVILEGED.includes(auth.role)) {
      throw forbidden("You can only view your own recommendations.");
    }
    // Role alone was the whole check before, so any manager could read any
    // employee's recommendations across every department. Confirm the target
    // is actually inside the caller's scope.
    await assertEmployeeAccess(auth, employeeId);
  }

  try {
    return ok(await getRecommendations(employeeId));
  } catch (err) {
    if (err instanceof RecommendationError) throw notFound(err.message);
    throw err;
  }
});
