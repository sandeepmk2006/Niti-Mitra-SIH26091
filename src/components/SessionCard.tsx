/**
 * One row in History / Home recent activity.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { RiskBadge, StageBadge } from "./badges";
import { useI18n } from "../i18n/I18nContext";
import type { Session } from "../types/session";
import { formatDate, formatINR } from "../utils/format";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

export function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const { t, locale } = useI18n();
  const report = session.report;
  const preview =
    session.draft?.summary ||
    [...session.messages].reverse().find((m) => m.role === "user")?.text ||
    "";

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <StageBadge stage={session.stage} />
        <Text style={styles.date}>{formatDate(session.updatedAt, locale)}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {session.title || t("history.untitled")}
      </Text>
      {preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}

      {report ? (
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{report.score}</Text>
            <Text style={styles.metricLabel}>{t("report.score")}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
              {report.financials.flags.includes("missingRevenue")
                ? t("common.notAvailable")
                : formatINR(report.financials.monthlyProfit)}
            </Text>
            <Text style={styles.metricLabel}>{t("report.monthlyProfit")}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.metric, { alignItems: "center" }]}>
            <RiskBadge level={report.financials.riskLevel} />
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.footerText}>{t("history.messages", { count: session.messages.length })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 8,
    ...Shadows.card,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  title: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, lineHeight: 22 },
  preview: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  metrics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  metric: { flex: 1, paddingHorizontal: 4 },
  metricValue: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  metricLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600", textAlign: "center" },
  divider: { width: 1, height: 28, backgroundColor: Colors.border },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
