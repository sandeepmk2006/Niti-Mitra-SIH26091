/**
 * Pure translation lookup — no React or native imports, so services (and scripts) can use it.
 */

import type { LanguageCode } from "./languages";
import { TRANSLATIONS } from "./translations";
import type { TranslationKey } from "./translations/en";

export type TranslateParams = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, params?: TranslateParams) => string;

/** Look up `key` in `language`, falling back to English, and fill `{name}` tokens. */
export function translate(
  language: LanguageCode,
  key: TranslationKey,
  params?: TranslateParams
): string {
  const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    name in params ? String(params[name]) : token
  );
}
