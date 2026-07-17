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
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const { width } = Dimensions.get("window");

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, userData } = useUser();
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Keep local copy of profile data similar to web nav
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

  // Determine if a given path matches the current location.  Expo Router
  // creates real URLs without the grouping parentheses, but we're still
  // passing the grouped paths throughout the codebase in a few places. To be
  // safe we check both variants here and mark the tab active if either
  // appears in the pathname.
  const isActive = (route: string) => {
    const trimmed = route.replace("/(tabs)", "");
    return pathname.includes(route) || pathname.includes(trimmed);
  };

  const NavItem = ({ route, icon }: { route: string; icon: string }) => {
    const active = isActive(route);

    return (
      <Pressable
        onPress={() => {
          // Use push instead of replace so that normal back behaviour still
          // works, and strip the group name if present.  `router.push` behaves
          // more predictably when switching between tabs.
          const path = route.replace("/(tabs)", "");
          router.push(path);
        }}
        style={[styles.navItem, active && styles.activeItemPill]}
      >
        <Ionicons
          name={active ? (icon as any) : ((icon + "-outline") as any)}
          size={22}
          color={active ? "#000" : "rgba(255,255,255,0.6)"}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.outerContainer}>
      {/* Main Navigation Pill */}
      <BlurView intensity={30} tint="dark" style={styles.navPillContainer}>
        <NavItem route="/home" icon="home" />
        <NavItem route="/notes" icon="document-text" />
        <NavItem route="/trips" icon="compass" />
        <NavItem route="/chats" icon="chatbubble" />
      </BlurView>

      {/* Standalone Profile Button */}
      <Pressable 
        style={styles.avatarWrapper}
        onPress={() => router.push("/ProfileSettings" as any)}
      >
        {profileLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          // use snapshot data first, fall back to context/user
          (profile?.photoURL || user?.photoURL || userData?.photoURL) ? (
            <Image
              source={{
                uri: profile?.photoURL || user?.photoURL || userData?.photoURL || undefined,
              }}
              style={styles.navAvatar}
            />
          ) : (
            <View style={[styles.navAvatar, styles.initialAvatar]}> 
              <Text style={styles.initialText}>
                {(profile?.name || userData?.name || user?.displayName || "?")[0]?.toUpperCase()}
              </Text>
            </View>
          )
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
  },
  navPillContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 35,
    paddingHorizontal: 8,
    paddingVertical: 8,
    height: 64,
    flex: 1,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "space-around",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  activeItemPill: {
    backgroundColor: "#E5E5E5", // Off-white/light grey color from images
    borderRadius: 24,
    height: 48,
    width: 60,
  },
  avatarWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  navAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "#444", // dark fallback so initial is readable
    overflow: "hidden",
  },
  initialAvatar: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#4db6ac", // teal background to match screenshot
  },
  initialText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});