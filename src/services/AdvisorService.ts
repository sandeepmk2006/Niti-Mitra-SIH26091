/**
 * @fileoverview AdvisorService — the Gemini-backed steps of the Evaluate flow.
 *
 *   1. getChatReply   — the advisor asks ONE multiple-choice question per turn (tap an option, or
 *                       type/speak your own answer), skipping anything the user's saved profile
 *                       already answers, and flags when it has enough to draft.
 *   2. draftIdea      — turns the conversation into a structured IdeaDraft (JSON mode), filling
 *                       gaps from the profile.
 *   3. evaluateIdea   — the "Proceed" job: computes financials and scheme matches in code, then has
 *                       Gemini write the report narrative around those fixed numbers.
 *   4. transcribeAudio — speech-to-text for the mic button.
 *
 * All user-facing text is generated in the user's selected language.
 */

import {
  GEMINI_CHAT_MODEL,
  GEMINI_REASONING_MODEL,
  GeminiSchema,
  GeminiTurn,
  generateJson,
  generateText,
} from "./gemini";
import {
  LOAN_INTEREST_RATE,
  LOAN_TENURE_YEARS,
  VISHWAKARMA_TRADES,
  computeFinancials,
  matchSchemes,
} from "./financials";
import { PreferenceAnswers, deriveFacts, describeProfile } from "./preferences";
import { getLanguage, LanguageCode } from "../i18n/languages";
import type {
  ChatMessage,
  ChatOption,
  ChatQuestion,
  EvaluationReport,
  IdeaDraft,
} from "../types/session";
import type { SocialCategory, VishwakarmaTradeType } from "../types/evaluation";

const SOCIAL_CATEGORIES: readonly SocialCategory[] = ["SC", "ST", "OBC", "EWS", "GENERAL"];

/**
 * Draft and report use the stronger model, but it can be slow under load (30s+ observed), so it
 * gets a time limit and falls back to the fast chat model instead of leaving the user waiting.
 */
const REASONING = {
  model: GEMINI_REASONING_MODEL,
  fallbackModel: GEMINI_CHAT_MODEL,
  timeoutMs: 15_000,
  // Indic scripts cost several tokens per word; leave room so JSON is never cut off.
  maxOutputTokens: 4096,
};

/** What the advisor knows about the user before the chat starts. */
export interface AdvisorContext {
  language: LanguageCode;
  fullName?: string;
  preferences: PreferenceAnswers | null;
}

function languageName(code: LanguageCode): string {
  const lang = getLanguage(code);
  return lang.code === "en" ? "English" : `${lang.englishName} (${lang.nativeName})`;
}

function profileBlock(ctx: AdvisorContext): string {
  const profile = describeProfile(ctx.preferences, ctx.fullName);
  return profile
    ? `Known facts about the user (from their saved profile — never ask about these again):\n${profile}`
    : "The user has not shared any profile details.";
}

function transcript(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      if (m.role === "user") return `Entrepreneur: ${m.text}`;
      const question = m.question ? ` [Asked: ${m.question.text}]` : "";
      return `Advisor: ${m.text}${question}`;
    })
    .join("\n");
}

// ──────────────────────────────────────────────
// 1. Chat — one multiple-choice question per turn
// ──────────────────────────────────────────────

export interface AdvisorTurn {
  message: string;
  question: ChatQuestion | null;
  readyToEvaluate: boolean;
}

/**
 * Facts the advisor must collect before drafting. Each turn the model restates them, quoting the
 * user's own answer or null — "ready" is decided in code from these, not taken on trust.
 */
const FACTS = {
  product: "what they will sell and to whom",
  place: "where they will run it",
  price: "selling price per unit",
  sales: "expected sales per day or month",
  unitCost: "material cost per unit",
  fixedCosts: "monthly fixed costs (rent, electricity, wages)",
  startupMoney: "total money needed to start",
  funding: "how the start-up money will be arranged (savings, loan, family)",
} as const;
type FactId = keyof typeof FACTS;
const FACT_IDS = Object.keys(FACTS) as FactId[];

const CHAT_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    question: {
      type: "OBJECT",
      nullable: true,
      properties: {
        text: { type: "STRING" },
        options: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { label: { type: "STRING" }, description: { type: "STRING" } },
            required: ["label", "description"],
          },
        },
      },
      required: ["text", "options"],
    },
    readyToEvaluate: { type: "BOOLEAN" },
    facts: {
      type: "OBJECT",
      properties: Object.fromEntries(FACT_IDS.map((id) => [id, { type: "STRING", nullable: true }])),
      required: FACT_IDS,
    },
  },
  required: ["facts", "message", "question", "readyToEvaluate"],
};

function advisorPrompt(ctx: AdvisorContext, evaluateLabel: string, focus: string[] = []): string {
  const focusBlock = focus.length
    ? [
        "",
        'IMPORTANT — these details are still missing. Ask about them now, one per turn, before anything else; "readyToEvaluate" must be false until they are answered:',
        ...focus.map((f) => `- ${f}`),
      ].join("\n")
    : "";
  return `You are Niti Mitra, a warm, practical business advisor for rural and small-town micro-entrepreneurs in India.
Write every field in ${languageName(ctx.language)}, using simple everyday words. Use ₹ for money.

${profileBlock(ctx)}

HOW YOU TALK — like a guided form, not an interview. Typing is hard for your users, so every turn you:
1. "message": react to their last answer in ONE short sentence (under 25 words). Add a practical tip only when it genuinely helps.
2. "question": ask exactly ONE clear question with 3 or 4 answer options they can tap.
   - label: at most 5 words. description: at most 10 words explaining that option.
   - For money or quantities, options are realistic ranges for THIS business (e.g. "₹10–20 per cup"), smallest first.
   - Options must be mutually exclusive and cover the common cases. Never add an "Other" option — the app always lets them type their own answer.
3. If they typed a question or something that does not answer your question, reply briefly in "message", then ask the SAME question again (you may reword it). Never treat an off-topic reply as an answer.

FACTS TO COLLECT — ask for them in this order, skipping only what the profile or the conversation already gives:
- product: what exactly they will sell or make, and to whom
- place: where they will run it (market, bus stand, home, village shop…)
- price: selling price per unit
- sales: expected sales per day or per month (number of units/customers)
- unitCost: material cost per unit
- fixedCosts: monthly fixed costs (rent, electricity, helper's wages) — "none" is a valid answer
- startupMoney: total money needed to start
- funding: how that start-up money will be arranged (own savings, loan, family) — ask for the loan amount if a loan is needed

"facts": fill this in FIRST, every turn. For each fact, quote what the Entrepreneur actually said (e.g. "₹10 a cup"), or null if they have not said it. A user message tagged (Answering: "...") answers only that question, and only if its words actually do — a reply about something else leaves that fact null. Never fill a fact from your own question or options.
Always ask about the first fact that is still null.
"readyToEvaluate" must be false while any fact is null.
When every fact has a value, set "readyToEvaluate" to true, set "question" to null, and in "message" briefly recap the key numbers and tell them to tap "${evaluateLabel}" to see their plan.
Never invent numbers on the user's behalf. Plain text only — no markdown.
${focusBlock}`;
}

/**
 * Assistant turns are replayed as the JSON the model produced, so it keeps its own format.
 * User replies are tagged with the question they answer, so an off-topic reply is recognisable.
 */
function toTurns(messages: ChatMessage[]): GeminiTurn[] {
  return messages.map((m, i) => {
    const asked = i > 0 && messages[i - 1].role === "assistant" ? messages[i - 1].question : null;
    return m.role === "user"
      ? { role: "user" as const, text: asked ? `(Answering: "${asked.text}") ${m.text}` : m.text }
      : {
          role: "model" as const,
          text: JSON.stringify({
            message: m.text,
            question: m.question ?? null,
            readyToEvaluate: !!m.readyToEvaluate,
          }),
        };
  });
}

type RawTurn = Partial<AdvisorTurn> & { facts?: Partial<Record<FactId, string | null>> };

function missingFacts(raw: RawTurn): FactId[] {
  return FACT_IDS.filter((id) => {
    const value = raw.facts?.[id];
    return typeof value !== "string" || !value.trim();
  });
}

/**
 * One advisor turn. `focus` lists details that must be asked about next (e.g. what the draft
 * found missing when the user taps "Refine").
 */
export async function getChatReply(
  messages: ChatMessage[],
  ctx: AdvisorContext,
  evaluateLabel: string,
  focus: string[] = []
): Promise<AdvisorTurn> {
  const ask = (extraFocus: string[]) =>
    generateJson<RawTurn>({
      model: GEMINI_CHAT_MODEL,
      system: advisorPrompt(ctx, evaluateLabel, extraFocus),
      turns: toTurns(messages),
      temperature: 0.5,
      maxOutputTokens: 1500,
      schema: CHAT_SCHEMA,
    });

  let raw = await ask(focus);

  // "Ready" is decided from the facts the model quoted, not from its own flag. If it claims to be
  // ready with gaps (or stops asking), ask once more naming the gaps, so the user always gets a
  // question instead of a dead end.
  let missing = missingFacts(raw);
  if (missing.length > 0 && (raw.readyToEvaluate || !raw.question)) {
    raw = await ask([...focus, ...missing.map((id) => FACTS[id])]);
    missing = missingFacts(raw);
  }
  raw.readyToEvaluate = missing.length === 0 && (raw.readyToEvaluate === true || !raw.question);
  if (raw.readyToEvaluate) raw.question = null;
  return normalizeTurn(raw);
}

function normalizeTurn(raw: Partial<AdvisorTurn>): AdvisorTurn {
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\*\*/g, "").trim() : "");
  const message = clean(raw.message);

  let question: ChatQuestion | null = null;
  const q = raw.question as Partial<ChatQuestion> | null | undefined;
  if (q && clean(q.text)) {
    const options: ChatOption[] = (Array.isArray(q.options) ? q.options : [])
      .map((o) => ({ label: clean(o?.label), description: clean(o?.description) }))
      .filter((o) => o.label)
      .slice(0, 5);
    if (options.length >= 2) question = { text: clean(q.text), options };
  }

  return {
    message: message || question?.text || "",
    question,
    readyToEvaluate: raw.readyToEvaluate === true,
  };
}

// ──────────────────────────────────────────────
// 2. Draft
// ──────────────────────────────────────────────

const nullableNumber = { type: "NUMBER", nullable: true };
const nullableString = { type: "STRING", nullable: true };
const stringList = { type: "ARRAY", items: { type: "STRING" } };

const DRAFT_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    category: { type: "STRING" },
    location: nullableString,
    targetCustomers: nullableString,
    pricePerUnit: nullableNumber,
    variableCostPerUnit: nullableNumber,
    expectedMonthlyUnits: nullableNumber,
    monthlyRevenue: nullableNumber,
    monthlyFixedCosts: nullableNumber,
    startupInvestment: nullableNumber,
    loanRequired: nullableNumber,
    existingMonthlyEmi: nullableNumber,
    tradeType: { type: "STRING", nullable: true, enum: [...VISHWAKARMA_TRADES] },
    socialCategory: { type: "STRING", nullable: true, enum: [...SOCIAL_CATEGORIES] },
    annualFamilyIncome: nullableNumber,
    assumptions: stringList,
    missingInfo: stringList,
  },
  required: [
    "title", "summary", "category", "location", "targetCustomers", "pricePerUnit",
    "variableCostPerUnit", "expectedMonthlyUnits", "monthlyRevenue", "monthlyFixedCosts",
    "startupInvestment", "loanRequired", "existingMonthlyEmi", "tradeType", "socialCategory",
    "annualFamilyIncome", "assumptions", "missingInfo",
  ],
};

function draftPrompt(ctx: AdvisorContext): string {
  return `You turn a conversation between a micro-entrepreneur and an advisor into a structured business idea draft.
${profileBlock(ctx)}

- Write title, summary, location, targetCustomers, assumptions and missingInfo in ${languageName(ctx.language)}.
- "category" is a short English snake_case label (e.g. tea_stall, tailoring, grocery_store).
- Money is in INR. Costs, revenue and units are per MONTH. Convert daily figures using 26 working days unless the user said otherwise, and note the conversion in assumptions.
- When the user picked a range (e.g. "₹10–20"), use its midpoint and say so in assumptions.
- Use only numbers the user stated or chose, or that follow directly from them. Otherwise use null — never guess.
- If price and monthly units are known, monthlyRevenue = price × units.
- If the user needs a loan but gave no amount, and startup money and own savings are known, loanRequired = startup money − own savings (not below 0); note it in assumptions.
- tradeType only if the business is clearly one of the listed PM-Vishwakarma trades. socialCategory, annualFamilyIncome and existingMonthlyEmi come from the profile or the conversation.
- summary: 2–3 sentences. assumptions and missingInfo: at most 4 short items each. Do not list profile facts as missing.`;
}

export async function draftIdea(messages: ChatMessage[], ctx: AdvisorContext): Promise<IdeaDraft> {
  const raw = await generateJson<Partial<IdeaDraft>>({
    ...REASONING,
    system: draftPrompt(ctx),
    turns: [{ role: "user", text: `Conversation:\n${transcript(messages)}` }],
    temperature: 0.2,
    schema: DRAFT_SCHEMA,
  });
  return withProfileDefaults(normalizeDraft(raw), ctx.preferences);
}

/** Fill scheme-relevant fields the conversation didn't cover from the saved profile. */
function withProfileDefaults(draft: IdeaDraft, preferences: PreferenceAnswers | null): IdeaDraft {
  const facts = deriveFacts(preferences);
  return {
    ...draft,
    socialCategory: draft.socialCategory ?? facts.socialCategory,
    annualFamilyIncome: draft.annualFamilyIncome ?? facts.annualFamilyIncome,
    existingMonthlyEmi: draft.existingMonthlyEmi ?? facts.existingMonthlyEmi,
    tradeType: draft.tradeType ?? facts.tradeType,
  };
}

function normalizeDraft(raw: Partial<IdeaDraft>): IdeaDraft {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()).slice(0, 4) : [];

  return {
    title: str(raw.title) ?? "Business idea",
    summary: str(raw.summary) ?? "",
    category: str(raw.category) ?? "business",
    location: str(raw.location),
    targetCustomers: str(raw.targetCustomers),
    pricePerUnit: num(raw.pricePerUnit),
    variableCostPerUnit: num(raw.variableCostPerUnit),
    expectedMonthlyUnits: num(raw.expectedMonthlyUnits),
    monthlyRevenue: num(raw.monthlyRevenue),
    monthlyFixedCosts: num(raw.monthlyFixedCosts),
    startupInvestment: num(raw.startupInvestment),
    loanRequired: num(raw.loanRequired),
    existingMonthlyEmi: num(raw.existingMonthlyEmi),
    tradeType: VISHWAKARMA_TRADES.includes(raw.tradeType as VishwakarmaTradeType)
      ? (raw.tradeType as VishwakarmaTradeType)
      : null,
    socialCategory: SOCIAL_CATEGORIES.includes(raw.socialCategory as SocialCategory)
      ? (raw.socialCategory as SocialCategory)
      : null,
    annualFamilyIncome: num(raw.annualFamilyIncome),
    assumptions: list(raw.assumptions),
    missingInfo: list(raw.missingInfo),
  };
}

// ──────────────────────────────────────────────
// 3. Evaluation ("Proceed")
// ──────────────────────────────────────────────

interface ReportNarrative {
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
}

const REPORT_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    verdict: { type: "STRING" },
    summary: { type: "STRING" },
    strengths: stringList,
    risks: stringList,
    nextSteps: stringList,
  },
  required: ["score", "verdict", "summary", "strengths", "risks", "nextSteps"],
};

function reportPrompt(ctx: AdvisorContext): string {
  return `You are a senior small-business credit advisor in India writing for a first-time micro-entrepreneur.
${profileBlock(ctx)}

Write every text field in ${languageName(ctx.language)}, in simple words. No markdown.
The financial figures were computed by a calculator and are correct — do not recompute or contradict them.
Tailor the advice to this person (their experience, savings, location and situation).
- score (0–100): LOW_RISK → 65–90, MODERATE_RISK → 40–70, HIGH_RISK → 10–45. Go lower within the band when key data is missing.
- verdict: one short line, at most 8 words.
- summary: 2–3 sentences on overall viability.
- strengths and risks: 2–4 items each, under 20 words, specific to this business.
- nextSteps: 3–5 concrete actions. Mention eligible government schemes by name where relevant.`;
}

export async function evaluateIdea(draft: IdeaDraft, ctx: AdvisorContext): Promise<EvaluationReport> {
  const financials = computeFinancials(draft);
  const schemes = matchSchemes(draft);

  const context = {
    idea: {
      title: draft.title,
      summary: draft.summary,
      category: draft.category,
      location: draft.location,
      targetCustomers: draft.targetCustomers,
      startupInvestment: draft.startupInvestment,
      loanRequired: draft.loanRequired,
      missingInfo: draft.missingInfo,
    },
    financials,
    loanAssumption: `${LOAN_INTEREST_RATE * 100}% per year over ${LOAN_TENURE_YEARS} years`,
    governmentSchemes: schemes.map((s) => ({ name: s.name, status: s.status })),
  };

  const narrative = await generateJson<ReportNarrative>({
    ...REASONING,
    system: reportPrompt(ctx),
    turns: [{ role: "user", text: JSON.stringify(context, null, 2) }],
    temperature: 0.3,
    schema: REPORT_SCHEMA,
  });

  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()).slice(0, 5) : [];
  const score = Math.round(Number(narrative.score));

  return {
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0,
    verdict: typeof narrative.verdict === "string" ? narrative.verdict.trim() : "",
    summary: typeof narrative.summary === "string" ? narrative.summary.trim() : "",
    strengths: list(narrative.strengths),
    risks: list(narrative.risks),
    nextSteps: list(narrative.nextSteps),
    financials,
    schemes,
    model: GEMINI_REASONING_MODEL,
    evaluatedAt: Date.now(),
  };
}

// ──────────────────────────────────────────────
// 4. Speech-to-text
// ──────────────────────────────────────────────

/**
 * Transcribe a short voice recording. Returns "" when nothing intelligible was said.
 * `mimeType` for the phone's AAC-in-MP4 (.m4a) recordings is "audio/mp4".
 */
export async function transcribeAudio(
  audio: { mimeType: string; data: string },
  language: LanguageCode
): Promise<string> {
  const text = await generateText({
    model: GEMINI_CHAT_MODEL,
    system: `You transcribe short voice answers from Indian micro-entrepreneurs. The speaker most likely uses ${languageName(language)}, possibly mixed with English words.
Write exactly what was said, in the script of the language spoken, with numbers as digits. Output only the transcript.
If there is no clear speech, output exactly: [[EMPTY]]`,
    turns: [{ role: "user", text: "Transcribe this recording.", audio }],
    temperature: 0,
    maxOutputTokens: 500,
  });
  return text.includes("[[EMPTY]]") ? "" : text.trim();
}
