import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { Colors } from "../constants/theme";

const LOGO = require("../../assets/images/logo.png");

/** The Niti Mitra logo (head + bulb), optionally inside a soft circular badge. */
export function Logo({ size = 64, badge = false }: { size?: number; badge?: boolean }) {
  const image = (
    <Image
      source={LOGO}
      style={{ width: badge ? size * 0.72 : size, height: badge ? size * 0.72 : size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
  if (!badge) return image;
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>{image}</View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
});
