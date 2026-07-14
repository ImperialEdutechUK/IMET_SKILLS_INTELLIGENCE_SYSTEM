/**
 * Provider-agnostic AI client.
 *
 * One place to choose the LLM for the whole recommendation engine — document
 * analysis (skill extraction), skill normalisation, and the recommendation
 * chat's reasoning all go through here. The default provider is **OpenRouter**
 * (one key, any model — DeepSeek, Anthropic, OpenAI, Google…); DeepSeek-direct,
 * Anthropic-direct and Gemini remain available behind `AI_PROVIDER` with no code
 * change.
 *
 * Everything stays gated behind `isConfigured()` — with no key set the whole
 * engine degrades gracefully to its deterministic behaviour instead of throwing.
 *
 * Env:
 *   AI_PROVIDER          deepseek | anthropic | gemini | openrouter
 *                        (default: auto-detect by whichever key is set)
 *   DEEPSEEK_API_KEY     enables DeepSeek direct
 *   DEEPSEEK_MODEL       default "deepseek-chat"          (there is no public
 *                        "deepseek-v4-pro" id yet; `deepseek-chat` tracks the
 *                        latest DeepSeek V3.x chat model, `deepseek-reasoner` the
 *                        reasoning model — set whichever you have access to)
 *   DEEPSEEK_BASE_URL    default "https://api.deepseek.com"
 *   ANTHROPIC_API_KEY    enables Anthropic direct
 *   ANTHROPIC_MODEL      default "claude-sonnet-5"
 *   OPENROUTER_API_KEY   enables OpenRouter (one key, many models/providers)
 *   OPENROUTER_MODEL     default "deepseek/deepseek-chat" — any OpenRouter
 *                        model id, e.g. "anthropic/claude-sonnet-4.5",
 *                        "openai/gpt-5", "google/gemini-2.5-flash"
 *   OPENROUTER_BASE_URL  default "https://openrouter.ai/api/v1"
 *   GEMINI_API_KEY / GEMINI_MODEL / GEMINI_MODEL_LITE   (see geminiClient.ts)
 */
import {
  generate as geminiGenerate,
  isConfigured as geminiConfigured,
  stripJsonFences,
} from "./geminiClient";

export { stripJsonFences };

export type AIProvider = "deepseek" | "anthropic" | "gemini" | "openrouter";

/** Generic tier hint. Providers that expose a cheaper model map "lite" onto it. */
export type AITier = "standard" | "lite";

export interface AIGenerateOptions {
  /** Ask the model to return strict JSON (used to set response_format on DeepSeek). */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  tier?: AITier;
  signal?: AbortSignal;
}

export class AIError extends Error {}

function deepseekKey() {
  return process.env.DEEPSEEK_API_KEY?.trim() || undefined;
}
function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}
function openrouterKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/** Resolve the active provider: explicit AI_PROVIDER wins, else first configured key. */
export function activeProvider(): AIProvider | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "deepseek") return deepseekKey() ? "deepseek" : null;
  if (explicit === "anthropic") return anthropicKey() ? "anthropic" : null;
  if (explicit === "gemini") return geminiConfigured() ? "gemini" : null;
  if (explicit === "openrouter") return openrouterKey() ? "openrouter" : null;

  // Auto-detect (order = preference): OpenRouter is the default, then the
  // direct providers, then Gemini.
  if (openrouterKey()) return "openrouter";
  if (deepseekKey()) return "deepseek";
  if (anthropicKey()) return "anthropic";
  if (geminiConfigured()) return "gemini";
  return null;
}

export function isConfigured(): boolean {
  return activeProvider() !== null;
}

const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Low-level text generation across providers. Returns raw model text (a JSON
 * string when `json: true`). Throws `AIError` on transport / API failure so
 * callers can decide whether to fall back.
 */
export async function generate(prompt: string, opts: AIGenerateOptions = {}): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new AIError(
      "No AI provider configured (set DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY)."
    );
  }

  switch (provider) {
    case "deepseek":
      return generateDeepSeek(prompt, opts);
    case "anthropic":
      return generateAnthropic(prompt, opts);
    case "openrouter":
      return generateOpenRouter(prompt, opts);
    case "gemini":
      // Delegate to the existing Gemini abstraction; map the generic tier.
      return geminiGenerate(prompt, {
        json: opts.json,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        systemInstruction: opts.systemInstruction,
        signal: opts.signal,
        tier: opts.tier === "lite" ? "lite" : "flash",
      });
  }
}

/** Generate and parse JSON. Strips markdown fences; caller applies its own Zod schema. */
export async function generateJson<T = unknown>(
  prompt: string,
  opts: AIGenerateOptions = {}
): Promise<T> {
  const raw = await generate(prompt, { ...opts, json: true });
  return JSON.parse(stripJsonFences(raw)) as T;
}

// ── DeepSeek (OpenAI-compatible /chat/completions) ────────────────────────────

async function generateDeepSeek(prompt: string, opts: AIGenerateOptions): Promise<string> {
  const key = deepseekKey()!;
  const base = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemInstruction) messages.push({ role: "system", content: opts.systemInstruction });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxOutputTokens ?? 4096,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const data = await postJson(`${base.replace(/\/$/, "")}/chat/completions`, body, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  }, opts.signal, "DeepSeek");

  const text = (data as DeepSeekResponse).choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIError("DeepSeek returned no text.");
  return text;
}

// ── OpenRouter (OpenAI-compatible /chat/completions, many models behind one key) ──

async function generateOpenRouter(prompt: string, opts: AIGenerateOptions): Promise<string> {
  const key = openrouterKey()!;
  const base = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  const model = process.env.OPENROUTER_MODEL?.trim() || "deepseek/deepseek-chat";

  const messages: Array<{ role: string; content: string }> = [];
  if (opts.systemInstruction) messages.push({ role: "system", content: opts.systemInstruction });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxOutputTokens ?? 4096,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const data = await postJson(`${base.replace(/\/$/, "")}/chat/completions`, body, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    // Optional but recommended by OpenRouter for attribution/rankings — harmless if absent upstream.
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim() || "http://localhost:3001",
    "X-Title": "iMET Skills Intelligence",
  }, opts.signal, "OpenRouter");

  const text = (data as DeepSeekResponse).choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIError("OpenRouter returned no text.");
  return text;
}

// ── Anthropic (Messages API) ──────────────────────────────────────────────────

async function generateAnthropic(prompt: string, opts: AIGenerateOptions): Promise<string> {
  const key = anthropicKey()!;
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";

  // Note: Sonnet 5 rejects non-default sampling params, so temperature is not
  // sent. Thinking is disabled to keep this a cheap, deterministic extraction
  // call. JSON is requested via the prompt (no response_format on this API).
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxOutputTokens ?? 4096,
    messages: [{ role: "user", content: prompt }],
    thinking: { type: "disabled" },
    ...(opts.systemInstruction ? { system: opts.systemInstruction } : {}),
  };

  const data = await postJson("https://api.anthropic.com/v1/messages", body, {
    "Content-Type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  }, opts.signal, "Anthropic");

  const parts = (data as AnthropicResponse).content ?? [];
  const text = parts.map((p) => (p.type === "text" ? p.text ?? "" : "")).join("").trim();
  if (!text) throw new AIError("Anthropic returned no text.");
  return text;
}

// ── Shared HTTP ───────────────────────────────────────────────────────────────

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  label: string
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    throw new AIError(`${label} request failed: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AIError(`${label} API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}
interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
}
