/**
 * Edit profile — change the display name (saved to /users/{uid}); the mobile number is the login
 * identity and is shown read-only. Links through to the preferences questionnaire.
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
import { useAuth } from "../src/context/AuthContext";
import { useI18n } from "../src/i18n/I18nContext";
import { PREFERENCE_QUESTIONS, countAnswered } from "../src/services/preferences";
import { BorderRadius, Colors, FontSize, Spacing } from "../src/constants/theme";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "invalid">("idle");

  if (!user) return <Redirect href="/auth" />;

  const dirty = fullName.trim() !== user.fullName;

  const save = async () => {
    if (!fullName.trim()) {
      setStatus("invalid");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ fullName });
      setStatus("saved");
    } catch (error) {
      console.warn("[Profile] Save failed:", error);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("profile.title")}</Text>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(fullName.trim() || "?").slice(0, 1).toUpperCase()}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("auth.fullName")}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  setStatus("idle");
                }}
                placeholder={t("auth.fullNamePlaceholder")}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                textContentType="name"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("auth.mobile")}</Text>
            <View style={[styles.inputWrapper, styles.inputLocked]}>
              <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
              <Text style={[styles.input, { color: Colors.textSecondary }]}>+91 {user.phoneNumber}</Text>
              <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
            </View>
            <Text style={styles.hint}>{t("profile.phoneLocked")}</Text>
          </View>

          <TouchableOpacity style={styles.prefsRow} onPress={() => router.push("/preferences")} activeOpacity={0.7}>
            <View style={styles.prefsIcon}>
              <Ionicons name="options-outline" size={18} color={Colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefsTitle}>{t("settings.editPreferences")}</Text>
              <Text style={styles.prefsBody}>
                {t("settings.prefsAnswered", {
                  count: countAnswered(user.preferences),
                  total: PREFERENCE_QUESTIONS.length,
                })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {status === "saved" ? (
            <View style={styles.saved}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.savedText}>{t("profile.saved")}</Text>
            </View>
          ) : null}
          {status === "error" ? <InlineError message={t("profile.saveError")} /> : null}
          {status === "invalid" ? <InlineError message={t("auth.errName")} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button label={t("profile.save")} icon="checkmark" loading={saving} disabled={!dirty} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  avatar: {
    alignSelf: "center",
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: Colors.textInverse },
  field: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputLocked: { backgroundColor: Colors.surfaceSecondary, borderColor: Colors.border },
  input: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.base },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  prefsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
  },
  prefsIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfacePrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  prefsTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  prefsBody: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  saved: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successMuted,
    borderRadius: BorderRadius.md,
    padding: 12,
  },
  savedText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600" },
  footer: { padding: Spacing.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
});
