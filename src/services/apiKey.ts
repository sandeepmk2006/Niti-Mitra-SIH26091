/**
 * @fileoverview Runtime Gemini API key override.
 *
 * The build ships with EXPO_PUBLIC_GEMINI_API_KEY, but a key can also be entered in Settings and
 * is then used for every later request — a way out if the built-in key is throttled or out of
 * quota during a demo. Stored in AsyncStorage on the device only (not in Firestore).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "nitimitra.geminiKey";
const BUILT_IN_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";

let overrideKey: string | null = null;

/** Read the stored override once at start-up (called by SettingsProvider). */
export async function loadStoredApiKey(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    overrideKey = stored && stored.trim() ? stored.trim() : null;
  } catch (error) {
    console.warn("[ApiKey] Could not read stored key:", error);
  }
}

/** The key every Gemini request should use right now. */
export function getApiKey(): string {
  return overrideKey || BUILT_IN_KEY;
}

export function hasOverride(): boolean {
  return overrideKey !== null;
}

/** "AQ.Ab8R…rZBY" — enough to recognise a key without showing it. */
export function maskKey(key: string = getApiKey()): string {
  if (key.length <= 12) return key ? "••••" : "";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  overrideKey = trimmed || null;
  try {
    if (trimmed) await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[ApiKey] Could not save key:", error);
  }
}

export function clearApiKey(): Promise<void> {
  return setApiKey("");
}

/** Check a key against the API before saving it. Returns the round-trip time in ms. */
export async function testApiKey(key: string): Promise<number> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key.trim() },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: controller.signal,
      }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
    return Date.now() - started;
  } finally {
    clearTimeout(timer);
  }
}
