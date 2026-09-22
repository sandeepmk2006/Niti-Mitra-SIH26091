/**
 * @fileoverview User preferences — the short questionnaire asked once after sign-up (and editable
 * in Settings), stored on /users/{uid}.preferences.
 *
 * Answers are option ids, or `other:<typed text>` when the user typed their own answer. They are
 * turned into (a) a plain-English profile summary the advisor prompts use so the chat never asks
 * these things again, and (b) concrete defaults for scheme matching and financials.
 */

import { translate } from "../i18n/translate";
import type { TranslationKey } from "../i18n/translations/en";
import type { SocialCategory, VishwakarmaTradeType } from "../types/evaluation";

export type PreferenceId =
  | "gender"
  | "age"
  | "location"
  | "occupation"
  | "experience"
  | "trade"
  | "category"
  | "income"
  | "savings"
  | "emi";

export type PreferenceAnswers = Partial<Record<PreferenceId, string>>;

export interface PreferenceOption {
  id: string;
  label: TranslationKey;
}

export interface PreferenceQuestion {
  id: PreferenceId;
  question: TranslationKey;
  description?: TranslationKey;
  options: PreferenceOption[];
  /** Whether the "Other — type your answer" field is offered. */
  allowOther: boolean;
}

const opt = (group: string, ids: string[]): PreferenceOption[] =>
  ids.map((id) => ({ id, label: `prefs.${group}.${id}` as TranslationKey }));

export const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  { id: "gender", question: "prefs.gender.q", options: opt("gender", ["male", "female", "other", "na"]), allowOther: false },
  { id: "age", question: "prefs.age.q", options: opt("age", ["18to25", "26to35", "36to50", "50plus"]), allowOther: false },
  { id: "location", question: "prefs.location.q", options: opt("location", ["village", "town", "city"]), allowOther: true },
  {
    id: "occupation",
    question: "prefs.occupation.q",
    options: opt("occupation", ["farming", "labour", "business", "artisan", "homemaker", "student"]),
    allowOther: true,
  },
  { id: "experience", question: "prefs.experience.q", options: opt("experience", ["first", "past", "current"]), allowOther: false },
  {
    id: "trade",
    question: "prefs.trade.q",
    description: "prefs.trade.desc",
    options: opt("trade", ["none", "tailor", "carpenter", "potter", "barber", "blacksmith"]),
    allowOther: true,
  },
  {
    id: "category",
    question: "prefs.category.q",
    description: "prefs.category.desc",
    options: opt("category", ["general", "obc", "sc", "st", "ews", "na"]),
    allowOther: false,
  },
  { id: "income", question: "prefs.income.q", options: opt("income", ["lt1", "1to3", "3to5", "gt5"]), allowOther: false },
  { id: "savings", question: "prefs.savings.q", options: opt("savings", ["lt25k", "25kto1l", "1to5l", "gt5l"]), allowOther: false },
  { id: "emi", question: "prefs.emi.q", options: opt("emi", ["none", "lt2k", "2to5k", "gt5k"]), allowOther: false },
];

const OTHER_PREFIX = "other:";

export function otherAnswer(text: string): string {
  return `${OTHER_PREFIX}${text.trim()}`;
}

export function parseAnswer(value: string | undefined): { optionId: string | null; otherText: string | null } {
  if (!value) return { optionId: null, otherText: null };
  if (value.startsWith(OTHER_PREFIX)) return { optionId: null, otherText: value.slice(OTHER_PREFIX.length) };
  return { optionId: value, otherText: null };
}

export function countAnswered(answers: PreferenceAnswers | null | undefined): number {
  if (!answers) return 0;
  return PREFERENCE_QUESTIONS.filter((q) => !!answers[q.id]).length;
}

/** Keep only known question ids with string values — the Firestore document may be stale. */
export function sanitizeAnswers(raw: unknown): PreferenceAnswers {
  if (!raw || typeof raw !== "object") return {};
  const answers: PreferenceAnswers = {};
  for (const q of PREFERENCE_QUESTIONS) {
    const value = (raw as Record<string, unknown>)[q.id];
    if (typeof value === "string" && value.trim()) answers[q.id] = value;
  }
  return answers;
}

// ──────────────────────────────────────────────
// Derived values
// ──────────────────────────────────────────────

const CATEGORY: Record<string, SocialCategory> = {
  general: "GENERAL",
  obc: "OBC",
  sc: "SC",
  st: "ST",
  ews: "EWS",
};
/** Bucket midpoints, in INR. */
const INCOME: Record<string, number> = { lt1: 75_000, "1to3": 200_000, "3to5": 400_000, gt5: 700_000 };
const SAVINGS: Record<string, number> = { lt25k: 15_000, "25kto1l": 60_000, "1to5l": 300_000, gt5l: 700_000 };
const EMI: Record<string, number> = { none: 0, lt2k: 1_500, "2to5k": 3_500, gt5k: 7_000 };
const TRADES: Record<string, VishwakarmaTradeType> = {
  tailor: "tailor",
  carpenter: "carpenter",
  potter: "potter",
  barber: "barber",
  blacksmith: "blacksmith",
};

export interface ProfileFacts {
  socialCategory: SocialCategory | null;
  annualFamilyIncome: number | null;
  ownSavings: number | null;
  existingMonthlyEmi: number | null;
  tradeType: VishwakarmaTradeType | null;
}

export function deriveFacts(answers: PreferenceAnswers | null | undefined): ProfileFacts {
  const pick = <T,>(id: PreferenceId, table: Record<string, T>): T | null => {
    const { optionId } = parseAnswer(answers?.[id]);
    return optionId && optionId in table ? table[optionId] : null;
  };
  return {
    socialCategory: pick("category", CATEGORY),
    annualFamilyIncome: pick("income", INCOME),
    ownSavings: pick("savings", SAVINGS),
    existingMonthlyEmi: pick("emi", EMI),
    tradeType: pick("trade", TRADES),
  };
}

/**
 * One line per answered question, in English, for the Gemini prompts
 * (e.g. "Family yearly income: ₹1–3 lakh"). Empty string when nothing is known.
 */
export function describeProfile(answers: PreferenceAnswers | null | undefined, fullName?: string): string {
  const lines: string[] = [];
  if (fullName) lines.push(`Name: ${fullName}`);
  for (const q of PREFERENCE_QUESTIONS) {
    const { optionId, otherText } = parseAnswer(answers?.[q.id]);
    const option = q.options.find((o) => o.id === optionId);
    const value = option ? translate("en", option.label) : otherText;
    if (value) lines.push(`${translate("en", q.question)} ${value}`);
  }
  return lines.join("\n");
}
