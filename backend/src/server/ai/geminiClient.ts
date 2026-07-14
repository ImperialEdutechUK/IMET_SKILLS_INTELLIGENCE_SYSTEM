/**
 * Gemini service abstraction.
 *
 * Talks to the Google Generative Language REST API directly with `fetch` so we
 * carry no SDK dependency. Everything is gated behind `isConfigured()` — when
 * no `GEMINI_API_KEY` is present the whole engine degrades gracefully to its
 * deterministic behaviour instead of throwing.
 *
 * Env:
 *   GEMINI_API_KEY        required to enable AI features
 *   GEMINI_MODEL          default "gemini-2.5-flash"
 *   GEMINI_MODEL_LITE     default "gemini-2.5-flash-lite"
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiTier = "flash" | "lite";

function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || undefined;
}

export function isConfigured(): boolean {
  return !!apiKey();
}

function modelFor(tier: GeminiTier): string {
  if (tier === "lite") return process.env.GEMINI_MODEL_LITE?.trim() || "gemini-2.5-flash-lite";
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export interface GenerateOptions {
  tier?: GeminiTier;
  /** Ask the model to return strict JSON (application/json response mime). */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  signal?: AbortSignal;
}

export class GeminiError extends Error {}

/**
 * Low-level text generation. Returns the raw model text (JSON string when
 * `json: true`). Throws `GeminiError` on transport / API failure so callers can
 * decide whether to fall back.
 */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const key = apiKey();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured.");

  const model = modelFor(opts.tier ?? "flash");
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new GeminiError(`Gemini request failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    const finish = data.candidates?.[0]?.finishReason;
    throw new GeminiError(`Gemini returned no text${finish ? ` (finishReason: ${finish})` : ""}.`);
  }
  return text;
}

/**
 * Generate and parse JSON. Strips markdown code fences the model sometimes adds
 * even when asked for raw JSON. Returns the parsed value (unvalidated — the
 * caller applies its Zod schema).
 */
export async function generateJson<T = unknown>(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<T> {
  const raw = await generate(prompt, { ...opts, json: true });
  return JSON.parse(stripJsonFences(raw)) as T;
}

export function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  // If the model wrapped prose around the JSON, grab the outermost object/array.
  const firstObj = t.indexOf("{");
  const firstArr = t.indexOf("[");
  const start =
    firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
  if (start > 0) t = t.slice(start);
  return t;
}

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
}
