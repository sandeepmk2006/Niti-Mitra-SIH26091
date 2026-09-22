/**
 * @fileoverview A feasibility study: the user's three inputs, the deterministic financial plan
 * (Module 2), OpenStreetMap local data, and the AI-written market report (Module 1).
 * Stored at /users/{uid}/studies/{studyId}.
 */

import type { LanguageCode } from "../i18n/languages";
import type { CategoryId } from "../services/categories";
import type { Coordinates, LocalData, PlaceNames } from "../services/geo";
import type { FinancialPlan, MonthlyCosts, OperationsSummary } from "../services/schemeCalculator";

export interface StudyInput {
  categoryId: CategoryId;
  /** Free text when categoryId is "other" (or extra detail for any category). */
  categoryDetail: string;
  place: PlaceNames;
  /** From GPS, if the user used it; otherwise geocoded from `place`. */
  coordinates: Coordinates | null;
  marginCapital: number;
  desiredProjectCost: number | null;
}

export type Saturation = "low" | "medium" | "high";
export type ThreatType = "supply" | "seasonal" | "buyer" | "competition" | "price" | "other";
export type Severity = "low" | "medium" | "high";

export interface FeasibilityReport {
  summary: string;
  marketReach: {
    population5km: number;
    population10km: number;
    households5km: number;
    targetCustomers: string;
    dailyCustomers: number;
    channels: { name: string; detail: string }[];
  };
  opportunities: { title: string; detail: string }[];
  competition: {
    estimatedCount5km: number;
    saturation: Saturation;
    competitorTypes: string[];
    note: string;
  };
  pricing: {
    strategy: string;
    purchasingPower: string;
    products: { name: string; unit: string; minPrice: number; maxPrice: number; suggestedPrice: number }[];
  };
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  threats: { type: ThreatType; severity: Severity; title: string; detail: string; mitigation: string }[];
  nextSteps: string[];
  economics: {
    monthlyRevenue: number;
    costs: MonthlyCosts;
    workingCapitalMonths: number;
  };
}

export interface CostItem {
  item: string;
  amount: number;
  isWorkingCapital?: boolean;
}

export interface Study {
  id: string;
  language: LanguageCode;
  input: StudyInput;
  plan: FinancialPlan;
  local: LocalData | null;
  report: FeasibilityReport;
  operations: OperationsSummary;
  /** Project cost split into assets + working capital; always sums to plan.projectCost. */
  costBreakdown: CostItem[];
  createdAt: number;
  updatedAt: number;
}
