// FULL ACCOUNT SETTINGS - EXACT UI MATCH

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  StatusBar,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { db, auth } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";

export default function Accounts() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [privacy, setPrivacy] = useState<any>({
    profileVisibility: "public",
    canBeAddedToGroups: "everyone",
    canBeAddedToTrips: "everyone",
  });

  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const accentColor = "#ff7a3d";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().privacy) {
        setPrivacy(snap.data().privacy);
      }
      setLoading(false);
    })();
  }, [authLoading, user]);

  const updatePrivacy = async (field: string, value: string) => {
    setPrivacy((p: any) => ({ ...p, [field]: value }));
    await updateDoc(doc(db, "users", user!.uid), {
      [`privacy.${field}`]: value,
    });
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        router.replace("/(auth)/login" as any);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#000000", "#05080f", "#0b1622"]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />

        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Account Settings</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>

          <Text style={styles.section}>PRIVACY</Text>

          {/* PRIVATE PROFILE */}
          <View style={styles.row}>
            <Feather name="lock" size={20} color="#fff" />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.title}>Private Profile</Text>
              <Text style={styles.subtitle}>
                Makes your profile visible only to friends
              </Text>
            </View>

            <Pressable
              style={[
                styles.switch,
                privacy.profileVisibility === "private" && {
                  backgroundColor: accentColor,
                },
              ]}
              onPress={() =>
                updatePrivacy(
                  "profileVisibility",
                  privacy.profileVisibility === "private"
                    ? "public"
                    : "private"
                )
              }
            >
              <View
                style={[
                  styles.thumb,
                  privacy.profileVisibility === "private"
                    ? styles.thumbRight
                    : styles.thumbLeft,
                ]}
              />
            </Pressable>
          </View>

          {/* GROUPS */}
          <Pressable
            style={styles.card}
            onPress={() => setShowGroupsModal(true)}
          >
            <MaterialCommunityIcons
              name="account-group-outline"
              size={22}
              color="#fff"
            />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.title}>
                Who can add you to groups
              </Text>
              <Text style={styles.subtitle}>
                {privacy.canBeAddedToGroups}
              </Text>
            </View>
          </Pressable>

          {/* TRIPS */}
          <Pressable
            style={styles.card}
            onPress={() => setShowTripsModal(true)}
          >
            <Feather name="briefcase" size={20} color="#fff" />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.title}>
                Who can add you to trips
              </Text>
              <Text style={styles.subtitle}>
                {privacy.canBeAddedToTrips}
              </Text>
            </View>
          </Pressable>

          <Text style={styles.section}>ACCOUNT ACTIONS</Text>

          <Pressable
            style={styles.row}
            onPress={() => setShowDeleteConfirm(true)}
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={22}
              color="#ff3b3b"
            />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={{ color: "#ff3b3b", fontSize: 16 }}>
                Delete Account
              </Text>
              <Text style={styles.subtitle}>
                This action is permanent and cannot be undone
              </Text>
            </View>
          </Pressable>
        </ScrollView>

        {/* SELECTOR MODAL */}
        <Modal transparent visible={showGroupsModal || showTripsModal} animationType="fade">
          <View style={styles.overlay} />
          <View style={styles.selectorWrapper}>
            <View style={styles.selectorCard}>
              {["everyone", "friends", "nobody"].map((opt) => {
                const field = showGroupsModal
                  ? "canBeAddedToGroups"
                  : "canBeAddedToTrips";
                const selected = privacy[field] === opt;

                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.selectorItem,
                      selected && { backgroundColor: accentColor },
                    ]}
                    onPress={() => {
                      updatePrivacy(field, opt);
                      setShowGroupsModal(false);
                      setShowTripsModal(false);
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 16 }}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                    {selected && (
                      <Feather name="check" size={18} color="#fff" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Modal>

        {/* DELETE MODAL */}
        <Modal transparent visible={showDeleteConfirm} animationType="fade">
          <View style={styles.overlayDark}>
            <View style={styles.deleteCard}>
              <View style={styles.deleteIcon}>
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={30}
                  color="#ff3b3b"
                />
              </View>

              <Text style={styles.deleteTitle}>
                Are you absolutely sure?
              </Text>

              <Text style={styles.deleteText}>
                This will permanently delete your account and all of your data.
                <Text style={{ color: "#ff3b3b" }}>
                  {" "}
                  This action cannot be undone.
                </Text>
              </Text>

              <View style={{ flexDirection: "row", marginTop: 25 }}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={{ color: "#fff" }}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={styles.deleteBtn}
                  onPress={handleDeleteAccount}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Delete My Account
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },

  section: {
    color: "#777",
    marginTop: 25,
    marginLeft: 20,
    marginBottom: 10,
    fontSize: 12,
    letterSpacing: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginHorizontal: 15,
    marginBottom: 15,
  },

  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  subtitle: { color: "#aaa", fontSize: 13, marginTop: 4 },

  switch: {
    width: 50,
    height: 26,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 3,
  },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  thumbRight: { alignSelf: "flex-end" },
  thumbLeft: { alignSelf: "flex-start" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  selectorWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  selectorCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 25,
    padding: 15,
  },
  selectorItem: {
    padding: 18,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  overlayDark: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  deleteCard: {
    backgroundColor: "#111",
    borderRadius: 25,
    padding: 30,
    width: "100%",
    alignItems: "center",
  },
  deleteIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  deleteTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
  },
  deleteText: {
    color: "#ccc",
    textAlign: "center",
    lineHeight: 22,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  deleteBtn: {
    flex: 1.5,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#8b0000",
    justifyContent: "center",
    alignItems: "center",
  },
});