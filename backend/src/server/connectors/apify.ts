/**
 * ApifyAllowedSitesConnector.
 *
 * Preferred data flow (keeps DB credentials OUT of the Actor):
 *   Apify Actor crawls course sites → pushes items to an Apify dataset →
 *   THIS server reads the dataset with the Apify API → importer writes Postgres.
 *
 * Only items whose URL host is on the allow-list are imported, so a misbehaving
 * or overly-broad crawl cannot inject arbitrary sources.
 *
 * Env:
 *   APIFY_TOKEN            required
 *   APIFY_DATASET_ID      default dataset to read
 *   APIFY_ACTOR_ID        optional: actor to run on demand
 *   APIFY_ALLOWED_DOMAINS comma-separated host allow-list
 *                         (default: edx.org,coursera.org,linkedin.com,futurelearn.com,udemy.com,open.edu)
 */
import { ApifyClient } from "apify-client";
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";
import { toCourseSource } from "./types";

const DEFAULT_ALLOWED = [
  "edx.org",
  "coursera.org",
  "linkedin.com",
  "futurelearn.com",
  "udemy.com",
  "open.edu",
];

export interface ApifySource {
  datasetId?: string;
  actorId?: string;
  runId?: string;
  limit?: number;
}

export class ApifyAllowedSitesConnector implements CourseSourceConnector {
  sourceName = "apify";
  constructor(private source: ApifySource = {}) {}

  isConfigured(): boolean {
    return !!process.env.APIFY_TOKEN;
  }

  private client(): ApifyClient {
    return new ApifyClient({ token: process.env.APIFY_TOKEN as string });
  }

  private allowedDomains(): string[] {
    const raw = process.env.APIFY_ALLOWED_DOMAINS?.trim();
    return raw ? raw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean) : DEFAULT_ALLOWED;
  }

  private isAllowedUrl(url?: string): boolean {
    if (!url) return true; // no URL → allow (e.g. internal items)
    try {
      const host = new URL(url).hostname.toLowerCase();
      return this.allowedDomains().some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  /**
   * Resolve the dataset to read: an explicit dataset id, the default dataset of
   * a completed run, or (optionally) trigger the actor and wait for its output.
   */
  private async resolveDatasetId(): Promise<string> {
    const client = this.client();
    if (this.source.datasetId || process.env.APIFY_DATASET_ID) {
      return (this.source.datasetId ?? process.env.APIFY_DATASET_ID) as string;
    }
    if (this.source.runId) {
      const run = await client.run(this.source.runId).get();
      if (!run?.defaultDatasetId) throw new Error(`Apify run ${this.source.runId} has no dataset.`);
      return run.defaultDatasetId;
    }
    const actorId = this.source.actorId ?? process.env.APIFY_ACTOR_ID;
    if (actorId) {
      const run = await client.actor(actorId).call(); // runs and waits
      if (!run?.defaultDatasetId) throw new Error(`Apify actor ${actorId} produced no dataset.`);
      return run.defaultDatasetId;
    }
    throw new Error("No Apify dataset/actor/run specified (set APIFY_DATASET_ID or pass datasetId/actorId/runId).");
  }

  async fetchCourses(): Promise<ExternalCourse[]> {
    if (!this.isConfigured()) throw new Error("Apify connector is not configured (APIFY_TOKEN missing).");
    const datasetId = await this.resolveDatasetId();
    const { items } = await this.client()
      .dataset(datasetId)
      .listItems({ limit: this.source.limit ?? 500, clean: true });

    return (items as ApifyItem[])
      .map((it) => this.toExternal(it))
      .filter((c) => c.title && this.isAllowedUrl(c.url));
  }

  private toExternal(it: ApifyItem): ExternalCourse {
    return {
      title: (it.title ?? "").trim(),
      provider: it.provider,
      url: it.url,
      description: it.description,
      skills: normaliseSkills(it.skills),
      level: it.level,
      durationHours: parseHours(it.duration),
      costType: parseCostType(it.price ?? it.cost ?? it.costType),
      language: it.language ?? "English",
      externalId: it.id ?? it.url,
      raw: it,
    };
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider,
      source: toCourseSource(course.provider ?? course.url),
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.durationHours ?? 0,
      costType: course.costType,
      language: course.language ?? "English",
      rating: course.rating,
      approved: false, // scraped data must be approved by a human first
      preferredProvider: false,
      availableToOrg: false,
      skills: course.skills ?? [],
    };
  }
}

interface ApifyItem {
  id?: string;
  title?: string;
  provider?: string;
  url?: string;
  description?: string;
  skills?: string[] | string;
  level?: string;
  duration?: string | number;
  price?: string | number;
  cost?: string | number;
  costType?: string;
  language?: string;
}

function normaliseSkills(skills?: string[] | string): string[] {
  if (!skills) return [];
  if (Array.isArray(skills)) return skills.filter(Boolean);
  return skills.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

/** Extract a whole-hours duration from "6 hours", "6h", "approx 10 hrs", or a number. */
export function parseHours(duration?: string | number): number | undefined {
  if (duration == null) return undefined;
  if (typeof duration === "number") return duration > 0 ? duration : undefined;
  const hoursMatch = duration.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hoursMatch) return parseFloat(hoursMatch[1]);
  const weeksMatch = duration.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (weeksMatch) return parseFloat(weeksMatch[1]) * 3; // ~3 study hours/week
  return undefined;
}

export function parseCostType(price?: string | number): string | undefined {
  if (price == null) return undefined;
  if (typeof price === "number") return price <= 0 ? "free" : "paid";
  const p = price.toLowerCase();
  if (p.includes("free") || p === "0" || p === "£0" || p === "$0") return "free";
  if (p.includes("subscription")) return "subscription";
  return "paid";
}
