/**
 * POST /api/courses/sync/edx
 * Sync from the official edX Discovery API. Only runs if EDX credentials exist.
 * Imported courses are unapproved by default (require human approval).
 * Body (optional): { query?, limit?, approveAll?, publish? }
 */
import { route, requireAuth, ok, badRequest, readJson } from "@/server/http";
import { edxSyncBodySchema } from "@/server/validation/schemas";
import { EdxCourseCatalogConnector, syncConnector } from "@/server/connectors/registry";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);
  const body = edxSyncBodySchema.parse(await readJson(req).catch(() => ({})));

  const connector = new EdxCourseCatalogConnector();
  if (!connector.isConfigured()) {
    throw badRequest("edX connector not configured. Set EDX_CLIENT_ID and EDX_CLIENT_SECRET.");
  }

  const result = await syncConnector(connector, {
    query: body.query,
    approveAll: body.approveAll,
    publish: body.publish,
  });
  return ok(result, 201);
});
