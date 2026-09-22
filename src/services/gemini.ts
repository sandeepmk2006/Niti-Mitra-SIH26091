/**
 * @fileoverview Minimal Gemini Developer API client (REST, no SDK).
 *
 * The key comes from EXPO_PUBLIC_GEMINI_API_KEY in `.env`, which Expo inlines into the bundle at
 * build time. That keeps it out of source control, but it is still extractable from the app —
 * production should proxy these calls through a backend (e.g. a Cloud Function) instead.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

/** Fast model for conversational replies. */
export const GEMINI_CHAT_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite";
/**
 * Model for drafting the idea and writing the evaluation report. Defaults to the fast model:
 * gemini-3.5-flash gives slightly better prose but was timing out (>15 s) for this key. Set
 * EXPO_PUBLIC_GEMINI_REASONING_MODEL=gemini-3.5-flash to use it — AdvisorService then caps it at
 * 15 s and falls back to the chat model.
 */
export const GEMINI_REASONING_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_REASONING_MODEL || GEMINI_CHAT_MODEL;

const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 1_500;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
  /** Optional inline audio (base64) sent before the text — used for speech-to-text. */
  audio?: { mimeType: string; data: string };
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

interface GenerateOptions {
  model: string;
  /** Tried once instead of re-trying `model` when it times out or is overloaded. */
  fallbackModel?: string;
  /** Per-request time limit; defaults to REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
  system: string;
  turns: GeminiTurn[];
  temperature?: number;
  maxOutputTokens?: number;
}

/** Gemini response schema (OpenAPI subset, upper-case type names). */
export type GeminiSchema = Record<string, unknown>;

/** Plain-text completion. */
export function generateText(options: GenerateOptions): Promise<string> {
  return generate(options, {});
}

/** Structured completion constrained to `schema`, parsed as JSON. */
export async function generateJson<T>(
  options: GenerateOptions & { schema: GeminiSchema }
): Promise<T> {
  const { schema, ...rest } = options;
  const jsonConfig = { responseMimeType: "application/json", responseSchema: schema };
  const parsed = parseJson(await generate(rest, jsonConfig));
  if (parsed !== null) return parsed as T;

  // Usually a reply cut off mid-JSON; one more attempt (on the fallback model if there is one).
  console.warn("[Gemini] Malformed JSON; retrying once");
  const retry = parseJson(
    await generate({ ...rest, model: rest.fallbackModel ?? rest.model, fallbackModel: undefined }, jsonConfig)
  );
  if (retry === null) {
    throw new GeminiError("Gemini returned malformed JSON");
  }
  return retry as T;
}

async function generate(
  {
    model,
    fallbackModel,
    timeoutMs = REQUEST_TIMEOUT_MS,
    system,
    turns,
    temperature = 0.4,
    maxOutputTokens = 2048,
  }: GenerateOptions,
  extraConfig: Record<string, unknown>
): Promise<string> {
  if (!API_KEY) {
    throw new GeminiError(
      "EXPO_PUBLIC_GEMINI_API_KEY is not set — add it to .env and restart Metro with `npx expo start -c`."
    );
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: mergeTurns(turns).map((turn) => ({
      role: turn.role,
      parts: turn.audio
        ? [{ inlineData: turn.audio }, { text: turn.text }]
        : [{ text: turn.text }],
    })),
    generationConfig: { temperature, maxOutputTokens, ...extraConfig },
  });

  try {
    return await request(model, body, timeoutMs);
  } catch (error) {
    if (error instanceof GeminiError && error.retryable) {
      if (fallbackModel && fallbackModel !== model) {
        console.warn(`[Gemini] ${model} failed (${error.message}); falling back to ${fallbackModel}`);
        return request(fallbackModel, body, REQUEST_TIMEOUT_MS);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return request(model, body, timeoutMs);
    }
    throw error;
  }
}

async function request(model: string, body: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new GeminiError(aborted ? "Gemini request timed out" : "Network request failed", undefined, true);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `Gemini request failed (${response.status})`;
    throw new GeminiError(message, response.status, RETRYABLE_STATUS.has(response.status));
  }

  const candidate = payload?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .filter((part: { text?: string; thought?: boolean }) => !part.thought)
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = candidate?.finishReason ?? payload?.promptFeedback?.blockReason ?? "EMPTY";
    throw new GeminiError(`Gemini returned no text (${reason})`);
  }
  return text;
}

/** Gemini expects alternating roles; collapse consecutive turns from the same side. */
function mergeTurns(turns: GeminiTurn[]): GeminiTurn[] {
  const merged: GeminiTurn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role && !last.audio && !turn.audio) {
      last.text = `${last.text}\n\n${turn.text}`;
    } else {
      merged.push({ ...turn });
    }
  }
  return merged;
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
