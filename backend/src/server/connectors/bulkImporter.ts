/**
 * Bulk catalogue importer — for whole-catalogue syncs (tens of thousands of
 * courses), where the per-course path in `importer.ts` is too chatty.
 *
 * `importCourses` issues roughly five sequential queries per course plus a
 * `resolveSkill` round-trip per skill. Across the full ~22.7k-course Coursera
 * catalogue that is on the order of half a million queries against a remote
 * Postgres. This path instead:
 *
 *   1. resolves every distinct category once           (~11 rows)
 *   2. resolves every distinct skill name once, in memory  (~45, or a few
 *      thousand once page-scraped skills are included)
 *   3. writes courses in chunks with bounded concurrency
 *   4. links skills with a single `createMany({ skipDuplicates })` per chunk
 *
 * Identity is `(externalSource, externalId)`, then `externalUrl` so a course
 * already stored by another connector is adopted rather than duplicated.
 * Unlike `importCourses` it never falls back to matching on `title`: two
 * unrelated courses can share a title, and silently overwriting one with the
 * other loses data.
 */
import { prisma } from "@/lib/db";
import { resolveSkill, cleanKey } from "@/server/skills/normalize";
import { chunk, mapLimit } from "./net";
import type { CourseCatalogueInput } from "./types";

export interface BulkImportOptions {
  approveAll?: boolean;
  publish?: boolean;
  /** Allow the AI fallback for unrecognised skill names (default false). */
  useAIForSkills?: boolean;
  /** Courses written per chunk (default 500). */
  chunkSize?: number;
  /** Concurrent writes within a chunk (default 16). */
  concurrency?: number;
  /** Report progress without writing anything. */
  dryRun?: boolean;
  onProgress?: (written: number, total: number) => void;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  skipped: number;
  skillsLinked: number;
  distinctSkills: number;
  distinctCategories: number;
  errors: { title: string; error: string }[];
}

/**
 * Which columns did a P2002 fire on?
 *
 * Prisma reports this differently depending on the engine. The classic query
 * engine sets `meta.target`; the pg driver adapter (what `lib/db.ts` uses)
 * instead nests the constraint under `meta.driverAdapterError`. Read both, and
 * fall back to the constraint name in the message ("Course_title_key").
 */
function uniqueViolationFields(err: unknown): string[] | null {
  const e = err as {
    code?: string;
    message?: string;
    meta?: {
      target?: unknown;
      driverAdapterError?: { cause?: { constraint?: { fields?: unknown }; originalMessage?: string } };
    };
  };
  if (e?.code !== "P2002") return null;

  const adapterFields = e.meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && adapterFields.length > 0) return adapterFields.map(String);

  const target = e.meta?.target;
  if (Array.isArray(target) && target.length > 0) return target.map(String);
  if (typeof target === "string" && target) return [target];

  // Last resort: the constraint name appears in the raw driver message.
  return [e.meta?.driverAdapterError?.cause?.originalMessage ?? e.message ?? ""];
}

const isUniqueViolation = (err: unknown, field: string): boolean =>
  uniqueViolationFields(err)?.some((f) => f.toLowerCase().includes(field)) ?? false;

/** Upsert every distinct category once; returns name → id. */
async function resolveCategories(inputs: CourseCatalogueInput[]): Promise<Map<string, string>> {
  const names = [...new Set(inputs.map((i) => i.category?.trim()).filter((n): n is string => !!n))];
  const map = new Map<string, string>();
  for (const name of names) {
    const cat = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    map.set(name, cat.id);
  }
  return map;
}

/**
 * Resolve every distinct skill name to a canonical Skill id, hitting the
 * database once for the existing skills/aliases and only calling `resolveSkill`
 * for names that are genuinely new.
 */
async function resolveSkillIds(
  inputs: CourseCatalogueInput[],
  useAI: boolean
): Promise<Map<string, string>> {
  const distinct = new Map<string, string>(); // cleanKey → original name
  for (const input of inputs) {
    for (const raw of input.skills) {
      const key = cleanKey(raw);
      if (key && !distinct.has(key)) distinct.set(key, raw);
    }
  }

  const [skills, aliases] = await Promise.all([
    prisma.skill.findMany({ select: { id: true, name: true } }),
    prisma.skillAlias.findMany({ select: { alias: true, skillId: true } }),
  ]);

  const byName = new Map(skills.map((s) => [cleanKey(s.name), s.id]));
  const byAlias = new Map(aliases.map((a) => [a.alias, a.skillId]));

  const resolved = new Map<string, string>(); // cleanKey → skillId
  for (const [key, original] of distinct) {
    const hit = byName.get(key) ?? byAlias.get(key);
    if (hit) {
      resolved.set(key, hit);
      continue;
    }
    // Genuinely unknown: let the normaliser create it and learn the alias.
    const res = await resolveSkill(original, { useAI });
    if (res) {
      resolved.set(key, res.skill.id);
      byName.set(cleanKey(res.skill.name), res.skill.id);
    }
  }
  return resolved;
}

/** Build the Course column payload for one input. */
function toCourseData(input: CourseCatalogueInput, categoryId: string | undefined, opts: BulkImportOptions) {
  return {
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
    approved: opts.approveAll ? true : input.approved,
    preferredProvider: input.preferredProvider,
    availableToOrg: input.availableToOrg,
    categoryId: categoryId ?? null,
    status: (opts.publish ? "published" : "draft") as "draft" | "published",
  };
}

/**
 * `Course.title` is globally unique, but ~0.2% of Coursera titles repeat (and
 * may collide with existing rows). Disambiguate rather than drop the course.
 */
function disambiguate(title: string, attempt: number, input: CourseCatalogueInput): string {
  if (attempt === 1 && input.provider) return `${title} (${input.provider})`;
  return `${title} (${input.externalSource}:${input.externalId})`;
}

/**
 * Offset pagination over a catalogue that is being edited underneath us can
 * hand back the same course twice. Two creates for one external id would then
 * collide on @@unique([externalSource, externalId]); keep the last one seen.
 */
function dedupeByExternalIdentity(inputs: CourseCatalogueInput[]): CourseCatalogueInput[] {
  const byIdentity = new Map<string, CourseCatalogueInput>();
  const withoutId: CourseCatalogueInput[] = [];
  for (const input of inputs) {
    if (!input.externalId) withoutId.push(input);
    else byIdentity.set(`${input.externalSource} ${input.externalId}`, input);
  }
  return [...byIdentity.values(), ...withoutId];
}

export async function importCoursesBulk(
  rawInputs: CourseCatalogueInput[],
  opts: BulkImportOptions = {}
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    skillsLinked: 0,
    distinctSkills: 0,
    distinctCategories: 0,
    errors: [],
  };
  if (rawInputs.length === 0) return result;
  const inputs = dedupeByExternalIdentity(rawInputs);

  if (opts.dryRun) {
    const skills = new Set(inputs.flatMap((i) => i.skills.map(cleanKey).filter(Boolean)));
    const cats = new Set(inputs.map((i) => i.category).filter(Boolean));
    result.distinctSkills = skills.size;
    result.distinctCategories = cats.size;
    result.created = inputs.length; // "would create or update"
    return result;
  }

  const categories = await resolveCategories(inputs);
  const skillIds = await resolveSkillIds(inputs, opts.useAIForSkills ?? false);
  result.distinctCategories = categories.size;
  result.distinctSkills = skillIds.size;

  const chunkSize = opts.chunkSize ?? 500;
  const concurrency = opts.concurrency ?? 16;
  let written = 0;

  for (const batch of chunk(inputs, chunkSize)) {
    // One lookup for the whole chunk: which of these already exist?
    const bySource = new Map<string, string[]>();
    for (const i of batch) {
      if (!i.externalId) continue;
      const list = bySource.get(i.externalSource) ?? [];
      list.push(i.externalId);
      bySource.set(i.externalSource, list);
    }

    const existingRows = await Promise.all(
      [...bySource].map(([externalSource, ids]) =>
        prisma.course.findMany({
          where: { externalSource, externalId: { in: ids } },
          select: { id: true, externalSource: true, externalId: true },
        })
      )
    );
    const existing = new Map(
      existingRows.flat().map((r) => [`${r.externalSource}\u0000${r.externalId}`, r.id])
    );

    // The same course may already exist under a *different* connector: the old
    // Apify crawl stored Coursera courses keyed by their URL. Same URL means
    // same course, so adopt that row and upgrade it in place rather than create
    // a near-duplicate that differs only by a disambiguated title.
    const urls = batch.map((i) => i.externalUrl).filter((u): u is string => !!u);
    const byUrl = new Map(
      (
        await prisma.course.findMany({
          where: { externalUrl: { in: urls } },
          select: { id: true, externalUrl: true },
        })
      ).map((r) => [r.externalUrl as string, r.id])
    );

    const links: { courseId: string; skillId: string }[] = [];

    await mapLimit(batch, concurrency, 0, async (input) => {
      const categoryId = input.category ? categories.get(input.category.trim()) : undefined;
      const data = toCourseData(input, categoryId, opts);
      const key = input.externalId ? `${input.externalSource}\u0000${input.externalId}` : undefined;
      const priorId =
        (key ? existing.get(key) : undefined) ?? (input.externalUrl ? byUrl.get(input.externalUrl) : undefined);

      let courseId: string | undefined;
      for (let attempt = 0; attempt <= 2 && !courseId; attempt++) {
        const title = attempt === 0 ? data.title : disambiguate(data.title, attempt, input);
        try {
          if (priorId) {
            const row = await prisma.course.update({ where: { id: priorId }, data: { ...data, title } });
            courseId = row.id;
            result.updated++;
          } else {
            const row = await prisma.course.create({ data: { ...data, title } });
            courseId = row.id;
            result.created++;
          }
        } catch (err) {
          if (isUniqueViolation(err, "title") && attempt < 2) continue; // retry disambiguated
          result.errors.push({ title: data.title, error: (err as Error).message });
          result.skipped++;
          return;
        }
      }

      if (!courseId) return;
      // Two raw names can normalise onto the same Skill; keep one link each.
      const seen = new Set<string>();
      for (const raw of input.skills) {
        const skillId = skillIds.get(cleanKey(raw));
        if (!skillId || seen.has(skillId)) continue;
        seen.add(skillId);
        links.push({ courseId, skillId });
      }
    });

    // @@unique([courseId, skillId]) makes this safely re-runnable.
    for (const linkBatch of chunk(links, 5_000)) {
      const linked = await prisma.courseSkill.createMany({ data: linkBatch, skipDuplicates: true });
      result.skillsLinked += linked.count;
    }

    written += batch.length;
    opts.onProgress?.(written, inputs.length);
  }

  return result;
}
