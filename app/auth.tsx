/**
 * @fileoverview Auth Screen — Registration & login with name, 10-digit mobile number and 6-digit
 * passcode. Second step of onboarding; once `user` is set the screen redirects to the tabs.
 */

import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";

import { Button, InlineError } from "../src/components/ui";
import { Logo } from "../src/components/Logo";
import { useAuth } from "../src/context/AuthContext";
import { useI18n } from "../src/i18n/I18nContext";
import { getLanguage } from "../src/i18n/languages";
import type { TranslationKey } from "../src/i18n/translations/en";
import { AuthError, AuthErrorReason } from "../src/services/AuthService";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../src/constants/theme";

const AUTH_ERROR_KEYS: Record<AuthErrorReason, TranslationKey> = {
  "phone-in-use": "auth.errPhoneInUse",
  "invalid-credentials": "auth.errInvalidCredentials",
  network: "auth.errNetwork",
  "too-many-requests": "auth.errTooMany",
  unknown: "auth.errGeneric",
};

export default function AuthScreen() {
  const router = useRouter();
  const { user, login, signUp } = useAuth();
  const { t, language, isReady, hasChosenLanguage } = useI18n();

  const [mode, setMode] = useState<"login" | "register">("register");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  if (user) return <Redirect href="/(tabs)" />;
  if (isReady && !hasChosenLanguage) return <Redirect href="/language" />;

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setErrorKey(null);
  };

  const handleSubmit = async () => {
    setErrorKey(null);
    if (mode === "register" && !fullName.trim()) return setErrorKey("auth.errName");
    if (phoneNumber.length !== 10) return setErrorKey("auth.errPhone");
    if (!/^\d{6}$/.test(passcode)) return setErrorKey("auth.errPasscode");

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await signUp(fullName, phoneNumber, passcode);
      } else {
        await login(phoneNumber, passcode);
      }
      // AuthContext now has a user; the <Redirect> above takes over on re-render.
    } catch (err: unknown) {
      setErrorKey(err instanceof AuthError ? AUTH_ERROR_KEYS[err.reason] : "auth.errGeneric");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.languageChip} onPress={() => router.push("/language")}>
              <Ionicons name="language" size={16} color={Colors.primaryText} />
              <Text style={styles.languageChipText}>{getLanguage(language).nativeName}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <Logo size={84} />
            <Text style={styles.title}>
              {mode === "register" ? t("auth.registerTitle") : t("auth.loginTitle")}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "register" ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}
            </Text>
          </View>

          <View style={styles.segment}>
            {(["register", "login"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
                onPress={() => switchMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === "register" ? t("auth.registerTab") : t("auth.loginTab")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.card}>
            {errorKey ? <InlineError message={t(errorKey)} /> : null}

            {mode === "register" && (
              <Field label={t("auth.fullName")}>
                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder={t("auth.fullNamePlaceholder")}
                  placeholderTextColor={Colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  textContentType="name"
                />
              </Field>
            )}

            <Field label={t("auth.mobile")}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(v) => setPhoneNumber(v.replace(/\D/g, ""))}
                textContentType="telephoneNumber"
              />
            </Field>

            <Field label={t("auth.passcode")} hint={t("auth.passcodeHint")}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="••••••"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                secureTextEntry={!showPasscode}
                maxLength={6}
                value={passcode}
                onChangeText={(v) => setPasscode(v.replace(/\D/g, ""))}
              />
              <TouchableOpacity onPress={() => setShowPasscode((s) => !s)} hitSlop={8}>
                <Ionicons
                  name={showPasscode ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </Field>

            <Button
              label={mode === "register" ? t("auth.createAccount") : t("auth.logIn")}
              icon="arrow-forward"
              loading={isSubmitting}
              onPress={handleSubmit}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  topBar: { flexDirection: "row", justifyContent: "flex-end", marginBottom: Spacing.md },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  languageChipText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },
  header: { alignItems: "center", marginBottom: Spacing.lg },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: Spacing.md,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  segmentItem: { flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: BorderRadius.md },
  segmentItemActive: { backgroundColor: Colors.surfacePrimary, ...Shadows.card },
  segmentText: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primaryText, fontWeight: "700" },
  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadows.card,
  },
  field: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  prefix: { borderRightWidth: 1, borderRightColor: Colors.border, paddingRight: Spacing.sm },
  prefixText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.base },
  input: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted },
});
