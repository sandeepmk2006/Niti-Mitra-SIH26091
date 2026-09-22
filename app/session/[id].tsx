/**
 * Session detail — one saved conversation with its draft and report, live from Firestore.
 * Unfinished sessions can be resumed in the Evaluate tab.
 */

import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { StageBadge } from "../../src/components/badges";
import { ChatBubble } from "../../src/components/ChatBubble";
import { DraftCard } from "../../src/components/DraftCard";
import { ReportView } from "../../src/components/ReportView";
import { Button, EmptyState, FullScreenLoader, SectionLabel } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useChat } from "../../src/context/ChatContext";
import { useI18n } from "../../src/i18n/I18nContext";
import { deleteSession, subscribeToSession } from "../../src/services/HistoryService";
import type { Session } from "../../src/types/session";
import { formatDate, formatTime } from "../../src/utils/format";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

export { ErrorFallback as ErrorBoundary } from "../../src/components/ErrorFallback";

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { sessionId: activeSessionId, resumeSession, startNewChat } = useChat();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !id) return;
    return subscribeToSession(
      uid,
      id,
      (next) => {
        setSession(next);
        setLoading(false);
      },
      (err) => {
        console.warn("[Session] Subscription failed:", err.code);
        setLoading(false);
      }
    );
  }, [uid, id]);

  if (!user) return <Redirect href="/auth" />;
  if (loading) return <FullScreenLoader />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/history"));

  const confirmDelete = () => {
    if (!session) return;
    Alert.alert(t("session.deleteConfirmTitle"), t("session.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("session.delete"),
        style: "destructive",
        onPress: async () => {
          if (activeSessionId === session.id) startNewChat();
          goBack();
          await deleteSession(user.uid, session.id).catch((err) =>
            console.warn("[Session] Delete failed:", err)
          );
        },
      },
    ]);
  };

  const continueInChat = () => {
    if (!session) return;
    resumeSession(session);
    router.dismissTo("/(tabs)/evaluate");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconButton} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("session.title")}
        </Text>
        {session ? (
          <TouchableOpacity onPress={confirmDelete} style={styles.iconButton} accessibilityLabel={t("session.delete")}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      {!session ? (
        <EmptyState icon="alert-circle-outline" title={t("session.notFound")} body="" />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.meta}>
              <StageBadge stage={session.stage} />
              <Text style={styles.date}>{formatDate(session.updatedAt, locale)}</Text>
            </View>
            <Text style={styles.title}>{session.title || t("history.untitled")}</Text>

            {session.report ? (
              <View style={styles.block}>
                <ReportView report={session.report} />
              </View>
            ) : null}

            {session.draft ? (
              <View style={styles.block}>
                <DraftCard draft={session.draft} />
              </View>
            ) : null}

            {session.messages.length > 0 ? (
              <View style={styles.block}>
                <SectionLabel>{t("session.conversation")}</SectionLabel>
                <View style={styles.transcript}>
                  {session.messages.map((message, index) => {
                    const next = session.messages[index + 1];
                    return (
                      <ChatBubble
                        key={message.id}
                        role={message.role}
                        text={message.text}
                        meta={formatTime(message.createdAt, locale)}
                        question={message.role === "assistant" ? message.question : null}
                        answer={next?.role === "user" ? next.text : undefined}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {session.stage !== "evaluated" ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
              <Button label={t("session.continue")} icon="chatbubbles-outline" onPress={continueInChat} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingBottom: 8,
    backgroundColor: Colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  content: { padding: 20, paddingBottom: Spacing.xl },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.md },
  block: { marginBottom: Spacing.lg },
  transcript: {
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: Colors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
