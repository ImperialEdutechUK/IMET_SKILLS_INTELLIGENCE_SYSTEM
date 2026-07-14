/**
 * Self-service document upload for the signed-in employee.
 *
 *   GET  /api/me/documents  → the employee's own uploaded documents.
 *   POST /api/me/documents  → multipart form-data: file, type
 *        (SKILL_MATRIX | CPD_RECORD | DAILY_REPORT). Stored, parsed and
 *        AI-analysed against THIS employee; feeds their skill gaps.
 *
 * Unlike /api/documents/upload (manager/admin/author only), this route lets any
 * authenticated employee upload their OWN documents — the userId is always
 * forced to the signed-in user, never taken from the request.
 */
import { route, requireAuth, ok, badRequest } from "@/server/http";
import { employeeDocumentTypeSchema } from "@/server/validation/schemas";
import { saveUpload, processDocument } from "@/server/documents/service";
import { prisma } from "@/lib/db";
import { DocumentType } from "@prisma/client";

const EMPLOYEE_DOC_TYPES: DocumentType[] = [
  DocumentType.SKILL_MATRIX,
  DocumentType.CPD_RECORD,
  DocumentType.DAILY_REPORT,
];

export const GET = route(async (req: Request) => {
  const auth = requireAuth(req);
  const docs = await prisma.document.findMany({
    where: { userId: auth.id, type: { in: EMPLOYEE_DOC_TYPES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, originalName: true, status: true, createdAt: true },
  });
  return ok({ documents: docs });
});

export const POST = route(async (req: Request) => {
  const auth = requireAuth(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected multipart/form-data with a 'file' field.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing 'file' in form-data.");

  const typeParsed = employeeDocumentTypeSchema.safeParse(form.get("type"));
  if (!typeParsed.success) {
    throw badRequest("Missing/invalid 'type'. One of: SKILL_MATRIX, CPD_RECORD, DAILY_REPORT.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await saveUpload({
    buffer,
    originalName: file.name || "upload",
    mimeType: file.type || undefined,
    type: typeParsed.data,
    userId: auth.id, // always the signed-in employee
  });

  // Process immediately so the chat can use fresh skills right away.
  const result = await processDocument(doc.id, { userId: auth.id });

  return ok(
    {
      id: doc.id,
      type: doc.type,
      originalName: doc.originalName,
      status: result.status,
      stored: result.stored ?? 0,
      message: result.message,
    },
    201
  );
});
