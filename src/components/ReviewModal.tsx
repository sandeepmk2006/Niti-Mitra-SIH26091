/**
 * One-time "Rate & review" sheet: star rating plus optional comment.
 */

import React, { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button, InlineError } from "./ui";
import { useI18n } from "../i18n/I18nContext";
import { BorderRadius, Colors, FontSize, Spacing } from "../constants/theme";

export function ReviewModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(false);
    try {
      await onSubmit(rating, comment);
    } catch (e) {
      console.warn("[Review] Submit failed:", e);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="none" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("review.title")}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t("common.cancel")}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <Text style={styles.subtitle}>{t("review.subtitle")}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setRating(n)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${n}/5`}
                accessibilityState={{ selected: rating === n }}
              >
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={44} color={n <= rating ? Colors.primary : Colors.borderStrong} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{rating ? `${rating}/5` : t("review.tapToRate")}</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder={t("review.placeholder")}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          {error ? <InlineError message={t("review.error")} /> : null}
          <Button label={t("review.submit")} icon="send" disabled={rating === 0} loading={sending} onPress={submit} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  body: { padding: Spacing.lg, gap: Spacing.md },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  stars: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: Spacing.sm },
  hint: { textAlign: "center", fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  input: {
    minHeight: 120,
    padding: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfacePrimary,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
});
