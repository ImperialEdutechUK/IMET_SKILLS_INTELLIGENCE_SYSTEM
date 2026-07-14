/**
 * ManualCourseImportConnector — courses supplied directly by an admin as a CSV,
 * Excel, or JSON payload (already parsed into ExternalCourse items). Manual
 * imports are treated as curated: approved by default.
 */
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";
import { toCourseSource } from "./types";

export class ManualCourseImportConnector implements CourseSourceConnector {
  sourceName = "manual";
  constructor(private items: ExternalCourse[] = []) {}

  isConfigured(): boolean {
    return true;
  }

  async fetchCourses(): Promise<ExternalCourse[]> {
    return this.items;
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider,
      source: toCourseSource(course.provider),
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.cpdHours ?? course.durationHours ?? 0,
      costType: course.costType,
      language: course.language ?? "English",
      rating: course.rating,
      approved: true, // curated import
      preferredProvider: false,
      availableToOrg: false,
      category: undefined,
      skills: course.skills ?? [],
    };
  }
}
