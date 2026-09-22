import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import type { RiskLevel, SchemeId } from "../services/schemeCalculator";
import { BorderRadius, Colors, FontSize } from "../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const RISK: Record<RiskLevel, { label: TranslationKey; color: string; tint: string; icon: IconName }> = {
  LOW_RISK: { label: "report.riskLow", color: Colors.success, tint: Colors.successMuted, icon: "shield-checkmark" },
  MODERATE_RISK: { label: "report.riskModerate", color: Colors.warning, tint: Colors.warningMuted, icon: "alert-circle" },
  HIGH_RISK: { label: "report.riskHigh", color: Colors.danger, tint: Colors.dangerMuted, icon: "warning" },
};

export function riskColor(level: RiskLevel): string {
  return (RISK[level] ?? RISK.MODERATE_RISK).color;
}

export function Pill({ label, color, tint, icon }: { label: string; color: string; tint: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: tint }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { t } = useI18n();
  const style = RISK[level] ?? RISK.MODERATE_RISK;
  return <Pill label={t(style.label)} color={style.color} tint={style.tint} icon={style.icon} />;
}

export function SchemeBadge({ scheme }: { scheme: SchemeId }) {
  const { t } = useI18n();
  return (
    <Pill
      label={t(scheme === "micro" ? "scheme.micro" : "scheme.term")}
      color={Colors.primaryText}
      tint={Colors.primarySoft}
      icon="business-outline"
    />
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  pillText: { fontSize: FontSize.xs, fontWeight: "700", letterSpacing: 0.2, flexShrink: 1 },
});
