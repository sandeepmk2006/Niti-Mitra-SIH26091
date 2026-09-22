/**
 * Advisor — Q&A about loans, schemes and the user's business. Each reply offers tappable
 * follow-up options; the user can also type or speak. When opened from a report the
 * conversation is linked to that study.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { AdvisorAvatar, ChatBubble, WorkingBubble } from "../../src/components/ChatBubble";
import { InlineError } from "../../src/components/ui";
import { useChat } from "../../src/context/ChatContext";
import { useSettings } from "../../src/context/SettingsContext";
import { useVoiceInput } from "../../src/hooks/useVoiceInput";
import { useI18n } from "../../src/i18n/I18nContext";
import { speak, stopSpeaking } from "../../src/services/voice";
import type { ChatMessage } from "../../src/types/session";
import { formatTime } from "../../src/utils/format";
import { BorderRadius, Colors, FontSize, Spacing } from "../../src/constants/theme";

/** What gets read aloud for an advisor turn: the answer, then the follow-up and its options. */
function spokenText(message: ChatMessage): string {
  const parts = [message.text];
  if (message.question) {
    parts.push(message.question.text);
    message.question.options.forEach((o, i) => parts.push(`${i + 1}. ${o.label}.`));
  }
  return parts.filter(Boolean).join(" ");
}

export default function AdvisorScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale, language } = useI18n();
  const { settings } = useSettings();
  const { messages, intro, linkedStudyTitle, busy, error, hasConversation, sendMessage, retry, startNewChat } = useChat();

  const [input, setInput] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const timeline = hasConversation ? messages : [intro];

  const voice = useVoiceInput(
    language,
    useCallback((text: string) => setInput((current) => (current.trim() ? `${current.trim()} ${text}` : text)), [])
  );

  const toggleSpeak = useCallback(
    (message: ChatMessage) => {
      if (speakingId === message.id) {
        stopSpeaking();
        setSpeakingId(null);
        return;
      }
      setSpeakingId(message.id);
      speak(spokenText(message), locale, { onDone: () => setSpeakingId((id) => (id === message.id ? null : id)) });
    },
    [speakingId, locale]
  );

  // Auto-read only replies that arrive while this screen is open — never the backlog.
  const lastSeenId = useRef(messages[messages.length - 1]?.id);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastSeenId.current) return;
    lastSeenId.current = last.id;
    if (settings.readAloud && last.role === "assistant") {
      setSpeakingId(last.id);
      speak(spokenText(last), locale, { onDone: () => setSpeakingId((id) => (id === last.id ? null : id)) });
    }
  }, [messages, settings.readAloud, locale]);

  useFocusEffect(
    useCallback(
      () => () => {
        stopSpeaking();
        setSpeakingId(null);
      },
      []
    )
  );

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(timer);
  }, [messages.length, busy, error]);

  const handleSend = (text: string = input) => {
    if (!text.trim() || busy) return;
    stopSpeaking();
    setSpeakingId(null);
    setInput("");
    void sendMessage(text);
  };

  const confirmNewChat = () => {
    if (!hasConversation) {
      startNewChat();
      return;
    }
    Alert.alert(t("chat.newChatConfirmTitle"), t("chat.newChatConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("chat.start"), onPress: startNewChat },
    ]);
  };

  const voiceBusy = voice.state !== "idle";

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <AdvisorAvatar size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("app.name")}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {linkedStudyTitle ? t("advisor.about", { title: linkedStudyTitle }) : t("chat.subtitle")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={confirmNewChat}
          disabled={busy || (!hasConversation && !linkedStudyTitle)}
          style={[styles.newChat, (busy || (!hasConversation && !linkedStudyTitle)) && { opacity: 0.4 }]}
          accessibilityLabel={t("chat.newChat")}
        >
          <Ionicons name="add" size={18} color={Colors.primaryText} />
          <Text style={styles.newChatText}>{t("chat.newChat")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.timeline}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {timeline.map((message, index) => {
          const next = timeline[index + 1];
          const isLast = index === timeline.length - 1;
          const isAssistant = message.role === "assistant";
          return (
            <ChatBubble
              key={message.id}
              role={message.role}
              text={message.text}
              meta={hasConversation ? formatTime(message.createdAt, locale) : undefined}
              question={isAssistant ? message.question : null}
              questionActive={isAssistant && isLast && !busy}
              answer={next?.role === "user" ? next.text : undefined}
              onSelectOption={handleSend}
              hint={t("chat.orType")}
              speaking={speakingId === message.id}
              onToggleSpeak={isAssistant ? () => toggleSpeak(message) : undefined}
              speakLabel={speakingId === message.id ? t("chat.stopSpeaking") : t("chat.speak")}
            />
          );
        })}
        {busy ? <WorkingBubble label={t("chat.typing")} /> : null}
        {error ? <InlineError message={t("chat.errorReply")} onRetry={retry} retryLabel={t("common.retry")} /> : null}
      </ScrollView>

      <View style={styles.composer}>
        {voice.state !== "idle" || voice.error ? (
          <View style={styles.voiceStatus}>
            {voice.state === "recording" ? <View style={styles.recDot} /> : null}
            {voice.state === "transcribing" ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
            {voice.error ? <Ionicons name="alert-circle" size={16} color={Colors.danger} /> : null}
            <Text style={[styles.voiceStatusText, voice.error ? { color: Colors.danger } : null]}>
              {voice.state === "recording"
                ? t("chat.listening")
                : voice.state === "transcribing"
                  ? t("chat.transcribing")
                  : voice.error === "permission"
                    ? t("chat.micDenied")
                    : t("chat.voiceError")}
            </Text>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.mic, voice.state === "recording" && styles.micRecording, (busy || voice.state === "transcribing") && styles.disabled]}
            onPress={voice.toggle}
            disabled={busy || voice.state === "transcribing"}
            accessibilityRole="button"
            accessibilityLabel={t("chat.mic")}
          >
            <Ionicons
              name={voice.state === "recording" ? "stop" : "mic"}
              size={20}
              color={voice.state === "recording" ? Colors.textInverse : Colors.primaryText}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            editable={!busy && !voiceBusy}
          />
          <TouchableOpacity
            style={[styles.send, (!input.trim() || busy) && styles.sendDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel={t("chat.send")}
          >
            <Ionicons name="send" size={18} color={Colors.textInverse} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
    backgroundColor: Colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  newChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
  },
  newChatText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primaryText },
  timeline: { padding: Spacing.md, paddingBottom: Spacing.lg },
  composer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  voiceStatus: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  voiceStatusText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  mic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  micRecording: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  disabled: { opacity: 0.45 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { backgroundColor: Colors.borderStrong },
});
