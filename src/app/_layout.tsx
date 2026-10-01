import { Stack } from "expo-router";

import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import { View, Platform } from "react-native";

import { UserProvider } from "../contexts/UserContext";

import {
  ThemeToggleProvider,
  useThemeToggle,
} from "../contexts/ThemeContext";

import { ChatSettingsProvider } from "../contexts/ChatSettingsContext";
import { CallProvider } from "../contexts/CallContext";

import NotificationsHandler from "../components/NotificationsHandler";
import IncomingCallHandler from "../components/IncomingCallHandler";
import { GradientProvider } from "../contexts/GradientContext";

function LayoutContent() {
  const { themeColors } = useThemeToggle();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: themeColors.background,
      }}
    >
      <GradientProvider>
        <UserProvider>
          <CallProvider>
            <ChatSettingsProvider>

              {/* Push notifications disabled temporarily */}
              <NotificationsHandler />
              <IncomingCallHandler />

              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: themeColors.background },
                  animation: Platform.OS === "ios" ? "default" : "slide_from_right",
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
    <GestureHandlerRootView
      style={{ flex: 1 }}
    >
      <ThemeToggleProvider>
        <LayoutContent />
      </ThemeToggleProvider>
    </GestureHandlerRootView>
  );
}