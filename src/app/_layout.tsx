import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import { UserProvider } from "../contexts/UserContext";
import { ThemeToggleProvider, useThemeToggle } from "../contexts/ThemeContext";
import { ChatSettingsProvider } from "../contexts/ChatSettingsContext";
import NotificationsHandler from "../components/NotificationsHandler";
import React from "react";

function LayoutContent() {
  const { themeColors } = useThemeToggle();

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <UserProvider>
        <ChatSettingsProvider>
          <NotificationsHandler />
          <Stack screenOptions={{ headerShown: false }} />
        </ChatSettingsProvider>
      </UserProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeToggleProvider>
        <LayoutContent />
      </ThemeToggleProvider>
    </GestureHandlerRootView>
  );
}