/**
 * @fileoverview Printable feasibility report (PDF) for taking to the channelizing agency or bank.
 * Rendered from HTML by expo-print in the user's language, then handed to the share sheet.
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { TranslateFn } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import type { Study } from "../types/study";
import { formatINR, formatNumber } from "../utils/format";
import { placeLabel, studyTitle } from "../utils/study";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");

export function buildReportHtml(study: Study, t: TranslateFn, meta: { name: string; date: string }): string {
  const { plan, report, operations, costBreakdown, local } = study;
  const scheme = t(plan.scheme.id === "micro" ? "scheme.micro" : "scheme.term");
  const verdict = t(
    operations.riskLevel === "LOW_RISK" ? "report.verdictLow" : operations.riskLevel === "MODERATE_RISK" ? "report.verdictModerate" : "report.verdictHigh"
  );
  const kv = (label: string, value: string) => `<tr><td>${esc(label)}</td><td class="r">${esc(value)}</td></tr>`;
  const costLabel = (k: string) => t(`report.cost.${k}` as TranslationKey);

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: sans-serif; color: #1C1917; font-size: 11px; margin: 28px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; color: #B45309; border-bottom: 2px solid #F8921F; padding-bottom: 4px; margin: 20px 0 8px; }
  h3 { font-size: 12px; margin: 10px 0 4px; }
  .muted { color: #6B6560; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #F8921F; padding-bottom: 10px; }
  .score { font-size: 28px; font-weight: 800; color: #B45309; text-align: right; }
  .tiles { display: flex; gap: 8px; margin: 8px 0; }
  .tile { flex: 1; background: #FFF4E6; border-radius: 8px; padding: 8px; }
  .tile b { display: block; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  td, th { padding: 4px 6px; border-bottom: 1px solid #ECE8E3; text-align: left; vertical-align: top; }
  th { background: #F5F3F0; font-size: 10px; }
  .r { text-align: right; }
  .swot { display: flex; flex-wrap: wrap; gap: 8px; }
  .swot div { flex: 1 1 45%; background: #FAF8F5; border-radius: 6px; padding: 6px 8px; }
  ul { margin: 2px 0 2px 16px; padding: 0; }
  li { margin: 2px 0; }
  .note { background: #FFFBEB; padding: 6px 8px; border-radius: 6px; }
  .page-break { page-break-before: always; }
  .foot { margin-top: 18px; font-size: 9px; color: #6B6560; }
</style></head><body>
<div class="head">
  <div>
    <div class="muted">${esc(t("app.name"))} · ${esc(t("report.title"))}</div>
    <h1>${esc(studyTitle(study, t))}</h1>
    <div class="muted">${esc(placeLabel(study.input))}</div>
    <div class="muted">${esc(t("report.preparedFor", { name: meta.name, date: meta.date }))}</div>
  </div>
  <div><div class="score">${operations.score}/100</div><div class="r"><b>${esc(verdict)}</b></div></div>
</div>

<h2>${esc(t("report.summary"))}</h2>
<p>${esc(report.summary)}</p>
<div class="tiles">
  <div class="tile">${esc(t("calc.projectCost"))}<b>${formatINR(plan.projectCost)}</b></div>
  <div class="tile">${esc(t("calc.yourShare"))}<b>${formatINR(plan.contribution)}</b></div>
  <div class="tile">${esc(t("calc.loanAmount"))}<b>${formatINR(plan.loanAmount)}</b></div>
  <div class="tile">${esc(t("calc.quarterly"))}<b>${formatINR(plan.quarterlyInstalment)}</b></div>
</div>

<h2>${esc(t("report.marketReach"))}</h2>
<table>
  ${kv(t("report.pop5"), formatNumber(report.marketReach.population5km))}
  ${kv(t("report.pop10"), formatNumber(report.marketReach.population10km))}
  ${kv(t("report.households"), formatNumber(report.marketReach.households5km))}
  ${kv(t("report.dailyCustomers"), formatNumber(report.marketReach.dailyCustomers))}
</table>
${local ? `<p class="muted">${esc(t("report.villagesNearby", { count5: local.settlementCount5km, count10: local.settlementCount10km }))}${local.settlements.length ? ": " + esc(local.settlements.slice(0, 12).map((s) => `${s.name} (${s.distanceKm} km)`).join(", ")) : ""}</p>` : ""}
<h3>${esc(t("report.targetCustomers"))}</h3><p>${esc(report.marketReach.targetCustomers)}</p>
<h3>${esc(t("report.channels"))}</h3>${list(report.marketReach.channels.map((c) => `${c.name} — ${c.detail}`))}

<h2>${esc(t("report.opportunities"))}</h2>
${list(report.opportunities.map((o) => `${o.title} — ${o.detail}`))}

<h2>${esc(t("report.swot"))}</h2>
<div class="swot">
  <div><b>${esc(t("report.strengths"))}</b>${list(report.swot.strengths)}</div>
  <div><b>${esc(t("report.weaknesses"))}</b>${list(report.swot.weaknesses)}</div>
  <div><b>${esc(t("report.swotOpportunities"))}</b>${list(report.swot.opportunities)}</div>
  <div><b>${esc(t("report.swotThreats"))}</b>${list(report.swot.threats)}</div>
</div>

<h2>${esc(t("report.threats"))}</h2>
<table><tr><th></th><th>${esc(t("report.whatToDo"))}</th></tr>
${report.threats
  .map(
    (th) =>
      `<tr><td><b>${esc(th.title)}</b> <span class="muted">(${esc(t(`report.threat.${th.type}` as TranslationKey))} · ${esc(t(`report.severity.${th.severity}` as TranslationKey))})</span><br/>${esc(th.detail)}</td><td>${esc(th.mitigation)}</td></tr>`
  )
  .join("")}
</table>

<h2>${esc(t("report.competition"))}</h2>
<table>
  ${kv(t("report.saturation"), t(`report.sat${report.competition.saturation[0].toUpperCase()}${report.competition.saturation.slice(1)}` as TranslationKey))}
  ${kv(t("report.estimatedCompetitors"), formatNumber(report.competition.estimatedCount5km))}
  ${local ? kv(t("report.mappedCompetitors"), formatNumber(local.competitorCount5km)) : ""}
</table>
<p>${esc(report.competition.competitorTypes.join(", "))}</p>
<p>${esc(report.competition.note)}</p>

<h2>${esc(t("report.pricing"))}</h2>
<table><tr><th>${esc(t("report.product"))}</th><th class="r">${esc(t("report.localPrice"))}</th><th class="r">${esc(t("report.suggested"))}</th></tr>
${report.pricing.products.map((p) => `<tr><td>${esc(p.name)} <span class="muted">/ ${esc(p.unit)}</span></td><td class="r">${formatINR(p.minPrice)}–${formatINR(p.maxPrice)}</td><td class="r"><b>${formatINR(p.suggestedPrice)}</b></td></tr>`).join("")}
</table>
<p>${esc(report.pricing.strategy)}</p>
<p class="muted">${esc(t("report.purchasingPower"))}: ${esc(report.pricing.purchasingPower)}</p>

<div class="page-break"></div>
<h2>${esc(t("report.financing"))}</h2>
<table>
  ${kv(t("calc.scheme"), scheme)}
  ${kv(t("calc.projectCost"), formatINR(plan.projectCost))}
  ${kv(t("calc.yourShare"), formatINR(plan.contribution))}
  ${kv(t("calc.loanAmount"), `${formatINR(plan.loanAmount)} (${Math.round(plan.loanShare * 1000) / 10}%)`)}
  ${kv(t("calc.interest"), t("calc.perYear", { rate: plan.scheme.annualRate * 100 }))}
  ${kv(t("calc.tenure"), t("calc.years", { count: plan.scheme.tenureMonths / 12 }))}
  ${kv(t("calc.moratorium"), t("calc.moratoriumBody", { count: plan.scheme.moratoriumMonths }))}
  ${kv(t("calc.moratoriumInterest"), formatINR(plan.moratoriumInterest))}
  ${kv(t("calc.quarterly"), formatINR(plan.quarterlyInstalment))}
  ${kv(t("calc.totalInterest"), formatINR(plan.totalInterest))}
  ${kv(t("calc.totalRepay"), formatINR(plan.totalRepayment))}
</table>

<h2>${esc(t("report.costBreakdown"))}</h2>
<table>${costBreakdown
    .map((c) => kv(c.isWorkingCapital ? t("report.workingCapital", { months: operations.workingCapitalMonths }) : c.item, formatINR(c.amount)))
    .join("")}${kv(t("calc.projectCost"), formatINR(plan.projectCost))}</table>

<h2>${esc(t("report.operations"))}</h2>
<table>
  ${kv(t("report.revenue"), formatINR(operations.monthlyRevenue))}
  ${Object.entries(report.economics.costs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => kv(costLabel(k), formatINR(v)))
    .join("")}
  ${kv(t("report.opex"), formatINR(operations.monthlyCosts))}
  ${kv(t("report.surplus"), formatINR(operations.monthlySurplus))}
</table>
${operations.coverage !== null ? `<p class="note">${esc(t("report.coverageBody", { ratio: operations.coverage }))}</p>` : ""}

<h2>${esc(t("calc.schedule"))}</h2>
<p class="note">${esc(t("calc.moratoriumRow", { count: plan.scheme.moratoriumMonths, amount: formatINR(plan.moratoriumInterest) }))}</p>
<table><tr><th>${esc(t("calc.quarter"))}</th><th>${esc(t("calc.monthsCol"))}</th><th class="r">${esc(t("calc.interest"))}</th><th class="r">${esc(t("calc.principal"))}</th><th class="r">${esc(t("calc.instalment"))}</th><th class="r">${esc(t("calc.balance"))}</th></tr>
${plan.schedule.map((r) => `<tr><td>${r.quarter}</td><td>${r.fromMonth}–${r.toMonth}</td><td class="r">${formatINR(r.interest)}</td><td class="r">${formatINR(r.principal)}</td><td class="r"><b>${formatINR(r.instalment)}</b></td><td class="r">${formatINR(r.closing)}</td></tr>`).join("")}
</table>

<h2>${esc(t("report.nextSteps"))}</h2>
${list(report.nextSteps)}
<h3>${esc(t("scheme.whereToApply"))}</h3><p>${esc(t("scheme.sca"))}</p>
<h3>${esc(t("scheme.documents"))}</h3>${list([t("scheme.doc1"), t("scheme.doc2"), t("scheme.doc3"), t("scheme.doc4")])}

<p class="foot">${esc(t("report.disclaimer"))} ${esc(local ? t("report.dataSource") : t("report.noMapData"))}</p>
</body></html>`;
}

export async function shareReportPdf(study: Study, t: TranslateFn, meta: { name: string; date: string }): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(study, t, meta) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: t("report.sharePdf") });
  }
}
