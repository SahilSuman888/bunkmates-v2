import React, { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  Image,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { Feather, Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import UserProfileModal from "../../components/UserProfileModal";
import AddFriendModal from "../../components/chat/AddFriendModal";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import { updateDoc, doc, arrayUnion, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function ChatsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const { chats = [], loading: chatsLoading } =
    useUserChats(user?.uid || null) || {};

  const { groups = [], loading: groupsLoading } =
    useUserGroups(user?.uid || null) || {};

  const { requests = [], loading: requestsLoading } =
    useFriendRequests(user?.uid || null) || {};

  const [searchText, setSearchText] = useState("");

  // Modal States
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    return chats.filter((chat: any) =>
      (chat?.name || "").toLowerCase().includes(searchText.toLowerCase().trim())
    );
  }, [chats, searchText]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group: any) =>
      (group?.name || "").toLowerCase().includes(searchText.toLowerCase().trim())
    );
  }, [groups, searchText]);

  const combinedList = useMemo(() => {
    const normalizedChats = (filteredChats || []).map((c: any) => ({
      id: c.id,
      type: "chat",
      title: c.name || c.displayName || "BunkMate Traveler",
      subtitle: c.lastMessage || "No messages yet",
      avatar: c.avatar || c.photoURL || "https://i.pravatar.cc/150?img=11",
      timestamp: c.lastTimestamp || c.updatedAt || 0,
      unreadCount: c.unreadCount || 0,
      badge: null,
      rawItem: c,
    }));

    const normalizedGroups = (filteredGroups || []).map((g: any) => ({
      id: g.id,
      type: "group",
      title: g.name || "Trip Group Chat",
      subtitle: g.lastMessage || "No messages yet",
      avatar: g.iconURL || "https://i.pravatar.cc/150?img=32",
      timestamp: g.lastTimestamp || g.updatedAt || 0,
      unreadCount: g.unreadCounts?.current || 0,
      badge: g.name?.includes("Dev") ? "🧪 Dev Beta" : null,
      rawItem: g,
    }));

    return [...normalizedChats, ...normalizedGroups].sort(
      (a, b) => (b.timestamp?.seconds || b.timestamp || 0) - (a.timestamp?.seconds || a.timestamp || 0)
    );
  }, [filteredChats, filteredGroups]);

  const handleAvatarPress = (uid: string, e?: any) => {
    if (e) e.stopPropagation();
    if (!uid) return;
    setSelectedProfileUid(uid);
    setProfileModalVisible(true);
  };

  const loading = authLoading || chatsLoading || groupsLoading || requestsLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <View style={styles.container}>
          {/* HEADER matching Screenshot */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chats</Text>
            <NotificationBell />
          </View>

          {/* SEARCH BAR matching Screenshot */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#777777" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users or groups..."
              placeholderTextColor="#777777"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <Pressable onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#777777" />
              </Pressable>
            ) : null}
          </View>

          {/* CHAT LIST matching Screenshot */}
          <ScrollView
            contentContainerStyle={{ paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
          >
            {combinedList.length > 0 ? (
              combinedList.map((item: any) => (
                <Pressable
                  key={`${item.type}-${item.id}`}
                  onPress={() =>
                    item.type === "chat"
                      ? router.push(`/chat/${item.id}` as any)
                      : router.push(`/(tabs)/group-chatroom/${item.id}` as any)
                  }
                  style={styles.card}
                >
                  <Pressable
                    onPress={(e) =>
                      item.type === "chat"
                        ? handleAvatarPress(item.rawItem?.uid || item.id, e)
                        : null
                    }
                  >
                    <Image source={{ uri: item.avatar }} style={styles.avatar} />
                  </Pressable>

                  <View style={styles.cardMiddle}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.badge && (
                        <View style={styles.groupBadge}>
                          <Text style={styles.groupBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>

                  <View style={styles.cardRight}>
                    <Text style={styles.tsText}>
                      {formatTime(item.timestamp)}
                    </Text>
                    {item.unreadCount > 0 ? (
                      <View style={styles.unreadDot} />
                    ) : (
                      <View style={styles.unreadDot} />
                    )}
                  </View>
                </Pressable>
              ))
            ) : (
              <Empty text="No conversations found" />
            )}
          </ScrollView>

          {/* FLOATING ACTION BUTTON (+) matching Screenshot */}
          <Pressable
            style={styles.fabBtn}
            onPress={() => setAddFriendModalVisible(true)}
          >
            <Feather name="plus" size={26} color="#ffffff" />
          </Pressable>

          {/* USER PROFILE MODAL */}
          <UserProfileModal
            userId={selectedProfileUid}
            visible={profileModalVisible}
            onClose={() => setProfileModalVisible(false)}
            onStartChat={(targetUid) => {
              setProfileModalVisible(false);
              router.push(`/chat/${targetUid}` as any);
            }}
          />

          {/* ADD FRIEND / USER SEARCH MODAL */}
          <AddFriendModal
            visible={addFriendModalVisible}
            onClose={() => setAddFriendModalVisible(false)}
            onSelectUser={(foundUser) => {
              handleAvatarPress(foundUser.uid || foundUser.id);
            }}
            onCreateGroup={() => {
              setCreateGroupModalVisible(true);
            }}
          />

          {/* CREATE GROUP MODAL */}
          <CreateGroupModal
            visible={createGroupModalVisible}
            onClose={() => setCreateGroupModalVisible(false)}
            onGroupCreated={(groupId) => {
              router.push(`/(tabs)/group-chatroom/${groupId}` as any);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: "#777777", fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function formatTime(ts: any) {
  if (!ts) return "";
  let date: Date;
  if (typeof ts === "number") {
    date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  } else if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13161c",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#222222",
  },
  cardMiddle: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  groupBadge: {
    backgroundColor: "rgba(37, 211, 102, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupBadgeText: {
    color: "#25d366",
    fontSize: 10,
    fontWeight: "800",
  },
  cardSub: {
    color: "#888888",
    fontSize: 13,
    marginTop: 4,
  },
  cardRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  tsText: {
    color: "#888888",
    fontSize: 11,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#e2a567",
  },
  fabBtn: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#c87a1c",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
});