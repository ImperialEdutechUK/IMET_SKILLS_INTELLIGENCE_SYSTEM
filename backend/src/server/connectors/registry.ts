/**
 * Connector registry + a uniform "sync" helper that runs any connector through
 * fetch → normalize → importCourses.
 */
import type { CourseSourceConnector } from "./types";
import { importCourses, type ImportOptions, type ImportResult } from "./importer";
import { ManualCourseImportConnector } from "./manual";
import { EdxCourseCatalogConnector } from "./edx";
import { CourseraCatalogConnector, CourseraBusinessConnector } from "./coursera";
import { LinkedInLearningConnector } from "./linkedin";
import { LinkedInLearningCatalogConnector } from "./linkedinLearningCatalog";
import { ApifyAllowedSitesConnector } from "./apify";

export {
  ManualCourseImportConnector,
  EdxCourseCatalogConnector,
  CourseraCatalogConnector,
  CourseraBusinessConnector,
  LinkedInLearningConnector,
  LinkedInLearningCatalogConnector,
  ApifyAllowedSitesConnector,
};

export function connectorStatus() {
  const connectors: CourseSourceConnector[] = [
    new EdxCourseCatalogConnector(),
    new CourseraCatalogConnector(),
    new LinkedInLearningConnector(),
    new LinkedInLearningCatalogConnector(),
    new ApifyAllowedSitesConnector(),
  ];
  return connectors.map((c) => ({ source: c.sourceName, configured: c.isConfigured() }));
}

/** Run a connector end-to-end and write results into the catalogue. */
export async function syncConnector(
  connector: CourseSourceConnector,
  opts: ImportOptions & { query?: string } = {}
): Promise<ImportResult & { source: string; fetched: number }> {
  const external = await connector.fetchCourses(opts.query);
  const normalized = external.map((c) => connector.normalizeCourse(c));
  const result = await importCourses(normalized, opts);
  return { source: connector.sourceName, fetched: external.length, ...result };
}
