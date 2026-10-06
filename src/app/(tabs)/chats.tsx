import React, { useMemo, useState, useEffect, useRef } from "react";
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
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useUser } from "../../contexts/UserContext";
import { useCall } from "../../contexts/CallContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLanguage } from "../../contexts/LanguageContext";
import NotificationBell from "../../components/NotificationBell";
import UserProfileModal from "../../components/UserProfileModal";
import AddFriendModal from "../../components/chat/AddFriendModal";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ChatsScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { startCall } = useCall();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"chats" | "calls">("chats");
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);

  // Tab animated slider value
  const tabSliderAnim = useRef(new Animated.Value(0)).current;

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

  // Animate tab switch
  const handleTabChange = (tab: "chats" | "calls") => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}

    setActiveTab(tab);
    Animated.spring(tabSliderAnim, {
      toValue: tab === "chats" ? 0 : 1,
      bounciness: 6,
      speed: 14,
      useNativeDriver: false,
    }).start();
  };

  // ============================================================
  // FETCH CALLS DIRECTLY FROM ROOT `calls` FIRESTORE COLLECTION
  // ============================================================
  useEffect(() => {
    if (!user?.uid) return;

    setCallHistoryLoading(true);

    // 1. Query Outgoing calls (callerId == user.uid)
    const qCaller = query(
      collection(db, "calls"),
      where("callerId", "==", user.uid)
    );

    // 2. Query Incoming calls (receiverId == user.uid)
    const qReceiver = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid)
    );

    let callerCalls: any[] = [];
    let receiverCalls: any[] = [];

    const mergeAndSetCalls = () => {
      const callMap = new Map<string, any>();

      [...callerCalls, ...receiverCalls].forEach((call) => {
        // Calculate duration from endedAt & createdAt if not directly set
        let dur = call.duration || 0;
        if (
          !dur &&
          call.createdAt?.seconds &&
          call.endedAt?.seconds &&
          call.endedAt.seconds > call.createdAt.seconds
        ) {
          dur = call.endedAt.seconds - call.createdAt.seconds;
        }

        callMap.set(call.id, {
          ...call,
          computedDuration: dur,
        });
      });

      const sorted = Array.from(callMap.values()).sort((a, b) => {
        const timeA =
          a.createdAt?.seconds ||
          a.createdAt?.toMillis?.() ||
          a.timestamp?.seconds ||
          0;
        const timeB =
          b.createdAt?.seconds ||
          b.createdAt?.toMillis?.() ||
          b.timestamp?.seconds ||
          0;
        return timeB - timeA;
      });

      setCallHistory(sorted);
      setCallHistoryLoading(false);
    };

    const unsubCaller = onSnapshot(
      qCaller,
      (snap) => {
        callerCalls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetCalls();
      },
      (err) => {
        console.warn("[Chats] Error querying caller calls:", err);
        setCallHistoryLoading(false);
      }
    );

    const unsubReceiver = onSnapshot(
      qReceiver,
      (snap) => {
        receiverCalls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeAndSetCalls();
      },
      (err) => {
        console.warn("[Chats] Error querying receiver calls:", err);
        setCallHistoryLoading(false);
      }
    );

    return () => {
      unsubCaller();
      unsubReceiver();
    };
  }, [user?.uid]);

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

  const filteredCallHistory = useMemo(() => {
    return callHistory.filter((call: any) => {
      const isOutgoing = call.callerId === user?.uid;
      const peerName = isOutgoing ? call.receiverName : call.callerName;
      const peerHandle = isOutgoing ? call.receiverHandle : call.callerHandle;
      const queryStr = searchText.toLowerCase().trim();

      return (
        (peerName || "").toLowerCase().includes(queryStr) ||
        (peerHandle || "").toLowerCase().includes(queryStr) ||
        (call.callType || "").toLowerCase().includes(queryStr)
      );
    });
  }, [callHistory, searchText, user?.uid]);

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
      (a, b) =>
        (b.timestamp?.seconds || b.timestamp || 0) -
        (a.timestamp?.seconds || a.timestamp || 0)
    );
  }, [filteredChats, filteredGroups]);

  const handleAvatarPress = (uid: string, e?: any) => {
    if (e) e.stopPropagation();
    if (!uid) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {}
    setSelectedProfileUid(uid);
    setProfileModalVisible(true);
  };

  const handleCallBack = (callItem: any, typeOverride?: "audio" | "video") => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {}

    const isOutgoing = callItem.callerId === user?.uid;
    const targetUid = isOutgoing ? callItem.receiverId : callItem.callerId;
    const targetName = isOutgoing ? callItem.receiverName : callItem.callerName;
    const targetAvatar = isOutgoing ? callItem.receiverAvatar : callItem.callerAvatar;
    const targetHandle = isOutgoing ? callItem.receiverHandle : callItem.callerHandle;

    startCall({
      receiverId: targetUid,
      receiverName: targetName,
      receiverAvatar: targetAvatar,
      receiverHandle: targetHandle,
      callType: typeOverride || callItem.callType || "audio",
    });
  };

  const loading = authLoading || chatsLoading || groupsLoading || requestsLoading;

  // Tab indicator slide interpolations
  const sliderWidth = (SCREEN_WIDTH - 32 - 8) / 2;
  const sliderLeft = tabSliderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 4 + sliderWidth],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e14" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00e6b0" />
        </View>
      ) : (
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {activeTab === "chats" ? t("messages", "Messages") : t("call_history", "Call History")}
              </Text>
              <Text style={styles.headerSubtitle}>
                {activeTab === "chats"
                  ? `${combinedList.length} ${t("conversations", "conversations")}`
                  : `${callHistory.length} ${t("total_calls", "total calls recorded")}`}
              </Text>
            </View>
            <NotificationBell />
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchContainer}>
            <Feather name="search" size={18} color="#7f8c9b" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === "chats"
                  ? t("search_messages", "Search travelers & groups...")
                  : t("search_calls", "Search calls by name or handle...")
              }
              placeholderTextColor="#7f8c9b"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSearchText("");
                }}
              >
                <Ionicons name="close-circle" size={18} color="#7f8c9b" />
              </Pressable>
            ) : null}
          </View>

          {/* ---------------------------------------------------- */}
          {/* TAB 1: CHATS LIST                                   */}
          {/* ---------------------------------------------------- */}
          {activeTab === "chats" ? (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {combinedList.length > 0 ? (
                combinedList.map((item: any) => (
                  <Pressable
                    key={`${item.type}-${item.id}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      item.type === "chat"
                        ? router.push(`/chat/${item.id}` as any)
                        : router.push(
                            `/(tabs)/group-chatroom/${item.id}` as any
                          );
                    }}
                    style={({ pressed }) => [
                      styles.card,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Pressable
                      onPress={(e) =>
                        item.type === "chat"
                          ? handleAvatarPress(item.rawItem?.uid || item.id, e)
                          : null
                      }
                      style={styles.avatarWrap}
                    >
                      <Image
                        source={{ uri: item.avatar }}
                        style={styles.avatar}
                      />
                    </Pressable>

                    <View style={styles.cardMiddle}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {item.badge && (
                          <View style={styles.groupBadge}>
                            <Text style={styles.groupBadgeText}>
                              {item.badge}
                            </Text>
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
                        <View style={styles.unreadDotBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {item.unreadCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty text={t("no_conversations", "No conversations found")} icon="chatbubbles-outline" />
              )}
            </ScrollView>
          ) : (
            /* ---------------------------------------------------- */
            /* TAB 2: CALL HISTORY LIST (FROM ROOT `calls` DB)      */
            /* ---------------------------------------------------- */
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {callHistoryLoading ? (
                <View style={{ marginTop: 50, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="#00e6b0" />
                  <Text style={styles.loadingText}>Fetching database calls...</Text>
                </View>
              ) : filteredCallHistory.length > 0 ? (
                filteredCallHistory.map((call: any) => {
                  const isOutgoing = call.callerId === user?.uid;
                  const peerUid = isOutgoing
                    ? call.receiverId
                    : call.callerId;
                  const peerName = isOutgoing
                    ? call.receiverName || "BunkMate"
                    : call.callerName || "BunkMate";
                  const peerAvatar = isOutgoing
                    ? call.receiverAvatar
                    : call.callerAvatar;
                  const peerHandle = isOutgoing
                    ? call.receiverHandle
                    : call.callerHandle;

                  const isVideo = call.callType === "video";
                  const isMissed =
                    call.status === "declined" ||
                    (call.status === "ended" && !call.computedDuration);

                  const callTime =
                    call.createdAt || call.timestamp || call.endedAt;

                  return (
                    <View key={call.id} style={styles.callCard}>
                      <Pressable
                        onPress={() => handleAvatarPress(peerUid)}
                        style={styles.avatarWrap}
                      >
                        <Image
                          source={{
                            uri:
                              peerAvatar || "https://i.pravatar.cc/150?img=12",
                          }}
                          style={styles.avatar}
                        />
                        {/* Call Type Miniature Badge */}
                        <View
                          style={[
                            styles.typeBadge,
                            isVideo
                              ? styles.typeBadgeVideo
                              : styles.typeBadgeAudio,
                          ]}
                        >
                          <Ionicons
                            name={isVideo ? "videocam" : "call"}
                            size={10}
                            color="#00140f"
                          />
                        </View>
                      </Pressable>

                      <View style={styles.cardMiddle}>
                        <View style={styles.titleRow}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {peerName}
                          </Text>
                          {peerHandle && (
                            <Text style={styles.handleSubText} numberOfLines={1}>
                              @{peerHandle}
                            </Text>
                          )}
                        </View>

                        <View style={styles.callMetaRow}>
                          {/* Direction / Status Icon */}
                          <View
                            style={[
                              styles.statusIconWrap,
                              isMissed
                                ? styles.statusIconMissed
                                : isOutgoing
                                ? styles.statusIconOutgoing
                                : styles.statusIconIncoming,
                            ]}
                          >
                            <Ionicons
                              name={
                                isMissed
                                  ? "arrow-down"
                                  : isOutgoing
                                  ? "arrow-up"
                                  : "arrow-down"
                              }
                              size={11}
                              color={
                                isMissed
                                  ? "#ff5252"
                                  : isOutgoing
                                  ? "#00e6b0"
                                  : "#25d366"
                              }
                            />
                          </View>

                          <Text
                            style={[
                              styles.callStatusLabel,
                              isMissed && { color: "#ff5252", fontWeight: "700" },
                            ]}
                          >
                            {isMissed
                              ? isOutgoing
                                ? "Unanswered"
                                : "Missed Call"
                              : isOutgoing
                              ? "Outgoing Call"
                              : "Incoming Call"}
                          </Text>

                          {call.computedDuration > 0 && (
                            <Text style={styles.callDurationDot}>•</Text>
                          )}
                          {call.computedDuration > 0 && (
                            <Text style={styles.callDurationText}>
                              {formatDuration(call.computedDuration)}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Timestamp & One-Tap Call Back Actions */}
                      <View style={styles.callActionsCol}>
                        <Text style={styles.tsText}>
                          {formatTime(callTime)}
                        </Text>

                        <View style={styles.quickCallBtnsRow}>
                          <Pressable
                            style={styles.quickCallActionBtn}
                            onPress={() => handleCallBack(call, "audio")}
                            hitSlop={8}
                          >
                            <Ionicons name="call" size={15} color="#00e6b0" />
                          </Pressable>

                          <Pressable
                            style={[
                              styles.quickCallActionBtn,
                              styles.quickCallVideoBtn,
                            ]}
                            onPress={() => handleCallBack(call, "video")}
                            hitSlop={8}
                          >
                            <Ionicons
                              name="videocam"
                              size={15}
                              color="#00e6b0"
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Empty text="No call history found in database" icon="call-outline" />
              )}
            </ScrollView>
          )}

          {/* ============================================================ */}
          {/* BOTTOM-ANCHORED M3 EXPRESSIVE SEGMENTED TAB SWITCHER & FAB   */}
          {/* ============================================================ */}
          <View style={styles.bottomDockContainer} pointerEvents="box-none">
            {/* SEGMENTED TAB PILL (Messages vs Calls) */}
            <View style={styles.floatingTabSwitcher}>
              {/* Sliding Active Pill Background */}
              <Animated.View
                style={[
                  styles.tabSliderBackground,
                  {
                    width: sliderWidth,
                    left: sliderLeft,
                  },
                ]}
              />

              <Pressable
                style={styles.tabBtn}
                onPress={() => handleTabChange("chats")}
              >
                <Ionicons
                  name={
                    activeTab === "chats"
                      ? "chatbubble-ellipses"
                      : "chatbubble-ellipses-outline"
                  }
                  size={17}
                  color={activeTab === "chats" ? "#00140f" : "#8b949e"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "chats" && styles.tabBtnTextActive,
                  ]}
                >
                  {t("messages", "Messages")}
                </Text>
              </Pressable>

              <Pressable
                style={styles.tabBtn}
                onPress={() => handleTabChange("calls")}
              >
                <Ionicons
                  name={activeTab === "calls" ? "call" : "call-outline"}
                  size={17}
                  color={activeTab === "calls" ? "#00140f" : "#8b949e"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === "calls" && styles.tabBtnTextActive,
                  ]}
                >
                  {t("calls", "Calls")}
                </Text>
                {callHistory.length > 0 && (
                  <View
                    style={[
                      styles.tabCountBadge,
                      activeTab === "calls" && styles.tabCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabCountText,
                        activeTab === "calls" && styles.tabCountTextActive,
                      ]}
                    >
                      {callHistory.length}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* NEW CHAT / USER FAB (+) */}
            <Pressable
              style={styles.fabBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setAddFriendModalVisible(true);
              }}
            >
              <Feather name="plus" size={24} color="#00140f" />
            </Pressable>
          </View>

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

function Empty({ text, icon }: { text: string; icon: any }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={32} color="#00e6b0" />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || isNaN(totalSeconds)) return "";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatTime(ts: any) {
  if (!ts) return "";
  let date: Date;
  if (typeof ts === "number") {
    date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  } else if (ts?.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (ts?.toMillis) {
    date = new Date(ts.toMillis());
  } else if (ts instanceof Date) {
    date = ts;
  } else {
    date = new Date(ts);
  }

  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffHours < 48) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a0e14",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "#7f8c9b",
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161c24",
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  scrollContent: {
    paddingBottom: 170,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  cardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#131820",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1b222d",
  },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#131820",
  },
  typeBadgeVideo: {
    backgroundColor: "#00e6b0",
  },
  typeBadgeAudio: {
    backgroundColor: "#4fc3f7",
  },
  cardMiddle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  handleSubText: {
    color: "#7f8c9b",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
    maxWidth: 110,
  },
  groupBadge: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  groupBadgeText: {
    color: "#00e6b0",
    fontSize: 10.5,
    fontWeight: "700",
  },
  cardSub: {
    color: "#8b949e",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  callMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  statusIconIncoming: {
    backgroundColor: "rgba(37, 211, 102, 0.18)",
  },
  statusIconOutgoing: {
    backgroundColor: "rgba(0, 230, 176, 0.18)",
  },
  statusIconMissed: {
    backgroundColor: "rgba(255, 82, 82, 0.18)",
  },
  callStatusLabel: {
    color: "#8b949e",
    fontSize: 12,
    fontWeight: "600",
  },
  callDurationDot: {
    color: "#555555",
    marginHorizontal: 5,
  },
  callDurationText: {
    color: "#8b949e",
    fontSize: 11.5,
    fontWeight: "600",
  },
  cardRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  callActionsCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 6,
  },
  quickCallBtnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 6,
  },
  quickCallActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.28)",
  },
  quickCallVideoBtn: {
    backgroundColor: "rgba(0, 230, 176, 0.18)",
  },
  tsText: {
    color: "#6b7785",
    fontSize: 11.5,
    fontWeight: "600",
  },
  unreadDotBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginTop: 6,
  },
  unreadBadgeText: {
    color: "#00140f",
    fontSize: 10,
    fontWeight: "900",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyText: {
    color: "#7f8c9b",
    fontSize: 14.5,
    fontWeight: "600",
  },
  loadingText: {
    color: "#7f8c9b",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
  bottomDockContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 104 : 90,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingTabSwitcher: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(18, 24, 32, 0.95)",
    borderRadius: 28,
    padding: 4,
    marginRight: 12,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    height: 54,
    alignItems: "center",
  },
  tabSliderBackground: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 24,
    backgroundColor: "#00e6b0",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 2,
  },
  tabBtnText: {
    color: "#8b949e",
    fontSize: 13.5,
    fontWeight: "700",
  },
  tabBtnTextActive: {
    color: "#00140f",
    fontWeight: "900",
  },
  tabCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    marginLeft: 6,
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(0, 20, 15, 0.22)",
  },
  tabCountText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "800",
  },
  tabCountTextActive: {
    color: "#00140f",
  },
  fabBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
});