/**
 * POST /api/courses/sync/apify
 * Import scraped courses from an Apify dataset (allowed source domains only).
 * Body: { datasetId?, actorId?, runId?, limit?, approveAll?, publish? }
 *
 * Preferred flow keeps DB credentials out of the Actor:
 *   Actor crawls → pushes to Apify dataset → this endpoint reads it → Postgres.
 */
import { route, requireAuth, ok, badRequest, readJson } from "@/server/http";
import { apifySyncBodySchema } from "@/server/validation/schemas";
import { ApifyAllowedSitesConnector, syncConnector } from "@/server/connectors/registry";

const WRITE_ROLES = ["manager", "admin", "author"];

export const POST = route(async (req: Request) => {
  requireAuth(req, WRITE_ROLES);
  const body = apifySyncBodySchema.parse(await readJson(req).catch(() => ({})));

  const connector = new ApifyAllowedSitesConnector({
    datasetId: body.datasetId,
    actorId: body.actorId,
    runId: body.runId,
    limit: body.limit,
  });
  if (!connector.isConfigured()) {
    throw badRequest("Apify connector not configured. Set APIFY_TOKEN (and APIFY_DATASET_ID or pass datasetId).");
  }

  const result = await syncConnector(connector, {
    approveAll: body.approveAll,
    publish: body.publish,
  });
  return ok(result, 201);
});
