/**
 * POST /api/courses/sync/linkedin-learning
 *
 * Ingests LinkedIn Learning's official course export.
 * multipart/form-data: file (.csv/.xlsx/.json) [+ approveAll, publish]
 *
 * There is no fetch-from-LinkedIn mode: the catalogue is auth-walled, has no
 * public sitemap, and robots.txt disallows its search endpoint. An admin
 * downloads the export from the LinkedIn Learning admin console
 * (Content → Library → Export) and uploads it here. See connectors/linkedin.ts.
 */
import { route, requireAuth, ok, badRequest } from "@/server/http";
import { parseDocument } from "@/server/parsing/documentParser";
import { LinkedInLearningConnector } from "@/server/connectors/linkedin";
import { importCoursesBulk } from "@/server/connectors/bulkImporter";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw badRequest(
      "Upload the LinkedIn Learning export as multipart/form-data with a 'file' field (.csv, .xlsx, or .json)."
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Missing 'file' in form-data.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseDocument(buffer, file.name, file.type || undefined);

  let rows: Record<string, unknown>[] = [];
  if (parsed.kind === "json") {
    const data = JSON.parse(parsed.text);
    rows = Array.isArray(data) ? data : Array.isArray(data.courses) ? data.courses : [data];
  } else if (parsed.rows) {
    rows = parsed.rows;
  } else {
    throw badRequest("Unsupported export format. Use .csv, .xlsx, or .json.");
  }

  const connector = LinkedInLearningConnector.fromRows(rows);
  const external = await connector.fetchCourses();
  if (external.length === 0) {
    throw badRequest("No courses found in the export (a course-title column is required).");
  }

  const normalized = external.map((c) => connector.normalizeCourse(c));
  const result = await importCoursesBulk(normalized, {
    approveAll: form.get("approveAll") === "true",
    publish: form.get("publish") !== "false", // default publish on
  });

  return ok({ source: "linkedin", fetched: external.length, ...result }, 201);
});
