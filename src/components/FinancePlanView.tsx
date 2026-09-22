/**
 * Module 2 output: financial structuring, scheme routing, EMI & moratorium, quarterly schedule.
 * Used by the standalone calculator and the report's Finance tab.
 */

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SchemeBadge } from "./badges";
import { Bullets, KeyValue, Note, Section, Tile, TileRow } from "./sections";
import { useI18n } from "../i18n/I18nContext";
import { FinancialPlan, MIN_MARGIN } from "../services/schemeCalculator";
import { formatINR } from "../utils/format";
import { BorderRadius, Colors, FontSize } from "../constants/theme";

const PREVIEW_ROWS = 4;

export function FinancePlanView({ plan, showHow = true }: { plan: FinancialPlan; showHow?: boolean }) {
  const { t } = useI18n();
  const schemeName = t(plan.scheme.id === "micro" ? "scheme.micro" : "scheme.term");
  const loanPercent = Math.round(plan.loanShare * 1000) / 10;

  return (
    <View style={{ gap: 12 }}>
      {/* Structure */}
      <Section title={t("report.financing")} icon="wallet-outline">
        <TileRow>
          <Tile label={t("calc.projectCost")} value={formatINR(plan.projectCost)} emphasis />
          <Tile label={t("calc.yourShare")} value={formatINR(plan.contribution)} caption={`${Math.round((100 - loanPercent) * 10) / 10}%`} />
          <Tile label={t("calc.loanAmount")} value={formatINR(plan.loanAmount)} caption={t("calc.loanPercent", { percent: loanPercent })} />
        </TileRow>
        <ShareBar loanShare={plan.loanShare} />
        {plan.notes.includes("capApplied") ? (
          <Note
            tone="warning"
            text={t("calc.capApplied", {
              scheme: schemeName,
              amount: formatINR(plan.scheme.maxLoan),
              project: formatINR(plan.projectCost),
            })}
          />
        ) : null}
        {plan.notes.includes("aboveMax") ? (
          <Note
            tone="warning"
            text={t("calc.aboveMax", {
              max: formatINR(plan.scheme.maxProjectCost),
              margin: formatINR(plan.contribution),
              surplus: formatINR(plan.surplusCapital),
            })}
          />
        ) : null}
        {plan.notes.includes("projectTooBig") ? (
          <Note tone="warning" text={t("calc.projectTooBig", { margin: formatINR(plan.marginCapital), max: formatINR(plan.maxProjectCost) })} />
        ) : null}
        {!plan.notes.includes("aboveMax") && plan.surplusCapital > 0 ? (
          <Note text={t("calc.smallerProject", { surplus: formatINR(plan.surplusCapital) })} />
        ) : null}
      </Section>

      {/* Scheme */}
      <Section title={t("calc.scheme")} icon="business-outline" badge={<SchemeBadge scheme={plan.scheme.id} />}>
        <Text style={styles.rule}>{t(plan.scheme.id === "micro" ? "scheme.microRule" : "scheme.termRule")}</Text>
        <View>
          <KeyValue label={t("calc.interest")} value={t("calc.perYear", { rate: plan.scheme.annualRate * 100 })} />
          <KeyValue label={t("calc.tenure")} value={t("calc.years", { count: plan.scheme.tenureMonths / 12 })} />
          <KeyValue
            label={t("calc.moratorium")}
            value={t("calc.moratoriumBody", { count: plan.scheme.moratoriumMonths })}
          />
        </View>
      </Section>

      {/* Repayment */}
      <Section title={t("calc.quarterly")} icon="calendar-outline">
        <View style={styles.instalment}>
          <Text style={styles.instalmentValue}>{formatINR(plan.quarterlyInstalment)}</Text>
          <Text style={styles.instalmentCaption}>{t("calc.instalments", { count: plan.repaymentQuarters })}</Text>
        </View>
        <Bullets
          items={[
            t("calc.monthlySave", { amount: formatINR(plan.monthlySetAside) }),
            t("calc.firstPayment", { month: plan.firstInstalmentMonth }),
          ]}
        />
        <View>
          <KeyValue label={t("calc.moratoriumInterest")} value={formatINR(plan.moratoriumInterest)} />
          <KeyValue label={t("calc.totalInterest")} value={formatINR(plan.totalInterest)} />
          <KeyValue label={t("calc.totalRepay")} value={formatINR(plan.totalRepayment)} strong />
        </View>
      </Section>

      <ScheduleTable plan={plan} />

      {showHow ? (
        <Section title={t("calc.howTitle")} icon="help-circle-outline">
          <Bullets numbered items={[t("calc.how1"), t("calc.how2"), t("calc.how3"), t("calc.how4")]} />
          <Text style={styles.min}>{t("calc.minMargin", { amount: formatINR(MIN_MARGIN) })}</Text>
        </Section>
      ) : null}
    </View>
  );
}

function ShareBar({ loanShare }: { loanShare: number }) {
  return (
    <View style={styles.bar}>
      <View style={[styles.barOwn, { flex: 1 - loanShare }]} />
      <View style={[styles.barLoan, { flex: loanShare }]} />
    </View>
  );
}

export function ScheduleTable({ plan }: { plan: FinancialPlan }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? plan.schedule : plan.schedule.slice(0, PREVIEW_ROWS);

  return (
    <Section title={t("calc.schedule")} icon="list-outline">
      <Text style={styles.moratoriumRow}>
        {t("calc.moratoriumRow", {
          count: plan.scheme.moratoriumMonths,
          amount: formatINR(plan.moratoriumInterest),
        })}
      </Text>
      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.cell, styles.cellQ, styles.thText]}>{t("calc.quarter")}</Text>
          <Text style={[styles.cell, styles.thText]}>{t("calc.interest")}</Text>
          <Text style={[styles.cell, styles.thText]}>{t("calc.principal")}</Text>
          <Text style={[styles.cell, styles.thText]}>{t("calc.instalment")}</Text>
          <Text style={[styles.cell, styles.thText]}>{t("calc.balance")}</Text>
        </View>
        {rows.map((row) => (
          <View key={row.quarter} style={[styles.tr, row.quarter % 2 === 0 && styles.trAlt]}>
            <View style={[styles.cell, styles.cellQ]}>
              <Text style={styles.qNum}>{row.quarter}</Text>
              <Text style={styles.qMonths}>
                {row.fromMonth}–{row.toMonth}
              </Text>
            </View>
            <Text style={styles.cell}>{formatINR(row.interest)}</Text>
            <Text style={styles.cell}>{formatINR(row.principal)}</Text>
            <Text style={[styles.cell, styles.cellStrong]}>{formatINR(row.instalment)}</Text>
            <Text style={styles.cell}>{formatINR(row.closing)}</Text>
          </View>
        ))}
      </View>
      {plan.schedule.length > PREVIEW_ROWS ? (
        <TouchableOpacity style={styles.toggle} onPress={() => setExpanded((e) => !e)}>
          <Text style={styles.toggleText}>{expanded ? t("calc.showLess") : t("calc.showAll")}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.primaryText} />
        </TouchableOpacity>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  barOwn: { backgroundColor: Colors.primaryText },
  barLoan: { backgroundColor: Colors.primaryBorder },
  rule: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  instalment: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  instalmentValue: { fontSize: 30, fontWeight: "800", color: Colors.primaryText },
  instalmentCaption: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  min: { fontSize: FontSize.xs, color: Colors.textMuted },

  moratoriumRow: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    backgroundColor: Colors.warningMuted,
    padding: 10,
    borderRadius: BorderRadius.md,
    lineHeight: 19,
  },
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 6 },
  trAlt: { backgroundColor: Colors.backgroundSubtle },
  th: { backgroundColor: Colors.surfaceSecondary },
  thText: { fontWeight: "700", color: Colors.textSecondary },
  cell: { flex: 1, fontSize: 11, color: Colors.textPrimary, textAlign: "right" },
  cellQ: { flex: 0.7, textAlign: "left" },
  cellStrong: { fontWeight: "800", color: Colors.primaryText },
  qNum: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary },
  qMonths: { fontSize: 10, color: Colors.textMuted },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 },
  toggleText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },
});
