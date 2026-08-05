/**
 * POST /api/gaps/run/:employeeId
 * Run deterministic gap analysis for one employee and persist SkillGap rows.
 */
import { route, requireAuth, ok, notFound, badRequest } from "@/server/http";
import { assertEmployeeAccess } from "@/lib/authz";
import { runGapAnalysis, GapAnalysisError } from "@/server/gaps/gapAnalysis";

// This WRITES SkillGap rows for the named employee. Authors have no mandate over
// employee records, so they are out; managers are confined to their own team.
const WRITE_ROLES = ["manager", "admin"];

export const POST = route(async (req: Request, ctx: { params: Promise<{ employeeId: string }> }) => {
  const auth = requireAuth(req, WRITE_ROLES);
  const { employeeId } = await ctx.params;

  await assertEmployeeAccess(auth, employeeId);

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
