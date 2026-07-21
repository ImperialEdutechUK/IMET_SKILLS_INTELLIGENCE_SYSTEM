/**
 * Gemini prompt templates. Each function returns a fully-formed prompt string.
 * Every extraction prompt demands STRICT JSON — no prose, no markdown — because
 * the output is validated with Zod and retried once with a repair prompt.
 */

const LEVELS_DOC = `Skill levels MUST be one of exactly: "None", "Basic", "Intermediate", "Advanced", "Expert".`;

/** Employee-side extraction: daily reports, CPD, evaluations, skill matrices. */
export function employeeExtractionPrompt(sourceType: string, text: string): string {
  return `You are a skills-intelligence analyst for a Learning & Development platform.
From the ${sourceType} below, extract the skills the employee demonstrably USED or was assessed on.

${LEVELS_DOC}
Estimate each skill's level from the concrete evidence in the text, not from job titles.
Only include skills with real supporting evidence. Do not invent skills.
IMPORTANT: include skills the document assesses at a LOW level ("None" or "Basic") too —
capturing what the employee is LACKING matters as much as their strengths, because weak
skills drive their learning recommendations. Never skip a skill because its level is low.
When the document explicitly states a target / expected / required level for a skill
(e.g. a "Target Level" column in a skill matrix), return it as "targetLevel"; otherwise
set "targetLevel" to null. Never guess a target.

Return STRICT JSON ONLY matching this shape (no markdown, no commentary):
{
  "employeeName": string | null,
  "sourceType": ${JSON.stringify(sourceType)},
  "detectedSkills": [
    {
      "skill": string,                // concise skill name, e.g. "Google Analytics"
      "estimatedLevel": "None|Basic|Intermediate|Advanced|Expert",
      "targetLevel": "None|Basic|Intermediate|Advanced|Expert" | null,
      "evidence": string,             // one short sentence quoting/paraphrasing the source
      "confidence": number            // 0.0–1.0
    }
  ]
}

---- ${sourceType.toUpperCase()} START ----
${clip(text)}
---- ${sourceType.toUpperCase()} END ----`;
}

/** Role-side extraction: role requirements and job descriptions. */
export function roleExtractionPrompt(sourceType: string, text: string): string {
  return `You are a skills-intelligence analyst. From the ${sourceType} below, extract the
skills REQUIRED to perform the role and the minimum level required for each.

${LEVELS_DOC}
Importance MUST be one of: "LOW", "MEDIUM", "HIGH", "CRITICAL".

Return STRICT JSON ONLY matching this shape (no markdown, no commentary):
{
  "roleTitle": string,
  "requiredSkills": [
    {
      "skill": string,
      "requiredLevel": "None|Basic|Intermediate|Advanced|Expert",
      "importance": "LOW|MEDIUM|HIGH|CRITICAL",
      "reason": string      // one short sentence on why the role needs it
    }
  ]
}

---- ${sourceType.toUpperCase()} START ----
${clip(text)}
---- ${sourceType.toUpperCase()} END ----`;
}

/** Repair prompt: re-ask for valid JSON after a validation failure. */
export function repairPrompt(originalPrompt: string, badOutput: string, zodError: string): string {
  return `Your previous response was NOT valid according to the required JSON schema.

Validation errors:
${zodError}

Your previous (invalid) response:
${clip(badOutput, 4000)}

Re-read the ORIGINAL task and return STRICT, VALID JSON ONLY that satisfies the schema.
Do not include markdown fences or any commentary.

ORIGINAL TASK:
${originalPrompt}`;
}

/**
 * Skill normalisation fallback — only invoked for skills the alias table and
 * heuristics could not resolve.
 */
export function normalizeSkillPrompt(unknownSkill: string, knownSkills: string[]): string {
  return `You normalise messy skill names to a single canonical name.

Candidate canonical skills already in our catalogue:
${knownSkills.map((s) => `- ${s}`).join("\n") || "(none yet)"}

Skill to normalise: "${unknownSkill}"

If it clearly refers to one of the candidates above, return that exact candidate.
Otherwise return a clean, title-cased canonical name for it.

Return STRICT JSON ONLY: { "canonical": string, "isNew": boolean }`;
}

/**
 * Manager-friendly recommendation explanation. The model may ONLY use the facts
 * provided — it must not invent course details, prices, providers, or skills.
 */
export function recommendationExplanationPrompt(payload: unknown): string {
  return `You are writing short, manager-friendly explanations for course recommendations.

STRICT RULES:
- Use ONLY the facts in the JSON below. Never invent course names, providers,
  durations, prices, skills, or levels.
- Each explanation is 1–2 sentences, plain professional English.
- Explicitly reference which of the employee's skill GAPS the course addresses.
- Do not mention scores, algorithms, or JSON.

FACTS:
${JSON.stringify(payload, null, 2)}

Return STRICT JSON ONLY of this shape (one entry per input course, same courseId):
{ "explanations": [ { "courseId": string, "reason": string } ] }`;
}

function clip(text: string, max = 12_000): string {
  const t = text ?? "";
  return t.length > max ? t.slice(0, max) + "\n…[truncated]" : t;
}
