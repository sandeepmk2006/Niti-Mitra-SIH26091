/**
 * Home — entry points to the three tools (feasibility study, calculator, advisor), a live quick
 * loan check, and the user's recent studies.
 */

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { SchemeBadge } from "../../src/components/badges";
import { StudyCard } from "../../src/components/cards";
import { Logo } from "../../src/components/Logo";
import { MoneyInput } from "../../src/components/MoneyInput";
import { Button, SectionLabel } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useStudies } from "../../src/hooks/useSessions";
import { useI18n } from "../../src/i18n/I18nContext";
import { computeFinancialPlan } from "../../src/services/schemeCalculator";
import { formatINR } from "../../src/utils/format";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../../src/constants/theme";

const RECENT_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const { studies, loading } = useStudies();
  const [margin, setMargin] = useState<number | null>(50_000);
  const plan = useMemo(() => (margin ? computeFinancialPlan(margin) : null), [margin]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Logo size={44} badge />
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} numberOfLines={1}>
            {t("home.greeting", { name: user?.fullName ?? "" })}
          </Text>
          <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/settings")}
          style={styles.settings}
          accessibilityRole="button"
          accessibilityLabel={t("settings.title")}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Feasibility study */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="analytics" size={24} color={Colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t("home.studyTitle")}</Text>
        </View>
        <Text style={styles.heroBody}>{t("home.studyBody")}</Text>
        <View style={styles.steps}>
          {(["home.step1", "home.step2", "home.step3"] as const).map((key, i) => (
            <View key={key} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{t(key)}</Text>
            </View>
          ))}
        </View>
        <Button label={t("home.studyCta")} icon="add-circle-outline" onPress={() => router.navigate("/(tabs)/study")} />
      </View>

      {/* Quick loan check */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="calculator-outline" size={20} color={Colors.primaryText} />
          <Text style={styles.cardTitle}>{t("home.calcTitle")}</Text>
        </View>
        <Text style={styles.cardBody}>{t("home.calcBody")}</Text>
        <MoneyInput value={margin} onChange={setMargin} />
        {plan ? (
          <View style={styles.quick}>
            <View style={styles.quickRow}>
              <Quick label={t("calc.projectCost")} value={formatINR(plan.projectCost)} />
              <Quick label={t("calc.loanAmount")} value={formatINR(plan.loanAmount)} />
              <Quick label={t("calc.quarterly")} value={formatINR(plan.quarterlyInstalment)} />
            </View>
            <SchemeBadge scheme={plan.scheme.id} />
          </View>
        ) : null}
        <Button
          label={t("home.calcCta")}
          icon="arrow-forward"
          variant="secondary"
          onPress={() =>
            router.navigate(margin ? { pathname: "/(tabs)/calculator", params: { margin: String(margin) } } : "/(tabs)/calculator")
          }
        />
      </View>

      {/* Advisor */}
      <TouchableOpacity style={[styles.card, styles.advisor]} activeOpacity={0.8} onPress={() => router.navigate("/(tabs)/advisor")}>
        <View style={styles.advisorIcon}>
          <Ionicons name="chatbubbles" size={22} color={Colors.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t("home.advisorTitle")}</Text>
          <Text style={styles.cardBody}>{t("home.advisorBody")}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Recent studies */}
      <View style={styles.sectionHeader}>
        <SectionLabel>{t("home.recentStudies")}</SectionLabel>
        {studies.length > RECENT_COUNT ? (
          <TouchableOpacity onPress={() => router.navigate("/(tabs)/history")} hitSlop={8}>
            <Text style={styles.seeAll}>{t("home.seeAll")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!loading && studies.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={20} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{t("home.noStudies")}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {studies.slice(0, RECENT_COUNT).map((study) => (
            <StudyCard key={study.id} study={study} onPress={() => router.push({ pathname: "/study/[id]", params: { id: study.id } })} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Quick({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: Spacing.xxl, gap: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  settings: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 4,
    borderTopColor: Colors.primary,
    padding: 18,
    gap: 12,
    ...Shadows.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  heroBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  steps: { gap: 8 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.primaryText },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },

  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
    ...Shadows.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  quick: { backgroundColor: Colors.primarySoft, borderRadius: BorderRadius.md, padding: 12, gap: 10 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  quickValue: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginTop: 2 },

  advisor: { flexDirection: "row", alignItems: "center", gap: 12 },
  advisorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 },
  seeAll: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.borderStrong,
  },
  emptyText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
});
