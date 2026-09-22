/**
 * Languages the UI is translated into. The AI advisor replies in the same language,
 * so adding a language means adding a row here plus a file in ./translations.
 */
export const LANGUAGES = [
  { code: "en", nativeName: "English", englishName: "English", locale: "en-IN" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", locale: "hi-IN" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali", locale: "bn-IN" },
  { code: "mr", nativeName: "मराठी", englishName: "Marathi", locale: "mr-IN" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil", locale: "ta-IN" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", locale: "te-IN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function getLanguage(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}
