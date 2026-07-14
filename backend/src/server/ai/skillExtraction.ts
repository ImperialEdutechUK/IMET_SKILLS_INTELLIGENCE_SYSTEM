/**
 * Skill extraction: text → validated JSON.
 *
 * Flow (per the spec):
 *   1. Ask Gemini for strict JSON.
 *   2. Validate with Zod.
 *   3. If invalid, retry ONCE with a repair prompt.
 *   4. If still invalid (or AI unavailable), report failure so the caller can
 *      mark the document NEEDS_REVIEW.
 */
import { z } from "zod";
import { generate, isConfigured, stripJsonFences, AIError } from "./aiClient";
import {
  employeeExtractionPrompt,
  roleExtractionPrompt,
  recommendationExplanationPrompt,
  repairPrompt,
} from "./prompts";
import {
  employeeExtractionSchema,
  roleExtractionSchema,
  type EmployeeExtraction,
  type RoleExtraction,
} from "@/server/validation/schemas";

export type ExtractionOutcome<T> =
  | { ok: true; data: T; usedRepair: boolean }
  | { ok: false; reason: string; needsReview: true };

async function extractWithRepair<S extends z.ZodTypeAny>(
  prompt: string,
  schema: S
): Promise<ExtractionOutcome<z.output<S>>> {
  if (!isConfigured()) {
    return { ok: false, reason: "AI extraction unavailable (GEMINI_API_KEY not set).", needsReview: true };
  }

  let firstRaw = "";
  try {
    firstRaw = await generate(prompt, { json: true, temperature: 0.1 });
    const parsed = schema.safeParse(JSON.parse(stripJsonFences(firstRaw)));
    if (parsed.success) return { ok: true, data: parsed.data, usedRepair: false };

    // One repair attempt.
    const errText = JSON.stringify(parsed.error.flatten());
    const repaired = await generate(repairPrompt(prompt, firstRaw, errText), {
      json: true,
      temperature: 0,
    });
    const reparsed = schema.safeParse(JSON.parse(stripJsonFences(repaired)));
    if (reparsed.success) return { ok: true, data: reparsed.data, usedRepair: true };

    return {
      ok: false,
      reason: `AI output failed validation after repair: ${JSON.stringify(reparsed.error.flatten())}`,
      needsReview: true,
    };
  } catch (err) {
    const kind = err instanceof AIError ? "AI request error" : "Malformed AI output";
    return { ok: false, reason: `${kind}: ${(err as Error).message}`, needsReview: true };
  }
}

export function extractEmployeeSkills(
  sourceType: string,
  text: string
): Promise<ExtractionOutcome<EmployeeExtraction>> {
  return extractWithRepair(employeeExtractionPrompt(sourceType, text), employeeExtractionSchema);
}

export function extractRoleRequirements(
  sourceType: string,
  text: string
): Promise<ExtractionOutcome<RoleExtraction>> {
  return extractWithRepair(roleExtractionPrompt(sourceType, text), roleExtractionSchema);
}

// ── Recommendation explanations (best-effort; never blocks the pipeline) ──────

const explanationsSchema = z.object({
  explanations: z.array(z.object({ courseId: z.string(), reason: z.string().min(1) })).default([]),
});

/**
 * Ask Gemini to phrase manager-friendly reasons using ONLY the supplied facts.
 * Returns a courseId → reason map, or `null` when AI is unavailable/failed so
 * the caller falls back to deterministic reason text.
 */
export async function explainRecommendations(
  payload: unknown
): Promise<Record<string, string> | null> {
  if (!isConfigured()) return null;
  try {
    const raw = await generate(recommendationExplanationPrompt(payload), {
      json: true,
      temperature: 0.3,
      tier: "lite",
    });
    const parsed = explanationsSchema.safeParse(JSON.parse(stripJsonFences(raw)));
    if (!parsed.success) return null;
    return Object.fromEntries(parsed.data.explanations.map((e) => [e.courseId, e.reason]));
  } catch {
    return null;
  }
}
