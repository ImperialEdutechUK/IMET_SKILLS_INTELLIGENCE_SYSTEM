/**
 * Coerce loosely-shaped rows (from a CSV/Excel/JSON course upload) into
 * ExternalCourse items, tolerating a variety of column names.
 */
import type { ExternalCourse } from "./types";
import { parseHours, parseCostType } from "./apify";

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const k of keys) {
    const v = lower.get(k.toLowerCase());
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function toSkills(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function coerceExternalCourse(row: Record<string, unknown>): ExternalCourse | null {
  const title = toStr(pick(row, ["title", "name", "course", "courseTitle", "course_name"]));
  if (!title) return null;

  const durationRaw = pick(row, ["durationHours", "duration", "hours", "length"]);
  return {
    title,
    provider: toStr(pick(row, ["provider", "platform", "source"])),
    url: toStr(pick(row, ["url", "link", "externalUrl", "courseUrl", "course_url"])),
    description: toStr(pick(row, ["description", "summary", "about", "overview"])),
    skills: toSkills(pick(row, ["skills", "tags", "topics"])),
    level: toStr(pick(row, ["level", "difficulty"])),
    durationHours: parseHours(durationRaw as string | number | undefined),
    costType: parseCostType(pick(row, ["costType", "cost", "price"]) as string | number | undefined),
    language: toStr(pick(row, ["language", "lang"])),
    externalId: toStr(pick(row, ["externalId", "id", "courseId", "course_id"])),
    rating: Number(pick(row, ["rating"])) || undefined,
    cpdHours: Number(pick(row, ["cpdHours", "cpd"])) || undefined,
  };
}

export function coerceRows(rows: Record<string, unknown>[]): ExternalCourse[] {
  return rows.map(coerceExternalCourse).filter((c): c is ExternalCourse => c !== null);
}
