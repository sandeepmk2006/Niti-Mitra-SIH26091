import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";

import { AuthProvider } from "../src/context/AuthContext";
import { ChatProvider } from "../src/context/ChatContext";
import { SettingsProvider } from "../src/context/SettingsContext";
import { I18nProvider } from "../src/i18n/I18nContext";
import { Colors } from "../src/constants/theme";

// Rendered if the root layout itself throws — outside the providers, so it falls back to English.
export { ErrorFallback as ErrorBoundary } from "../src/components/ErrorFallback";

/**
 * Root layout — global providers and the top-level stack.
 *
 * Flow: first launch → /language → /auth → /preferences (once) → (tabs). The gating itself lives in
 * app/(tabs)/_layout.tsx, which redirects until a language is chosen and a user is signed in.
 */
export default function RootLayout() {
  return (
    <I18nProvider>
      <SettingsProvider>
        <AuthProvider>
          <ChatProvider>
            <View style={styles.container}>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.background },
                  // Deliberately calm UI: screens switch instantly, no transitions.
                  animation: "none",
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="language" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="preferences" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="session/[id]" />
              </Stack>
            </View>
          </ChatProvider>
        </AuthProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
