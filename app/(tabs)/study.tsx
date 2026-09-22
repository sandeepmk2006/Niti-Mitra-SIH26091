/**
 * New feasibility study — a four-step wizard for the three inputs the analysis needs
 * (business category, location, margin capital), then a progress screen while the study runs.
 * On success the report opens at /study/[id].
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";

import { SchemeBadge } from "../../src/components/badges";
import { MoneyInput, QUICK_AMOUNTS } from "../../src/components/MoneyInput";
import { Button, InlineError } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useStudies } from "../../src/hooks/useSessions";
import { useI18n } from "../../src/i18n/I18nContext";
import type { TranslationKey } from "../../src/i18n/translations/en";
import { CATEGORIES, CategoryId, OTHER_CATEGORY, getCategory } from "../../src/services/categories";
import { StudyStep, runStudy } from "../../src/services/FeasibilityService";
import { Coordinates, PlaceNames, reverseGeocode } from "../../src/services/geo";
import { newDocumentId, saveStudy } from "../../src/services/HistoryService";
import { MIN_MARGIN, computeFinancialPlan } from "../../src/services/schemeCalculator";
import { formatINR } from "../../src/utils/format";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

const EMPTY_PLACE: PlaceNames = { village: "", block: "", district: "", state: "" };
const STEPS = 4;

const PROGRESS: { step: StudyStep; label: TranslationKey }[] = [
  { step: "locate", label: "study.progLocate" },
  { step: "local", label: "study.progLocal" },
  { step: "finance", label: "study.progFinance" },
  { step: "analysis", label: "study.progAnalysis" },
];

type GpsState = "idle" | "locating" | "found" | "denied" | "failed";

export default function StudyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { studies } = useStudies();
  const params = useLocalSearchParams<{ margin?: string }>();

  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [detail, setDetail] = useState("");
  const [place, setPlace] = useState<PlaceNames>(EMPTY_PLACE);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [gps, setGps] = useState<GpsState>("idle");
  const [margin, setMargin] = useState<number | null>(null);
  const [running, setRunning] = useState<StudyStep | null>(null);
  const [failed, setFailed] = useState(false);

  // Pre-fill the location from the last study — most users plan in the same village.
  const lastPlace = studies[0]?.input.place;
  useEffect(() => {
    if (lastPlace && !place.village && !place.district) setPlace(lastPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPlace]);

  // Arriving from the calculator carries the margin amount.
  useEffect(() => {
    const incoming = Number(params.margin);
    if (Number.isFinite(incoming) && incoming > 0) setMargin(incoming);
  }, [params.margin]);

  const plan = useMemo(() => (margin ? computeFinancialPlan(margin) : null), [margin]);

  const updatePlace = (key: keyof PlaceNames, value: string) => {
    setPlace((p) => ({ ...p, [key]: value }));
    // Typed names may no longer match the GPS fix; geocode them instead.
    if (key === "village" || key === "district") setCoords(null);
  };

  const useGps = async () => {
    setGps("locating");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setGps("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: position.coords.latitude, lon: position.coords.longitude };
      const names = await reverseGeocode(c);
      if (names) setPlace(names);
      setCoords(c);
      setGps("found");
    } catch (error) {
      console.warn("[Study] GPS failed:", error);
      setGps("failed");
    }
  };

  const canContinue =
    (step === 0 && categoryId !== null && (categoryId !== "other" || detail.trim().length > 1)) ||
    (step === 1 && (place.village.trim() || coords) && (place.district.trim() || coords)) ||
    (step === 2 && plan !== null) ||
    step === 3;

  const generate = async () => {
    if (!user || !categoryId || !margin) return;
    setFailed(false);
    setRunning("locate");
    try {
      const result = await runStudy(
        {
          categoryId,
          categoryDetail: detail.trim(),
          place: {
            village: place.village.trim(),
            block: place.block.trim(),
            district: place.district.trim(),
            state: place.state.trim(),
          },
          coordinates: coords,
          marginCapital: margin,
          desiredProjectCost: null,
        },
        { language, fullName: user.fullName, preferences: user.preferences },
        setRunning
      );
      const id = newDocumentId(user.uid, "studies");
      // The local write is visible to the report's listener immediately, even before it syncs.
      saveStudy(user.uid, { id, ...result }).catch((error) => console.warn("[Study] Save failed:", error));
      setRunning(null);
      setStep(0);
      setCategoryId(null);
      setDetail("");
      router.push({ pathname: "/study/[id]", params: { id } });
    } catch (error) {
      console.warn("[Study] Failed:", error);
      setRunning(null);
      setFailed(true);
    }
  };

  // ── Progress screen ──
  if (running) {
    const current = PROGRESS.findIndex((p) => p.step === running);
    return (
      <View style={[styles.progress, { paddingTop: insets.top + Spacing.xl }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.progressTitle}>{t("study.progressTitle")}</Text>
        <Text style={styles.progressBody}>{t("study.progressBody")}</Text>
        <View style={styles.progressList}>
          {PROGRESS.map((p, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <View key={p.step} style={styles.progressRow}>
                <Ionicons
                  name={done ? "checkmark-circle" : active ? "ellipse" : "ellipse-outline"}
                  size={22}
                  color={done ? Colors.success : active ? Colors.primary : Colors.borderStrong}
                />
                <Text style={[styles.progressLabel, (done || active) && styles.progressLabelActive]}>{t(p.label)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t("study.title")}</Text>
        <Text style={styles.stepText}>{t("study.step", { current: step + 1, total: STEPS })}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${((step + 1) / STEPS) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Text style={styles.question}>{t("study.categoryQ")}</Text>
            <View style={styles.grid}>
              {[...CATEGORIES, OTHER_CATEGORY].map((c) => {
                const active = categoryId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.categoryCard, active && styles.categoryActive]}
                    onPress={() => setCategoryId(c.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={c.icon} size={24} color={active ? Colors.textInverse : Colors.primaryText} />
                    <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]} numberOfLines={2}>
                      {t(c.label)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {categoryId ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {categoryId === "other" ? t("study.detailRequired") : t("study.detailLabel")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={detail}
                  onChangeText={setDetail}
                  placeholder={t("study.detailPlaceholder")}
                  placeholderTextColor={Colors.textMuted}
                  maxLength={120}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.question}>{t("study.locationQ")}</Text>
            <Text style={styles.hint}>{t("study.locationHint")}</Text>
            <TouchableOpacity style={styles.gps} onPress={useGps} disabled={gps === "locating"} activeOpacity={0.8}>
              {gps === "locating" ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Ionicons name={gps === "found" ? "checkmark-circle" : "locate"} size={20} color={Colors.primaryText} />
              )}
              <Text style={styles.gpsText}>{gps === "locating" ? t("study.locating") : t("study.useGps")}</Text>
            </TouchableOpacity>
            {gps === "found" ? <Text style={styles.gpsNote}>{t("study.gpsFound")}</Text> : null}
            {gps === "denied" ? <InlineError message={t("study.gpsDenied")} /> : null}
            {gps === "failed" ? <InlineError message={t("study.gpsFailed")} /> : null}
            {(["village", "block", "district", "state"] as const).map((key) => (
              <View key={key} style={styles.field}>
                <Text style={styles.fieldLabel}>{t(`study.${key}`)}</Text>
                <TextInput
                  style={styles.input}
                  value={place[key]}
                  onChangeText={(v) => updatePlace(key, v)}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.question}>{t("study.capitalQ")}</Text>
            <Text style={styles.hint}>{t("study.capitalHint")}</Text>
            <MoneyInput value={margin} onChange={setMargin} quickAmounts={QUICK_AMOUNTS} large />
            {margin !== null && !plan ? (
              <Text style={styles.warn}>{t("calc.minMargin", { amount: formatINR(MIN_MARGIN) })}</Text>
            ) : null}
            {plan ? (
              <View style={styles.preview}>
                <View style={styles.previewRow}>
                  <Preview label={t("calc.projectCost")} value={formatINR(plan.projectCost)} />
                  <Preview label={t("calc.loanAmount")} value={formatINR(plan.loanAmount)} />
                </View>
                <View style={styles.previewRow}>
                  <SchemeBadge scheme={plan.scheme.id} />
                  <Text style={styles.previewMeta}>
                    {t("calc.quarterly")}: {formatINR(plan.quarterlyInstalment)}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 3 && categoryId && plan ? (
          <>
            <Text style={styles.question}>{t("study.review")}</Text>
            <ReviewRow
              icon={getCategory(categoryId).icon}
              label={t("study.business")}
              value={[categoryId === "other" ? "" : t(getCategory(categoryId).label), detail.trim()].filter(Boolean).join(" — ")}
              onEdit={() => setStep(0)}
            />
            <ReviewRow
              icon="location-outline"
              label={t("study.location")}
              value={[place.village, place.block, place.district, place.state].filter(Boolean).join(", ")}
              onEdit={() => setStep(1)}
            />
            <ReviewRow
              icon="wallet-outline"
              label={t("study.capital")}
              value={`${formatINR(margin)} → ${formatINR(plan.projectCost)} (${t(plan.scheme.id === "micro" ? "scheme.micro" : "scheme.term")})`}
              onEdit={() => setStep(2)}
            />
            {failed ? <InlineError message={t("study.failed")} /> : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t("prefs.back")}
          icon="arrow-back"
          variant="secondary"
          disabled={step === 0}
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          style={{ flex: 1 }}
        />
        {step < STEPS - 1 ? (
          <Button
            label={t("prefs.next")}
            icon="arrow-forward"
            disabled={!canContinue}
            onPress={() => setStep((s) => s + 1)}
            style={{ flex: 1.4 }}
          />
        ) : (
          <Button label={t("study.generate")} icon="sparkles" onPress={generate} style={{ flex: 1.4 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

function ReviewRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.review}>
      <View style={styles.reviewIcon}>
        <Ionicons name={icon} size={20} color={Colors.primaryText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <Text style={styles.reviewValue}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={10}>
        <Text style={styles.edit}>{t("common.edit")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  stepText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceSecondary, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  content: { padding: 20, paddingBottom: Spacing.xl, gap: 12 },
  question: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, lineHeight: 30 },
  hint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  warn: { fontSize: FontSize.sm, color: Colors.warning },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 92,
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
    gap: 8,
    justifyContent: "space-between",
  },
  categoryActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, lineHeight: 18 },
  categoryLabelActive: { color: Colors.textInverse },

  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfacePrimary,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  gps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
  },
  gpsText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primaryText },
  gpsNote: { fontSize: FontSize.sm, color: Colors.success },

  preview: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    padding: 14,
    gap: 10,
  },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  previewLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  previewValue: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  previewMeta: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },

  review: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },
  reviewIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  reviewValue: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginTop: 2 },
  edit: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },

  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },

  progress: { flex: 1, alignItems: "center", paddingHorizontal: 28, gap: 10, backgroundColor: Colors.background },
  progressTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, marginTop: Spacing.md, textAlign: "center" },
  progressBody: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  progressList: { alignSelf: "stretch", gap: 16, marginTop: Spacing.lg },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textMuted },
  progressLabelActive: { color: Colors.textPrimary, fontWeight: "700" },
});
