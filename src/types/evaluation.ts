/**
 * @fileoverview Shared TypeScript interfaces for the business evaluation Cloud Function.
 *
 * These types define the contract of the `evaluate_business_idea` Firebase Callable
 * (functions/main.py) and its Firestore documents. The app itself currently runs the
 * chat → draft → evaluation flow client-side with Gemini (see ./session.ts); the shared
 * enums below (SocialCategory, VishwakarmaTradeType, RiskLevel) are used by both.
 *
 * @module evaluation
 */

// ──────────────────────────────────────────────
// Social Category & Trade Types
// ──────────────────────────────────────────────

/** Social category for government scheme eligibility matching. */
export type SocialCategory = "SC" | "ST" | "OBC" | "EWS" | "GENERAL";

/**
 * PM-Vishwakarma recognized trades (18 trades).
 * Used for scheme matching in the financial agent.
 */
export type VishwakarmaTradeType =
  | "carpenter"
  | "boat_maker"
  | "armourer"
  | "blacksmith"
  | "hammer_and_toolkit_maker"
  | "locksmith"
  | "goldsmith"
  | "potter"
  | "sculptor"
  | "cobbler"
  | "mason"
  | "basket_weaver"
  | "doll_and_toy_maker"
  | "barber"
  | "garland_maker"
  | "washerman"
  | "tailor"
  | "fishing_net_maker";

// ──────────────────────────────────────────────
// Business Input (Client → Cloud)
// ──────────────────────────────────────────────

/**
 * Raw business input from the user.
 * This is what the client sends to the Firebase callable.
 */
export interface BusinessInput {
  /** Original user transcript or typed text (may be in any supported language). */
  rawTranscript: string;

  /** ISO-639 language code of the raw transcript (e.g., "hi", "ta", "en"). */
  sourceLanguage: string;

  /**
   * Structured business dimensions extracted by on-device Qwen2-0.5B.
   * `null` if device is LOW_SPEC and local parsing was skipped.
   */
  parsedContext: ParsedBusinessContext | null;

  /** Whether the input was parsed on-device (true) or sent raw (false). */
  parsedOnDevice: boolean;

  /** Firebase Auth user ID. Optional for unauthenticated users. */
  userId?: string;

  /** User's social category for scheme matching. */
  socialCategory?: SocialCategory;

  /** User's trade type if applicable to PM-Vishwakarma. */
  tradeType?: VishwakarmaTradeType;

  /** User's annual family income in INR (for scheme eligibility). */
  annualFamilyIncome?: number;
}

/**
 * Structured business dimensions extracted from raw transcript.
 * Produced either by on-device Qwen2-0.5B or the cloud orchestrator node.
 */
export interface ParsedBusinessContext {
  /** Business category (e.g., "food_stall", "tailoring", "pottery"). */
  category: string;

  /** More specific sub-category (e.g., "street_food", "bridal_tailoring"). */
  subCategory?: string;

  /** Business location — latitude. */
  locationLat?: number;

  /** Business location — longitude. */
  locationLng?: number;

  /** Location name / description (e.g., "near Ranchi bus stand"). */
  locationDescription?: string;

  /** Estimated monthly revenue in INR. */
  monthlyRevenue?: number;

  /** Estimated monthly costs in INR. */
  monthlyCosts?: number;

  /** Estimated monthly fixed costs in INR (rent, salary, etc.). */
  monthlyFixedCosts?: number;

  /** Estimated price per unit of product/service in INR. */
  pricePerUnit?: number;

  /** Estimated variable cost per unit in INR. */
  variableCostPerUnit?: number;

  /** Existing debt / loan obligations (monthly EMI in INR). */
  existingMonthlyDebt?: number;

  /** Total existing loan principal in INR. */
  existingLoanPrincipal?: number;
}

// ──────────────────────────────────────────────
// Evaluation Result (Cloud → Client)
// ──────────────────────────────────────────────

/** Risk classification levels. */
export type RiskLevel = "HIGH_RISK" | "MODERATE_RISK" | "LOW_RISK";

/** Evaluation processing status. */
export type EvaluationStatus = "SUCCESS" | "PARTIAL" | "ERROR";

/**
 * A single government scheme recommendation.
 */
export interface SchemeRecommendation {
  /** Scheme name (e.g., "PM-Vishwakarma", "PM-DAKSH", "NSFDC"). */
  schemeName: string;

  /** Whether the user meets eligibility criteria. */
  eligible: boolean;

  /** Reason for eligibility / ineligibility. */
  eligibilityReason: string;

  /** Maximum loan/grant amount available in INR. */
  maxAmount?: number;

  /** Interest rate (if applicable). */
  interestRate?: string;

  /** Official scheme URL or portal link. */
  portalUrl?: string;
}

/**
 * Market density analysis from the hyperlocal scraper.
 */
export interface MarketAnalysis {
  /** Number of competing businesses per km². */
  competitorDensity: number;

  /** Distance to the nearest competitor in meters. */
  nearestCompetitorM: number;

  /** Names of nearby competitor businesses. */
  competitorNames: string[];

  /** Total competitors found within search radius. */
  totalCompetitors: number;

  /** Search radius used in meters. */
  searchRadiusM: number;
}

/**
 * Financial metrics calculated by the financial agent.
 */
export interface FinancialMetrics {
  /**
   * Debt Service Coverage Ratio.
   * DSCR = Net Operating Income / Total Debt Service.
   * Values > 1.25 indicate healthy debt servicing capacity.
   */
  dscr: number;

  /** Break-even point in units sold. */
  bepUnits: number;

  /** Break-even point in revenue (INR). */
  bepRevenue: number;

  /** Working capital = Current Assets - Current Liabilities (INR). */
  workingCapital: number;

  /** Projected monthly net income after all costs and debt (INR). */
  monthlyNetIncome: number;

  /** Contribution margin ratio (0-1). */
  contributionMarginRatio: number;
}

/**
 * Risk assessment from the validator node.
 */
export interface RiskAssessment {
  /** Overall risk classification. */
  level: RiskLevel;

  /** Specific risk flags (e.g., "DSCR below 1.0", "Negative working capital"). */
  flags: string[];

  /** LLM-generated natural-language risk narrative. */
  narrative: string;
}

/**
 * Complete evaluation result returned by the Firebase callable.
 */
export interface EvaluationResult {
  /** Processing status. */
  status: EvaluationStatus;

  /** Firestore document ID for this evaluation. */
  ideaId: string;

  /** Structured business dimensions used for evaluation. */
  parsedInput: ParsedBusinessContext;

  /** Market density analysis. */
  market: MarketAnalysis;

  /** Financial metrics (DSCR, BEP, working capital). */
  financial: FinancialMetrics;

  /** Matched government scheme recommendations. */
  schemes: SchemeRecommendation[];

  /** Risk assessment. */
  risk: RiskAssessment;

  /** ISO-8601 timestamp of evaluation. */
  evaluatedAt: string;

  /** Pipeline version identifier. */
  modelVersion: string;

  /** Error message if status is ERROR or PARTIAL. */
  errorMessage?: string;
}

// ──────────────────────────────────────────────
// BHASHINI Integration Types
// ──────────────────────────────────────────────

/** Supported BHASHINI pipeline task types. */
export type BhashiniTaskType = "asr" | "translation" | "tts";

/** BHASHINI ASR result. */
export interface BhashiniASRResult {
  /** Transcribed text. */
  text: string;

  /** Detected language code. */
  detectedLanguage: string;

  /** Confidence score (0-1). */
  confidence: number;
}

/** BHASHINI Translation result. */
export interface BhashiniTranslationResult {
  /** Translated text. */
  translatedText: string;

  /** Source language code. */
  sourceLanguage: string;

  /** Target language code. */
  targetLanguage: string;
}

/** BHASHINI TTS result. */
export interface BhashiniTTSResult {
  /** Base64-encoded audio data. */
  audioBase64: string;

  /** Audio format (e.g., "wav", "mp3"). */
  audioFormat: string;
}
