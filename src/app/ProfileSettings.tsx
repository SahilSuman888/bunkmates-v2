import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  Image,
  ActivityIndicator,
  StatusBar,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useThemeToggle } from "../contexts/ThemeContext";
import { MotiView } from "moti";

export default function ProfileSettings() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { themeColors } = useThemeToggle();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    photoURL: "",
    verified: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    (async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData({
            name: data.name || user.displayName || "Explorer",
            email: user.email || "",
            photoURL: data.photoURL || user.photoURL || "",
            verified: !!user.emailVerified,
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const SettingItem = ({ icon, title, subtitle, onPress, color = "#fff" }: any) => (
    <Pressable style={styles.settingItem} onPress={onPress}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Feather name="chevron-right" size={18} color="#444" />
    </Pressable>
  );

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/(auth)/login" as any);
    } catch (e) {
      console.error("logout", e);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: themeColors.background }] }>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={themeColors.text === '#ffffff' ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: themeColors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={[styles.profileCard, { backgroundColor: themeColors.border || '#1c1c1e' }]}
        >
          <Pressable style={styles.profilePressable} onPress={() => router.push('/profile')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image
              source={{ uri: profileData.photoURL || "https://i.pravatar.cc/150?img=11" }}
              style={styles.avatar}
            />
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: themeColors.text }]}>{profileData.name}</Text>
              <Text style={[styles.profileEmail, { color: themeColors.textSecondary }]} numberOfLines={1}>{profileData.email}</Text>
              {profileData.verified && (
                <Text style={styles.verifiedText}>Verified</Text>
              )}
          </View>
          <Pressable style={styles.qrButton}>
            <Ionicons name="grid-outline" size={20} color="#fff" />
          </Pressable>
        </MotiView>

        <View style={styles.settingsGroup}>
          <SettingItem
            icon="account-outline"
            title="Accounts"
            subtitle="View and manage your account details"
            onPress={() => router.push("/accounts")}
            color={themeColors.text}
          />
          <SettingItem
            icon="chat-outline"
            title="Chats"
            subtitle="Theme, Wallpapers, and Chat Settings"
            onPress={() => router.push('/chat-settings')}
            color={themeColors.text}
          />
          <SettingItem
            icon="cog-outline"
            title="General Settings"
            subtitle="App theme, accent, location, background"
            onPress={() => router.push('/general-settings' as any)}
            color={themeColors.text}
          />
          <SettingItem
            icon="help-circle-outline"
            title="Help"
            subtitle="Contact support and privacy policies"
            onPress={() => router.push('/help' as any)}
          />
          <SettingItem
            icon="message-alert-outline"
            title="Send feedback"
            subtitle="Report technical issues"
            onPress={() => router.push('/feedback' as any)}
          />
          <SettingItem
            icon="account-plus-outline"
            title="Invite a Friend"
            onPress={async () => {
              try {
                await Share.share({
                  message: 'Join me on BunkMates! https://example.com',
                });
              } catch {};
            }}
          />
          <SettingItem
            icon="information-outline"
            title="About"
            onPress={() => router.push('/about' as any)}
          />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 10,
  },

  backButton: { marginRight: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 25,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  profilePressable: { borderRadius: 30, overflow: 'hidden' },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  profileInfo: { flex: 1, marginLeft: 15 },
  profileName: { fontSize: 18, fontWeight: "bold" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  qrButton: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsGroup: { marginTop: 10 },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  iconContainer: { width: 40, alignItems: "center" },
  settingText: { flex: 1, marginLeft: 10 },
  settingTitle: { fontSize: 16, fontWeight: "600" },
  settingSubtitle: { fontSize: 12, marginTop: 4 },
  logoutBtn: {
    marginTop: 40,
    padding: 18,
    borderRadius: 15,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  logoutText: { color: "#ef4444", fontWeight: "bold", fontSize: 16 },
  verifiedText: { fontSize: 12, color: "#00e676", marginTop: 2 },
});
