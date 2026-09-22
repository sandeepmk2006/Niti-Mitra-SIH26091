/**
 * The drafted idea shown after "Evaluate", with Proceed / Refine actions.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "./ui";
import { useI18n } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import type { IdeaDraft } from "../types/session";
import { formatINR, formatNumber } from "../utils/format";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

interface DraftCardProps {
  draft: IdeaDraft;
  /** Omit both actions to render read-only (e.g. in History). */
  onProceed?: () => void;
  onRefine?: () => void;
  evaluating?: boolean;
}

export function DraftCard({ draft, onProceed, onRefine, evaluating = false }: DraftCardProps) {
  const { t } = useI18n();
  const notProvided = t("draft.notProvided");
  // Without revenue the evaluation can only show costs, so steer the user back to the chat first.
  const noRevenue =
    draft.monthlyRevenue === null && (draft.pricePerUnit === null || draft.expectedMonthlyUnits === null);

  const rows: { label: TranslationKey; value: string | null }[] = [
    { label: "draft.location", value: draft.location },
    { label: "draft.customers", value: draft.targetCustomers },
    { label: "draft.price", value: draft.pricePerUnit !== null ? formatINR(draft.pricePerUnit) : null },
    { label: "draft.unitCost", value: draft.variableCostPerUnit !== null ? formatINR(draft.variableCostPerUnit) : null },
    { label: "draft.monthlyUnits", value: draft.expectedMonthlyUnits !== null ? formatNumber(draft.expectedMonthlyUnits) : null },
    { label: "draft.monthlyRevenue", value: draft.monthlyRevenue !== null ? formatINR(draft.monthlyRevenue) : null },
    { label: "draft.fixedCosts", value: draft.monthlyFixedCosts !== null ? formatINR(draft.monthlyFixedCosts) : null },
    { label: "draft.investment", value: draft.startupInvestment !== null ? formatINR(draft.startupInvestment) : null },
    { label: "draft.loan", value: draft.loanRequired !== null ? formatINR(draft.loanRequired) : null },
    { label: "draft.existingEmi", value: draft.existingMonthlyEmi !== null ? formatINR(draft.existingMonthlyEmi) : null },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Ionicons name="document-text" size={14} color={Colors.primaryText} />
        <Text style={styles.label}>{t("draft.label")}</Text>
      </View>
      <Text style={styles.title}>{draft.title}</Text>
      {draft.summary ? <Text style={styles.summary}>{draft.summary}</Text> : null}

      <View style={styles.table}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{t(row.label)}</Text>
            <Text style={[styles.rowValue, row.value === null && styles.rowMissing]}>
              {row.value ?? notProvided}
            </Text>
          </View>
        ))}
      </View>

      <BulletSection icon="bulb-outline" title={t("draft.assumptions")} items={draft.assumptions} />
      <BulletSection icon="help-circle-outline" title={t("draft.missing")} items={draft.missingInfo} tone="warning" />

      {onProceed || onRefine ? (
        <View style={styles.actions}>
          {noRevenue ? (
            <View style={styles.warning}>
              <Ionicons name="alert-circle" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>{t("flag.missingRevenue")}</Text>
            </View>
          ) : null}
          {onProceed ? (
            <Button
              label={evaluating ? t("draft.running") : t("draft.proceed")}
              icon="arrow-forward"
              variant={noRevenue ? "secondary" : "primary"}
              loading={evaluating}
              onPress={onProceed}
            />
          ) : null}
          {onRefine ? (
            <Button
              label={t("draft.refine")}
              icon="create-outline"
              variant={noRevenue ? "primary" : "secondary"}
              disabled={evaluating}
              onPress={onRefine}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function BulletSection({
  icon,
  title,
  items,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  items: string[];
  tone?: "neutral" | "warning";
}) {
  if (items.length === 0) return null;
  const color = tone === "warning" ? Colors.warning : Colors.textSecondary;
  return (
    <View style={[styles.section, tone === "warning" && styles.sectionWarning]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      {items.map((item, index) => (
        <Text key={index} style={styles.bullet}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
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
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  summary: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  table: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    marginTop: Spacing.xs,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.md, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  rowValue: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, textAlign: "right" },
  rowMissing: { color: Colors.textMuted, fontWeight: "500", fontStyle: "italic" },
  section: {
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
    padding: 12,
    gap: 4,
  },
  sectionWarning: { backgroundColor: Colors.warningMuted },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "700" },
  bullet: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  actions: { gap: 10, marginTop: Spacing.sm },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.warningMuted,
  },
  warningText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, lineHeight: 19 },
});
