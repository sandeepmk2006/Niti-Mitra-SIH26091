/**
 * Preferences questionnaire — one question per screen, tap an option (or type your own).
 *
 * Shown once right after sign-up (the tabs layout redirects here while `user.preferences` is null)
 * and reopened from Settings to edit. In edit mode the first step is the app language, and picking
 * a new one switches the UI immediately, so the remaining questions appear in that language.
 */

import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";

import { LanguageList } from "../src/components/LanguageList";
import { Logo } from "../src/components/Logo";
import { Button, InlineError } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useI18n } from "../src/i18n/I18nContext";
import {
  PREFERENCE_QUESTIONS,
  PreferenceAnswers,
  PreferenceQuestion,
  otherAnswer,
  parseAnswer,
} from "../src/services/preferences";
import { BorderRadius, Colors, FontSize, Spacing } from "../src/constants/theme";

type Step = { kind: "language" } | { kind: "question"; question: PreferenceQuestion };

export default function PreferencesScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { t, language, setLanguage } = useI18n();

  const isOnboarding = user?.preferences === null;
  const steps = useMemo<Step[]>(
    () => [
      // Onboarding already asked for the language on the very first screen.
      ...(isOnboarding ? [] : [{ kind: "language" } as Step]),
      ...PREFERENCE_QUESTIONS.map((question) => ({ kind: "question", question }) as Step),
    ],
    [isOnboarding]
  );

  const [answers, setAnswers] = useState<PreferenceAnswers>(() => user?.preferences ?? {});
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of PREFERENCE_QUESTIONS) {
      const { otherText } = parseAnswer(user?.preferences?.[q.id]);
      if (otherText) initial[q.id] = otherText;
    }
    return initial;
  });
  const [otherOpen, setOtherOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(typing).map((id) => [id, true]))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  if (!user) return <Redirect href="/auth" />;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const finish = async (final: PreferenceAnswers) => {
    setSaving(true);
    setSaveError(false);
    try {
      await updateProfile({ preferences: final });
      if (isOnboarding || !router.canGoBack()) router.replace("/(tabs)");
      else router.back();
    } catch (error) {
      console.warn("[Preferences] Save failed:", error);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const goNext = (next: PreferenceAnswers = answers) => {
    if (isLast) void finish(next);
    else setIndex((i) => i + 1);
  };

  const choose = (question: PreferenceQuestion, optionId: string) => {
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    setOtherOpen((o) => ({ ...o, [question.id]: false }));
    goNext(next);
  };

  const commitTyped = (question: PreferenceQuestion) => {
    const text = typing[question.id]?.trim();
    const next = { ...answers };
    if (text) next[question.id] = otherAnswer(text);
    setAnswers(next);
    goNext(next);
  };

  const skip = () => goNext(answers);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top bar: progress + close (edit mode) */}
      <View style={styles.topBar}>
        <Logo size={36} badge />
        <View style={{ flex: 1 }}>
          <Text style={styles.progressText}>
            {t("prefs.progress", { current: index + 1, total: steps.length })}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
          </View>
        </View>
        {!isOnboarding ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel={t("common.cancel")}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {index === 0 ? (
          <View style={styles.intro}>
            <Text style={styles.title}>{t("prefs.title")}</Text>
            <Text style={styles.subtitle}>{t("prefs.subtitle")}</Text>
          </View>
        ) : null}

        {step.kind === "language" ? (
          <>
            <Text style={styles.question}>{t("settings.chooseLanguage")}</Text>
            <LanguageList
              selected={language}
              onSelect={async (code) => {
                await setLanguage(code);
                setIndex((i) => i + 1);
              }}
            />
          </>
        ) : (
          <QuestionStep
            question={step.question}
            selected={parseAnswer(answers[step.question.id]).optionId}
            otherOpen={!!otherOpen[step.question.id]}
            otherText={typing[step.question.id] ?? ""}
            onChoose={(id) => choose(step.question, id)}
            onOpenOther={() => setOtherOpen((o) => ({ ...o, [step.question.id]: true }))}
            onChangeOther={(text) => setTyping((v) => ({ ...v, [step.question.id]: text }))}
            onSubmitOther={() => commitTyped(step.question)}
          />
        )}

        <Text style={styles.privacy}>
          <Ionicons name="lock-closed" size={12} color={Colors.textMuted} /> {t("prefs.privacy")}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        {saveError ? <InlineError message={t("prefs.saveError")} /> : null}
        <View style={styles.footerRow}>
          <Button
            label={t("prefs.back")}
            icon="arrow-back"
            variant="secondary"
            disabled={index === 0 || saving}
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
            style={{ flex: 1 }}
          />
          {step.kind === "question" && otherOpen[step.question.id] && typing[step.question.id]?.trim() ? (
            <Button
              label={isLast ? t("prefs.finish") : t("prefs.next")}
              icon={isLast ? "checkmark" : "arrow-forward"}
              loading={saving}
              onPress={() => commitTyped(step.question)}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label={isLast ? t("prefs.finish") : t("prefs.skip")}
              icon={isLast ? "checkmark" : "play-skip-forward-outline"}
              variant={isLast ? "primary" : "secondary"}
              loading={saving}
              onPress={skip}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function QuestionStep({
  question,
  selected,
  otherOpen,
  otherText,
  onChoose,
  onOpenOther,
  onChangeOther,
  onSubmitOther,
}: {
  question: PreferenceQuestion;
  selected: string | null;
  otherOpen: boolean;
  otherText: string;
  onChoose: (optionId: string) => void;
  onOpenOther: () => void;
  onChangeOther: (text: string) => void;
  onSubmitOther: () => void;
}) {
  const { t } = useI18n();
  return (
    <View>
      <Text style={styles.question}>{t(question.question)}</Text>
      {question.description ? <Text style={styles.description}>{t(question.description)}</Text> : null}

      <View style={styles.options}>
        {question.options.map((option, index) => {
          const active = selected === option.id && !otherOpen;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onChoose(option.id)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.optionIndex, active && styles.optionIndexActive]}>
                {active ? (
                  <Ionicons name="checkmark" size={14} color={Colors.textInverse} />
                ) : (
                  <Text style={styles.optionIndexText}>{index + 1}</Text>
                )}
              </View>
              <Text style={styles.optionLabel}>{t(option.label)}</Text>
            </TouchableOpacity>
          );
        })}

        {question.allowOther ? (
          otherOpen ? (
            <View style={[styles.option, styles.optionActive, styles.otherBox]}>
              <Ionicons name="create-outline" size={18} color={Colors.primaryText} />
              <TextInput
                style={styles.otherInput}
                value={otherText}
                onChangeText={onChangeOther}
                placeholder={t("prefs.otherPlaceholder")}
                placeholderTextColor={Colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSubmitOther}
              />
            </View>
          ) : (
            <TouchableOpacity onPress={onOpenOther} style={[styles.option, styles.otherButton]} activeOpacity={0.7}>
              <View style={styles.optionIndex}>
                <Ionicons name="create-outline" size={14} color={Colors.primaryText} />
              </View>
              <Text style={[styles.optionLabel, { color: Colors.textSecondary }]}>{t("prefs.other")}</Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceSecondary, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },

  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  intro: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  question: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, lineHeight: 31, marginBottom: 6 },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  options: { gap: 10, marginTop: Spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },
  optionActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  optionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIndexActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionIndexText: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primaryText },
  optionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary },
  otherButton: { borderStyle: "dashed" },
  otherBox: { gap: 10 },
  otherInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, paddingVertical: 4 },

  privacy: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginTop: Spacing.lg },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  footerRow: { flexDirection: "row", gap: 10 },
});
