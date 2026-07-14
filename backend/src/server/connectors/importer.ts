/**
 * Catalogue importer — the single write path for course data from any
 * connector. Idempotent: upserts by (externalSource, externalId) when an
 * external id is present, otherwise by unique title. Resolves skills through
 * the normaliser so the same course links to canonical Skill rows.
 */
import type { Course } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveSkill } from "@/server/skills/normalize";
import type { CourseCatalogueInput } from "./types";

export type { CourseCatalogueInput } from "./types";

export interface ImportOptions {
  /** Force approved=true on every imported course. */
  approveAll?: boolean;
  /** Publish (status=published) rather than leaving as draft. */
  publish?: boolean;
  /** Use the AI fallback when normalising course skills (default false — bulk). */
  useAIForSkills?: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  courses: { id: string; title: string; approved: boolean; status: string }[];
  errors: { title: string; error: string }[];
}

async function resolveCategoryId(name?: string): Promise<string | undefined> {
  if (!name?.trim()) return undefined;
  const cat = await prisma.category.upsert({
    where: { name: name.trim() },
    update: {},
    create: { name: name.trim() },
  });
  return cat.id;
}

async function linkSkills(courseId: string, skills: string[], useAI: boolean): Promise<void> {
  for (const raw of skills) {
    if (!raw?.trim()) continue;
    const resolved = await resolveSkill(raw, { useAI });
    if (!resolved) continue;
    await prisma.courseSkill.upsert({
      where: { courseId_skillId: { courseId, skillId: resolved.skill.id } },
      update: {},
      create: { courseId, skillId: resolved.skill.id, weight: 1.0 },
    });
  }
}

export async function importCourses(
  inputs: CourseCatalogueInput[],
  opts: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, courses: [], errors: [] };

  for (const input of inputs) {
    try {
      const categoryId = await resolveCategoryId(input.category);
      const approved = opts.approveAll ? true : input.approved;
      const status = opts.publish ? "published" : "draft";

      const data = {
        title: input.title.trim(),
        description: input.description ?? null,
        provider: input.provider ?? null,
        source: input.source,
        externalSource: input.externalSource,
        externalId: input.externalId ?? null,
        externalUrl: input.externalUrl || null,
        level: input.level ?? null,
        durationHours: input.durationHours ?? null,
        cpdHours: input.cpdHours ?? 0,
        costType: input.costType ?? null,
        language: input.language ?? null,
        rating: input.rating ?? null,
        approved,
        preferredProvider: input.preferredProvider,
        availableToOrg: input.availableToOrg,
        categoryId,
        status: status as "draft" | "published",
      };

      // Find existing by external identity, then by title.
      let existing: Course | null = null;
      if (input.externalId) {
        existing = await prisma.course.findFirst({
          where: { externalSource: input.externalSource, externalId: input.externalId },
        });
      }
      if (!existing) {
        existing = await prisma.course.findUnique({ where: { title: data.title } });
      }

      let course: Course;
      if (existing) {
        course = await prisma.course.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        course = await prisma.course.create({ data });
        result.created++;
      }

      await linkSkills(course.id, input.skills, opts.useAIForSkills ?? false);
      result.courses.push({ id: course.id, title: course.title, approved: course.approved, status: course.status });
    } catch (err) {
      result.errors.push({ title: input.title, error: (err as Error).message });
      result.skipped++;
    }
  }

  return result;
}
