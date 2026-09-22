/**
 * Selectable list of UI languages — used by onboarding and by Settings.
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { LANGUAGES, LanguageCode } from "../i18n/languages";
import { BorderRadius, Colors, FontSize, Spacing } from "../constants/theme";

export function LanguageList({
  selected,
  onSelect,
}: {
  selected: LanguageCode | null;
  onSelect: (code: LanguageCode) => void;
}) {
  return (
    <View style={styles.list}>
      {LANGUAGES.map((lang) => {
        const active = lang.code === selected;
        return (
          <TouchableOpacity
            key={lang.code}
            activeOpacity={0.8}
            onPress={() => onSelect(lang.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.row, active && styles.rowActive]}
          >
            <View style={[styles.badge, active && styles.badgeActive]}>
              <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                {lang.nativeName.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.native}>{lang.nativeName}</Text>
              {lang.nativeName !== lang.englishName ? (
                <Text style={styles.english}>{lang.englishName}</Text>
              ) : null}
            </View>
            <Ionicons
              name={active ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={active ? Colors.primaryText : Colors.borderStrong}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },
  rowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: { backgroundColor: Colors.surfacePrimary },
  badgeText: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textSecondary },
  badgeTextActive: { color: Colors.primaryText },
  native: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  english: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
});
