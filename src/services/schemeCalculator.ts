/**
 * @fileoverview Smart Financial Calculator & Scheme Router — pure, deterministic, works offline.
 *
 * Rules:
 *   - The beneficiary contributes 10% of the project cost as margin money; the scheme lends 90%.
 *   - Micro Finance Scheme: project cost ≤ ₹1.40 lakh, loan ≤ ₹1.25 lakh, 6.5% p.a.,
 *     36 months including a 3-month moratorium.
 *   - Term Loan Scheme: project cost ₹1.40 lakh – ₹50 lakh, loan ≤ ₹45 lakh, 8% p.a.,
 *     84 months including a 6-month moratorium.
 *
 * Repayment model: interest accrued during the moratorium (simple interest) is added to the loan,
 * which is then repaid in equal quarterly instalments over the rest of the tenure.
 */

export type SchemeId = "micro" | "term";

export interface Scheme {
  id: SchemeId;
  /** Largest project cost the scheme covers (inclusive). */
  maxProjectCost: number;
  maxLoan: number;
  /** Annual interest rate, e.g. 0.065. */
  annualRate: number;
  tenureMonths: number;
  moratoriumMonths: number;
}

export const MARGIN_SHARE = 0.1;
export const LOAN_SHARE = 1 - MARGIN_SHARE;

export const SCHEMES: Record<SchemeId, Scheme> = {
  micro: {
    id: "micro",
    maxProjectCost: 140_000,
    maxLoan: 125_000,
    annualRate: 0.065,
    tenureMonths: 36,
    moratoriumMonths: 3,
  },
  term: {
    id: "term",
    maxProjectCost: 5_000_000,
    maxLoan: 4_500_000,
    annualRate: 0.08,
    tenureMonths: 84,
    moratoriumMonths: 6,
  },
};

/** Smallest margin the calculator accepts (₹1,000 → ₹10,000 project). */
export const MIN_MARGIN = 1_000;

export interface ScheduleRow {
  quarter: number;
  /** Loan months covered by this quarter, e.g. 4–6. */
  fromMonth: number;
  toMonth: number;
  opening: number;
  interest: number;
  principal: number;
  instalment: number;
  closing: number;
}

export type PlanNote =
  /** The loan cap bound, so the project was sized as margin + max loan. */
  | "capApplied"
  /** Margin supports more than the largest eligible project; the rest is surplus. */
  | "aboveMax"
  /** Requested project cost was larger than the margin can support; reduced to the maximum. */
  | "projectTooBig";

export interface FinancialPlan {
  marginCapital: number;
  /** Margin actually used; below marginCapital only when the project hit the scheme maximum. */
  contribution: number;
  surplusCapital: number;
  projectCost: number;
  /** Largest project cost this margin can support. */
  maxProjectCost: number;
  loanAmount: number;
  /** Loan as a share of the project cost (0–1). */
  loanShare: number;
  scheme: Scheme;
  /** Interest accrued during the moratorium and added to the loan. */
  moratoriumInterest: number;
  repaymentQuarters: number;
  quarterlyInstalment: number;
  /** Instalment ÷ 3 — what to set aside each month. */
  monthlySetAside: number;
  totalInterest: number;
  totalRepayment: number;
  firstInstalmentMonth: number;
  schedule: ScheduleRow[];
  notes: PlanNote[];
}

function schemeFor(projectCost: number): Scheme {
  return projectCost <= SCHEMES.micro.maxProjectCost ? SCHEMES.micro : SCHEMES.term;
}

/** Largest project a given margin can fund, and its scheme. */
function maxProjectFor(margin: number): { projectCost: number; scheme: Scheme; capApplied: boolean } {
  const byMargin = margin / MARGIN_SHARE;
  const scheme = schemeFor(byMargin);
  // The loan may not exceed the scheme cap, so the project is at most margin + max loan…
  const byCap = margin + scheme.maxLoan;
  // …and never more than the scheme's largest project.
  const projectCost = Math.min(byMargin, byCap, scheme.maxProjectCost);
  return { projectCost, scheme, capApplied: byCap < byMargin && byCap <= scheme.maxProjectCost };
}

function round(value: number): number {
  return Math.round(value);
}

export function buildSchedule(
  principal: number,
  scheme: Scheme
): Pick<
  FinancialPlan,
  | "moratoriumInterest"
  | "repaymentQuarters"
  | "quarterlyInstalment"
  | "totalInterest"
  | "totalRepayment"
  | "firstInstalmentMonth"
  | "schedule"
> {
  const moratoriumInterest = principal * scheme.annualRate * (scheme.moratoriumMonths / 12);
  const balance0 = principal + moratoriumInterest;
  const quarters = Math.round((scheme.tenureMonths - scheme.moratoriumMonths) / 3);
  const q = scheme.annualRate / 4;
  const instalment = balance0 * q / (1 - Math.pow(1 + q, -quarters));

  const schedule: ScheduleRow[] = [];
  let balance = balance0;
  let interestTotal = moratoriumInterest;
  for (let i = 1; i <= quarters; i++) {
    const interest = balance * q;
    const principalPart = i === quarters ? balance : instalment - interest;
    const payment = interest + principalPart;
    const closing = Math.max(balance - principalPart, 0);
    const fromMonth = scheme.moratoriumMonths + (i - 1) * 3 + 1;
    schedule.push({
      quarter: i,
      fromMonth,
      toMonth: fromMonth + 2,
      opening: round(balance),
      interest: round(interest),
      principal: round(principalPart),
      instalment: round(payment),
      closing: round(closing),
    });
    interestTotal += interest;
    balance = closing;
  }

  return {
    moratoriumInterest: round(moratoriumInterest),
    repaymentQuarters: quarters,
    quarterlyInstalment: round(instalment),
    totalInterest: round(interestTotal),
    totalRepayment: round(principal + interestTotal),
    // Instalments fall due at the end of each quarter after the moratorium.
    firstInstalmentMonth: scheme.moratoriumMonths + 3,
    schedule,
  };
}

/**
 * Structure a loan from the user's margin money. `desiredProjectCost` (optional) plans a smaller
 * project than the maximum; it is clamped to what the margin supports.
 * Returns null for margins below MIN_MARGIN.
 */
export function computeFinancialPlan(
  marginCapital: number,
  desiredProjectCost?: number | null
): FinancialPlan | null {
  if (!Number.isFinite(marginCapital) || marginCapital < MIN_MARGIN) return null;

  const max = maxProjectFor(marginCapital);
  const notes: PlanNote[] = [];

  let projectCost = max.projectCost;
  if (desiredProjectCost && desiredProjectCost > 0) {
    if (desiredProjectCost > max.projectCost) notes.push("projectTooBig");
    projectCost = Math.min(desiredProjectCost, max.projectCost);
  } else {
    if (max.capApplied) notes.push("capApplied");
    if (marginCapital / MARGIN_SHARE > SCHEMES.term.maxProjectCost) notes.push("aboveMax");
  }

  const scheme = schemeFor(projectCost);
  const loanAmount = round(Math.min(projectCost * LOAN_SHARE, scheme.maxLoan));
  projectCost = round(projectCost);
  const contribution = projectCost - loanAmount;
  const repayment = buildSchedule(loanAmount, scheme);

  return {
    marginCapital,
    contribution,
    surplusCapital: Math.max(marginCapital - contribution, 0),
    projectCost,
    maxProjectCost: round(max.projectCost),
    loanAmount,
    loanShare: projectCost > 0 ? loanAmount / projectCost : 0,
    scheme,
    ...repayment,
    monthlySetAside: round(repayment.quarterlyInstalment / 3),
    notes,
  };
}

// ──────────────────────────────────────────────
// Operations: can the business carry the loan?
// ──────────────────────────────────────────────

export type RiskLevel = "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK";

export interface MonthlyCosts {
  rawMaterials: number;
  wages: number;
  rent: number;
  utilities: number;
  transport: number;
  other: number;
}

export interface OperationsInput {
  monthlyRevenue: number;
  costs: MonthlyCosts;
  /** Months of operating costs to hold as working capital (stock, credit to buyers). */
  workingCapitalMonths: number;
}

export interface OperationsSummary {
  monthlyRevenue: number;
  monthlyCosts: number;
  monthlySurplus: number;
  /** Surplus over one quarter ÷ the quarterly instalment. */
  coverage: number | null;
  /** Suggested working capital, part of the project cost. */
  workingCapital: number;
  workingCapitalMonths: number;
  riskLevel: RiskLevel;
  /** 0–100, computed from coverage and competition — never by the LLM. */
  score: number;
}

const COVERAGE_HIGH_RISK = 1.0;
const COVERAGE_MODERATE_RISK = 1.25;
/** Working capital is capped so fixed assets still get most of the project cost. */
const MAX_WORKING_CAPITAL_SHARE = 0.4;

export function sumCosts(costs: MonthlyCosts): number {
  return costs.rawMaterials + costs.wages + costs.rent + costs.utilities + costs.transport + costs.other;
}

export function computeOperations(
  plan: FinancialPlan,
  input: OperationsInput,
  saturation: "low" | "medium" | "high"
): OperationsSummary {
  const monthlyCosts = round(sumCosts(input.costs));
  const monthlySurplus = round(input.monthlyRevenue - monthlyCosts);
  const coverage =
    plan.quarterlyInstalment > 0 ? Math.round(((monthlySurplus * 3) / plan.quarterlyInstalment) * 100) / 100 : null;

  const months = Math.min(Math.max(input.workingCapitalMonths || 2, 1), 4);
  const workingCapital = round(Math.min(monthlyCosts * months, plan.projectCost * MAX_WORKING_CAPITAL_SHARE));

  let riskLevel: RiskLevel;
  let score: number;
  if (input.monthlyRevenue <= 0 || coverage === null || coverage < COVERAGE_HIGH_RISK) {
    riskLevel = "HIGH_RISK";
    score = coverage !== null && coverage > 0 ? 25 + Math.round(coverage * 15) : 20;
  } else if (coverage <= COVERAGE_MODERATE_RISK) {
    riskLevel = "MODERATE_RISK";
    score = 50 + Math.round(((coverage - 1) / 0.25) * 10);
  } else {
    riskLevel = "LOW_RISK";
    score = Math.min(90, 65 + Math.round((coverage - 1.25) * 12));
  }
  score -= saturation === "high" ? 10 : saturation === "medium" ? 4 : 0;

  return {
    monthlyRevenue: round(input.monthlyRevenue),
    monthlyCosts,
    monthlySurplus,
    coverage,
    workingCapital,
    workingCapitalMonths: months,
    riskLevel,
    score: Math.max(5, Math.min(95, score)),
  };
}
