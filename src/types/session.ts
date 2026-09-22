/**
 * @fileoverview Types for the chat → draft → evaluation flow and its Firestore persistence.
 *
 * A Session is one conversation with the advisor. It lives at /users/{uid}/sessions/{sessionId}
 * and accumulates the chat transcript, the drafted idea, and the final evaluation report as the
 * user moves through the flow — so History can list chats, drafts, and evaluations from one query.
 */

import type { LanguageCode } from "../i18n/languages";
import type { TranslationKey } from "../i18n/translations/en";
import type { RiskLevel, SocialCategory, VishwakarmaTradeType } from "./evaluation";

export type ChatRole = "user" | "assistant";

/** One answer choice in an advisor question. */
export interface ChatOption {
  label: string;
  description: string;
}

/** A multiple-choice question the advisor asks; the user taps an option or types their own. */
export interface ChatQuestion {
  text: string;
  options: ChatOption[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Assistant only: the question asked in this turn, if any. */
  question?: ChatQuestion | null;
  /** Assistant only: the advisor has enough information to draft the idea. */
  readyToEvaluate?: boolean;
}

/** How far the session has progressed. */
export type SessionStage = "chatting" | "drafted" | "evaluated";

/**
 * Structured business idea drafted by Gemini from the conversation.
 * Text fields are in the user's language; money is INR; unknowns are null.
 */
export interface IdeaDraft {
  title: string;
  summary: string;
  category: string;
  location: string | null;
  targetCustomers: string | null;
  pricePerUnit: number | null;
  variableCostPerUnit: number | null;
  expectedMonthlyUnits: number | null;
  monthlyRevenue: number | null;
  monthlyFixedCosts: number | null;
  startupInvestment: number | null;
  loanRequired: number | null;
  existingMonthlyEmi: number | null;
  tradeType: VishwakarmaTradeType | null;
  socialCategory: SocialCategory | null;
  annualFamilyIncome: number | null;
  assumptions: string[];
  missingInfo: string[];
}

export type RiskFlag =
  | "lossMaking"
  | "lowDscr"
  | "highMargin"
  | "longPayback"
  | "missingRevenue";

/** Deterministic numbers computed in code from the draft — never by the LLM. */
export interface FinancialSnapshot {
  monthlyRevenue: number;
  monthlyCosts: number;
  monthlyProfit: number;
  /** Profit / revenue (0–1), null when there is no revenue. */
  profitMargin: number | null;
  /** Existing EMI plus the estimated EMI on the requested loan. */
  monthlyDebtService: number;
  newLoanEmi: number;
  /** Null when there is no debt to service. */
  dscr: number | null;
  breakEvenUnits: number | null;
  breakEvenRevenue: number | null;
  paybackMonths: number | null;
  riskLevel: RiskLevel;
  flags: RiskFlag[];
}

export type SchemeId = "pmVishwakarma" | "pmDaksh" | "nsfdc";
export type SchemeStatus = "eligible" | "notEligible" | "needsInfo";

export interface SchemeMatch {
  id: SchemeId;
  name: string;
  status: SchemeStatus;
  reasonKey: TranslationKey;
  reasonParams?: Record<string, string>;
  maxAmount: number | null;
  portalUrl: string;
}

/** Final output of "Proceed": computed financials + scheme matches + Gemini's narrative. */
export interface EvaluationReport {
  /** 0–100 viability score from Gemini, anchored to the computed risk level. */
  score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  financials: FinancialSnapshot;
  schemes: SchemeMatch[];
  model: string;
  evaluatedAt: number;
}

export interface Session {
  id: string;
  title: string;
  language: LanguageCode;
  stage: SessionStage;
  messages: ChatMessage[];
  draft: IdeaDraft | null;
  report: EvaluationReport | null;
  createdAt: number;
  updatedAt: number;
}
