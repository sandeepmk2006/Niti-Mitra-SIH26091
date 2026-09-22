/**
 * History — feasibility studies and advisor conversations, live from Firestore.
 */

import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ConversationCard, StudyCard } from "../../src/components/cards";
import { Button, EmptyState, FullScreenLoader, InlineError, ScreenHeader } from "../../src/components/ui";
import { useSessions, useStudies } from "../../src/hooks/useSessions";
import { useI18n } from "../../src/i18n/I18nContext";
import type { Session } from "../../src/types/session";
import type { Study } from "../../src/types/study";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

type Tab = "studies" | "conversations";

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const studies = useStudies();
  const sessions = useSessions();
  const [tab, setTab] = useState<Tab>("studies");

  const current = tab === "studies" ? studies : sessions;
  const data: (Study | Session)[] = tab === "studies" ? studies.studies : sessions.sessions;

  if (current.loading && data.length === 0) return <FullScreenLoader />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      data={data}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={current.reload} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
      ListHeaderComponent={
        <View>
          <ScreenHeader title={t("history.title")} />
          <View style={styles.segment}>
            {(["studies", "conversations"] as Tab[]).map((key) => {
              const count = key === "studies" ? studies.studies.length : sessions.sessions.length;
              const active = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  onPress={() => setTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t(key === "studies" ? "history.studies" : "history.conversations")} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {current.error ? (
            <View style={{ marginBottom: Spacing.md }}>
              <InlineError message={t("history.loadError")} onRetry={current.reload} retryLabel={t("common.retry")} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        current.error ? null : tab === "studies" ? (
          <EmptyState
            icon="analytics-outline"
            title={t("history.noStudies")}
            body={t("history.noStudiesBody")}
            action={<Button label={t("home.studyCta")} icon="add-circle-outline" onPress={() => router.navigate("/(tabs)/study")} />}
          />
        ) : (
          <EmptyState
            icon="chatbubbles-outline"
            title={t("history.empty")}
            body={t("history.noChatsBody")}
            action={<Button label={t("home.advisorTitle")} icon="chatbubbles-outline" onPress={() => router.navigate("/(tabs)/advisor")} />}
          />
        )
      }
      renderItem={({ item }) =>
        tab === "studies" ? (
          <StudyCard study={item as Study} onPress={() => router.push({ pathname: "/study/[id]", params: { id: item.id } })} />
        ) : (
          <ConversationCard
            session={item as Session}
            onPress={() => router.push({ pathname: "/session/[id]", params: { id: item.id } })}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: Spacing.xl, flexGrow: 1 },
  segment: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: BorderRadius.md },
  segmentActive: { backgroundColor: Colors.surfacePrimary },
  segmentText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  segmentTextActive: { color: Colors.primaryText, fontWeight: "800" },
});
