import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Platform, StatusBar } from "react-native";
import { enableScreens, enableFreeze } from "react-native-screens";

import { UserProvider } from "../contexts/UserContext";
import {
  ThemeToggleProvider,
  useThemeToggle,
} from "../contexts/ThemeContext";

import { ChatSettingsProvider } from "../contexts/ChatSettingsContext";
import { CallProvider } from "../contexts/CallContext";

import NotificationsHandler from "../components/NotificationsHandler";
import IncomingCallHandler from "../components/IncomingCallHandler";
import { InAppNotificationBanner } from "../components/ui/InAppNotificationBanner";
import { GradientProvider } from "../contexts/GradientContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { AppSettingsProvider, useAppSettings } from "../contexts/AppSettingsContext";
import { AppAtmosphereBackground } from "../components/ui/AppAtmosphereBackground";

// Native hardware-accelerated screen optimizations
enableScreens(true);
enableFreeze(true);

function LayoutContent() {
  const { themeColors, isDark, reduceAnimations, background } = useThemeToggle();
  const { reduceMotion } = useAppSettings();

  const disableAnimations = reduceAnimations || reduceMotion;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themeColors.background,
      }}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.background}
      />
      <AppAtmosphereBackground />
      <GradientProvider>
        <UserProvider>
          <CallProvider>
            <ChatSettingsProvider>
              {/* Push notifications handler & interactive In-App banner */}
              <NotificationsHandler />
              <InAppNotificationBanner />
              <IncomingCallHandler />

              <Stack
                screenOptions={{
                  headerShown: false,
                  presentation: "card",
                  contentStyle: {
                    backgroundColor:
                      background.mode === "solid"
                        ? themeColors.background
                        : "transparent",
                  },
                  animation: disableAnimations ? "none" : "slide_from_right",
                  animationDuration: 180,
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  freezeOnBlur: true,
                  animationTypeForReplace: "push",
                }}
              />
            </ChatSettingsProvider>
          </CallProvider>
        </UserProvider>
      </GradientProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppSettingsProvider>
        <ThemeToggleProvider>
          <LanguageProvider>
            <LayoutContent />
          </LanguageProvider>
        </ThemeToggleProvider>
      </AppSettingsProvider>
    </GestureHandlerRootView>
  );
}