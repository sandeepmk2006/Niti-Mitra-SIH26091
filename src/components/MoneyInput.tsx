/**
 * Rupee amount input with Indian digit grouping and optional quick-pick chips.
 */

import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { formatINR, formatNumber } from "../utils/format";
import { BorderRadius, Colors, FontSize } from "../constants/theme";

export const QUICK_AMOUNTS = [10_000, 25_000, 50_000, 1_00_000, 2_00_000, 5_00_000];

export function parseAmount(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  quickAmounts,
  large = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  quickAmounts?: number[];
  large?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.field, large && styles.fieldLarge]}>
        <Text style={[styles.rupee, large && styles.rupeeLarge]}>₹</Text>
        <TextInput
          style={[styles.input, large && styles.inputLarge]}
          value={value !== null ? formatNumber(value) : ""}
          onChangeText={(text) => onChange(parseAmount(text))}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={14}
        />
      </View>
      {quickAmounts ? (
        <View style={styles.chips}>
          {quickAmounts.map((amount) => {
            const active = value === amount;
            return (
              <TouchableOpacity
                key={amount}
                onPress={() => onChange(amount)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatINR(amount)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfacePrimary,
  },
  fieldLarge: { height: 64, borderColor: Colors.primary },
  rupee: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textSecondary },
  rupeeLarge: { fontSize: FontSize.xl, color: Colors.primaryText },
  input: { flex: 1, fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  inputLarge: { fontSize: FontSize.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse },
});
