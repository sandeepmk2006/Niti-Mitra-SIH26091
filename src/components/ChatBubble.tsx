/**
 * Chat message bubble (with an optional read-aloud button), the advisor's multiple-choice
 * question card, and the "typing" / "working" indicator bubble.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FormattedText } from "./FormattedText";
import { Logo } from "./Logo";
import type { ChatQuestion, ChatRole } from "../types/session";
import { BorderRadius, Colors, FontSize, Spacing } from "../constants/theme";

export function AdvisorAvatar({ size = 30 }: { size?: number }) {
  return <Logo size={size} badge />;
}

interface ChatBubbleProps {
  role: ChatRole;
  text: string;
  meta?: string;
  /** Advisor messages: the question asked in this turn. */
  question?: ChatQuestion | null;
  /** Enables the options. Omit/false for answered questions and read-only transcripts. */
  questionActive?: boolean;
  /** The label the user picked (or typed) in reply, highlighted on answered questions. */
  answer?: string;
  onSelectOption?: (label: string) => void;
  hint?: string;
  /** Read-aloud control; omit to hide. */
  speaking?: boolean;
  onToggleSpeak?: () => void;
  speakLabel?: string;
}

export function ChatBubble({
  role,
  text,
  meta,
  question,
  questionActive = false,
  answer,
  onSelectOption,
  hint,
  speaking = false,
  onToggleSpeak,
  speakLabel,
}: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && <AdvisorAvatar />}
      <View style={[styles.column, isUser && styles.columnUser]}>
        {text ? (
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
            <FormattedText text={text} style={[styles.text, isUser && styles.textUser]} />
            <View style={styles.footer}>
              {onToggleSpeak ? (
                <TouchableOpacity
                  onPress={onToggleSpeak}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={speakLabel}
                  style={styles.speak}
                >
                  <Ionicons
                    name={speaking ? "stop-circle" : "volume-medium-outline"}
                    size={18}
                    color={speaking ? Colors.primaryText : Colors.textMuted}
                  />
                </TouchableOpacity>
              ) : null}
              {meta ? <Text style={[styles.meta, isUser && styles.metaUser]}>{meta}</Text> : null}
            </View>
          </View>
        ) : null}

        {question ? (
          <QuestionCard
            question={question}
            active={questionActive}
            answer={answer}
            onSelect={onSelectOption}
            hint={questionActive ? hint : undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * A question with numbered, tappable options — the primary way users answer. Typing or speaking
 * a custom answer in the composer is always available as the "other" choice.
 */
export function QuestionCard({
  question,
  active,
  answer,
  onSelect,
  hint,
}: {
  question: ChatQuestion;
  active: boolean;
  answer?: string;
  onSelect?: (label: string) => void;
  hint?: string;
}) {
  return (
    <View style={[styles.question, !active && styles.questionAnswered]}>
      <Text style={styles.questionText}>{question.text}</Text>
      <View style={styles.options}>
        {question.options.map((option, index) => {
          const chosen = !!answer && answer.trim() === option.label.trim();
          return (
            <TouchableOpacity
              key={`${index}-${option.label}`}
              disabled={!active}
              onPress={() => onSelect?.(option.label)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ disabled: !active, selected: chosen }}
              style={[styles.option, chosen && styles.optionChosen, !active && !chosen && styles.optionDimmed]}
            >
              <View style={[styles.optionIndex, chosen && styles.optionIndexChosen]}>
                {chosen ? (
                  <Ionicons name="checkmark" size={14} color={Colors.textInverse} />
                ) : (
                  <Text style={styles.optionIndexText}>{index + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.description ? <Text style={styles.optionDesc}>{option.description}</Text> : null}
              </View>
              {active ? <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {hint ? (
        <View style={styles.hintRow}>
          <Ionicons name="create-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.hint}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function WorkingBubble({ label }: { label: string }) {
  return (
    <View style={[styles.row, styles.rowAssistant]}>
      <AdvisorAvatar />
      <View style={[styles.bubble, styles.bubbleAssistant, styles.working]}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.workingText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginBottom: 14 },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  column: { flex: 1, gap: 8, alignItems: "flex-start" },
  columnUser: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surfaceSecondary,
    borderTopLeftRadius: 4,
  },
  text: { fontSize: FontSize.base, lineHeight: 22, color: Colors.textPrimary },
  textUser: { color: Colors.textInverse },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  speak: { marginRight: "auto" },
  meta: { fontSize: 10, color: Colors.textMuted },
  metaUser: { color: Colors.primarySoft },

  question: {
    alignSelf: "stretch",
    backgroundColor: Colors.surfacePrimary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    padding: 12,
    gap: 10,
  },
  questionAnswered: { borderColor: Colors.border, borderWidth: 1 },
  questionText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, lineHeight: 21 },
  options: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundSubtle,
  },
  optionChosen: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  optionDimmed: { opacity: 0.55 },
  optionIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.surfacePrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIndexChosen: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionIndexText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.primaryText },
  optionLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  optionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1, lineHeight: 18 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hint: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted },

  working: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  workingText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
});
