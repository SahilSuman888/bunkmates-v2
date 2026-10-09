import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";

export default function ProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commonTrips, setCommonTrips] = useState<any[]>([]);
  const [mutualCount, setMutualCount] = useState(0);

  // ================= LOAD USER =================
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "users", id.toString()), (snap) => {
      if (snap.exists()) setProfile(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  // ================= MUTUAL FRIENDS =================
  useEffect(() => {
    if (!profile || !user) return;
    const mutual = profile.friends?.filter((f: string) => user.friends?.includes(f)) || [];
    setMutualCount(mutual.length);
  }, [profile]);

  // ================= COMMON TRIPS =================
  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, "trips"), where("members", "array-contains", user.uid));
    getDocs(q).then((snap) => {
      const filtered = snap.docs.filter((docSnap) => docSnap.data().members.includes(id));
      setCommonTrips(filtered.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [id]);

  // ================= ACTIONS =================
  const deleteChat = async () => {
    if (!user || !id) return;
    const chatId = [user.uid, id].sort().join("_");
    try {
      await deleteDoc(doc(db, "chats", chatId));
      Alert.alert("Chat Deleted");
      router.back();
    } catch { Alert.alert("Delete failed"); }
  };

  const blockUser = async () => {
    if (!user || !id) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        blockedUids: [...(user.blockedUids || []), id],
      });
      Alert.alert("User Blocked");
    } catch { Alert.alert("Block failed"); }
  };

  const removeFriend = async () => {
    if (!user || !id) return;
    try {
      const updated = user.friends?.filter((f: string) => f !== id) || [];
      await updateDoc(doc(db, "users", user.uid), { friends: updated });
      Alert.alert("Removed from friends");
      router.back();
    } catch { Alert.alert("Remove failed"); }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "#fff" }}>Loading Profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "#fff" }}>User not found</Text>
      </View>
    );
  }

  const isPrivate =
    profile.privacy?.profileVisibility === "private" ||
    profile.profileVisibility === "private";
  const isFriend =
    profile.friends?.includes(user?.uid) ||
    user?.friends?.includes(id?.toString());
  const isSelf = user?.uid === id?.toString();
  const canViewFullProfile = !isPrivate || isFriend || isSelf;

  const [friendRequested, setFriendRequested] = useState(false);

  const handleAddFriend = () => {
    setFriendRequested(true);
    Alert.alert("Friend Request Sent", `A friend request was sent to @${profile.username || profile.name}.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* TOP BACK BUTTON */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#fff" />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        {/* PROFILE HEADER */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.photoURL || "https://i.pravatar.cc/300" }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile.name || "User"}</Text>
          <Text style={styles.username}>@{profile.username || "user"}</Text>
          {isPrivate && (
            <View style={[styles.nicknamePill, { flexDirection: "row", alignItems: "center", marginTop: 4 }]}>
              <Ionicons name="lock-closed" size={12} color="#aaa" style={{ marginRight: 4 }} />
              <Text style={styles.nicknameText}>Private Account</Text>
            </View>
          )}
        </View>

        {!canViewFullProfile ? (
          /* PRIVATE ACCOUNT GUARD */
          <View style={styles.privateCard}>
            <View style={styles.privateIconCircle}>
              <Ionicons name="lock-closed-outline" size={28} color="#E2E8F0" />
            </View>
            <Text style={styles.privateTitle}>This Account is Private</Text>
            <Text style={styles.privateSubtitle}>
              Follow or become friends with @{profile.username || profile.name} to see their trips, groups, and activity.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.addFriendBtn,
                friendRequested && { backgroundColor: "rgba(255,255,255,0.15)" },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleAddFriend}
              disabled={friendRequested}
            >
              <Ionicons
                name={friendRequested ? "checkmark" : "person-add"}
                size={16}
                color={friendRequested ? "#fff" : "#000"}
              />
              <Text style={[styles.addFriendText, friendRequested && { color: "#fff" }]}>
                {friendRequested ? "Request Sent" : "Add Friend"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* INFO LIST */}
            <View style={styles.listContainer}>
              <View style={styles.listItem}>
                <Text style={styles.listText}>{mutualCount} Mutual Friends</Text>
                <View style={styles.mutualAvatarsWrapper}>
                  {/* Dummy overlapping avatars matching the image */}
                  <Image source={{ uri: "https://i.pravatar.cc/100?img=1" }} style={[styles.mutualAvatar, { zIndex: 3 }]} />
                  <Image source={{ uri: "https://i.pravatar.cc/100?img=2" }} style={[styles.mutualAvatar, styles.mutualOverlap, { zIndex: 2 }]} />
                  <Image source={{ uri: "https://i.pravatar.cc/100?img=3" }} style={[styles.mutualAvatar, styles.mutualOverlap, { zIndex: 1 }]} />
                </View>
              </View>
              
              {profile.mobile && (
                <View style={styles.listItem}>
                  <Feather name="phone" size={18} color="#ccc" style={styles.listIcon} />
                  <Text style={styles.listText}>{profile.mobile}</Text>
                </View>
              )}
              
              <View style={styles.listItem}>
                <Feather name="user" size={18} color="#ccc" style={styles.listIcon} />
                <Text style={styles.listText}>Profile</Text>
              </View>

              <View style={styles.listItem}>
                <MaterialCommunityIcons name="format-text" size={20} color="#ccc" style={styles.listIcon} />
                <Text style={styles.listText}>Add a Nickname</Text>
              </View>
            </View>

            {/* COMMON GROUPS */}
            <Text style={styles.sectionTitle}>Common Groups</Text>
            <View style={styles.groupItem}>
              <Image source={{ uri: "https://i.pravatar.cc/150?img=11" }} style={styles.groupAvatar} />
              <View style={styles.groupTextContainer}>
                <Text style={styles.groupTitle}>BM - Dev Beta</Text>
                <Text style={styles.groupMembers} numberOfLines={1}>Jayendra Choudhary, Mohit Sharma, Sahil...</Text>
              </View>
            </View>
            <View style={styles.groupItem}>
              <Image source={{ uri: "https://i.pravatar.cc/150?img=12" }} style={styles.groupAvatar} />
              <View style={styles.groupTextContainer}>
                <Text style={styles.groupTitle}>Chai Circle Lite</Text>
                <Text style={styles.groupMembers} numberOfLines={1}>Sahil Suman, Jayendra Choudhary, Rauna...</Text>
              </View>
            </View>

            {/* COMMON TRIPS */}
            <Text style={styles.sectionTitle}>Common Trips</Text>
            {commonTrips.length > 0 ? (
              commonTrips.map((trip) => (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripHeaderRow}>
                    <Text style={styles.tripTitle}>{trip.name || "Bunkers of Thar"}</Text>
                    <View style={styles.tripProgressContainer}>
                      <Text style={styles.tripProgressText}>0 / 1 complete</Text>
                      <View style={styles.progressBarBg}>
                        <View style={styles.progressBarFill} />
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.tripRow}>
                    <Feather name="map-pin" size={12} color="#888" />
                    <Text style={styles.tripSubText}>{trip.location || "Jaipur → Jaisalmer"}</Text>
                  </View>
                  <View style={styles.tripRow}>
                    <Feather name="clock" size={12} color="#888" />
                    <Text style={styles.tripSubText}>{trip.startDate || "2025-11-07"} → {trip.endDate || "2025-11-10"}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.tripCard}>
                <View style={styles.tripHeaderRow}>
                  <Text style={styles.tripTitle}>Bunkers of Thar</Text>
                  <View style={styles.tripProgressContainer}>
                    <Text style={styles.tripProgressText}>0 / 1 complete</Text>
                    <View style={styles.progressBarBg}>
                      <View style={styles.progressBarFill} />
                    </View>
                  </View>
                </View>
                
                <View style={styles.tripRow}>
                  <Feather name="map-pin" size={12} color="#888" />
                  <Text style={styles.tripSubText}>Jaipur → Jaisalmer</Text>
                </View>
                <View style={styles.tripRow}>
                  <Feather name="clock" size={12} color="#888" />
                  <Text style={styles.tripSubText}>2025-11-07 → 2025-11-10</Text>
                </View>
              </View>
            )}

            {/* DANGER ZONE (Only visible when friends/connected) */}
            <View style={styles.dangerZone}>
              <Pressable onPress={deleteChat} style={styles.dangerBtn}>
                <Feather name="trash-2" size={18} color="#d94a4a" style={styles.dangerIcon} />
                <Text style={styles.dangerText}>Delete Chat</Text>
              </Pressable>

              <Pressable onPress={blockUser} style={styles.dangerBtn}>
                <Feather name="slash" size={18} color="#d94a4a" style={styles.dangerIcon} />
                <Text style={styles.dangerText}>Block Friend</Text>
              </Pressable>

              {isFriend && (
                <Pressable onPress={removeFriend} style={styles.dangerBtn}>
                  <Feather name="minus-circle" size={18} color="#d94a4a" style={styles.dangerIcon} />
                  <Text style={styles.dangerText}>Remove from Friend</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  
  // Header
  backButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e1e1e", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignSelf: "flex-start", marginTop: Platform.OS === 'android' ? 20 : 10, marginBottom: 20 },
  backText: { color: "#fff", fontSize: 12, fontWeight: "bold", marginLeft: 6 },
  
  // Profile Top
  profileHeader: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  name: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  username: { color: "#aaa", fontSize: 13, marginBottom: 8 },
  nicknamePill: { backgroundColor: "#1e1e1e", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  nicknameText: { color: "#aaa", fontSize: 12 },

  // List Items
  listContainer: { marginBottom: 10 },
  listItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#131313", padding: 16, borderRadius: 12, marginBottom: 8 },
  listIcon: { marginRight: 14 },
  listText: { color: "#ddd", fontSize: 14, flex: 1 },
  
  mutualAvatarsWrapper: { flexDirection: "row", alignItems: "center" },
  mutualAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: "#131313" },
  mutualOverlap: { marginLeft: -8 },

  // Sections
  sectionTitle: { color: "#fff", fontSize: 14, fontWeight: "bold", marginTop: 24, marginBottom: 12 },
  
  // Groups
  groupItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#131313", padding: 12, borderRadius: 12, marginBottom: 8 },
  groupAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  groupTextContainer: { flex: 1 },
  groupTitle: { color: "#fff", fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  groupMembers: { color: "#888", fontSize: 11 },

  // Trips
  tripCard: { backgroundColor: "#131313", padding: 16, borderRadius: 12, marginBottom: 8 },
  tripHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  tripTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  tripProgressContainer: { alignItems: "flex-end" },
  tripProgressText: { color: "#aaa", fontSize: 10, marginBottom: 4 },
  progressBarBg: { width: 60, height: 3, backgroundColor: "#333", borderRadius: 2 },
  progressBarFill: { width: "30%", height: "100%", backgroundColor: "#555", borderRadius: 2 }, // Hardcoded 30% for visual match
  tripRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  tripSubText: { color: "#aaa", fontSize: 12, marginLeft: 6 },

  // Danger Zone
  dangerZone: { marginTop: 20 },
  dangerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a0f0f", padding: 16, borderRadius: 12, marginBottom: 8 },
  dangerIcon: { marginRight: 12 },
  dangerText: { color: "#d94a4a", fontSize: 14 },

  // Private Account Card
  privateCard: {
    backgroundColor: "#161618",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 20,
    borderWidth: 0,
  },
  privateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#202024",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  privateTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  privateSubtitle: {
    color: "#8E95A2",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  addFriendBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addFriendText: {
    color: "#000000",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
});