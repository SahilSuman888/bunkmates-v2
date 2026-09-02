import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import { collection, doc, getDoc, setDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";
import { Ionicons, Feather } from "@expo/vector-icons";

export default function CreateGroupModal({
  visible,
  onClose,
  onGroupCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (groupId: string) => void;
}) {
  const { user: currentUser } = useUser();
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupIcon, setGroupIcon] = useState("🏕️");
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const EMOJI_ICONS = ["🏕️", "✈️", "🌴", "🗺️", "🏔️", "🛵", "🍻", "🏄", "🎒", "🏨"];

  useEffect(() => {
    if (visible && currentUser) {
      setLoadingFriends(true);
      getDoc(doc(db, "users", currentUser.uid))
        .then(async (userSnap) => {
          if (userSnap.exists()) {
            const friendUids: string[] = userSnap.data().friends || [];
            const fetched: any[] = [];
            for (const fUid of friendUids) {
              const fSnap = await getDoc(doc(db, "users", fUid)).catch(() => null);
              if (fSnap && fSnap.exists()) {
                fetched.push({ id: fSnap.id, uid: fSnap.id, ...fSnap.data() });
              }
            }
            setFriendsList(fetched);
          }
        })
        .finally(() => setLoadingFriends(false));
    }
  }, [visible, currentUser]);

  const toggleMember = (uid: string) => {
    if (selectedMembers.includes(uid)) {
      setSelectedMembers(selectedMembers.filter((id) => id !== uid));
    } else {
      setSelectedMembers([...selectedMembers, uid]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name Required", "Please enter a name for your group chat.");
      return;
    }
    if (!currentUser) return;

    setSubmitting(true);
    try {
      const allMembers = Array.from(new Set([currentUser.uid, ...selectedMembers]));
      const groupRef = doc(collection(db, "groups"));

      const groupData = {
        id: groupRef.id,
        name: groupName.trim(),
        description: groupDesc.trim() || "Trip & BunkMate group chat",
        iconURL: groupIcon,
        createdBy: currentUser.uid,
        adminUids: [currentUser.uid],
        members: allMembers,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: `${currentUser.displayName || "Someone"} created the group`,
        lastTimestamp: serverTimestamp(),
      };

      await setDoc(groupRef, groupData);

      // Add system announcement message inside messages subcollection
      await addDoc(collection(db, "groups", groupRef.id, "messages"), {
        text: `🎉 Group "${groupName.trim()}" created!`,
        senderId: "system",
        senderName: "System",
        timestamp: serverTimestamp(),
      });

      setGroupName("");
      setGroupDesc("");
      setSelectedMembers([]);
      onClose();
      onGroupCreated(groupRef.id);
    } catch (e: any) {
      console.error("Error creating group:", e);
      Alert.alert("Error", "Failed to create group. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.dragBar} />

          <View style={styles.header}>
            <Text style={styles.title}>Create Group Chat</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* EMOJI SELECTOR */}
            <Text style={styles.label}>Choose Group Icon</Text>
            <View style={styles.emojiRow}>
              {EMOJI_ICONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => setGroupIcon(emoji)}
                  style={[styles.emojiBtn, groupIcon === emoji && styles.emojiBtnSelected]}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* INPUT FIELDS */}
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Goa Trip Bunkers 2026"
              placeholderTextColor="#666"
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Planning stays, rides, and activities"
              placeholderTextColor="#666"
              value={groupDesc}
              onChangeText={setGroupDesc}
            />

            {/* SELECT FRIENDS */}
            <Text style={styles.label}>
              Select Members ({selectedMembers.length} selected)
            </Text>

            {loadingFriends ? (
              <ActivityIndicator size="small" color="#00e6b0" style={{ marginVertical: 12 }} />
            ) : friendsList.length === 0 ? (
              <Text style={styles.noFriendsText}>
                No BunkMate friends found. Add friends first to add them to groups!
              </Text>
            ) : (
              <View style={{ gap: 8, marginVertical: 8 }}>
                {friendsList.map((item) => {
                  const isSelected = selectedMembers.includes(item.uid);
                  return (
                    <Pressable
                      key={item.uid}
                      style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                      onPress={() => toggleMember(item.uid)}
                    >
                      <Image
                        source={{
                          uri: item.photoURL || item.avatar || "https://i.pravatar.cc/150?img=12",
                        }}
                        style={styles.avatar}
                      />
                      <Text style={styles.memberName}>
                        {item.displayName || item.name || "BunkMate"}
                      </Text>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? "#00e6b0" : "#666"}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* SUBMIT BUTTON */}
            <Pressable
              style={[styles.createBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#00140f" />
              ) : (
                <>
                  <Ionicons name="people-sharp" size={18} color="#00140f" />
                  <Text style={styles.createBtnText}>Create Group</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 16,
    height: "82%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    overflow: "hidden",
    backgroundColor: "rgba(14, 16, 24, 0.95)",
    padding: 16,
  },
  dragBar: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 10,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#cccccc",
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnSelected: {
    backgroundColor: "rgba(0, 230, 176, 0.2)",
    borderWidth: 1.5,
    borderColor: "#00e6b0",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    color: "#ffffff",
    fontSize: 13.5,
  },
  noFriendsText: {
    color: "#888888",
    fontSize: 12.5,
    fontStyle: "italic",
    marginVertical: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  memberRowSelected: {
    backgroundColor: "rgba(0, 230, 176, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.3)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  createBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#00e6b0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  createBtnText: {
    color: "#00140f",
    fontSize: 15,
    fontWeight: "800",
  },
});
