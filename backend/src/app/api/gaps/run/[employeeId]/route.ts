/**
 * POST /api/gaps/run/:employeeId
 * Run deterministic gap analysis for one employee and persist SkillGap rows.
 */
import { route, requireAuth, ok, notFound, badRequest } from "@/server/http";
import { runGapAnalysis, GapAnalysisError } from "@/server/gaps/gapAnalysis";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request, ctx: { params: Promise<{ employeeId: string }> }) => {
  requireAuth(req, WRITE_ROLES);
  const { employeeId } = await ctx.params;

  try {
    const result = await runGapAnalysis(employeeId);
    return ok(result);
  } catch (err) {
    if (err instanceof GapAnalysisError) {
      // Missing role/skills is a client-actionable 400/404, not a 500.
      const message = err.message;
      if (message.includes("not found")) throw notFound(message);
      throw badRequest(message);
    }
    throw err;
  }
});
