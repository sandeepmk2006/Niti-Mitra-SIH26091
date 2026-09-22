/**
 * Layout building blocks for report-style screens (calculator, feasibility report).
 */

import React, { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

export function Section({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: IconName;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={16} color={Colors.primaryText} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {badge}
      </View>
      {children}
    </View>
  );
}

/** A labelled number, e.g. "Loan amount ₹9,00,000". */
export function Tile({
  label,
  value,
  caption,
  tone,
  emphasis = false,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.tile, emphasis && styles.tileEmphasis]}>
      <Text style={[styles.tileLabel, emphasis && styles.tileLabelEmphasis]}>{label}</Text>
      <Text
        style={[styles.tileValue, emphasis && styles.tileValueEmphasis, tone ? { color: tone } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {caption ? <Text style={[styles.tileCaption, emphasis && styles.tileLabelEmphasis]}>{caption}</Text> : null}
    </View>
  );
}

export function TileRow({ children }: { children: ReactNode }) {
  return <View style={styles.tileRow}>{children}</View>;
}

/** Label on the left, value on the right. */
export function KeyValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, strong && styles.kvStrong]}>{value}</Text>
    </View>
  );
}

export function Bullets({ items, color = Colors.primary, numbered = false }: { items: string[]; color?: string; numbered?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          {numbered ? (
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
          ) : (
            <View style={[styles.dot, { backgroundColor: color }]} />
          )}
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function Note({ icon = "information-circle-outline", text, tone = "neutral" }: { icon?: IconName; text: string; tone?: "neutral" | "warning" }) {
  const color = tone === "warning" ? Colors.warning : Colors.textSecondary;
  return (
    <View style={[styles.note, tone === "warning" && styles.noteWarning]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.noteText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 12,
    ...Shadows.card,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },

  tileRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 2,
  },
  tileEmphasis: { backgroundColor: Colors.primary },
  tileLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  tileLabelEmphasis: { color: Colors.textInverse },
  tileValue: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  tileValueEmphasis: { color: Colors.textInverse },
  tileCaption: { fontSize: FontSize.xs, color: Colors.textMuted },

  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  kvLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  kvValue: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, textAlign: "right", flexShrink: 1 },
  kvStrong: { fontSize: FontSize.base, color: Colors.primaryText },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  number: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.primaryText },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 21 },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundSubtle,
  },
  noteWarning: { backgroundColor: Colors.warningMuted },
  noteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 19 },
});
