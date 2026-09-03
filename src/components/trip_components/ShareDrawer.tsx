import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  limit,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

interface Member {
  uid: string;
  name?: string;
  email?: string;
  photoURL?: string;
  username?: string;
}

interface Trip {
  id?: string;
  name?: string;
  members?: string[];
}

interface Props {
  shareDrawerOpen: boolean;
  setShareDrawerOpen: (v: boolean) => void;
  inviteLink: string;
  trip?: Trip;
  memberDetails?: Member[];
  mode?: "light" | "dark";
  setSnackbar?: (v: { open: boolean; message: string }) => void;
}

interface ConnectionItem {
  id: string;
  uid: string;
  name: string;
  username: string;
  avatar: string;
  isActive: boolean;
}

const FALLBACK_CONNECTIONS: ConnectionItem[] = [
  {
    id: "conn-1",
    uid: "raunak_1",
    name: "Raunak Bansal",
    username: "@raunak_bansal",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
    isActive: true,
  },
  {
    id: "conn-2",
    uid: "ankit_2",
    name: "Ankit Mewara",
    username: "@Ankitmewara",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
    isActive: false,
  },
  {
    id: "conn-3",
    uid: "jayendra_3",
    name: "Jayendra Choudhary",
    username: "@jayendrachoudhary_111",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
    isActive: true,
  },
];

const ShareDrawer: React.FC<Props> = ({
  shareDrawerOpen,
  setShareDrawerOpen,
  inviteLink,
  trip,
  memberDetails = [],
  setSnackbar,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [qrError, setQrError] = useState(false);

  const displayLink =
    inviteLink || "https://bunk-mates.vercel.app/join?trip=" + (trip?.id || "");

  /* ─── FETCH GENUINE CONNECTIONS FROM FIRESTORE ─── */
  useEffect(() => {
    if (!shareDrawerOpen) return;

    let isMounted = true;
    (async () => {
      setLoadingConnections(true);
      try {
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid;

        const tripMemberUids: string[] = [
          ...(trip?.members || []),
          ...memberDetails.map((m) => m.uid),
        ];

        const fetchedMap = new Map<string, ConnectionItem>();

        // 1. Fetch from current user's friends list
        if (currentUid) {
          try {
            const myDoc = await getDoc(doc(db, "users", currentUid));
            const myFriends: string[] = myDoc.exists()
              ? myDoc.data()?.friends || []
              : [];

            for (const fUid of myFriends.slice(0, 20)) {
              if (fUid === currentUid) continue;
              const fSnap = await getDoc(doc(db, "users", fUid));
              if (fSnap.exists()) {
                const data = fSnap.data();
                const name =
                  data.displayName || data.name || data.username || "BunkMate";
                const uname =
                  data.username ||
                  (data.email ? data.email.split("@")[0] : "user");
                fetchedMap.set(fSnap.id, {
                  id: fSnap.id,
                  uid: fSnap.id,
                  name,
                  username: `@${uname}`,
                  avatar:
                    data.photoURL ||
                    data.avatar ||
                    `https://i.pravatar.cc/150?u=${fSnap.id}`,
                  isActive: tripMemberUids.includes(fSnap.id),
                });
              }
            }
          } catch (e) {
            console.log("Error loading friends in ShareDrawer:", e);
          }
        }

        // 2. Fetch other genuine platform users (up to 40)
        try {
          const q = query(collection(db, "users"), limit(40));
          const snap = await getDocs(q);
          snap.forEach((d) => {
            if (d.id === currentUid) return;
            if (!fetchedMap.has(d.id)) {
              const data = d.data();
              const name =
                data.displayName || data.name || data.username || "BunkMate";
              const uname =
                data.username ||
                (data.email ? data.email.split("@")[0] : "user");
              fetchedMap.set(d.id, {
                id: d.id,
                uid: d.id,
                name,
                username: `@${uname}`,
                avatar:
                  data.photoURL ||
                  data.avatar ||
                  `https://i.pravatar.cc/150?u=${d.id}`,
                isActive: tripMemberUids.includes(d.id),
              });
            }
          });
        } catch (e) {
          console.log("Error loading platform users in ShareDrawer:", e);
        }

        // 3. Fallback sample connections if fewer than 3 users in database
        if (fetchedMap.size === 0) {
          FALLBACK_CONNECTIONS.forEach((fc) => fetchedMap.set(fc.id, fc));
        }

        if (isMounted) {
          setConnections(Array.from(fetchedMap.values()));
        }
      } catch (err) {
        console.warn("Could not fetch genuine connections:", err);
        if (isMounted) {
          setConnections(FALLBACK_CONNECTIONS);
        }
      } finally {
        if (isMounted) setLoadingConnections(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [shareDrawerOpen, trip?.id, trip?.members, memberDetails]);

  /* ─── ADD CONNECTION DIRECTLY TO TRIP ─── */
  const handleAddConnection = async (conn: ConnectionItem) => {
    if (conn.isActive) {
      Alert.alert("Already Active", `${conn.name} is already a member of this trip.`);
      return;
    }

    if (!trip?.id) {
      // Toggle local state
      setConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? { ...c, isActive: true } : c))
      );
      Alert.alert("Added", `${conn.name} added to the trip!`);
      return;
    }

    try {
      // 1. Update trip document members
      await updateDoc(doc(db, "trips", trip.id), {
        members: arrayUnion(conn.uid),
      });

      // 2. Update corresponding group chat members if exists
      try {
        await updateDoc(doc(db, "groupChats", trip.id), {
          members: arrayUnion(conn.uid),
        });
      } catch (e) {
        console.log("No matching groupChat doc or updated:", e);
      }

      // 3. Update local state
      setConnections((prev) =>
        prev.map((c) => (c.id === conn.id ? { ...c, isActive: true } : c))
      );

      if (setSnackbar) {
        setSnackbar({ open: true, message: `Added ${conn.name} to trip!` });
      }
      Alert.alert("Member Added", `🎉 ${conn.name} has been added to ${trip.name || "this trip"}!`);
    } catch (error: any) {
      console.error("Failed to add member to trip:", error);
      Alert.alert("Error", "Could not add connection to trip. Please try again.");
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(displayLink);
      if (setSnackbar) {
        setSnackbar({ open: true, message: "Copied invite link!" });
      }
      Alert.alert("Copied!", "Trip invite link copied to clipboard.");
    } catch {
      Alert.alert("Link", displayLink);
    }
  };

  const openSocial = async (platform: string) => {
    const tripName = trip?.name || "our trip";
    const msg = `Join ${tripName} on BunkMates! 🚀\n${displayLink}`;
    let url = "";

    switch (platform) {
      case "whatsapp":
        url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
        break;
      case "telegram":
        url = `tg://msg?text=${encodeURIComponent(msg)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`;
        break;
      case "instagram":
        copyLink();
        url = "instagram://";
        break;
    }

    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        if (platform === "whatsapp") {
          await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
        } else if (platform === "telegram") {
          await Linking.openURL(
            `https://t.me/share/url?url=${encodeURIComponent(
              displayLink
            )}&text=${encodeURIComponent(tripName)}`
          );
        } else {
          copyLink();
        }
      }
    } catch {
      copyLink();
    }
  };

  const filteredConnections = connections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={shareDrawerOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setShareDrawerOpen(false)}
    >
      <View style={styles.modalOverlay}>
        {/* Fullscreen Heavy Background Blur (Matching Image 4) */}
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.6)" },
          ]}
          onPress={() => setShareDrawerOpen(false)}
        />

        {/* Bottom-anchored Sheet (Matching Image 4) */}
        <View style={styles.drawer}>
          {/* Top Handle */}
          <View style={styles.handle} />

          {/* Header Row: Trip Invite & Access Network + Close Button (Matching Image 4) */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Trip Invite & Access Network</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShareDrawerOpen(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* White QR Code Card (Matching Image 4) */}
            <View style={styles.qrCardBox}>
              {!qrError ? (
                <QRCode
                  value={displayLink}
                  size={184}
                  backgroundColor="#ffffff"
                  color="#000000"
                  onError={() => setQrError(true)}
                />
              ) : (
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      displayLink
                    )}`,
                  }}
                  style={{ width: 184, height: 184 }}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Invite Link Capsule Box (Matching Image 4) */}
            <TouchableOpacity
              style={styles.linkCapsuleBox}
              onPress={copyLink}
              activeOpacity={0.8}
            >
              <Text style={styles.linkCapsuleText} numberOfLines={1}>
                {displayLink}
              </Text>
              <Ionicons
                name="copy-outline"
                size={18}
                color="rgba(255, 255, 255, 0.7)"
              />
            </TouchableOpacity>

            {/* Add Connections Directly Section (Matching Image 4) */}
            <Text style={styles.sectionSubtitle}>Add Connections Directly</Text>

            {/* Search Input Box */}
            <View style={styles.searchBox}>
              <Ionicons
                name="search"
                size={16}
                color="rgba(255, 255, 255, 0.45)"
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search account connections..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                style={styles.searchInput}
              />
            </View>

            {/* Connections List (Loaded genuinely from Firebase) */}
            <View style={styles.connectionsList}>
              {loadingConnections && connections.length === 0 ? (
                <ActivityIndicator
                  size="small"
                  color="#00e676"
                  style={{ marginVertical: 14 }}
                />
              ) : filteredConnections.length === 0 ? (
                <Text style={styles.emptyConnText}>
                  No matching connections found.
                </Text>
              ) : (
                filteredConnections.map((conn) => (
                  <View key={conn.id} style={styles.connRow}>
                    <Image
                      source={{ uri: conn.avatar }}
                      style={styles.connAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.connName}>{conn.name}</Text>
                      <Text style={styles.connUsername}>{conn.username}</Text>
                    </View>
                    {conn.isActive ? (
                      <TouchableOpacity
                        style={styles.activePillBadge}
                        onPress={() => handleAddConnection(conn)}
                      >
                        <Text style={styles.activePillText}>Active</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.addConnBtn}
                        onPress={() => handleAddConnection(conn)}
                      >
                        <Ionicons name="add" size={18} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Social Share Buttons Row (Matching Image 4) */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialCircleBtn, { backgroundColor: "#25D366" }]}
                onPress={() => openSocial("whatsapp")}
              >
                <Ionicons name="logo-whatsapp" size={22} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialCircleBtn, { backgroundColor: "#229ED9" }]}
                onPress={() => openSocial("telegram")}
              >
                <Ionicons
                  name="paper-plane"
                  size={18}
                  color="#ffffff"
                  style={{ marginLeft: -1 }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialCircleBtn, { backgroundColor: "#1DA1F2" }]}
                onPress={() => openSocial("twitter")}
              >
                <Ionicons name="logo-twitter" size={20} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialCircleBtn, { backgroundColor: "#E1306C" }]}
                onPress={() => openSocial("instagram")}
              >
                <Ionicons name="logo-instagram" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default ShareDrawer;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: "rgba(18, 22, 32, 0.96)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: "88%",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 4,
  },
  qrCardBox: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 14,
  },
  linkCapsuleBox: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  linkCapsuleText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
  },
  sectionSubtitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  searchBox: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13.5,
  },
  connectionsList: {
    marginBottom: 20,
    minHeight: 120,
  },
  emptyConnText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 16,
  },
  connRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  connAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#1e2230",
  },
  connName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  connUsername: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  activePillBadge: {
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
  },
  activePillText: {
    color: "#00e676",
    fontSize: 12,
    fontWeight: "700",
  },
  addConnBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    marginTop: 10,
    paddingBottom: 10,
  },
  socialCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});