import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Image,
  Platform,
  Dimensions,
  Text,
  ActivityIndicator,
  Animated,
  Keyboard,
} from "react-native";
import { BlurView } from "./ui/AppBlurView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import * as Haptics from "expo-haptics";

import { useAppSettings } from "../contexts/AppSettingsContext";

const { width } = Dimensions.get("window");

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user, userData } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard listener for responsive floating above keyboard (Image 3)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sync profile data in real time
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Hide bottom navigation on full-screen chats
  if (pathname.includes("group-chatroom") || pathname.includes("chat/")) {
    return null;
  }

  const isActive = (route: string) => {
    const trimmed = route.replace("/(tabs)", "");
    return pathname.includes(route) || pathname.includes(trimmed);
  };

  const NavItem = ({
    route,
    icon,
  }: {
    route: string;
    icon: string;
  }) => {
    const active = isActive(route);
    const scaleAnim = useRef(new Animated.Value(active ? 1.05 : 1)).current;

    useEffect(() => {
      Animated.spring(scaleAnim, {
        toValue: active ? 1.05 : 1,
        useNativeDriver: true,
        friction: 6,
        tension: 80,
      }).start();
    }, [active]);

    const handlePress = () => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}

      // Press down animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      const path = route.replace("/(tabs)", "");
      router.push(path as any);
    };

    return (
      <Pressable
        onPress={handlePress}
        style={styles.navItemTouchTarget}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        <Animated.View
          style={[
            styles.navItemPill,
            active && styles.activeItemPill,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons
            name={active ? (icon as any) : ((icon + "-outline") as any)}
            size={22}
            color={active ? "#000000" : "rgba(255, 255, 255, 0.65)"}
          />
        </Animated.View>
      </Pressable>
    );
  };

  const bottomOffset =
    keyboardHeight > 0
      ? keyboardHeight + 8
      : Math.max(insets.bottom, 10) + 8;

  const userInitial = (
    profile?.name ||
    profile?.displayName ||
    userData?.name ||
    userData?.displayName ||
    user?.displayName ||
    "M"
  )[0]?.toUpperCase();

  const userPhoto =
    profile?.photoURL ||
    user?.photoURL ||
    userData?.photoURL ||
    null;

  return (
    <View
      style={[
        styles.outerContainer,
        {
          bottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.dockRow}>
        {/* Main Glossy Navigation Capsule Dock */}
        <View style={styles.dockGlassWrapper}>
          <BlurView intensity={70} tint="dark" style={styles.navPillContainer}>
            <NavItem route="/home" icon="home" />
            <NavItem route="/notes" icon="document-text" />
            <NavItem route="/trips" icon="compass" />
            <NavItem route="/chats" icon="chatbubble" />
          </BlurView>
        </View>

        {/* Standalone Circular Profile Pod */}
        <Pressable
          style={styles.avatarGlassWrapper}
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
            router.push("/settings" as any);
          }}
          hitSlop={8}
        >
          <BlurView intensity={70} tint="dark" style={styles.avatarPillContainer}>
            {profileLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.navAvatar} />
            ) : (
              <View style={[styles.navAvatar, styles.initialAvatar]}>
                <Text style={styles.initialText}>{userInitial}</Text>
              </View>
            )}
          </BlurView>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  dockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 345,
    paddingHorizontal: 12,
    gap: 8,
  },
  dockGlassWrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  navPillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 5,
    height: 56,
  },
  navItemTouchTarget: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navItemPill: {
    height: 40,
    width: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  activeItemPill: {
    backgroundColor: "#e5e7eb", // Soft glossy light off-white from images 1 & 2
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarGlassWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPillContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  navAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "#1c2026",
    overflow: "hidden",
  },
  initialAvatar: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00a884", // Vibrant teal green from Image 1 & 2
  },
  initialText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
});