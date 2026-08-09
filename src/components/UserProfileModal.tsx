import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const { height } = Dimensions.get("window");

export default function UserProfileModal({
  userId,
  userData: initialUserData,
  visible,
  onClose,
  onStartChat,
}: {
  userId?: string | null;
  userData?: any;
  visible: boolean;
  onClose: () => void;
  onStartChat?: (uid: string) => void;
}) {
  const [userProfile, setUserProfile] = useState<any>(initialUserData || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      if (initialUserData && initialUserData.uid === userId) {
        setUserProfile(initialUserData);
        return;
      }

      setLoading(true);
      getDoc(doc(db, "users", userId))
        .then((snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() });
          } else {
            setUserProfile(initialUserData || null);
          }
        })
        .catch((e) => console.log("Profile fetch error:", e))
        .finally(() => setLoading(false));
    }
  }, [visible, userId, initialUserData]);

  if (!visible) return null;

  const displayName =
    userProfile?.displayName ||
    userProfile?.name ||
    userProfile?.username ||
    "BunkMate User";

  const photoURL =
    userProfile?.photoURL ||
    userProfile?.avatar ||
    "https://i.pravatar.cc/150?img=12";

  const handleText = userProfile?.username
    ? `@${userProfile.username}`
    : "@bunkmate";

  const bioText =
    userProfile?.bio ||
    userProfile?.about ||
    "Exploring the world one bunk at a time ✈️🏕️";

  const locationText =
    userProfile?.location || userProfile?.city || "Goa, India";

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.cardContainer}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.dragHandleBar} />

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </Pressable>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00e6b0" />
            </View>
          ) : (
            <View style={styles.content}>
              {/* AVATAR HERO */}
              <View style={styles.avatarHero}>
                <Image source={{ uri: photoURL }} style={styles.avatarImg} />
                <View style={styles.onlineDot} />
              </View>

              {/* USER INFO */}
              <Text style={styles.nameText}>{displayName}</Text>
              <Text style={styles.handleText}>{handleText}</Text>

              {/* BIO */}
              <Text style={styles.bioText}>{bioText}</Text>

              {/* METRICS ROW */}
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Feather name="map-pin" size={14} color="#00e6b0" />
                  <Text style={styles.metricVal}>{locationText}</Text>
                </View>

                <View style={styles.metricItem}>
                  <Ionicons name="people-outline" size={14} color="#00e6b0" />
                  <Text style={styles.metricVal}>
                    {userProfile?.friendsCount || 12} Mutual
                  </Text>
                </View>
              </View>

              {/* ACTIONS */}
              <View style={styles.actionRow}>
                {onStartChat && userId ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onStartChat(userId);
                    }}
                    style={styles.messageBtn}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#00140f" />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </Pressable>
                ) : null}

                <Pressable onPress={onClose} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  cardContainer: {
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
    backgroundColor: "rgba(14, 16, 24, 0.95)",
    padding: 20,
    paddingTop: 12,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 10,
    alignSelf: "center",
    marginBottom: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  avatarHero: {
    position: "relative",
    marginBottom: 12,
  },
  avatarImg: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: "#00e6b0",
    backgroundColor: "#1e1e24",
  },
  onlineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00e6b0",
    borderWidth: 2,
    borderColor: "#121214",
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  nameText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },
  handleText: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  bioText: {
    color: "#cccccc",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricVal: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  messageBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#00e6b0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  messageBtnText: {
    color: "#00140f",
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryBtn: {
    minWidth: 90,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
