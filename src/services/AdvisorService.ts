/**
 * @fileoverview AdvisorService — the conversational advisor and speech-to-text.
 *
 * The advisor answers questions about starting a micro-enterprise, margin money, the concessional
 * loan schemes and — when the conversation is linked to a feasibility study — that report.
 * Every reply ends with ONE follow-up question with tappable options, so users rarely need to
 * type; the composer (text or voice) is always available for their own question.
 */

import { GEMINI_CHAT_MODEL, GeminiSchema, GeminiTurn, generateJson, generateText } from "./gemini";
import { PreferenceAnswers, describeProfile } from "./preferences";
import { SCHEMES } from "./schemeCalculator";
import { getCategory } from "./categories";
import { getLanguage, LanguageCode } from "../i18n/languages";
import type { ChatMessage, ChatOption, ChatQuestion } from "../types/session";
import type { Study } from "../types/study";

export interface AdvisorContext {
  language: LanguageCode;
  fullName?: string;
  preferences: PreferenceAnswers | null;
  /** The linked feasibility study, if the conversation is about one. */
  study: Study | null;
}

export interface AdvisorTurn {
  message: string;
  question: ChatQuestion | null;
}

function languageName(code: LanguageCode): string {
  const lang = getLanguage(code);
  return lang.code === "en" ? "English" : `${lang.englishName} (${lang.nativeName})`;
}

const SCHEME_RULES = `Concessional loan rules (State Channelizing Agencies):
- The entrepreneur pays 10% of the project cost as margin money; the agency lends 90%. Example: ₹1,00,000 margin → ₹10,00,000 project → ₹9,00,000 loan.
- Micro Finance Scheme: project cost up to ₹1.40 lakh; loan up to 90% (max ₹1.25 lakh); ${SCHEMES.micro.annualRate * 100}% per year; repaid over 3 years including a 3-month moratorium.
- Term Loan Scheme: project cost above ₹1.40 lakh up to ₹50 lakh; loan up to 90% (max ₹45 lakh); ${SCHEMES.term.annualRate * 100}% per year; repaid over 7 years including a 6-month moratorium.
- Repayment is in quarterly instalments after the moratorium. Applications go through the State Channelizing Agency (national corporations such as NSFDC for SC, NSTFDC for ST, NBCFDC for backward classes).`;

/** A compact, English summary of a study for the prompt. */
export function summarizeStudy(study: Study): string {
  const { input, plan, report, operations } = study;
  const category = getCategory(input.categoryId);
  const place = [input.place.village, input.place.block, input.place.district, input.place.state].filter(Boolean).join(", ");
  return [
    `The user's feasibility study:`,
    `- Business: ${input.categoryId === "other" ? input.categoryDetail : category.englishName}${input.categoryDetail && input.categoryId !== "other" ? ` (${input.categoryDetail})` : ""}; location: ${place}`,
    `- Margin ₹${plan.contribution}; project cost ₹${plan.projectCost}; loan ₹${plan.loanAmount} (${plan.scheme.id === "micro" ? "Micro Finance" : "Term Loan"}, ${plan.scheme.annualRate * 100}%, ${plan.scheme.tenureMonths} months, ${plan.scheme.moratoriumMonths}-month moratorium); quarterly instalment ₹${plan.quarterlyInstalment}, first due in month ${plan.firstInstalmentMonth}`,
    `- Expected monthly sales ₹${operations.monthlyRevenue}, costs ₹${operations.monthlyCosts}, surplus ₹${operations.monthlySurplus}; repayment cover ${operations.coverage ?? "n/a"}×; risk ${operations.riskLevel}; working capital ₹${operations.workingCapital}`,
    `- Market: ~${report.marketReach.population5km} people within 5 km; ${report.marketReach.dailyCustomers} customers/day expected; competition ${report.competition.saturation} (~${report.competition.estimatedCount5km} similar businesses)`,
    `- Main local threats: ${report.threats.map((t) => t.title).join("; ") || "none listed"}`,
    `- Suggested prices: ${report.pricing.products.map((p) => `${p.name} ₹${p.suggestedPrice}/${p.unit}`).join("; ") || "n/a"}`,
  ].join("\n");
}

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
  },
  required: ["message", "question"],
};

function advisorPrompt(ctx: AdvisorContext): string {
  const profile = describeProfile(ctx.preferences, ctx.fullName);
  return `You are Niti Mitra, a warm, practical business and loan advisor for rural and semi-urban micro-entrepreneurs in India, many of them first-time and from marginalised communities.
Write every field in ${languageName(ctx.language)}, using simple everyday words. Use ₹ and Indian number format (lakh).

${SCHEME_RULES}

${profile ? `About the user (never ask about these again):\n${profile}` : "The user has not shared profile details."}

${ctx.study ? summarizeStudy(ctx.study) : "No feasibility study is linked to this conversation. If the user wants a full local market report and loan plan, suggest the \"New study\" tab."}

How to reply:
1. "message": answer the user's latest message directly and practically in under 120 words. Use the numbers above when relevant — never invent different ones. Short "- " bullets are fine; no headings or markdown tables.
2. "question": then offer ONE follow-up with 3–4 tappable options. Either a clarifying question you need answered, or "What would you like to know next?" with the most useful next topics for this user. label: at most 6 words; description: at most 10 words. Never add an "Other" option — the user can always type.
Stay on topic (business, money, loans, schemes, marketing, operations). Be honest about risks.`;
}

/** Replay assistant turns as the JSON they were produced in, so the model keeps its format. */
function toTurns(messages: ChatMessage[]): GeminiTurn[] {
  return messages.map((m) =>
    m.role === "user"
      ? { role: "user" as const, text: m.text }
      : { role: "model" as const, text: JSON.stringify({ message: m.text, question: m.question ?? null }) }
  );
}

export async function getAdvisorReply(messages: ChatMessage[], ctx: AdvisorContext): Promise<AdvisorTurn> {
  const raw = await generateJson<Partial<AdvisorTurn>>({
    model: GEMINI_CHAT_MODEL,
    system: advisorPrompt(ctx),
    turns: toTurns(messages),
    temperature: 0.5,
    maxOutputTokens: 2000,
    schema: CHAT_SCHEMA,
  });

  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\*\*/g, "").trim() : "");
  let question: ChatQuestion | null = null;
  const q = raw.question as Partial<ChatQuestion> | null | undefined;
  if (q && clean(q.text)) {
    const options: ChatOption[] = (Array.isArray(q.options) ? q.options : [])
      .map((o) => ({ label: clean(o?.label), description: clean(o?.description) }))
      .filter((o) => o.label)
      .slice(0, 4);
    if (options.length >= 2) question = { text: clean(q.text), options };
  }
  return { message: clean(raw.message) || question?.text || "", question };
}

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
    system: `You transcribe short voice messages from Indian micro-entrepreneurs. The speaker most likely uses ${languageName(language)}, possibly mixed with English words.
Write exactly what was said, in the script of the language spoken, with numbers as digits. Output only the transcript.
If there is no clear speech, output exactly: [[EMPTY]]`,
    turns: [{ role: "user", text: "Transcribe this recording.", audio }],
    temperature: 0,
    maxOutputTokens: 500,
  });
  return text.includes("[[EMPTY]]") ? "" : text.trim();
}
