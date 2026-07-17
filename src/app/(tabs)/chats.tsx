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
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import NotificationBell from '../../components/NotificationBell';
import GroupChatScreen from "../../components/group_chat/GroupChatScreen";

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
  const [activeTab, setActiveTab] =
    useState<"all" | "chats" | "groups" | "requests">("all");

  /* ================= ALWAYS DEFINE MEMOS ================= */

  const filteredChats = useMemo(() => {
    return chats.filter((chat: any) =>
      chat?.name?.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [chats, searchText]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group: any) =>
      group?.name?.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [groups, searchText]);

  const combinedList = useMemo(() => {
    // merge chats and groups into a single feed; normalize fields
    const normalizedChats = (filteredChats || []).map((c: any) => ({
      id: c.id,
      type: "chat",
      title: c.name,
      subtitle: c.lastMessage,
      avatar: c.avatar,
      timestamp: c.lastTimestamp || 0,
      unreadCount: c.unreadCount || 0,
    }));

    const normalizedGroups = (filteredGroups || []).map((g: any) => ({
      id: g.id,
      type: "group",
      title: g.name,
      subtitle: g.lastMessage || (g.description || `${g.members?.length || 0} members`),
      avatar: g.iconURL,
      timestamp: g.lastTimestamp || g.updatedAt || 0,
      unreadCount: g.unreadCounts?.current || 0,
    }));

    return [...normalizedChats, ...normalizedGroups].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [filteredChats, filteredGroups]);

  /* ================= SAFE LOADING ================= */

  const loading =
    authLoading || chatsLoading || groupsLoading || requestsLoading;

  /* ================= UI ================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e0e" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#b36a22" />
        </View>
      ) : (
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
              <Text style={styles.headerTitle}>Chats</Text>
              <NotificationBell />
          </View>

          {/* SEARCH */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#888"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* TABS */}
          <View style={styles.tabRow}>
            {["all", "chats", "groups", "requests"].map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab as any)}
                style={[
                  styles.tabButton,
                  activeTab === tab && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "requests"
                    ? `Requests (${requests.length})`
                    : tab === "groups"
                    ? "Groups"
                    : tab === "chats"
                    ? "Chats"
                    : "All"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === "all" &&
              (combinedList.length > 0 ? (
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
                    <Image
                      source={{ uri: item.avatar || "https://i.pravatar.cc/150" }}
                      style={styles.avatar}
                    />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardSub} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={styles.tsText}>{formatTime(item.timestamp)}</Text>
                      {item.unreadCount > 0 && <View style={styles.unreadDot} />}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty text="No conversations yet" />
              ))}

            {activeTab === "chats" &&
              (filteredChats.length > 0 ? (
                filteredChats.map((chat: any) => (
                  <Pressable
                    key={chat.id}
                    onPress={() => router.push(`/chat/${chat.id}` as any)}
                    style={styles.card}
                  >
                    <Image
                      source={{ uri: chat.avatar || "https://i.pravatar.cc/150?img=11" }}
                      style={styles.avatar}
                    />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.cardTitle}>{chat.name}</Text>
                      <Text style={styles.cardSub}>{chat.lastMessage}</Text>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={styles.tsText}>{formatTime(chat.lastTimestamp)}</Text>
                      {chat.unreadCount > 0 && <View style={styles.unreadDot} />}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty text="No chats yet" />
              ))}

            {activeTab === "requests" &&
              (requests.length > 0 ? (
                requests.map((req: any) => (
                  <View key={req.id} style={styles.card}>
                    <Image
                      source={{ uri: req.fromUserAvatar || "https://i.pravatar.cc/150?img=5" }}
                      style={styles.avatar}
                    />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.cardTitle}>{req.fromUserName}</Text>
                      <Text style={styles.cardSub}>Wants to connect</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Empty text="No requests" />
              ))}
          </ScrollView>

          {activeTab === "groups" && (
            <GroupChatScreen
              groups={filteredGroups}
              loading={groupsLoading}
              onRefresh={() => {}}
            />
          )}

        </View>
      )}
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: "#888" }}>{text}</Text>
    </View>
  );
}

function formatTime(ts: number) {
  if (!ts) return "";
  // ts might be a Firestore seconds value or millis
  const t = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  const now = new Date();
  if (t.toDateString() === now.toDateString()) {
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return t.toLocaleDateString();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0e0e0e" },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 20 : 10,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: "#fff", marginLeft: 8 },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#00f721",
  },
  tabText: { color: "#888", fontWeight: "600" },
  tabTextActive: { color: "#00f721" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#333",
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  cardMiddle: { marginLeft: 14, flex: 1 },
  cardTitle: { color: "#fff", fontWeight: "bold" },
  cardSub: { color: "#888", fontSize: 13 },

  empty: { padding: 40, alignItems: "center" },
  cardRight: { width: 60, alignItems: "flex-end", marginLeft: 8 },
  tsText: { color: "#666", fontSize: 11 },
  unreadDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: "#ff6b3d", marginTop: 6 },

});