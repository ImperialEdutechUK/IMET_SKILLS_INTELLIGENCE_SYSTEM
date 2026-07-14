/**
 * POST /api/documents/:id/process
 * Parse the document, run AI extraction (with repair retry), normalise skills,
 * and store employee skills or role requirements. Body (optional):
 *   { userId?, roleTitle?, departmentId?, extractOnly? }
 */
import { route, requireAuth, ok, readJson } from "@/server/http";
import { processDocumentBodySchema } from "@/server/validation/schemas";
import { processDocument } from "@/server/documents/service";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireAuth(req, WRITE_ROLES);
  const { id } = await ctx.params;

  const body = processDocumentBodySchema.parse(
    await readJson(req).catch(() => ({}))
  );

  const result = await processDocument(id, {
    userId: body.userId,
    roleTitle: body.roleTitle,
    departmentId: body.departmentId,
    extractOnly: body.extractOnly,
  });

  const status = result.status === "PROCESSED" ? 200 : result.status === "NEEDS_REVIEW" ? 422 : 200;
  return ok(result, status);
});
