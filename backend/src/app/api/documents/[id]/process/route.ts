/**
 * POST /api/documents/:id/process
 * Parse the document, run AI extraction (with repair retry), normalise skills,
 * and store employee skills or role requirements. Body (optional):
 *   { userId?, roleTitle?, departmentId?, extractOnly? }
 */
import { route, requireAuth, ok, readJson, notFound, forbidden } from "@/server/http";
import { processDocumentBodySchema } from "@/server/validation/schemas";
import { processDocument } from "@/server/documents/service";
import { assertDepartmentAccess, assertEmployeeAccess, isUnscoped } from "@/lib/authz";
import { prisma } from "@/lib/db";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = requireAuth(req, WRITE_ROLES);
  const { id } = await ctx.params;

  const body = processDocumentBodySchema.parse(
    await readJson(req).catch(() => ({}))
  );

  // This is the write half of the document pipeline: it can set an employee's
  // recorded skill levels, or create/replace a role profile's requirements.
  // Neither the document nor the target was previously checked against the
  // caller, so any manager could process any document id and aim the result at
  // any user in any department.
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!doc) throw notFound("Document not found.");

  if (!isUnscoped(auth)) {
    // The document's own owner, when it has one, must be in scope.
    if (doc.userId) await assertEmployeeAccess(auth, doc.userId);
    // …and so must any employee the caller redirects the result onto.
    if (body.userId) {
      if (auth.role === "author") throw forbidden("Authors cannot process documents onto an employee.");
      await assertEmployeeAccess(auth, body.userId);
    }
    // Role requirements are department-scoped data too.
    if (body.departmentId) assertDepartmentAccess(auth, body.departmentId);
    // A document with no owner and no explicit target resolves its employee by
    // NAME inside the service, which can land on anyone in the organisation.
    // Managers must say who they mean.
    if (!doc.userId && !body.userId && !body.roleTitle) {
      throw forbidden("Specify a userId — this document is not linked to an employee you manage.");
    }
  }

  const result = await processDocument(id, {
    userId: body.userId,
    roleTitle: body.roleTitle,
    departmentId: body.departmentId,
    extractOnly: body.extractOnly,
  });

  const status = result.status === "PROCESSED" ? 200 : result.status === "NEEDS_REVIEW" ? 422 : 200;
  return ok(result, status);
});
