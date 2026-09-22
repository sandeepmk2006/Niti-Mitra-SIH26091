/**
 * History — real-time list of the user's sessions from Firestore (/users/{uid}/sessions),
 * filterable by stage.
 */

import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { SessionCard } from "../../src/components/SessionCard";
import { Button, EmptyState, FullScreenLoader, InlineError, ScreenHeader } from "../../src/components/ui";
import { useChat } from "../../src/context/ChatContext";
import { useSessions } from "../../src/hooks/useSessions";
import { useI18n } from "../../src/i18n/I18nContext";
import type { TranslationKey } from "../../src/i18n/translations/en";
import type { SessionStage } from "../../src/types/session";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

type Filter = "all" | SessionStage;

const FILTERS: { value: Filter; label: TranslationKey }[] = [
  { value: "all", label: "history.filterAll" },
  { value: "chatting", label: "history.filterChats" },
  { value: "drafted", label: "history.filterDrafts" },
  { value: "evaluated", label: "history.filterEvaluations" },
];

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { startNewChat } = useChat();
  const { sessions, loading, error, reload } = useSessions();
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const byStage: Record<Filter, number> = { all: sessions.length, chatting: 0, drafted: 0, evaluated: 0 };
    sessions.forEach((s) => (byStage[s.stage] += 1));
    return byStage;
  }, [sessions]);

  const visible = filter === "all" ? sessions : sessions.filter((s) => s.stage === filter);

  if (loading && sessions.length === 0) return <FullScreenLoader />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      data={visible}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={reload} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
      ListHeaderComponent={
        <View>
          <ScreenHeader title={t("history.title")} subtitle={t("history.subtitle", { count: sessions.length })} />
          <View style={styles.filters}>
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(f.label)}</Text>
                  <View style={[styles.count, active && styles.countActive]}>
                    <Text style={[styles.countText, active && styles.countTextActive]}>{counts[f.value]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {error ? (
            <View style={{ marginBottom: Spacing.md }}>
              <InlineError message={t("history.loadError")} onRetry={reload} retryLabel={t("common.retry")} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <EmptyState
            icon="time-outline"
            title={t("history.empty")}
            body={t("history.emptyBody")}
            action={
              <Button
                label={t("home.startCta")}
                icon="add-circle-outline"
                onPress={() => {
                  startNewChat();
                  router.navigate("/(tabs)/evaluate");
                }}
              />
            }
          />
        )
      }
      renderItem={({ item }) => (
        <SessionCard
          session={item}
          onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: Spacing.xl, flexGrow: 1 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfacePrimary,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: Colors.textInverse },
  count: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  countActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  countText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  countTextActive: { color: Colors.textInverse },
});
