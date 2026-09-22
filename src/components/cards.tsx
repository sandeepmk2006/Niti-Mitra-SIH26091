/**
 * List rows for History and Home: a feasibility study, and an advisor conversation.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { RiskBadge, SchemeBadge } from "./badges";
import { useI18n } from "../i18n/I18nContext";
import { getCategory } from "../services/categories";
import type { Session } from "../types/session";
import type { Study } from "../types/study";
import { formatDate, formatINR } from "../utils/format";
import { placeLabel, studyTitle } from "../utils/study";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

export function StudyCard({ study, onPress }: { study: Study; onPress: () => void }) {
  const { t, locale } = useI18n();
  const category = getCategory(study.input.categoryId);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={category.icon} size={20} color={Colors.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {studyTitle(study, t)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {placeLabel(study.input)}
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>{study.operations.score}</Text>
        </View>
      </View>

      <View style={styles.figures}>
        <View style={styles.figure}>
          <Text style={styles.figureLabel}>{t("calc.projectCost")}</Text>
          <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(study.plan.projectCost)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.figure}>
          <Text style={styles.figureLabel}>{t("calc.loanAmount")}</Text>
          <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(study.plan.loanAmount)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.figure}>
          <Text style={styles.figureLabel}>{t("calc.quarterly")}</Text>
          <Text style={styles.figureValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(study.plan.quarterlyInstalment)}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.badges}>
          <SchemeBadge scheme={study.plan.scheme.id} />
          <RiskBadge level={study.operations.riskLevel} />
        </View>
        <Text style={styles.date}>{formatDate(study.createdAt, locale)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function ConversationCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const { t, locale } = useI18n();
  const lastUser = [...session.messages].reverse().find((m) => m.role === "user")?.text ?? "";
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={session.studyId ? "document-text-outline" : "chatbubbles-outline"} size={20} color={Colors.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {session.title || t("history.untitled")}
          </Text>
          {lastUser ? (
            <Text style={styles.meta} numberOfLines={2}>
              {lastUser}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.meta}>{t("history.messages", { count: session.messages.length })}</Text>
        <Text style={styles.date}>{formatDate(session.updatedAt, locale)}</Text>
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
    gap: 12,
    ...Shadows.card,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1, lineHeight: 18 },
  score: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primaryText },
  figures: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  figure: { flex: 1, paddingHorizontal: 4, alignItems: "center" },
  figureLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600", textAlign: "center" },
  figureValue: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: Colors.border },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badges: { flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap" },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
});
