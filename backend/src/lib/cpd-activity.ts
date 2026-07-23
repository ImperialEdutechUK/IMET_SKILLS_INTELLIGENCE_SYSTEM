// CPD activities carry more detail than the CpdRecord columns hold (title, type,
// provider, category, completion date, learning-impact answers). To avoid a schema
// migration, that structured metadata is stored as JSON in CpdRecord.description.
// These helpers pack/parse it, tolerating plain-text descriptions from older rows.

export const CPD_TYPES = [
  "Learning",
  "Webinar",
  "Conference",
  "Reading",
  "Coaching",
  "Other",
] as const;
export type CpdType = (typeof CPD_TYPES)[number];

export const CPD_CATEGORIES = [
  "Technical Skills",
  "Professional Skills",
  "Leadership",
  "Other",
] as const;
export type CpdCategory = (typeof CPD_CATEGORIES)[number];

export interface CpdActivityMeta {
  title: string;
  type: CpdType;
  provider?: string | null;
  category: CpdCategory;
  dateCompleted?: string | null; // ISO date (yyyy-mm-dd)
  note?: string | null; // free-text description
  impact?: Record<string, string> | null; // learning-impact answers
}

const MARKER = "__cpd__";

export function packCpd(meta: CpdActivityMeta): string {
  return JSON.stringify({ [MARKER]: 1, ...meta });
}

export function parseCpd(
  description: string | null | undefined,
  fallbackTitle: string,
  fallbackType: CpdType = "Other"
): CpdActivityMeta {
  if (description) {
    try {
      const obj = JSON.parse(description);
      if (obj && obj[MARKER]) {
        return {
          title: obj.title ?? fallbackTitle,
          type: (CPD_TYPES as readonly string[]).includes(obj.type) ? obj.type : fallbackType,
          provider: obj.provider ?? null,
          category: (CPD_CATEGORIES as readonly string[]).includes(obj.category) ? obj.category : "Other",
          dateCompleted: obj.dateCompleted ?? null,
          note: obj.note ?? null,
          impact: obj.impact ?? null,
        };
      }
    } catch {
      // not JSON — treat the whole thing as a plain-text title/note below
    }
  }
  return {
    title: description || fallbackTitle,
    type: fallbackType,
    provider: null,
    category: "Other",
    dateCompleted: null,
    note: description || null,
    impact: null,
  };
}
