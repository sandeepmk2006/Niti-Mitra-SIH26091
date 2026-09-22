/**
 * Settings — account (edit profile), saved preferences, language (live-switches the whole UI),
 * read-aloud, and support links. Opened from the Home header.
 */

import React, { useEffect, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";

import { ApiKeyModal } from "../src/components/ApiKeyModal";
import { LanguageList } from "../src/components/LanguageList";
import { ReviewModal } from "../src/components/ReviewModal";
import { Button, SectionLabel } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useSettings } from "../src/context/SettingsContext";
import { useI18n } from "../src/i18n/I18nContext";
import { getLanguage, LanguageCode } from "../src/i18n/languages";
import { hasOverride, maskKey } from "../src/services/apiKey";
import { AppReview, getReview, submitReview } from "../src/services/ReviewService";
import { PREFERENCE_QUESTIONS, PreferenceId, countAnswered, parseAnswer } from "../src/services/preferences";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../src/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Preferences shown as a summary on this screen. */
const SUMMARY: { id: PreferenceId; icon: IconName }[] = [
  { id: "location", icon: "location-outline" },
  { id: "occupation", icon: "briefcase-outline" },
  { id: "income", icon: "wallet-outline" },
  { id: "savings", icon: "cash-outline" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { settings, updateSettings } = useSettings();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState<AppReview | null>(null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  // Re-render the row after the key changes in the modal.
  const [keyVersion, setKeyVersion] = useState(0);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    getReview(uid)
      .then(setReview)
      .catch((error) => console.warn("[Settings] Could not load review:", error));
  }, [uid]);

  if (!user) return <Redirect href="/auth" />;

  const comingSoon = () => Alert.alert(t("common.comingSoon"), t("common.comingSoonBody"));

  const selectLanguage = async (code: LanguageCode) => {
    await setLanguage(code);
    setLanguageOpen(false);
  };

  const confirmLogout = () => {
    Alert.alert(t("settings.logoutConfirmTitle"), t("settings.logoutConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("settings.logout"), style: "destructive", onPress: () => void logout() },
    ]);
  };

  const answerLabel = (id: PreferenceId): string | null => {
    const question = PREFERENCE_QUESTIONS.find((q) => q.id === id);
    const { optionId, otherText } = parseAnswer(user.preferences?.[id]);
    const option = question?.options.find((o) => o.id === optionId);
    return option ? t(option.label) : otherText;
  };
  const summary = SUMMARY.map((s) => ({ ...s, value: answerLabel(s.id) })).filter((s) => s.value);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  void keyVersion;

  const sendReview = async (rating: number, comment: string) => {
    const stored = await submitReview(user.uid, { name: user.fullName, rating, comment, language, appVersion: version });
    setReview(stored);
    setReviewOpen(false);
    Alert.alert(t("review.thanks"));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={styles.iconButton}
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <TouchableOpacity style={styles.profile} activeOpacity={0.8} onPress={() => router.push("/profile")}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.fullName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.fullName}</Text>
            <Text style={styles.profilePhone}>+91 {user.phoneNumber}</Text>
          </View>
          <View style={styles.editChip}>
            <Ionicons name="create-outline" size={14} color={Colors.primaryText} />
            <Text style={styles.editChipText}>{t("settings.editProfile")}</Text>
          </View>
        </TouchableOpacity>

        {/* Saved preferences */}
        <SectionLabel>{t("settings.yourPreferences")}</SectionLabel>
        <View style={styles.group}>
          {summary.length > 0 ? (
            <View style={styles.summary}>
              {summary.map((item) => (
                <View key={item.id} style={styles.summaryChip}>
                  <Ionicons name={item.icon} size={14} color={Colors.primaryText} />
                  <Text style={styles.summaryText} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Row
            icon="options-outline"
            label={t("settings.editPreferences")}
            subtitle={t("settings.prefsAnswered", { count: countAnswered(user.preferences), total: PREFERENCE_QUESTIONS.length })}
            onPress={() => router.push("/preferences")}
            last
          />
        </View>

        {/* App preferences */}
        <SectionLabel>{t("settings.preferences")}</SectionLabel>
        <View style={styles.group}>
          <Row
            icon="language-outline"
            label={t("settings.language")}
            value={getLanguage(language).nativeName}
            onPress={() => setLanguageOpen(true)}
          />
          <Row
            icon="volume-medium-outline"
            label={t("settings.readAloud")}
            subtitle={t("settings.readAloudBody")}
            right={
              <Switch
                value={settings.readAloud}
                onValueChange={(readAloud) => updateSettings({ readAloud })}
                trackColor={{ true: Colors.primary, false: Colors.borderStrong }}
                thumbColor={Colors.surfacePrimary}
              />
            }
          />
          <Row
            icon="notifications-outline"
            label={t("settings.notifications")}
            subtitle={t("settings.notificationsBody")}
            right={
              <Switch
                value={settings.notifications}
                onValueChange={(notifications) => updateSettings({ notifications })}
                trackColor={{ true: Colors.primary, false: Colors.borderStrong }}
                thumbColor={Colors.surfacePrimary}
              />
            }
            last
          />
        </View>

        <SectionLabel>{t("settings.support")}</SectionLabel>
        <View style={styles.group}>
          <Row
            icon={review ? "star" : "star-outline"}
            label={t("review.row")}
            subtitle={review ? t("review.rowDone", { stars: review.rating }) : t("review.rowBody")}
            onPress={review ? undefined : () => setReviewOpen(true)}
          />
          <Row icon="help-buoy-outline" label={t("settings.help")} onPress={comingSoon} />
          <Row icon="shield-checkmark-outline" label={t("settings.privacy")} onPress={comingSoon} />
          <Row icon="document-text-outline" label={t("settings.terms")} onPress={comingSoon} />
          <Row
            icon="key-outline"
            label={t("apikey.row")}
            subtitle={hasOverride() ? t("apikey.custom", { masked: maskKey() }) : t("apikey.default")}
            onPress={() => setApiKeyOpen(true)}
          />
          <Row icon="information-circle-outline" label={t("settings.about")} value={t("settings.version", { version })} last />
        </View>

        <Button label={t("settings.logout")} icon="log-out-outline" variant="danger" onPress={confirmLogout} />
      </ScrollView>

      <ApiKeyModal
        visible={apiKeyOpen}
        onClose={() => setApiKeyOpen(false)}
        onChanged={() => setKeyVersion((v) => v + 1)}
      />

      <ReviewModal visible={reviewOpen} onClose={() => setReviewOpen(false)} onSubmit={sendReview} />

      <Modal visible={languageOpen} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setLanguageOpen(false)}>
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("settings.chooseLanguage")}</Text>
            <TouchableOpacity onPress={() => setLanguageOpen(false)} hitSlop={10} accessibilityLabel={t("common.cancel")}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
            <LanguageList selected={language} onSelect={selectLanguage} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Row({
  icon,
  label,
  subtitle,
  value,
  right,
  onPress,
  last = false,
}: {
  icon: IconName;
  label: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={Colors.primaryText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /> : null}
    </View>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : (
    content
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
  content: { padding: 20, paddingBottom: Spacing.xxl },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textInverse },
  profileName: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  profilePhone: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  editChipText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primaryText },

  group: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: "hidden",
    ...Shadows.card,
  },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: Spacing.md, paddingBottom: 4 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary, flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: Spacing.md, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  rowSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  rowValue: { maxWidth: "45%", fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },

  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
});
