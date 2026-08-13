import React, { useEffect, useState } from "react";
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
  Platform,
  StatusBar,
} from "react-native";
import { collection, query, getDocs, limit } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";

export default function AddFriendModal({
  visible,
  onClose,
  onSelectUser,
  onCreateGroup,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: any) => void;
  onCreateGroup?: () => void;
}) {
  const { user: currentUser } = useUser();
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearchText("");
      setSelectedUserIds([]);
      setIsMultiSelectMode(false);
      return;
    }

    // Pre-populate Your Friends list
    setLoading(true);
    const q = query(collection(db, "users"), limit(40));
    getDocs(q)
      .then((snap) => {
        const users: any[] = [];
        snap.forEach((docSnap) => {
          if (docSnap.id === currentUser?.uid) return;
          const data = docSnap.data();
          users.push({ id: docSnap.id, uid: docSnap.id, ...data });
        });
        setAllUsers(users);
      })
      .catch((e) => console.error("Fetch users error:", e))
      .finally(() => setLoading(false));
  }, [visible, currentUser]);

  const filteredUsers = allUsers.filter((u) => {
    const term = searchText.toLowerCase().trim();
    if (!term) return true;
    const name = (u.displayName || u.name || "").toLowerCase();
    const username = (u.username || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(term) || username.includes(term) || email.includes(term);
  });

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#08090b" />

        {/* HEADER matching Screenshot 3 & 4 */}
        <View style={styles.header}>
          <Pressable style={styles.backCircleBtn} onPress={onClose}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>New Chat</Text>
        </View>

        {/* SEARCH BAR matching Screenshot 3 */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={18} color="#888888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends by name or username"
            placeholderTextColor="#666666"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#888888" />
            </Pressable>
          ) : null}
        </View>

        {/* ACTION BUTTONS matching Screenshot 3 */}
        {!isMultiSelectMode && (
          <View style={styles.actionSection}>
            <Pressable
              style={styles.actionRow}
              onPress={() => {
                if (onCreateGroup) {
                  onClose();
                  onCreateGroup();
                } else {
                  setIsMultiSelectMode(true);
                }
              }}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="person-add" size={18} color="#ffffff" />
              </View>
              <Text style={styles.actionText}>CREATE GROUP</Text>
            </Pressable>

            <Pressable
              style={styles.actionRow}
              onPress={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
              }}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="person-add-outline" size={18} color="#ffffff" />
              </View>
              <Text style={styles.actionText}>NEW CONTACT</Text>
            </Pressable>
          </View>
        )}

        {/* SECTION TITLE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#00e6b0" />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No friends found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            renderItem={({ item }) => {
              const isSelected = selectedUserIds.includes(item.id);
              return (
                <Pressable
                  style={styles.userRow}
                  onPress={() => {
                    if (isMultiSelectMode) {
                      toggleSelectUser(item.id);
                    } else {
                      onClose();
                      onSelectUser(item);
                    }
                  }}
                >
                  <Image
                    source={{
                      uri: item.photoURL || item.avatar || "https://i.pravatar.cc/150",
                    }}
                    style={styles.avatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.displayName || item.name || "BunkMate"}</Text>
                    <Text style={styles.userHandle}>@{item.username || "traveler"}</Text>
                  </View>

                  {isMultiSelectMode && (
                    <View style={[styles.checkboxCircle, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#000000" />}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        {/* BOTTOM ACTION BAR matching Screenshot 4 */}
        {isMultiSelectMode && (
          <View style={styles.bottomBar}>
            <Pressable style={styles.cancelBtn} onPress={() => setIsMultiSelectMode(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </Pressable>

            <Pressable
              style={[
                styles.continueBtn,
                selectedUserIds.length === 0 && { opacity: 0.5 },
              ]}
              disabled={selectedUserIds.length === 0}
              onPress={() => {
                if (onCreateGroup) {
                  onClose();
                  onCreateGroup();
                } else {
                  onClose();
                }
              }}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090b",
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 10 : 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1b1e24",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13161c",
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  actionSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "600",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#222222",
  },
  userName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  userHandle: {
    color: "#888888",
    fontSize: 12.5,
    marginTop: 2,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#666666",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#00e6b0",
    borderColor: "#00e6b0",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#888888",
    fontSize: 14,
  },
  bottomBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#ff5252",
    backgroundColor: "rgba(255, 82, 82, 0.08)",
  },
  cancelBtnText: {
    color: "#ff5252",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  continueBtn: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 25,
    backgroundColor: "#ffffff",
  },
  continueBtnText: {
    color: "#000000",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
