/**
 * POST /api/documents/upload
 * Multipart form-data: file, type (DocumentType), userId?, roleTitle?
 * Stores the file and creates a Document (status UPLOADED). Does not parse yet.
 */
import { route, requireAuth, ok, badRequest } from "@/server/http";
import { documentTypeSchema } from "@/server/validation/schemas";
import { saveUpload } from "@/server/documents/service";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing 'file' in form-data.");

  const typeParsed = documentTypeSchema.safeParse(form.get("type"));
  if (!typeParsed.success) {
    throw badRequest(
      "Missing/invalid 'type'. One of: DAILY_REPORT, CPD_RECORD, ROLE_REQUIREMENT, JOB_DESCRIPTION, MANAGER_EVALUATION, SKILL_MATRIX."
    );
  }

  const userId = (form.get("userId") as string) || undefined;
  const roleTitle = (form.get("roleTitle") as string) || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());

  const doc = await saveUpload({
    buffer,
    originalName: file.name || "upload",
    mimeType: file.type || undefined,
    type: typeParsed.data,
    userId,
    roleTitle,
  });

  return ok(
    {
      id: doc.id,
      type: doc.type,
      originalName: doc.originalName,
      status: doc.status,
      userId: doc.userId,
      roleTitle: doc.roleTitle,
      nextStep: `POST /api/documents/${doc.id}/process`,
    },
    201
  );
});
