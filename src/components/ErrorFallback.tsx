/**
 * Fallback UI for expo-router's per-route ErrorBoundary. A render error in a screen shows this
 * (with a retry) instead of unmounting the whole tree to a blank white screen.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ErrorBoundaryProps } from "expo-router";

import { Button } from "./ui";
import { useI18n } from "../i18n/I18nContext";
import { BorderRadius, Colors, FontSize, Spacing } from "../constants/theme";

export function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="warning" size={30} color={Colors.danger} />
      </View>
      <Text style={styles.title}>{t("error.title")}</Text>
      <Text style={styles.body}>{t("error.body")}</Text>
      {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      <Button label={t("common.retry")} icon="refresh" onPress={retry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dangerMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  body: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  detail: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", fontFamily: "monospace" },
  button: { marginTop: Spacing.md, alignSelf: "stretch" },
});
