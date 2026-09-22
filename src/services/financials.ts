/**
 * @fileoverview Deterministic financial checks and government-scheme matching.
 *
 * Numbers are computed here, not by the LLM — Gemini only writes the narrative around them.
 * Risk thresholds and scheme eligibility rules mirror `financial_agent_node`, `validator_node`
 * and `_match_government_schemes` in functions/main.py; keep the two in step.
 */

import type {
  FinancialSnapshot,
  IdeaDraft,
  RiskFlag,
  SchemeMatch,
} from "../types/session";
import type { RiskLevel, VishwakarmaTradeType } from "../types/evaluation";

/** Assumed terms for the EMI on a requested loan (shown to the user in the report). */
export const LOAN_INTEREST_RATE = 0.12;
export const LOAN_TENURE_YEARS = 3;

const DSCR_HIGH_RISK = 1.0;
const DSCR_MODERATE_RISK = 1.25;
const UNREALISTIC_MARGIN = 0.8;
const LONG_PAYBACK_MONTHS = 36;

export const VISHWAKARMA_TRADES: readonly VishwakarmaTradeType[] = [
  "carpenter", "boat_maker", "armourer", "blacksmith", "hammer_and_toolkit_maker",
  "locksmith", "goldsmith", "potter", "sculptor", "cobbler", "mason", "basket_weaver",
  "doll_and_toy_maker", "barber", "garland_maker", "washerman", "tailor", "fishing_net_maker",
];

/** Standard reducing-balance EMI. */
export function monthlyEmi(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const months = years * 12;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  const growth = Math.pow(1 + r, months);
  return (principal * r * growth) / (growth - 1);
}

export function computeFinancials(draft: IdeaDraft): FinancialSnapshot {
  const price = positive(draft.pricePerUnit);
  const unitCost = positive(draft.variableCostPerUnit);
  const fixedCosts = positive(draft.monthlyFixedCosts);

  const units =
    positive(draft.expectedMonthlyUnits) ||
    (price > 0 && positive(draft.monthlyRevenue) > 0 ? positive(draft.monthlyRevenue) / price : 0);
  const monthlyRevenue = positive(draft.monthlyRevenue) || price * units;
  const variableCosts = unitCost * units;
  const monthlyCosts = fixedCosts + variableCosts;
  const monthlyProfit = monthlyRevenue - monthlyCosts;

  const newLoanEmi = monthlyEmi(positive(draft.loanRequired), LOAN_INTEREST_RATE, LOAN_TENURE_YEARS);
  const monthlyDebtService = positive(draft.existingMonthlyEmi) + newLoanEmi;
  const dscr = monthlyDebtService > 0 ? round(monthlyProfit / monthlyDebtService, 2) : null;
  const profitMargin = monthlyRevenue > 0 ? monthlyProfit / monthlyRevenue : null;

  const contribution = price - unitCost;
  const breakEvenUnits = price > 0 && contribution > 0 ? Math.ceil(fixedCosts / contribution) : null;
  const contributionRatio =
    price > 0 ? contribution / price : monthlyRevenue > 0 ? (monthlyRevenue - variableCosts) / monthlyRevenue : 0;
  const breakEvenRevenue = contributionRatio > 0 ? Math.round(fixedCosts / contributionRatio) : null;

  const investment = positive(draft.startupInvestment);
  const paybackMonths = investment > 0 && monthlyProfit > 0 ? Math.ceil(investment / monthlyProfit) : null;

  const flags: RiskFlag[] = [];
  if (monthlyRevenue === 0) flags.push("missingRevenue");
  if (monthlyRevenue > 0 && monthlyProfit < 0) flags.push("lossMaking");
  if (dscr !== null && dscr < DSCR_MODERATE_RISK) flags.push("lowDscr");
  if (profitMargin !== null && profitMargin > UNREALISTIC_MARGIN) flags.push("highMargin");
  if (paybackMonths !== null && paybackMonths > LONG_PAYBACK_MONTHS) flags.push("longPayback");

  return {
    monthlyRevenue: Math.round(monthlyRevenue),
    monthlyCosts: Math.round(monthlyCosts),
    monthlyProfit: Math.round(monthlyProfit),
    profitMargin: profitMargin === null ? null : round(profitMargin, 3),
    monthlyDebtService: Math.round(monthlyDebtService),
    newLoanEmi: Math.round(newLoanEmi),
    dscr,
    breakEvenUnits,
    breakEvenRevenue,
    paybackMonths,
    riskLevel: classifyRisk(monthlyRevenue, monthlyProfit, dscr, profitMargin),
    flags,
  };
}

function classifyRisk(
  revenue: number,
  profit: number,
  dscr: number | null,
  margin: number | null
): RiskLevel {
  if (revenue === 0 || profit <= 0) return "HIGH_RISK";
  if (dscr !== null) {
    if (dscr < DSCR_HIGH_RISK) return "HIGH_RISK";
    if (dscr <= DSCR_MODERATE_RISK) return "MODERATE_RISK";
    return "LOW_RISK";
  }
  return margin !== null && margin < 0.1 ? "MODERATE_RISK" : "LOW_RISK";
}

export function matchSchemes(draft: IdeaDraft): SchemeMatch[] {
  const category = draft.socialCategory;
  const income = draft.annualFamilyIncome;
  const trade = draft.tradeType;

  const vishwakarmaEligible = trade !== null && VISHWAKARMA_TRADES.includes(trade);
  const vishwakarma: SchemeMatch = {
    id: "pmVishwakarma",
    name: "PM-Vishwakarma",
    status: vishwakarmaEligible ? "eligible" : "notEligible",
    reasonKey: vishwakarmaEligible ? "scheme.vishwakarmaEligible" : "scheme.vishwakarmaNo",
    reasonParams: trade ? { trade: trade.replace(/_/g, " ") } : undefined,
    maxAmount: vishwakarmaEligible ? 300_000 : null,
    portalUrl: "https://pmvishwakarma.gov.in",
  };

  // PM-DAKSH: SC/ST have no income cap; OBC/EWS need family income below ₹3L.
  let daksh: Pick<SchemeMatch, "status" | "reasonKey">;
  if (category === null) {
    daksh = { status: "needsInfo", reasonKey: "scheme.needCategory" };
  } else if (category === "SC" || category === "ST") {
    daksh = { status: "eligible", reasonKey: "scheme.dakshEligible" };
  } else if (category === "OBC" || category === "EWS") {
    daksh =
      income === null
        ? { status: "needsInfo", reasonKey: "scheme.needIncome" }
        : income < 300_000
          ? { status: "eligible", reasonKey: "scheme.dakshEligible" }
          : { status: "notEligible", reasonKey: "scheme.dakshIncome" };
  } else {
    daksh = { status: "notEligible", reasonKey: "scheme.dakshNo" };
  }

  // NSFDC: SC only, family income up to ₹5L.
  let nsfdc: Pick<SchemeMatch, "status" | "reasonKey">;
  if (category === null) {
    nsfdc = { status: "needsInfo", reasonKey: "scheme.needCategory" };
  } else if (category !== "SC") {
    nsfdc = { status: "notEligible", reasonKey: "scheme.nsfdcNo" };
  } else if (income === null) {
    nsfdc = { status: "needsInfo", reasonKey: "scheme.needIncome" };
  } else if (income > 500_000) {
    nsfdc = { status: "notEligible", reasonKey: "scheme.nsfdcIncome" };
  } else {
    nsfdc = { status: "eligible", reasonKey: "scheme.nsfdcEligible" };
  }

  return [
    vishwakarma,
    {
      id: "pmDaksh",
      name: "PM-DAKSH",
      ...daksh,
      reasonParams: category ? { category } : undefined,
      maxAmount: null,
      portalUrl: "https://pmdaksh.dosje.gov.in",
    },
    {
      id: "nsfdc",
      name: "NSFDC",
      ...nsfdc,
      maxAmount: nsfdc.status === "eligible" ? 1_500_000 : null,
      portalUrl: "https://nsfdc.nic.in",
    },
  ];
}

function positive(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
