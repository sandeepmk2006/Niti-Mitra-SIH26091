import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useI18n } from "../i18n/I18nContext";
import type { TranslationKey } from "../i18n/translations/en";
import type { RiskLevel } from "../types/evaluation";
import type { SessionStage } from "../types/session";
import { BorderRadius, Colors, FontSize } from "../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const RISK: Record<RiskLevel, { label: TranslationKey; color: string; tint: string; icon: IconName }> = {
  LOW_RISK: { label: "report.riskLow", color: Colors.success, tint: Colors.successMuted, icon: "shield-checkmark" },
  MODERATE_RISK: { label: "report.riskModerate", color: Colors.warning, tint: Colors.warningMuted, icon: "alert-circle" },
  HIGH_RISK: { label: "report.riskHigh", color: Colors.danger, tint: Colors.dangerMuted, icon: "warning" },
};

const STAGE: Record<SessionStage, { label: TranslationKey; color: string; tint: string; icon: IconName }> = {
  chatting: { label: "history.stageChat", color: Colors.info, tint: Colors.infoMuted, icon: "chatbubbles" },
  drafted: { label: "history.stageDraft", color: Colors.warning, tint: Colors.warningMuted, icon: "document-text" },
  evaluated: { label: "history.stageEvaluated", color: Colors.success, tint: Colors.successMuted, icon: "checkmark-done" },
};

export function riskColor(level: RiskLevel): string {
  return RISK[level].color;
}

function Pill({ label, color, tint, icon }: { label: string; color: string; tint: string; icon: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={12} color={color} />
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

export function StageBadge({ stage }: { stage: SessionStage }) {
  const { t } = useI18n();
  const style = STAGE[stage] ?? STAGE.chatting;
  return <Pill label={t(style.label)} color={style.color} tint={style.tint} icon={style.icon} />;
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
  },
  pillText: { fontSize: FontSize.xs, fontWeight: "700", letterSpacing: 0.2 },
});
