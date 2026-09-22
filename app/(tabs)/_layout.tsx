import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FullScreenLoader } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { useI18n } from "../../src/i18n/I18nContext";
import { Colors, BorderRadius } from "../../src/constants/theme";

export { ErrorFallback as ErrorBoundary } from "../../src/components/ErrorFallback";

/**
 * 5-tab navigation layout — Home | New study | Calculator | Advisor | History.
 * Settings is a stack screen opened from Home.
 *
 * Also the onboarding gate: until a language is chosen, a user is signed in and they have been
 * through the preferences questionnaire once, it redirects to /language, /auth or /preferences.
 */
export default function TabLayout() {
  const { t, isReady, hasChosenLanguage } = useI18n();
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (!isReady || (isLoading && !user)) return <FullScreenLoader />;
  if (!hasChosenLanguage) return <Redirect href="/language" />;
  if (!user) return <Redirect href="/auth" />;
  if (user.preferences === null) return <Redirect href="/preferences" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          { height: 62 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) },
        ],
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.home"), tabBarIcon: (props) => <TabIcon {...props} name="home" /> }}
      />
      <Tabs.Screen
        name="study"
        options={{ title: t("tabs.study"), tabBarIcon: (props) => <TabIcon {...props} name="analytics" /> }}
      />
      <Tabs.Screen
        name="calculator"
        options={{ title: t("tabs.calculator"), tabBarIcon: (props) => <TabIcon {...props} name="calculator" /> }}
      />
      <Tabs.Screen
        name="advisor"
        options={{ title: t("tabs.advisor"), tabBarIcon: (props) => <TabIcon {...props} name="chatbubbles" /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t("tabs.history"), tabBarIcon: (props) => <TabIcon {...props} name="time" /> }}
      />
    </Tabs>
  );
}

/** Tab icon with a soft violet pill behind the active tab. */
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Ionicons name={name} size={size - 2} color={focused ? Colors.primaryText : color} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBarBackground,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  tabItem: {
    paddingVertical: 2,
  },
  iconPill: {
    minWidth: 46,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconPillActive: {
    backgroundColor: Colors.primarySoft,
  },
});
