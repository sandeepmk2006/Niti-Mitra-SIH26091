/**
 * Smart Financial Calculator & Scheme Router — margin money in, full loan plan out. Pure
 * computation: works offline and updates as the user types.
 */

import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FinancePlanView } from "../../src/components/FinancePlanView";
import { MoneyInput, QUICK_AMOUNTS } from "../../src/components/MoneyInput";
import { Button, EmptyState, ScreenHeader } from "../../src/components/ui";
import { useI18n } from "../../src/i18n/I18nContext";
import { MIN_MARGIN, computeFinancialPlan } from "../../src/services/schemeCalculator";
import { formatINR } from "../../src/utils/format";
import { Colors, FontSize, Spacing } from "../../src/constants/theme";

export default function CalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ margin?: string }>();

  const [margin, setMargin] = useState<number | null>(100_000);
  const [project, setProject] = useState<number | null>(null);

  // Arriving from Home's quick check carries the amount the user already typed.
  useEffect(() => {
    const incoming = Number(params.margin);
    if (Number.isFinite(incoming) && incoming > 0) {
      setMargin(incoming);
      setProject(null);
    }
  }, [params.margin]);

  const plan = useMemo(() => (margin ? computeFinancialPlan(margin, project) : null), [margin, project]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={t("calc.title")} subtitle={t("calc.subtitle")} />

        <View style={styles.inputs}>
          <Text style={styles.label}>{t("calc.marginLabel")}</Text>
          <Text style={styles.hint}>{t("calc.marginHint")}</Text>
          <MoneyInput value={margin} onChange={setMargin} quickAmounts={QUICK_AMOUNTS} large />

          <Text style={[styles.label, { marginTop: Spacing.md }]}>{t("calc.projectLabel")}</Text>
          <Text style={styles.hint}>{t("calc.projectHint")}</Text>
          <MoneyInput value={project} onChange={setProject} placeholder={plan ? String(plan.maxProjectCost) : "0"} />
        </View>

        {plan ? (
          <>
            <FinancePlanView plan={plan} />
            <Button
              label={t("calc.startStudy")}
              icon="analytics-outline"
              onPress={() =>
                router.navigate({ pathname: "/(tabs)/study", params: { margin: String(plan.marginCapital) } })
              }
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : (
          <EmptyState
            icon="calculator-outline"
            title={t("calc.enterAmount")}
            body={t("calc.minMargin", { amount: formatINR(MIN_MARGIN) })}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: Spacing.xxl },
  inputs: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 4,
  },
  label: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6 },
});
