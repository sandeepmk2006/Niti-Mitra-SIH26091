/**
 * Home — greeting, entry point into the Evaluate chat, live stats and recent activity.
 */

import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Button, SectionLabel } from "../../src/components/ui";
import { Logo } from "../../src/components/Logo";
import { SessionCard } from "../../src/components/SessionCard";
import { useAuth } from "../../src/context/AuthContext";
import { useChat } from "../../src/context/ChatContext";
import { useSessions } from "../../src/hooks/useSessions";
import { useI18n } from "../../src/i18n/I18nContext";
import { BorderRadius, Colors, FontSize, Shadows, Spacing } from "../../src/constants/theme";

const RECENT_COUNT = 3;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const { hasConversation, stage, startNewChat } = useChat();
  const { sessions, loading } = useSessions();

  const evaluations = sessions.filter((s) => s.report);
  const schemesMatched = evaluations.reduce(
    (sum, s) => sum + (s.report?.schemes.filter((scheme) => scheme.status === "eligible").length ?? 0),
    0
  );
  const canContinue = hasConversation && stage !== "evaluated";

  const openEvaluate = (fresh: boolean) => {
    if (fresh) startNewChat();
    router.navigate("/(tabs)/evaluate");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.fullName ?? "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} numberOfLines={1}>
            {t("home.greeting", { name: user?.fullName ?? "" })}
          </Text>
          <Text style={styles.appTag}>{t("app.name")} · {t("app.tagline")}</Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroBadgeText}>{t("chat.subtitle")}</Text>
            <Text style={styles.heroTitle}>{t("home.heroTitle")}</Text>
          </View>
          <Logo size={72} />
        </View>
        <Text style={styles.heroBody}>{t("home.heroBody")}</Text>
        <Button label={t("home.startCta")} icon="add-circle-outline" onPress={() => openEvaluate(true)} />
      </View>

      {canContinue ? (
        <Button
          label={t("home.continueCta")}
          icon="chatbubbles-outline"
          variant="secondary"
          onPress={() => openEvaluate(false)}
          style={{ marginBottom: Spacing.lg }}
        />
      ) : null}

      {/* Stats */}
      <View style={styles.stats}>
        <Stat icon="chatbubbles" value={sessions.length} label={t("home.statChats")} loading={loading} />
        <Stat icon="analytics" value={evaluations.length} label={t("home.statEvaluations")} loading={loading} />
        <Stat icon="ribbon" value={schemesMatched} label={t("home.statSchemes")} loading={loading} />
      </View>

      {/* Recent activity */}
      <View style={styles.sectionHeader}>
        <SectionLabel>{t("home.recent")}</SectionLabel>
        {sessions.length > RECENT_COUNT ? (
          <TouchableOpacity onPress={() => router.navigate("/(tabs)/history")} hitSlop={8}>
            <Text style={styles.seeAll}>{t("home.seeAll")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.lg }} />
      ) : sessions.length === 0 ? (
        <View style={styles.emptyRecent}>
          <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
          <Text style={styles.emptyRecentText}>{t("home.noActivity")}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {sessions.slice(0, RECENT_COUNT).map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
            />
          ))}
        </View>
      )}

      {/* How it works */}
      <View style={{ marginTop: Spacing.xl }}>
        <SectionLabel>{t("home.howItWorks")}</SectionLabel>
        <View style={styles.steps}>
          <Step n={1} icon="chatbubble-ellipses" title={t("home.step1Title")} body={t("home.step1Body")} />
          <Step n={2} icon="document-text" title={t("home.step2Title")} body={t("home.step2Body")} />
          <Step n={3} icon="ribbon" title={t("home.step3Title")} body={t("home.step3Body")} last />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({
  icon,
  value,
  label,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  loading: boolean;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={Colors.primaryText} />
      </View>
      <Text style={styles.statValue}>{loading ? "–" : value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Step({
  n,
  icon,
  title,
  body,
  last = false,
}: {
  n: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepRail}>
        <View style={styles.stepBadge}>
          <Ionicons name={icon} size={16} color={Colors.primaryText} />
        </View>
        {!last && <View style={styles.stepLine} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : Spacing.md }}>
        <Text style={styles.stepTitle}>
          {n}. {title}
        </Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: Spacing.xl },

  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.lg },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primaryText },
  greeting: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  appTag: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  hero: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 4,
    borderTopColor: Colors.primary,
    padding: 18,
    marginBottom: Spacing.md,
    gap: 12,
    ...Shadows.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.primaryText,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, lineHeight: 28 },
  heroBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  stats: { flexDirection: "row", gap: 10, marginBottom: Spacing.xl },
  stat: {
    flex: 1,
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    ...Shadows.card,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600", marginTop: 2 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  seeAll: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primaryText },
  emptyRecent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.borderStrong,
  },
  emptyRecentText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  steps: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  step: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center" },
  stepBadge: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.primaryBorder, marginVertical: 4 },
  stepTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  stepBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19, marginTop: 2 },
});
