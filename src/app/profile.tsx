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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setProfile(snap.data());
        }
      } catch (e) {
        console.log("Profile fetch error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const handleLogout = async () => {
    await auth.signOut();
    router.replace("/(auth)/login" as any);
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#000000", "#0a0f1c", "#0c1b2a"]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>

          <Text style={styles.headerTitle}>Profile</Text>

          <Pressable
            style={styles.headerRight}
            onPress={() => router.push("/ProfileEdit")}
          >
            <Ionicons name="person-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarSection}>
            <Image
              source={{
                uri:
                  profile?.photoURL ||
                  "https://i.pravatar.cc/150?img=12",
              }}
              style={styles.avatar}
            />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {profile?.type || "Dev Beta"}
              </Text>
            </View>
          </View>

          <Text style={styles.name}>
            {profile?.name || "User"}
          </Text>
          <Text style={styles.username}>
            @{profile?.username || "username"}
          </Text>

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Your Beta Stats</Text>
            <Text style={styles.statsText}>Feedbacks: 0</Text>
            <Text style={styles.statsText}>Issues: 0</Text>
            <Text style={styles.statsText}>Reports: 0</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.label}>User Type</Text>
            <Text style={styles.value}>{profile?.type}</Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile?.email}</Text>

            <Text style={styles.label}>Mobile</Text>
            <Text style={styles.value}>{profile?.mobile}</Text>

            <Text style={styles.label}>Bio</Text>
            <Text style={styles.value}>
              {profile?.bio || "No bio added"}
            </Text>
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },

  headerRight: {
    width: 30,
    alignItems: "flex-end",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  avatarSection: {
    alignItems: "center",
    marginTop: 30,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  badge: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  badgeText: {
    color: "#fff",
    fontSize: 12,
  },

  name: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 15,
  },

  username: {
    textAlign: "center",
    fontSize: 14,
    color: "#aaa",
    marginBottom: 20,
  },

  statsCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
  },

  statsTitle: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },

  statsText: {
    color: "#ccc",
    fontSize: 13,
  },

  infoSection: {
    marginBottom: 30,
  },

  label: {
    color: "#888",
    marginTop: 15,
    fontSize: 12,
  },

  value: {
    color: "#fff",
    fontSize: 14,
    marginTop: 4,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5c0a0a",
    padding: 16,
    borderRadius: 20,
    gap: 8,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },
});