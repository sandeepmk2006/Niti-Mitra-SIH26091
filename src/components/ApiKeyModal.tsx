/**
 * Settings → Gemini API key. Lets a key be swapped at runtime (and tested first) when the
 * built-in one is throttled or out of quota.
 */

import React, { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button, InlineError } from "./ui";
import { useI18n } from "../i18n/I18nContext";
import { clearApiKey, getApiKey, hasOverride, maskKey, setApiKey, testApiKey } from "../services/apiKey";
import { BorderRadius, Colors, FontSize, Spacing } from "../constants/theme";

export function ApiKeyModal({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const candidate = key.trim() || getApiKey();

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const ms = await testApiKey(candidate);
      setResult({ ok: true, text: t("apikey.ok", { ms }) });
    } catch (error) {
      setResult({ ok: false, text: t("apikey.bad", { error: error instanceof Error ? error.message : String(error) }) });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    await setApiKey(key);
    setKey("");
    setResult({ ok: true, text: t("apikey.saved") });
    onChanged();
  };

  const reset = async () => {
    await clearApiKey();
    setKey("");
    setResult(null);
    onChanged();
  };

  return (
    <Modal visible={visible} animationType="none" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("apikey.row")}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t("common.cancel")}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <Text style={styles.subtitle}>{t("apikey.subtitle")}</Text>
          <View style={styles.current}>
            <Ionicons name="key-outline" size={18} color={Colors.primaryText} />
            <Text style={styles.currentText}>
              {hasOverride() ? t("apikey.custom", { masked: maskKey() }) : t("apikey.default")}
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={(v) => {
              setKey(v);
              setResult(null);
            }}
            placeholder={t("apikey.placeholder")}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
          {result ? (
            result.ok ? (
              <View style={styles.okBox}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.okText}>{result.text}</Text>
              </View>
            ) : (
              <InlineError message={result.text} />
            )
          ) : null}
          <Button
            label={testing ? t("apikey.testing") : t("apikey.test")}
            icon="flash-outline"
            variant="secondary"
            loading={testing}
            disabled={!candidate}
            onPress={test}
          />
          <Button label={t("apikey.save")} icon="save-outline" disabled={!key.trim() || testing} onPress={save} />
          {hasOverride() ? (
            <Button label={t("apikey.reset")} icon="refresh-outline" variant="danger" onPress={reset} />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  body: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  currentText: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },
  input: {
    minHeight: 80,
    padding: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfacePrimary,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontFamily: "monospace",
  },
  okBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.successMuted,
  },
  okText: { flex: 1, fontSize: FontSize.sm, color: Colors.success, fontWeight: "600" },
});
