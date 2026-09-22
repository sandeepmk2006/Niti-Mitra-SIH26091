/**
 * The final evaluation report produced by "Proceed".
 */

import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { RiskBadge, riskColor } from "./badges";
import { useI18n } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import { LOAN_INTEREST_RATE, LOAN_TENURE_YEARS } from "../services/financials";
import type { EvaluationReport, SchemeMatch, SchemeStatus } from "../types/session";
import { formatINR, formatNumber, formatPercent } from "../utils/format";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const SCHEME_DESCRIPTION: Record<SchemeMatch["id"], TranslationKey> = {
  pmVishwakarma: "scheme.pmVishwakarma.desc",
  pmDaksh: "scheme.pmDaksh.desc",
  nsfdc: "scheme.nsfdc.desc",
};

const SCHEME_STATUS: Record<SchemeStatus, { label: TranslationKey; color: string; tint: string; icon: IconName }> = {
  eligible: { label: "report.eligible", color: Colors.success, tint: Colors.successMuted, icon: "checkmark-circle" },
  notEligible: { label: "report.notEligible", color: Colors.textMuted, tint: Colors.surfaceSecondary, icon: "close-circle" },
  needsInfo: { label: "report.needsInfo", color: Colors.warning, tint: Colors.warningMuted, icon: "help-circle" },
};

const SCHEME_ORDER: Record<SchemeStatus, number> = { eligible: 0, needsInfo: 1, notEligible: 2 };

export function ReportView({ report }: { report: EvaluationReport }) {
  const { t } = useI18n();
  const f = report.financials;
  const na = t("common.notAvailable");
  const accent = riskColor(f.riskLevel);

  // Without a price/revenue, "profit" would just be minus the costs — show N/A, not a fake loss.
  const noRevenue = f.flags.includes("missingRevenue");
  const metrics: { label: string; value: string; tone?: string }[] = [
    {
      label: t("report.monthlyProfit"),
      value: noRevenue ? na : formatINR(f.monthlyProfit),
      tone: noRevenue ? undefined : f.monthlyProfit < 0 ? Colors.danger : Colors.success,
    },
    { label: t("report.margin"), value: formatPercent(f.profitMargin, na) },
    { label: t("report.dscr"), value: f.dscr === null ? t("report.noDebt") : `${f.dscr.toFixed(2)}×` },
    {
      label: t("report.breakEven"),
      value: f.breakEvenUnits === null ? na : t("report.unitsPerMonth", { units: formatNumber(f.breakEvenUnits) }),
    },
    {
      label: t("report.payback"),
      value: f.paybackMonths === null ? na : t("report.months", { count: f.paybackMonths }),
    },
  ];

  const schemes = [...report.schemes].sort((a, b) => SCHEME_ORDER[a.status] - SCHEME_ORDER[b.status]);

  return (
    <View style={styles.container}>
      {/* Score */}
      <View style={styles.hero}>
        <View style={styles.labelRow}>
          <Ionicons name="ribbon" size={14} color={Colors.primaryText} />
          <Text style={styles.label}>{t("report.label")}</Text>
        </View>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreRing, { borderColor: accent }]}>
            <Text style={[styles.scoreValue, { color: accent }]}>{report.score}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={styles.scoreText}>
            <Text style={styles.scoreCaption}>{t("report.score")}</Text>
            {report.verdict ? <Text style={styles.verdict}>{report.verdict}</Text> : null}
            <RiskBadge level={f.riskLevel} />
          </View>
        </View>
        {report.summary ? <Text style={styles.summary}>{report.summary}</Text> : null}
      </View>

      {/* Key numbers */}
      <Section title={t("report.metrics")} icon="stats-chart">
        <View style={styles.metricsGrid}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.metric}>
              <Text style={[styles.metricValue, m.tone ? { color: m.tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
                {m.value}
              </Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
        {f.newLoanEmi > 0 ? (
          <Text style={styles.note}>
            {t("report.loanAssumption", { rate: LOAN_INTEREST_RATE * 100, years: LOAN_TENURE_YEARS })}
          </Text>
        ) : null}
      </Section>

      {f.flags.length > 0 ? (
        <Section title={t("report.warnings")} icon="warning" tone={Colors.warning}>
          {f.flags.map((flag) => (
            <Bullet key={flag} text={t(`flag.${flag}` as TranslationKey)} color={Colors.warning} />
          ))}
        </Section>
      ) : null}

      <ListSection title={t("report.strengths")} icon="trending-up" items={report.strengths} color={Colors.success} />
      <ListSection title={t("report.risks")} icon="alert-circle" items={report.risks} color={Colors.danger} />
      <ListSection title={t("report.nextSteps")} icon="footsteps" items={report.nextSteps} color={Colors.primary} numbered />

      {/* Schemes */}
      <Section title={t("report.schemes")} icon="business">
        <View style={{ gap: 10 }}>
          {schemes.map((scheme) => (
            <SchemeRow key={scheme.id} scheme={scheme} />
          ))}
        </View>
      </Section>

      <Text style={styles.disclaimer}>{t("report.disclaimer")}</Text>
    </View>
  );
}

function SchemeRow({ scheme }: { scheme: SchemeMatch }) {
  const { t } = useI18n();
  const status = SCHEME_STATUS[scheme.status];
  return (
    <View style={[styles.scheme, scheme.status === "eligible" && styles.schemeEligible]}>
      <View style={styles.schemeHeader}>
        <Text style={styles.schemeName}>{scheme.name}</Text>
        <View style={[styles.statusPill, { backgroundColor: status.tint }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{t(status.label)}</Text>
        </View>
      </View>
      <Text style={styles.schemeDesc}>{t(SCHEME_DESCRIPTION[scheme.id])}</Text>
      <Text style={styles.schemeReason}>{t(scheme.reasonKey, scheme.reasonParams)}</Text>
      <View style={styles.schemeFooter}>
        {scheme.maxAmount ? (
          <Text style={styles.schemeAmount}>{t("report.upTo", { amount: formatINR(scheme.maxAmount) })}</Text>
        ) : (
          <View />
        )}
        <TouchableOpacity
          onPress={() => Linking.openURL(scheme.portalUrl).catch(() => {})}
          hitSlop={8}
          style={styles.portalLink}
        >
          <Text style={styles.portalText}>{t("report.visitPortal")}</Text>
          <Ionicons name="open-outline" size={13} color={Colors.primaryText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Section({
  title,
  icon,
  tone = Colors.textPrimary,
  children,
}: {
  title: string;
  icon: IconName;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={tone} />
        <Text style={[styles.sectionTitle, { color: tone }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ListSection({
  title,
  icon,
  items,
  color,
  numbered = false,
}: {
  title: string;
  icon: IconName;
  items: string[];
  color: string;
  numbered?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <Section title={title} icon={icon}>
      {items.map((item, index) => (
        <Bullet key={index} text={item} color={color} marker={numbered ? String(index + 1) : undefined} />
      ))}
    </Section>
  );
}

function Bullet({ text, color, marker }: { text: string; color: string; marker?: string }) {
  return (
    <View style={styles.bulletRow}>
      {marker ? (
        <View style={[styles.numberBadge, { backgroundColor: Colors.primarySoft }]}>
          <Text style={styles.numberText}>{marker}</Text>
        </View>
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  hero: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    padding: Spacing.md,
    gap: 12,
    ...Shadows.card,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: {
    fontSize: FontSize.xs,
    fontWeight: "800",
    color: Colors.primaryText,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  scoreRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundSubtle,
  },
  scoreValue: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  scoreMax: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  scoreText: { flex: 1, gap: 6 },
  scoreCaption: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "700", letterSpacing: 0.4 },
  verdict: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, lineHeight: 22 },
  summary: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },

  section: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
    ...Shadows.card,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: "800" },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 2,
  },
  metricValue: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  note: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 17 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  numberBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.primaryText },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 21 },

  scheme: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
  },
  schemeEligible: { borderColor: Colors.success, backgroundColor: Colors.successMuted },
  schemeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  schemeName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, flexShrink: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: "700" },
  schemeDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  schemeReason: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 19, fontWeight: "600" },
  schemeFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  schemeAmount: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.success },
  portalLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  portalText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },

  disclaimer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: Spacing.md,
  },
});
