/**
 * Course source connector contract.
 *
 * Every catalogue source (manual import, edX, Coursera, LinkedIn Learning,
 * Apify scrapers) implements the same interface so the import pipeline is
 * uniform:  fetchCourses() → normalizeCourse() → importCourses().
 */
import type { CourseSource } from "@prisma/client";

/** Raw shape a connector produces before normalisation. */
export interface ExternalCourse {
  title: string;
  provider?: string;
  url?: string;
  description?: string;
  skills?: string[];
  level?: string; // Beginner | Intermediate | Advanced (free text ok)
  durationHours?: number;
  costType?: string; // free | paid | subscription
  language?: string;
  externalId?: string;
  rating?: number;
  cpdHours?: number;
  raw?: unknown;
}

/** The normalised shape the importer writes into the courseCatalogue. */
export interface CourseCatalogueInput {
  title: string;
  description?: string;
  provider?: string;
  source: CourseSource; // coursera | edx | linkedin | internal
  externalSource: string; // connector sourceName (edx, apify, manual…)
  externalId?: string;
  externalUrl?: string;
  level?: string;
  durationHours?: number;
  cpdHours?: number;
  costType?: string;
  language?: string;
  rating?: number;
  approved: boolean;
  preferredProvider: boolean;
  availableToOrg: boolean;
  category?: string;
  skills: string[];
}

export interface CourseSourceConnector {
  sourceName: string;
  isConfigured(): boolean;
  fetchCourses(query?: string): Promise<ExternalCourse[]>;
  normalizeCourse(course: ExternalCourse): CourseCatalogueInput;
}

/** Map a connector/provider to the closest `CourseSource` enum value. */
export function toCourseSource(name?: string): CourseSource {
  const n = (name ?? "").toLowerCase();
  if (n.includes("coursera")) return "coursera";
  if (n.includes("edx")) return "edx";
  if (n.includes("linkedin")) return "linkedin";
  return "internal";
}
