import { AccessibilityApplicator } from "../components/ui/AccessibilityApplicator";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Platform, StatusBar } from "react-native";
import { enableScreens, enableFreeze } from "react-native-screens";

import { UserProvider } from "../contexts/UserContext";
import { AppSettingsProvider } from "../contexts/AppSettingsContext";
import { LanguageProvider } from "../contexts/LanguageContext";

import {
  ThemeToggleProvider,
  useThemeToggle,
} from "../contexts/ThemeContext";

import { ChatSettingsProvider } from "../contexts/ChatSettingsContext";
import { CallProvider } from "../contexts/CallContext";

import NotificationsHandler from "../components/NotificationsHandler";
import IncomingCallHandler from "../components/IncomingCallHandler";
import OneSignalHandler from "../components/OneSignalHandler";
import { AppAtmosphereBackground } from "../components/ui/AppAtmosphereBackground";
import { InAppNotificationBanner } from "../components/ui/InAppNotificationBanner";
import { GradientProvider } from "../contexts/GradientContext";
import { initOneSignal } from "../lib/onesignal";
import { QRLoginDeepLinkHandler } from "../components/auth/QRLoginDeepLinkHandler";

// Initialize OneSignal & Android Notification Channels at module load
initOneSignal();

// Activate native screen management and background freeze for 60/120fps navigation
enableScreens(true);
enableFreeze(true);

function LayoutContent() {
  const { themeColors, isDark, reduceAnimations, background, reduceMotionAccessibility } = useThemeToggle();

  const disableAnimations = reduceAnimations || reduceMotionAccessibility;

  return (
    <AccessibilityApplicator>
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

                {/* OneSignal — handles push notification taps & call alerts */}
                <OneSignalHandler />

                {/* Local expo-notifications handler */}
                <NotificationsHandler />
                <InAppNotificationBanner />
                <IncomingCallHandler />
                <QRLoginDeepLinkHandler />

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
    </AccessibilityApplicator>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView
      style={{ flex: 1 }}
    >
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