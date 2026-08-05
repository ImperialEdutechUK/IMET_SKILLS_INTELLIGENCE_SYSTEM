/**
 * POST /api/documents/upload
 * Multipart form-data: file, type (DocumentType), userId?, roleTitle?
 * Stores the file and creates a Document (status UPLOADED). Does not parse yet.
 */
import { route, requireAuth, ok, badRequest } from "@/server/http";
import { documentTypeSchema } from "@/server/validation/schemas";
import { saveUpload } from "@/server/documents/service";
import { assertEmployeeAccess } from "@/lib/authz";
import { checkBufferSize, checkUpload } from "@/lib/upload-limits";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request) => {
  const auth = requireAuth(req, WRITE_ROLES);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing 'file' in form-data.");

  const upload = checkUpload(file);
  if (!upload.ok) throw badRequest(upload.error!);

  const typeParsed = documentTypeSchema.safeParse(form.get("type"));
  if (!typeParsed.success) {
    throw badRequest(
      "Missing/invalid 'type'. One of: DAILY_REPORT, CPD_RECORD, ROLE_REQUIREMENT, JOB_DESCRIPTION, MANAGER_EVALUATION, SKILL_MATRIX."
    );
  }

  const rawUserId = form.get("userId");
  const userId = typeof rawUserId === "string" && rawUserId.trim() ? rawUserId.trim() : undefined;

  // `userId` decides whose skill profile this document will eventually write to,
  // and it came straight off the request with nothing checking it. A manager
  // could attach a skill matrix to ANY employee in ANY department and, via
  // /process, overwrite their recorded levels. Authors have no employee mandate
  // at all, so they may not target one.
  if (userId) {
    if (auth.role === "author") {
      throw badRequest("Authors cannot attach documents to an employee.");
    }
    await assertEmployeeAccess(auth, userId);
  }

  const roleTitleRaw = form.get("roleTitle");
  const roleTitle =
    typeof roleTitleRaw === "string" && roleTitleRaw.trim()
      ? roleTitleRaw.trim().slice(0, 200)
      : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const size = checkBufferSize(buffer);
  if (!size.ok) throw badRequest(size.error!);

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
