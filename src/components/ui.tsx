/**
 * Small shared UI primitives built on the theme tokens.
 */

import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// ── Buttons ──

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const foreground =
    variant === "primary" ? Colors.textInverse : variant === "danger" ? Colors.danger : Colors.primaryText;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={foreground} />}
          <Text style={[styles.buttonText, { color: foreground }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.buttonBase, inactive && styles.buttonInactive, style]}
    >
      <View
        style={[
          styles.buttonInner,
          variant === "primary"
            ? styles.buttonPrimary
            : variant === "secondary"
              ? styles.buttonSecondary
              : styles.buttonDanger,
        ]}
      >
        {content}
      </View>
    </TouchableOpacity>
  );
}

// ── Layout ──

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ── States ──

export function FullScreenLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={Colors.primaryText} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export function InlineError({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <View style={styles.inlineError}>
      <Ionicons name="alert-circle" size={18} color={Colors.danger} />
      <Text style={styles.inlineErrorText}>{message}</Text>
      {onRetry && retryLabel ? (
        <TouchableOpacity onPress={onRetry} hitSlop={8}>
          <Text style={styles.inlineErrorAction}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  buttonInner: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonSecondary: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  buttonDanger: {
    backgroundColor: Colors.dangerMuted,
    borderWidth: 1,
    borderColor: Colors.dangerMuted,
  },
  buttonInactive: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  card: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dangerMuted,
    borderRadius: BorderRadius.md,
    padding: 12,
  },
  inlineErrorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.danger,
    lineHeight: 19,
  },
  inlineErrorAction: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.primaryText,
  },
});
