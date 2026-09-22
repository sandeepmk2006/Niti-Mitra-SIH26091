/**
 * Renders the small markdown subset the advisor is allowed to use: **bold** spans and
 * "- " bullet lines. Anything else is shown as plain text.
 */

import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";

import { Spacing } from "../constants/theme";

function renderInline(line: string, baseKey: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <Text key={`${baseKey}-${index}`} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    )
  );
}

export function FormattedText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const lines = text.split("\n");

  return (
    <View style={styles.container}>
      {lines.map((raw, index) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={index} style={styles.gap} />;

        const bullet = line.match(/^\s*[-•]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={index} style={styles.bulletRow}>
              <Text style={style}>•</Text>
              <Text style={[style, styles.bulletText]}>{renderInline(bullet[1], String(index))}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={style}>
            {renderInline(line, String(index))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  gap: { height: Spacing.xs },
  bold: { fontWeight: "700" },
  bulletRow: { flexDirection: "row", gap: 6, paddingLeft: 2 },
  bulletText: { flex: 1 },
});
