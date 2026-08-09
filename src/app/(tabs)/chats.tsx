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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { Feather, Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
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
      title: c.name || "BunkMate Traveler",
      subtitle: c.lastMessage || "Start a conversation...",
      avatar: c.avatar || "https://i.pravatar.cc/150?img=11",
      timestamp: c.lastTimestamp || 0,
      unreadCount: c.unreadCount || 0,
      isOnline: true,
    }));

    const normalizedGroups = (filteredGroups || []).map((g: any) => ({
      id: g.id,
      type: "group",
      title: g.name || "Trip Group Chat",
      subtitle:
        g.lastMessage ||
        (g.description || `${g.members?.length || 0} members`),
      avatar: g.iconURL || "https://i.pravatar.cc/150?img=32",
      timestamp: g.lastTimestamp || g.updatedAt || 0,
      unreadCount: g.unreadCounts?.current || 0,
      isOnline: false,
    }));

    return [...normalizedChats, ...normalizedGroups].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [filteredChats, filteredGroups]);

  const loading =
    authLoading || chatsLoading || groupsLoading || requestsLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00e6b0" />
        </View>
      ) : (
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Chats</Text>
              <Text style={styles.headerSub}>Connect with your bunkmates</Text>
            </View>
            <NotificationBell />
          </View>

          {/* SEARCH */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={17} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor="#666"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <Pressable onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={16} color="#888" />
              </Pressable>
            ) : null}
          </View>

          {/* SEGMENTED TAB BUTTONS */}
          <View style={styles.tabRow}>
            {(["all", "chats", "groups", "requests"] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
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
            contentContainerStyle={{ paddingBottom: 110 }}
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
                    <View style={{ position: "relative" }}>
                      <Image
                        source={{ uri: item.avatar }}
                        style={styles.avatar}
                      />
                      {item.isOnline && <View style={styles.onlineDot} />}
                    </View>

                    <View style={styles.cardMiddle}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        {item.type === "group" && (
                          <View style={styles.groupBadge}>
                            <Text style={styles.groupBadgeText}>GROUP</Text>
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
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {item.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty text="No conversations found" />
              ))}

            {activeTab === "chats" &&
              (filteredChats.length > 0 ? (
                filteredChats.map((chat: any) => (
                  <Pressable
                    key={chat.id}
                    onPress={() => router.push(`/chat/${chat.id}` as any)}
                    style={styles.card}
                  >
                    <View style={{ position: "relative" }}>
                      <Image
                        source={{
                          uri: chat.avatar || "https://i.pravatar.cc/150?img=11",
                        }}
                        style={styles.avatar}
                      />
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={styles.cardMiddle}>
                      <Text style={styles.cardTitle}>
                        {chat.name || "BunkMate User"}
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {chat.lastMessage || "Tap to chat"}
                      </Text>
                    </View>

                    <View style={styles.cardRight}>
                      <Text style={styles.tsText}>
                        {formatTime(chat.lastTimestamp)}
                      </Text>
                      {chat.unreadCount > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {chat.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty text="No direct chats yet" />
              ))}

            {activeTab === "requests" &&
              (requests.length > 0 ? (
                requests.map((req: any) => (
                  <View key={req.id} style={styles.card}>
                    <Image
                      source={{
                        uri:
                          req.fromUserAvatar || "https://i.pravatar.cc/150?img=5",
                      }}
                      style={styles.avatar}
                    />
                    <View style={styles.cardMiddle}>
                      <Text style={styles.cardTitle}>
                        {req.fromUserName || "Traveler"}
                      </Text>
                      <Text style={styles.cardSub}>Wants to connect with you</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Empty text="No pending connection requests" />
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
      <Ionicons name="chatbubbles-outline" size={32} color="#555555" />
      <Text style={{ color: "#888888", fontSize: 13, marginTop: 8 }}>{text}</Text>
    </View>
  );
}

function formatTime(ts: number) {
  if (!ts) return "";
  const t = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  const now = new Date();
  if (t.toDateString() === now.toDateString()) {
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return t.toLocaleDateString([], { month: "short", day: "numeric" });
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
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSub: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#1e1e24",
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#141416",
    borderWidth: 1,
    borderColor: "#222228",
  },
  tabActive: {
    backgroundColor: "rgba(0,230,176,0.14)",
    borderColor: "#00e6b0",
  },
  tabText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#00e6b0",
    fontWeight: "800",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e1e24",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#222228",
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00e6b0",
    borderWidth: 2,
    borderColor: "#121214",
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  cardMiddle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cardSub: {
    color: "#888888",
    fontSize: 12,
    marginTop: 3,
  },
  groupBadge: {
    backgroundColor: "rgba(0,230,176,0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupBadgeText: {
    color: "#00e6b0",
    fontSize: 8.5,
    fontWeight: "800",
  },
  cardRight: {
    alignItems: "flex-end",
  },
  tsText: {
    color: "#777777",
    fontSize: 10.5,
  },
  unreadBadge: {
    backgroundColor: "#00e6b0",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    paddingHorizontal: 5,
  },
  unreadText: {
    color: "#00140f",
    fontSize: 10,
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
});