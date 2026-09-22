/**
 * Language selection — the first screen on a fresh install, and reachable from the auth screen.
 * The heading previews the highlighted language before it is confirmed.
 */

import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button } from "../src/components/ui";
import { Logo } from "../src/components/Logo";
import { LanguageList } from "../src/components/LanguageList";
import { translate, useI18n } from "../src/i18n/I18nContext";
import type { LanguageCode } from "../src/i18n/languages";
import { Colors, FontSize, Spacing } from "../src/constants/theme";

export default function LanguageScreen() {
  const router = useRouter();
  const { language, setLanguage } = useI18n();
  const [selected, setSelected] = useState<LanguageCode>(language);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    await setLanguage(selected);
    setSaving(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/auth");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Logo size={96} />
          <Text style={styles.appName}>{translate(selected, "app.name")}</Text>
          <Text style={styles.tagline}>{translate(selected, "app.tagline")}</Text>
        </View>

        <Text style={styles.title}>{translate(selected, "language.title")}</Text>
        <Text style={styles.subtitle}>{translate(selected, "language.subtitle")}</Text>

        <LanguageList selected={selected} onSelect={setSelected} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={translate(selected, "common.continue")}
          icon="arrow-forward"
          loading={saving}
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.md },
  brand: { alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.xl },
  appName: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, marginTop: Spacing.sm },
  tagline: { fontSize: FontSize.sm, color: Colors.primaryText, fontWeight: "600", marginTop: 2 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, letterSpacing: -0.3 },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
});
