import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  Dimensions,
  Text,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "./ui/AppBlurView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

import { useAppSettings } from "../contexts/AppSettingsContext";

const { width } = Dimensions.get("window");

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData } = useUser();
  const { isDark, themeColors, accentColor } = useThemeToggle();
  const { largeTouchTargets, triggerHaptic, highContrastMode } = useAppSettings();

  // Efficiently derive profile from UserContext with zero duplicate Firestore snapshots
  const profile = userData || user;

  const isActive = (route: string) => {
    const trimmed = route.replace("/(tabs)", "");
    return pathname.includes(route) || pathname.includes(trimmed);
  };

  const NavItem = ({ route, icon, label }: { route: string; icon: string; label: string }) => {
    const active = isActive(route);

    return (
      <Pressable
        onPress={() => {
          triggerHaptic("selection");
          const path = route.replace("/(tabs)", "");
          router.navigate(path as any);
        }}
        hitSlop={largeTouchTargets ? { top: 14, bottom: 14, left: 14, right: 14 } : { top: 6, bottom: 6, left: 6, right: 6 }}
        accessible={true}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        style={[
          styles.navItem,
          active && [
            styles.activeItemPill,
            {
              backgroundColor: accentColor,
            },
          ],
        ]}
      >
        <Ionicons
          name={active ? (icon as any) : ((icon + "-outline") as any)}
          size={22}
          color={
            active
              ? "#FFFFFF"
              : isDark
              ? "rgba(255, 255, 255, 0.55)"
              : "rgba(0, 0, 0, 0.45)"
          }
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.outerContainer}>
      {/* Main Navigation Pill */}
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.navPillContainer,
          {
            backgroundColor: isDark
              ? "rgba(20, 20, 20, 0.45)"
              : "rgba(255, 255, 255, 0.65)",
          },
        ]}
      >
        <NavItem route="/home" icon="home" label="Home Tab" />
        <NavItem route="/notes" icon="document-text" label="Notes Tab" />
        <NavItem route="/trips" icon="compass" label="Trips Tab" />
        <NavItem route="/chats" icon="chatbubble" label="Chats Tab" />
      </BlurView>

      {/* Standalone Profile Button */}
      <Pressable
        style={[
          styles.avatarWrapper,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.06)",
          },
          highContrastMode && {
            borderColor: isDark ? "#FFFFFF" : "#000000",
            borderWidth: 1.5,
          },
        ]}
        hitSlop={largeTouchTargets ? { top: 14, bottom: 14, left: 14, right: 14 } : { top: 6, bottom: 6, left: 6, right: 6 }}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Profile & Settings"
        onPress={() => {
          triggerHaptic("selection");
          router.push("/ProfileSettings" as any);
        }}
      >
        {profile?.photoURL || user?.photoURL || userData?.photoURL ? (
          <Image
            source={{
              uri:
                profile?.photoURL ||
                user?.photoURL ||
                userData?.photoURL ||
                undefined,
            }}
            style={styles.navAvatar}
          />
        ) : (
          <View
            style={[
              styles.navAvatar,
              styles.initialAvatar,
              { backgroundColor: accentColor },
            ]}
          >
            <Text style={styles.initialText}>
              {(profile?.name ||
                userData?.name ||
                user?.displayName ||
                "?")[0]?.toUpperCase()}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 20,
    zIndex: 20,
  },
  navPillContainer: {
    flexDirection: "row",
    borderRadius: 35,
    paddingHorizontal: 8,
    paddingVertical: 8,
    height: 64,
    flex: 1,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "space-around",
    overflow: "hidden",
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      },
    }),
  },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  activeItemPill: {
    borderRadius: 24,
    height: 48,
    width: 60,
  },
  avatarWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: "0 3px 12px rgba(0,0,0,0.08)",
      },
    }),
  },
  navAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  initialAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  initialText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});