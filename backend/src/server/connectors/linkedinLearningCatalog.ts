/**
 * LinkedInLearningCatalogConnector — the whole-catalogue scrape of LinkedIn
 * Learning's public course pages.
 *
 * This is the crawl counterpart to `linkedin.ts` (the admin CSV/XLSX export).
 * They are deliberately kept apart:
 *
 *   - `linkedin.ts`      externalSource "linkedin"          — the org's OWN
 *                        licensed library, so its rows are `approved` and
 *                        `availableToOrg` on import.
 *   - this connector     externalSource "linkedin-learning" — the public
 *                        catalogue at large. Like the Coursera scrape, rows land
 *                        unapproved and unavailable until a human vets them.
 *
 * Distinct `externalSource` values mean the two never collide on
 * `@@unique([externalSource, externalId])`; a course present in both is stored
 * once per source, which is what the reviewer wants to see.
 *
 * `fetchCourses()` here just adapts a list of already-scraped courses; the CLI
 * (`scripts/linkedin-learning-sync.ts`) owns enumeration, the checkpointed
 * scrape, and the bulk import, exactly as the Coursera CLI does.
 */
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";
import type { ScrapedLinkedInCourse } from "./linkedinLearningScraper";

/** Adapt one scraped course to the connector's raw `ExternalCourse` shape. */
export function toExternalCourse(c: ScrapedLinkedInCourse): ExternalCourse {
  return {
    title: c.title.trim(),
    provider: c.provider ?? "LinkedIn Learning",
    url: c.url,
    description: c.description,
    skills: c.skills,
    level: c.level,
    durationHours: c.durationHours,
    costType: c.costType ?? "subscription",
    language: c.language ?? "English",
    externalId: c.slug,
    raw: { ...c, category: c.category },
  };
}

export class LinkedInLearningCatalogConnector implements CourseSourceConnector {
  sourceName = "linkedin-learning";

  constructor(private items: ExternalCourse[] = []) {}

  /** Build from courses the CLI has already scraped. */
  static fromScraped(courses: ScrapedLinkedInCourse[]): LinkedInLearningCatalogConnector {
    return new LinkedInLearningCatalogConnector(courses.map(toExternalCourse));
  }

  /** The catalogue is public — there is nothing to configure. */
  isConfigured(): boolean {
    return true;
  }

  async fetchCourses(): Promise<ExternalCourse[]> {
    return this.items;
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    const category = (course.raw as { category?: string } | undefined)?.category;
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider ?? "LinkedIn Learning",
      source: "linkedin",
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.durationHours ?? 0,
      costType: course.costType ?? "subscription",
      language: course.language ?? "English",
      rating: course.rating,
      // Scraped from the public catalogue, not the org's licensed library:
      // a human approves before it can be recommended (cf. Coursera).
      approved: false,
      preferredProvider: false,
      availableToOrg: false,
      category,
      skills: course.skills ?? [],
    };
  }
}
