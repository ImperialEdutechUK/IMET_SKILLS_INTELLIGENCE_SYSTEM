/**
 * Skill normalisation — merges messy skill names onto a single canonical Skill.
 *
 * Strategy (cheapest first, AI last):
 *   1. exact match on Skill.name (case-insensitive)
 *   2. lowercase / trim / de-plural cleanup, re-checked against name + aliases
 *   3. alias table (built-in seed map + learned SkillAlias rows)
 *   4. optional AI-assisted normalisation, only for still-unknown names
 *
 * Every resolution is memoised into SkillAlias so the same messy name is free
 * next time.
 */
import type { Skill } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isConfigured, generate, stripJsonFences } from "@/server/ai/aiClient";
import { normalizeSkillPrompt } from "@/server/ai/prompts";
import { skillNormalizationSchema } from "@/server/validation/schemas";

/**
 * Built-in aliases (from the spec). Keys are cleaned lowercase forms; values are
 * the canonical Skill name. Extendable, but the SkillAlias table is the durable
 * store learned at runtime.
 */
const BUILTIN_ALIASES: Record<string, string> = {
  // Google Analytics
  "ga4": "Google Analytics",
  "google analytics 4": "Google Analytics",
  "google analytic": "Google Analytics",
  "website analytic": "Google Analytics",
  "web analytic": "Google Analytics",
  "site analytic": "Google Analytics",
  // AI Marketing
  "chatgpt for marketing": "AI Marketing",
  "ai content generation": "AI Marketing",
  "generative ai marketing": "AI Marketing",
  "genai marketing": "AI Marketing",
  "ai marketing tool": "AI Marketing",
  // Campaign Reporting
  "campaign report": "Campaign Reporting",
  "marketing report": "Campaign Reporting",
  "weekly performance report": "Campaign Reporting",
  "performance report": "Campaign Reporting",
  "campaign reporting": "Campaign Reporting",
  // A few generic ones
  "ms excel": "Excel",
  "microsoft excel": "Excel",
  "spreadsheet": "Excel",
  "structured query language": "SQL",
  "py": "Python",
};

/** Trim, collapse whitespace, strip trailing punctuation, de-pluralise simply. */
export function cleanKey(raw: string): string {
  let s = raw.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
  // naive singularisation: reports → report, analytics stays analytics
  s = s.replace(/\breports\b/g, "report").replace(/\bskills\b/g, "skill");
  if (s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("analytics") && !s.endsWith("us")) {
    // only strip a plural 's' from the final token when it is long enough
    const parts = s.split(" ");
    const last = parts[parts.length - 1];
    if (last.length > 3 && last.endsWith("s")) {
      parts[parts.length - 1] = last.slice(0, -1);
      s = parts.join(" ");
    }
  }
  return s;
}

export function titleCase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

async function findSkillByName(name: string): Promise<Skill | null> {
  return prisma.skill.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
}

async function findOrCreateSkill(canonicalName: string): Promise<Skill> {
  const existing = await findSkillByName(canonicalName);
  if (existing) return existing;
  // Race-safe create (name is @unique).
  try {
    return await prisma.skill.create({ data: { name: canonicalName } });
  } catch {
    const again = await findSkillByName(canonicalName);
    if (again) return again;
    throw new Error(`Could not create skill "${canonicalName}"`);
  }
}

async function rememberAlias(alias: string, skillId: string): Promise<void> {
  if (!alias) return;
  await prisma.skillAlias.upsert({
    where: { alias },
    update: { skillId },
    create: { alias, skillId },
  });
}

export interface ResolveOptions {
  /** Allow the AI fallback for unknown skills (default: follow GEMINI config). */
  useAI?: boolean;
  /** Create a new Skill when nothing matches (default true). */
  createIfMissing?: boolean;
}

export interface Resolution {
  skill: Skill;
  method: "exact" | "alias" | "builtin" | "ai" | "created";
}

/**
 * Resolve a single raw skill name to a canonical Skill row, learning the alias.
 * Returns null only when `createIfMissing` is false and nothing matched.
 */
export async function resolveSkill(
  raw: string,
  opts: ResolveOptions = {}
): Promise<Resolution | null> {
  const createIfMissing = opts.createIfMissing ?? true;
  const useAI = opts.useAI ?? isConfigured();
  const key = cleanKey(raw);
  if (!key) return null;

  // 1. exact match on the original name
  const exact = await findSkillByName(raw.trim());
  if (exact) return { skill: exact, method: "exact" };

  // 2/3. learned alias table
  const aliasRow = await prisma.skillAlias.findUnique({ where: { alias: key }, include: { skill: true } });
  if (aliasRow) return { skill: aliasRow.skill, method: "alias" };

  // cleaned-name exact match
  const cleanedMatch = await findSkillByName(titleCase(key));
  if (cleanedMatch) {
    await rememberAlias(key, cleanedMatch.id);
    return { skill: cleanedMatch, method: "exact" };
  }

  // 3. built-in alias map
  if (BUILTIN_ALIASES[key]) {
    const skill = await findOrCreateSkill(BUILTIN_ALIASES[key]);
    await rememberAlias(key, skill.id);
    return { skill, method: "builtin" };
  }

  // 4. AI-assisted normalisation for the truly unknown
  if (useAI) {
    const aiResolved = await aiNormalize(key);
    if (aiResolved) {
      const skill = await findOrCreateSkill(aiResolved);
      await rememberAlias(key, skill.id);
      return { skill, method: "ai" };
    }
  }

  if (!createIfMissing) return null;

  const created = await findOrCreateSkill(titleCase(key));
  await rememberAlias(key, created.id);
  return { skill: created, method: "created" };
}

async function aiNormalize(cleaned: string): Promise<string | null> {
  try {
    const known = (await prisma.skill.findMany({ select: { name: true }, take: 200 })).map((s) => s.name);
    const raw = await generate(normalizeSkillPrompt(cleaned, known), { json: true, tier: "lite", temperature: 0 });
    const parsed = skillNormalizationSchema.safeParse(JSON.parse(stripJsonFences(raw)));
    return parsed.success ? parsed.data.canonical.trim() : null;
  } catch {
    return null;
  }
}

/** Resolve many names at once, de-duplicating by cleaned key. */
export async function resolveSkills(
  rawNames: string[],
  opts: ResolveOptions = {}
): Promise<Map<string, Resolution>> {
  const out = new Map<string, Resolution>();
  const seen = new Map<string, string>(); // cleanKey → original
  for (const raw of rawNames) {
    const key = cleanKey(raw);
    if (!key || seen.has(key)) continue;
    seen.set(key, raw);
    const res = await resolveSkill(raw, opts);
    if (res) out.set(raw, res);
  }
  return out;
}
