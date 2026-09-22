/**
 * @fileoverview Runs a feasibility study end to end.
 *
 *   1. Locate  — GPS coordinates, or geocode village/block/district (OpenStreetMap).
 *   2. Local   — nearby settlements and same-category businesses (OpenStreetMap).
 *   3. Finance — scheme routing, loan and repayment schedule (schemeCalculator, deterministic).
 *   4. Market  — Gemini: market reach, opportunities, competition, pricing.
 *   5. Strategy — Gemini: SWOT, local threats, next steps, and monthly unit economics sized to the
 *      project; code then computes coverage, risk, score and the cost breakdown.
 *
 * Steps 1–2 are best-effort: if the map lookups fail the study still completes, with the market
 * figures marked as estimates.
 */

import { GEMINI_CHAT_MODEL, GEMINI_REASONING_MODEL, GeminiSchema, generateJson } from "./gemini";
import { BusinessCategory, getCategory } from "./categories";
import { LocalData, fetchLocalData, geocode } from "./geo";
import { PreferenceAnswers, describeProfile } from "./preferences";
import {
  FinancialPlan,
  MonthlyCosts,
  computeFinancialPlan,
  computeOperations,
} from "./schemeCalculator";
import { getLanguage, LanguageCode } from "../i18n/languages";
import type { CostItem, FeasibilityReport, Study, StudyInput } from "../types/study";

export type StudyStep = "locate" | "local" | "finance" | "analysis";

export interface StudyContext {
  language: LanguageCode;
  fullName?: string;
  preferences: PreferenceAnswers | null;
}

const MODEL = {
  model: GEMINI_REASONING_MODEL,
  fallbackModel: GEMINI_CHAT_MODEL,
  // Long structured outputs; the API has been seen taking 30s+ even for short answers under load.
  timeoutMs: 90_000,
  maxOutputTokens: 6000,
  temperature: 0.3,
};

function languageName(code: LanguageCode): string {
  const lang = getLanguage(code);
  return lang.code === "en" ? "English" : `${lang.englishName} (${lang.nativeName})`;
}

function businessName(input: StudyInput, category: BusinessCategory): string {
  const detail = input.categoryDetail.trim();
  if (category.id === "other") return detail || "small business";
  return detail ? `${category.englishName} — ${detail}` : category.englishName;
}

function placeLine(input: StudyInput): string {
  const p = input.place;
  return [
    p.village && `Village/town: ${p.village}`,
    p.block && `Block: ${p.block}`,
    p.district && `District: ${p.district}`,
    p.state && `State: ${p.state}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function localEvidence(local: LocalData | null): string {
  if (!local) return "Map data: unavailable — estimate from your knowledge of this district.";
  const near = local.settlements
    .slice(0, 15)
    .map((s) => `${s.name} (${s.kind}, ${s.distanceKm} km${s.population ? `, pop ${s.population}` : ""})`)
    .join("; ");
  return [
    `Map data (OpenStreetMap, may be incomplete in rural areas):`,
    `- Settlements within 5 km: ${local.settlementCount5km}; within 10 km: ${local.settlementCount10km}`,
    `- Nearby: ${near || "none mapped"}`,
    `- Mapped population within 5 km: ${local.mappedPopulation5km ?? "not mapped"}; within 10 km: ${local.mappedPopulation10km ?? "not mapped"}`,
    `- Similar businesses mapped within 5 km: ${local.competitorCount5km}${local.nearestCompetitorKm !== null ? ` (nearest ${local.nearestCompetitorKm} km)` : ""}${local.competitorNames.length ? ` — ${local.competitorNames.join(", ")}` : ""}`,
  ].join("\n");
}

function financeLine(plan: FinancialPlan): string {
  return `Project cost ₹${plan.projectCost}; own margin ₹${plan.contribution}; loan ₹${plan.loanAmount} under the ${plan.scheme.id === "micro" ? "Micro Finance" : "Term Loan"} scheme at ${plan.scheme.annualRate * 100}% for ${plan.scheme.tenureMonths} months (${plan.scheme.moratoriumMonths}-month moratorium); quarterly instalment ₹${plan.quarterlyInstalment}.`;
}

function contextBlock(input: StudyInput, plan: FinancialPlan, local: LocalData | null, ctx: StudyContext): string {
  const category = getCategory(input.categoryId);
  const profile = describeProfile(ctx.preferences, ctx.fullName);
  return [
    `Business: ${businessName(input, category)}`,
    `Location: ${placeLine(input)}`,
    `Finance: ${financeLine(plan)}`,
    localEvidence(local),
    profile ? `Entrepreneur profile:\n${profile}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ──────────────────────────────────────────────
// Gemini schemas
// ──────────────────────────────────────────────

const S = { type: "STRING" };
const N = { type: "NUMBER" };
const list = (items: object) => ({ type: "ARRAY", items });
const obj = (properties: Record<string, object>) => ({
  type: "OBJECT",
  properties,
  required: Object.keys(properties),
});

const MARKET_SCHEMA: GeminiSchema = obj({
  summary: S,
  marketReach: obj({
    population5km: N,
    population10km: N,
    households5km: N,
    targetCustomers: S,
    dailyCustomers: N,
    channels: list(obj({ name: S, detail: S })),
  }),
  opportunities: list(obj({ title: S, detail: S })),
  competition: obj({
    estimatedCount5km: N,
    saturation: { type: "STRING", enum: ["low", "medium", "high"] },
    competitorTypes: list(S),
    note: S,
  }),
  pricing: obj({
    strategy: S,
    purchasingPower: S,
    products: list(obj({ name: S, unit: S, minPrice: N, maxPrice: N, suggestedPrice: N })),
  }),
});

const STRATEGY_SCHEMA: GeminiSchema = obj({
  swot: obj({ strengths: list(S), weaknesses: list(S), opportunities: list(S), threats: list(S) }),
  threats: list(
    obj({
      type: { type: "STRING", enum: ["supply", "seasonal", "buyer", "competition", "price", "other"] },
      severity: { type: "STRING", enum: ["low", "medium", "high"] },
      title: S,
      detail: S,
      mitigation: S,
    })
  ),
  nextSteps: list(S),
  economics: obj({
    monthlyRevenue: N,
    costs: obj({ rawMaterials: N, wages: N, rent: N, utilities: N, transport: N, other: N }),
    workingCapitalMonths: N,
    assets: list(obj({ item: S, amount: N })),
  }),
});

function marketPrompt(language: LanguageCode): string {
  return `You are a rural market-research analyst in India preparing a hyper-local feasibility study for a first-time micro-entrepreneur.
Write every text field in ${languageName(language)}, in simple words. Numbers are plain numbers (no text). Money in INR.
Use the map data as evidence. Where it is missing, estimate from typical figures for this district/state (e.g. average village size, household size ~4.5) and stay conservative.
- summary: 2–3 sentences on whether this business fits this place.
- marketReach: population and households within 5 km and 10 km, who the customers are, realistic daily customers for a new unit of this size, and 3–4 distribution channels (e.g. weekly haat, door-to-door, local shops, dairy cooperative, online) with one-line details.
- opportunities: 3–4 unserved or underserved niches in this local economy for this sector.
- competition: estimated number of similar businesses within 5 km (at least the mapped count), saturation, 2–4 competitor types, one-line note.
- pricing: pricing strategy (2 sentences), local purchasing power (1 sentence), and 3–5 main products/services with local price range and a suggested launch price per unit.
Keep each text item under 30 words.`;
}

function strategyPrompt(language: LanguageCode): string {
  return `You are a small-business credit advisor in India. Using the study context, complete the feasibility study.
Write every text field in ${languageName(language)}, in simple words. Numbers are plain numbers. Money in INR.
- swot: 3 items per quadrant, specific to this business, budget and place.
- threats: 3–5 local risks, covering where relevant supply-chain bottlenecks, seasonal demand swings and dependence on a single buyer; each with severity and a practical mitigation.
- nextSteps: 4–5 concrete actions, including applying to the State Channelizing Agency under the named scheme.
- economics: realistic MONTHLY figures for this unit at full operation, sized to the project cost and to realistic local prices and customer numbers for this place:
  monthlyRevenue, costs (rawMaterials, wages, rent, utilities, transport, other — use 0 where not applicable; count the owner's own labour as 0 wages),
  workingCapitalMonths (1–3: months of costs to keep as stock/credit), and assets: 3–6 fixed items (equipment, animals, shed, fittings) with approximate costs that could be bought with this project cost.
Be conservative: do not assume full capacity in a crowded market. Keep each text item under 30 words.`;
}

// ──────────────────────────────────────────────
// Normalisation
// ──────────────────────────────────────────────

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown, max = 5) =>
  Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : [];
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

function normalizeCosts(raw: any): MonthlyCosts {
  return {
    rawMaterials: Math.round(num(raw?.rawMaterials)),
    wages: Math.round(num(raw?.wages)),
    rent: Math.round(num(raw?.rent)),
    utilities: Math.round(num(raw?.utilities)),
    transport: Math.round(num(raw?.transport)),
    other: Math.round(num(raw?.other)),
  };
}

/** Scale the AI's asset list so assets + working capital equal the project cost exactly. */
function buildCostBreakdown(rawAssets: unknown, assetsBudget: number, workingCapital: number, wcLabel: string): CostItem[] {
  const assets = (Array.isArray(rawAssets) ? rawAssets : [])
    .map((a: any) => ({ item: str(a?.item), amount: num(a?.amount) }))
    .filter((a) => a.item && a.amount > 0)
    .slice(0, 6);

  const items: CostItem[] = [];
  if (assetsBudget > 0) {
    const total = assets.reduce((s, a) => s + a.amount, 0);
    if (total > 0) {
      let allocated = 0;
      assets.forEach((a, i) => {
        const amount = i === assets.length - 1 ? assetsBudget - allocated : Math.round((a.amount / total) * assetsBudget);
        allocated += amount;
        items.push({ item: a.item, amount });
      });
    } else {
      items.push({ item: "—", amount: assetsBudget });
    }
  }
  if (workingCapital > 0) items.push({ item: wcLabel, amount: workingCapital, isWorkingCapital: true });
  return items;
}

// ──────────────────────────────────────────────
// Run
// ──────────────────────────────────────────────

export class StudyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudyError";
  }
}

export async function runStudy(
  input: StudyInput,
  ctx: StudyContext,
  onStep: (step: StudyStep) => void = () => {}
): Promise<Omit<Study, "id">> {
  const category = getCategory(input.categoryId);

  // 1–2. Locate and gather map data (best effort)
  onStep("locate");
  const coordinates = input.coordinates ?? (await geocode(input.place).catch(() => null));
  let local: LocalData | null = null;
  if (coordinates) {
    onStep("local");
    local = await fetchLocalData(coordinates, category).catch((error) => {
      console.warn("[Study] Local data unavailable:", error);
      return null;
    });
  }

  // 3. Financial structuring (deterministic)
  onStep("finance");
  const plan = computeFinancialPlan(input.marginCapital, input.desiredProjectCost);
  if (!plan) throw new StudyError("Margin capital is below the minimum");

  // 4–5. Market analysis and strategy + economics, in parallel to keep the wait short
  onStep("analysis");
  const context = contextBlock(input, plan, local, ctx);
  const [market, strategy] = await Promise.all([
    generateJson<any>({
      ...MODEL,
      system: marketPrompt(ctx.language),
      turns: [{ role: "user", text: context }],
      schema: MARKET_SCHEMA,
    }),
    generateJson<any>({
      ...MODEL,
      system: strategyPrompt(ctx.language),
      turns: [{ role: "user", text: context }],
      schema: STRATEGY_SCHEMA,
    }),
  ]);

  const mappedCompetitors = local?.competitorCount5km ?? 0;
  const report: FeasibilityReport = {
    summary: str(market.summary),
    marketReach: {
      population5km: Math.round(Math.max(num(market.marketReach?.population5km), local?.mappedPopulation5km ?? 0)),
      population10km: Math.round(Math.max(num(market.marketReach?.population10km), local?.mappedPopulation10km ?? 0)),
      households5km: Math.round(num(market.marketReach?.households5km)),
      targetCustomers: str(market.marketReach?.targetCustomers),
      dailyCustomers: Math.round(num(market.marketReach?.dailyCustomers)),
      channels: (Array.isArray(market.marketReach?.channels) ? market.marketReach.channels : [])
        .map((c: any) => ({ name: str(c?.name), detail: str(c?.detail) }))
        .filter((c: { name: string }) => c.name)
        .slice(0, 5),
    },
    opportunities: (Array.isArray(market.opportunities) ? market.opportunities : [])
      .map((o: any) => ({ title: str(o?.title), detail: str(o?.detail) }))
      .filter((o: { title: string }) => o.title)
      .slice(0, 5),
    competition: {
      estimatedCount5km: Math.round(Math.max(num(market.competition?.estimatedCount5km), mappedCompetitors)),
      saturation: oneOf(market.competition?.saturation, ["low", "medium", "high"] as const, "medium"),
      competitorTypes: strs(market.competition?.competitorTypes, 4),
      note: str(market.competition?.note),
    },
    pricing: {
      strategy: str(market.pricing?.strategy),
      purchasingPower: str(market.pricing?.purchasingPower),
      products: (Array.isArray(market.pricing?.products) ? market.pricing.products : [])
        .map((p: any) => {
          const min = num(p?.minPrice);
          const max = Math.max(num(p?.maxPrice), min);
          const suggested = Math.min(Math.max(num(p?.suggestedPrice, min), min), max || Infinity);
          return { name: str(p?.name), unit: str(p?.unit), minPrice: min, maxPrice: max, suggestedPrice: suggested };
        })
        .filter((p: { name: string }) => p.name)
        .slice(0, 5),
    },
    swot: {
      strengths: strs(strategy.swot?.strengths, 4),
      weaknesses: strs(strategy.swot?.weaknesses, 4),
      opportunities: strs(strategy.swot?.opportunities, 4),
      threats: strs(strategy.swot?.threats, 4),
    },
    threats: (Array.isArray(strategy.threats) ? strategy.threats : [])
      .map((t: any) => ({
        type: oneOf(t?.type, ["supply", "seasonal", "buyer", "competition", "price", "other"] as const, "other"),
        severity: oneOf(t?.severity, ["low", "medium", "high"] as const, "medium"),
        title: str(t?.title),
        detail: str(t?.detail),
        mitigation: str(t?.mitigation),
      }))
      .filter((t: { title: string }) => t.title)
      .slice(0, 5),
    nextSteps: strs(strategy.nextSteps, 5),
    economics: {
      monthlyRevenue: Math.round(num(strategy.economics?.monthlyRevenue)),
      costs: normalizeCosts(strategy.economics?.costs),
      workingCapitalMonths: num(strategy.economics?.workingCapitalMonths, 2),
    },
  };

  const operations = computeOperations(plan, report.economics, report.competition.saturation);
  const costBreakdown = buildCostBreakdown(
    strategy.economics?.assets,
    plan.projectCost - operations.workingCapital,
    operations.workingCapital,
    "__workingCapital__"
  );

  const now = Date.now();
  return {
    language: ctx.language,
    input: { ...input, coordinates },
    plan,
    local,
    report,
    operations,
    costBreakdown,
    createdAt: now,
    updatedAt: now,
  };
}
