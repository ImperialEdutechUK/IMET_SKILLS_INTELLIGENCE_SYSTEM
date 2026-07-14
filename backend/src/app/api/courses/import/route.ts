/**
 * POST /api/courses/import
 * Import courses into the approved catalogue. Two modes:
 *   - JSON body: { courses: [...], approveAll?, publish? }
 *   - multipart/form-data: file (.csv/.xlsx/.json) [+ approveAll, publish fields]
 */
import { route, requireAuth, ok, badRequest } from "@/server/http";
import { courseImportBodySchema, type CourseImportItem } from "@/server/validation/schemas";
import { parseDocument } from "@/server/parsing/documentParser";
import { coerceRows } from "@/server/connectors/coerce";
import { ManualCourseImportConnector } from "@/server/connectors/manual";
import { importCourses, type CourseCatalogueInput } from "@/server/connectors/importer";
import { toCourseSource } from "@/server/connectors/types";

const WRITE_ROLES = ["manager", "admin", "author"];

function itemToCatalogueInput(item: CourseImportItem): CourseCatalogueInput {
  return {
    title: item.title,
    description: item.description,
    provider: item.provider,
    source: item.source ?? toCourseSource(item.provider),
    externalSource: "manual",
    externalId: item.externalId,
    externalUrl: item.externalUrl || undefined,
    level: item.level,
    durationHours: item.durationHours,
    cpdHours: item.cpdHours ?? item.durationHours ?? 0,
    costType: item.costType,
    language: item.language ?? "English",
    rating: item.rating,
    approved: item.approved ?? true,
    preferredProvider: item.preferredProvider ?? false,
    availableToOrg: item.availableToOrg ?? false,
    category: item.category,
    skills: item.skills.map((s) => (typeof s === "string" ? s : s.skill)),
  };
}

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);
  const contentType = req.headers.get("content-type") ?? "";

  // ── File upload mode ──
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Missing 'file' in form-data.");
    const approveAll = form.get("approveAll") === "true";
    const publish = form.get("publish") !== "false"; // default publish on

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buffer, file.name, file.type || undefined);

    let rows: Record<string, unknown>[] = [];
    if (parsed.kind === "json") {
      const data = JSON.parse(parsed.text);
      rows = Array.isArray(data) ? data : Array.isArray(data.courses) ? data.courses : [data];
    } else if (parsed.rows) {
      rows = parsed.rows;
    } else {
      throw badRequest("Unsupported course file. Use .csv, .xlsx, or .json.");
    }

    const external = coerceRows(rows);
    if (external.length === 0) throw badRequest("No valid course rows found (a 'title' column is required).");

    const connector = new ManualCourseImportConnector(external);
    const normalized = (await connector.fetchCourses()).map((c) => connector.normalizeCourse(c));
    const result = await importCourses(normalized, { approveAll, publish });
    return ok({ mode: "file", fetched: external.length, ...result }, 201);
  }

  // ── JSON mode ──
  const body = courseImportBodySchema.parse(await req.json().catch(() => null));
  const inputs = body.courses.map(itemToCatalogueInput);
  const result = await importCourses(inputs, { approveAll: body.approveAll, publish: body.publish ?? true });
  return ok({ mode: "json", fetched: inputs.length, ...result }, 201);
});
