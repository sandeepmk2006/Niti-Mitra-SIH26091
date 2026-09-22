/**
 * Feasibility report — summary header, then two tabs: Market study (Module 1) and
 * Loan & finance (Module 2). Share as PDF, discuss with the advisor, or delete.
 */

import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { RiskBadge, SchemeBadge, riskColor } from "../../src/components/badges";
import { FinancePlanView } from "../../src/components/FinancePlanView";
import { MarketReportView } from "../../src/components/MarketReportView";
import { Bullets, KeyValue, Note, Section, Tile, TileRow } from "../../src/components/sections";
import { Button, EmptyState, FullScreenLoader, InlineError } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useChat } from "../../src/context/ChatContext";
import { useI18n } from "../../src/i18n/I18nContext";
import type { TranslationKey } from "../../src/i18n/translations/en";
import { deleteStudy, subscribeToStudy } from "../../src/services/HistoryService";
import { shareReportPdf } from "../../src/services/reportPdf";
import type { Study } from "../../src/types/study";
import { formatDate, formatINR } from "../../src/utils/format";
import { agencyKey, placeLabel, studyTitle } from "../../src/utils/study";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

export { ErrorFallback as ErrorBoundary } from "../../src/components/ErrorFallback";

type Tab = "market" | "finance";

const VERDICT: Record<Study["operations"]["riskLevel"], TranslationKey> = {
  LOW_RISK: "report.verdictLow",
  MODERATE_RISK: "report.verdictModerate",
  HIGH_RISK: "report.verdictHigh",
};

export default function StudyReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { startChatAboutStudy } = useChat();

  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("market");
  const [sharing, setSharing] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid || !id) return;
    return subscribeToStudy(
      uid,
      id,
      (s) => {
        setStudy(s);
        setLoading(false);
      },
      (err) => {
        console.warn("[Report] Subscription failed:", err.code);
        setLoading(false);
      }
    );
  }, [uid, id]);

  if (!user) return <Redirect href="/auth" />;
  if (loading) return <FullScreenLoader />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/history"));

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={goBack} style={styles.iconButton} accessibilityLabel={t("common.back")}>
        <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {t("report.title")}
      </Text>
      {study ? (
        <TouchableOpacity
          style={styles.iconButton}
          accessibilityLabel={t("session.delete")}
          onPress={() =>
            Alert.alert(t("report.deleteTitle"), t("report.deleteBody"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("session.delete"),
                style: "destructive",
                onPress: () => {
                  goBack();
                  deleteStudy(user.uid, study.id).catch((e) => console.warn("[Report] Delete failed:", e));
                },
              },
            ])
          }
        >
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );

  if (!study) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon="alert-circle-outline" title={t("report.notFound")} body="" />
      </View>
    );
  }

  const { operations, plan } = study;
  const title = studyTitle(study, t);
  const accent = riskColor(operations.riskLevel);

  const sharePdf = async () => {
    setSharing(true);
    setPdfError(false);
    try {
      await shareReportPdf(study, t, { name: user.fullName, date: formatDate(study.createdAt, locale) });
    } catch (error) {
      console.warn("[Report] PDF failed:", error);
      setPdfError(true);
    } finally {
      setSharing(false);
    }
  };

  const discuss = () => {
    startChatAboutStudy(study, title);
    router.navigate("/(tabs)/advisor");
  };

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <View style={[styles.hero, { borderTopColor: accent }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>{placeLabel(study.input)}</Text>
              <Text style={styles.meta}>{formatDate(study.createdAt, locale)}</Text>
            </View>
            <View style={[styles.scoreRing, { borderColor: accent }]}>
              <Text style={[styles.scoreValue, { color: accent }]}>{operations.score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
          </View>
          <Text style={[styles.verdict, { color: accent }]}>{t(VERDICT[operations.riskLevel])}</Text>
          <View style={styles.badges}>
            <RiskBadge level={operations.riskLevel} />
            <SchemeBadge scheme={plan.scheme.id} />
          </View>
          {study.report.summary ? <Text style={styles.summary}>{study.report.summary}</Text> : null}
          <TileRow>
            <Tile label={t("calc.projectCost")} value={formatINR(plan.projectCost)} />
            <Tile label={t("calc.loanAmount")} value={formatINR(plan.loanAmount)} />
            <Tile label={t("calc.quarterly")} value={formatINR(plan.quarterlyInstalment)} emphasis />
          </TileRow>
          <View style={styles.actions}>
            <Button label={t("report.sharePdf")} icon="share-outline" onPress={sharePdf} loading={sharing} style={{ flex: 1 }} />
            <Button label={t("tabs.advisor")} icon="chatbubbles-outline" variant="secondary" onPress={discuss} style={{ flex: 1 }} />
          </View>
          {pdfError ? <InlineError message={t("report.pdfFailed")} /> : null}
        </View>

        {/* Tabs */}
        <View style={styles.segment}>
          {(["market", "finance"] as Tab[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.segmentItem, tab === key && styles.segmentActive]}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
            >
              <Ionicons
                name={key === "market" ? "storefront-outline" : "wallet-outline"}
                size={16}
                color={tab === key ? Colors.primaryText : Colors.textSecondary}
              />
              <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>
                {t(key === "market" ? "report.tabMarket" : "report.tabFinance")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "market" ? (
          <MarketReportView study={study} />
        ) : (
          <View style={{ gap: 12 }}>
            {/* Operations: can the business carry the loan? */}
            <Section title={t("report.operations")} icon="pulse-outline">
              <TileRow>
                <Tile label={t("report.revenue")} value={formatINR(operations.monthlyRevenue)} />
                <Tile label={t("report.opex")} value={formatINR(operations.monthlyCosts)} />
                <Tile
                  label={t("report.surplus")}
                  value={formatINR(operations.monthlySurplus)}
                  tone={operations.monthlySurplus < 0 ? Colors.danger : Colors.success}
                />
              </TileRow>
              {operations.coverage !== null ? (
                <Note
                  tone={operations.riskLevel === "LOW_RISK" ? "neutral" : "warning"}
                  icon="shield-checkmark-outline"
                  text={`${t("report.coverage")}: ${t("report.coverageBody", { ratio: operations.coverage })}`}
                />
              ) : null}
              <View>
                <Text style={styles.subhead}>{t("report.monthlyCosts")}</Text>
                {Object.entries(study.report.economics.costs)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => (
                    <KeyValue key={k} label={t(`report.cost.${k}` as TranslationKey)} value={formatINR(v)} />
                  ))}
              </View>
            </Section>

            {/* Where the project money goes */}
            {study.costBreakdown.length > 0 ? (
              <Section title={t("report.costBreakdown")} icon="pie-chart-outline">
                <View>
                  {study.costBreakdown.map((c, i) => (
                    <KeyValue
                      key={i}
                      label={c.isWorkingCapital ? t("report.workingCapital", { months: operations.workingCapitalMonths }) : c.item}
                      value={formatINR(c.amount)}
                    />
                  ))}
                  <KeyValue label={t("calc.projectCost")} value={formatINR(plan.projectCost)} strong />
                </View>
              </Section>
            ) : null}

            <FinancePlanView plan={plan} showHow={false} />

            {/* Where to apply */}
            <Section title={t("scheme.whereToApply")} icon="business-outline">
              <Text style={styles.body}>{t("scheme.sca")}</Text>
              <Note text={t(agencyKey(user.preferences))} />
              <Text style={styles.subhead}>{t("scheme.documents")}</Text>
              <Bullets items={[t("scheme.doc1"), t("scheme.doc2"), t("scheme.doc3"), t("scheme.doc4")]} />
            </Section>
          </View>
        )}

        <Text style={styles.disclaimer}>{t("report.disclaimer")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 8,
    backgroundColor: Colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  content: { padding: 16, paddingBottom: Spacing.xxl, gap: 12 },

  hero: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 4,
    padding: Spacing.md,
    gap: 10,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  scoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: 24, fontWeight: "800", lineHeight: 28 },
  scoreMax: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  verdict: { fontSize: FontSize.lg, fontWeight: "800" },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  summary: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 10 },

  segment: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  segmentActive: { backgroundColor: Colors.surfacePrimary },
  segmentText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primaryText, fontWeight: "800" },

  subhead: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginTop: 4 },
  body: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 21 },
  disclaimer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", lineHeight: 17, paddingHorizontal: 12 },
});
