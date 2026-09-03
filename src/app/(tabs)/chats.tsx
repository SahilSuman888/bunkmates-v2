import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  StatusBar,
  Platform,
  Dimensions,
  Modal,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../../contexts/UserContext";
import { useCall } from "../../contexts/CallContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import UserProfileModal from "../../components/UserProfileModal";
import AddFriendModal from "../../components/chat/AddFriendModal";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ChatFilterScope = "All" | "Direct" | "Groups" | "Unread" | "Calls";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, userData, loading: authLoading } = useUser();
  const { startCall } = useCall();

  const [activeScope, setActiveScope] = useState<ChatFilterScope>("All");
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Quick Action Menu on a chat
  const [selectedChatAction, setSelectedChatAction] = useState<any | null>(null);

  const { chats = [], loading: chatsLoading } =
    useUserChats(user?.uid || null) || {};

  const { groups = [], loading: groupsLoading } =
    useUserGroups(user?.uid || null) || {};

  const { requests = [], loading: requestsLoading } =
    useFriendRequests(user?.uid || null) || {};

  // Modals
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [composeMenuVisible, setComposeMenuVisible] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // 1. FETCH CALLS
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.uid) return;

    setCallHistoryLoading(true);

    const qCaller = query(
      collection(db, "calls"),
      where("callerId", "==", user.uid)
    );

    const qReceiver = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid)
    );

    let callerCalls: any[] = [];
    let receiverCalls: any[] = [];

    const mergeAndSetCalls = () => {
      const callMap = new Map<string, any>();

      [...callerCalls, ...receiverCalls].forEach((call) => {
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

  // Pull to refresh simulation
  const handleRefresh = () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  };

  // ═══════════════════════════════════════════════════════════
  // 2. CONVERSATIONS & FILTERING
  // ═══════════════════════════════════════════════════════════
  const filteredChats = useMemo(() => {
    return chats.filter((chat: any) =>
      (chat?.name || "").toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [chats, searchQuery]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group: any) =>
      (group?.name || "").toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [groups, searchQuery]);

  const combinedList = useMemo(() => {
    const normalizedChats = (filteredChats || []).map((c: any) => ({
      id: c.id,
      type: "chat" as const,
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
      type: "group" as const,
      title: g.name || "Trip Group Chat",
      subtitle: g.lastMessage || "No messages yet",
      avatar: g.iconURL || "https://i.pravatar.cc/150?img=32",
      timestamp: g.lastTimestamp || g.updatedAt || 0,
      unreadCount: g.unreadCounts?.current || 0,
      badge: g.name?.includes("Dev") ? "Dev Beta" : null,
      rawItem: g,
    }));

    return [...normalizedChats, ...normalizedGroups].sort(
      (a, b) =>
        (b.timestamp?.seconds || b.timestamp || 0) -
        (a.timestamp?.seconds || a.timestamp || 0)
    );
  }, [filteredChats, filteredGroups]);

  // Filter based on activeScope
  const displayedList = useMemo(() => {
    if (activeScope === "Direct") {
      return combinedList.filter((item) => item.type === "chat");
    }
    if (activeScope === "Groups") {
      return combinedList.filter((item) => item.type === "group");
    }
    if (activeScope === "Unread") {
      return combinedList.filter((item) => item.unreadCount > 0);
    }
    return combinedList;
  }, [combinedList, activeScope]);

  const filteredCallHistory = useMemo(() => {
    return callHistory.filter((call: any) => {
      const isOutgoing = call.callerId === user?.uid;
      const peerName = isOutgoing ? call.receiverName : call.callerName;
      const peerHandle = isOutgoing ? call.receiverHandle : call.callerHandle;
      const queryStr = searchQuery.toLowerCase().trim();

      return (
        (peerName || "").toLowerCase().includes(queryStr) ||
        (peerHandle || "").toLowerCase().includes(queryStr) ||
        (call.callType || "").toLowerCase().includes(queryStr)
      );
    });
  }, [callHistory, searchQuery, user?.uid]);

  const totalUnreadCount = useMemo(() => {
    return combinedList.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0);
  }, [combinedList]);

  // ═══════════════════════════════════════════════════════════
  // 1b. REALTIME ONLINE USERS LISTENER (Firestore users collection)
  // ═══════════════════════════════════════════════════════════
  const [realtimeOnlineUsers, setRealtimeOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const qUsers = query(collection(db, "users"), limit(60));
    const unsub = onSnapshot(
      qUsers,
      (snapshot) => {
        const list: any[] = [];
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          if (docSnap.id === user.uid) return; // Exclude current user

          const data = docSnap.data();
          const lastSeenMs = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : 0;
          const isRecent = lastSeenMs > 0 && now - lastSeenMs < 10 * 60 * 1000;

          const isUserOnline = data.online === true || data.isOnline === true || isRecent;

          if (isUserOnline) {
            const rawName = data.displayName || data.name || data.username || "Traveler";
            const photo =
              data.photoURL ||
              data.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=10b981&color=fff`;

            list.push({
              id: docSnap.id,
              uid: docSnap.id,
              name: rawName.split(" ")[0],
              fullName: rawName,
              avatar: photo,
              online: true,
            });
          }
        });

        setRealtimeOnlineUsers(list);
      },
      (err) => {
        console.warn("[Chats] Error listening to online users:", err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // ═══════════════════════════════════════════════════════════
  // 3. ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════
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

  const handleStartCallFromChat = (item: any, type: "audio" | "video") => {
    setSelectedChatAction(null);
    if (item.type === "group") {
      router.push(`/(tabs)/group-chatroom/${item.id}` as any);
      return;
    }

    startCall({
      receiverId: item.rawItem?.uid || item.id,
      receiverName: item.title,
      receiverAvatar: item.avatar,
      receiverHandle: item.rawItem?.username || "traveler",
      callType: type,
    });
  };

  const loading = authLoading || chatsLoading || groupsLoading || requestsLoading;

  return (
    <View style={s.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* ── TOP HEADER (Clean, Professional, Profile Removed) ── */}
      <View style={[s.topHeader, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={s.headerTitleText}>Chats</Text>
          <Text style={s.headerSubtitleText}>
            {activeScope === "Calls"
              ? `${callHistory.length} calls logged`
              : `${combinedList.length} chats ${totalUnreadCount > 0 ? `• ${totalUnreadCount} unread` : ""}`}
          </Text>
        </View>

        <View style={s.headerRightCluster}>
          {/* Create Group Quick Button */}
          <Pressable
            style={s.headerCircleBtn}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {}
              setCreateGroupModalVisible(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="people-outline" size={20} color="#ffffff" />
          </Pressable>

          {/* New Chat Quick Button */}
          <Pressable
            style={s.headerCircleBtn}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {}
              setAddFriendModalVisible(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="person-add-outline" size={19} color="#ffffff" />
          </Pressable>

          <NotificationBell />
        </View>
      </View>

      {/* ── SEARCH BAR (High-Legibility, Sleek Floating Pill) ── */}
      <View style={s.searchRow}>
        <View style={s.searchFieldBox}>
          <Feather name="search" size={17} color="#7e8594" style={{ marginRight: 10 }} />
          <TextInput
            placeholder={
              activeScope === "Calls"
                ? "Search call records..."
                : "Search bunkmates, groups, chats..."
            }
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={s.searchInputField}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {}
                setSearchQuery("");
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color="#7e8594" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── HORIZONTAL CATEGORY CHIPS (All, Direct, Groups, Unread, Calls) ── */}
      <View style={s.scopeChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scopeChipsScroll}
        >
          {(
            [
              { key: "All", label: "All", count: combinedList.length },
              { key: "Direct", label: "Direct", count: chats.length },
              { key: "Groups", label: "Groups", count: groups.length },
              { key: "Unread", label: "Unread", count: totalUnreadCount },
              { key: "Calls", label: "Calls", count: callHistory.length },
            ] as const
          ).map((scope) => {
            const isSelected = activeScope === scope.key;
            return (
              <Pressable
                key={scope.key}
                onPress={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch (e) {}
                  setActiveScope(scope.key);
                }}
                style={[s.scopeChip, isSelected && s.scopeChipSelected]}
              >
                {scope.key === "Groups" && (
                  <Ionicons
                    name="people"
                    size={13}
                    color={isSelected ? "#000000" : "rgba(255, 255, 255, 0.6)"}
                    style={{ marginRight: 5 }}
                  />
                )}
                {scope.key === "Calls" && (
                  <Ionicons
                    name="call"
                    size={12}
                    color={isSelected ? "#000000" : "rgba(255, 255, 255, 0.6)"}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text style={[s.scopeChipText, isSelected && s.scopeChipTextSelected]}>
                  {scope.label}
                </Text>
                {scope.count > 0 && (
                  <View
                    style={[
                      s.scopeCountBadge,
                      isSelected && s.scopeCountBadgeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        s.scopeCountBadgeText,
                        isSelected && s.scopeCountBadgeTextSelected,
                      ]}
                    >
                      {scope.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── MAIN SCROLL FEED ── */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            s.mainListScroll,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#ffffff"
              colors={["#00e6b0"]}
            />
          }
        >
          {/* Active Bunkmates Tray (Only shows if REAL online users exist, no dummy data) */}
          {activeScope !== "Calls" &&
            activeScope !== "Groups" &&
            !searchQuery &&
            realtimeOnlineUsers.length > 0 && (
              <View style={s.activeBunkmatesSection}>
                <View style={s.activeSectionHeader}>
                  <Text style={s.activeSectionTitle}>Active Bunkmates</Text>
                  <Text style={s.activeSectionCount}>
                    {realtimeOnlineUsers.length} online
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.activeTrayScroll}
                >
                  {/* + New Chat Shortcut */}
                  <Pressable
                    style={s.activeTrayItem}
                    onPress={() => setAddFriendModalVisible(true)}
                  >
                    <View style={s.activeTrayAddCircle}>
                      <Feather name="plus" size={20} color="#00e6b0" />
                    </View>
                    <Text style={s.activeTrayName}>New</Text>
                  </Pressable>

                  {/* Real Online Companions */}
                  {realtimeOnlineUsers.map((comp) => (
                    <Pressable
                      key={comp.uid}
                      style={s.activeTrayItem}
                      onPress={() => router.push(`/chat/${comp.uid}` as any)}
                    >
                      <View style={s.activeTrayAvatarRing}>
                        <ExpoImage
                          source={{ uri: comp.avatar }}
                          style={s.activeTrayAvatarImg}
                          contentFit="cover"
                        />
                        <View style={s.activeTrayOnlineDot} />
                      </View>
                      <Text style={s.activeTrayName} numberOfLines={1}>
                        {comp.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

          {/* ═══════════════════════════════════════════════════════════
             1. CALLS FEED (When Calls tab is active)
             ═══════════════════════════════════════════════════════════ */}
          {activeScope === "Calls" ? (
            callHistoryLoading ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={s.emptySubText}>Fetching calls...</Text>
              </View>
            ) : filteredCallHistory.length > 0 ? (
              <View style={s.cardsStack}>
                {filteredCallHistory.map((call: any) => {
                  const isOutgoing = call.callerId === user?.uid;
                  const peerUid = isOutgoing ? call.receiverId : call.callerId;
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

                  const callTime = call.createdAt || call.timestamp || call.endedAt;

                  return (
                    <View key={call.id} style={s.modernCard}>
                      <Pressable
                        onPress={() => handleAvatarPress(peerUid)}
                        style={s.avatarContainer}
                      >
                        <ExpoImage
                          source={{
                            uri:
                              peerAvatar ||
                              "https://i.pravatar.cc/150?img=12",
                          }}
                          style={s.avatarImage}
                          contentFit="cover"
                        />
                        <View
                          style={[
                            s.callTypeBadge,
                            isVideo ? s.callTypeBadgeVideo : s.callTypeBadgeAudio,
                          ]}
                        >
                          <Ionicons
                            name={isVideo ? "videocam" : "call"}
                            size={9}
                            color="#000000"
                          />
                        </View>
                      </Pressable>

                      <View style={s.cardBodyMiddle}>
                        <View style={s.cardHeadlineRow}>
                          <Text style={s.cardHeadlineTitle} numberOfLines={1}>
                            {peerName}
                          </Text>
                          {peerHandle && (
                            <Text style={s.cardHandleSub} numberOfLines={1}>
                              @{peerHandle}
                            </Text>
                          )}
                        </View>

                        <View style={s.callDetailRow}>
                          <Ionicons
                            name={
                              isMissed
                                ? "arrow-down"
                                : isOutgoing
                                ? "arrow-up"
                                : "arrow-down"
                            }
                            size={12}
                            color={
                              isMissed
                                ? "#ff5252"
                                : isOutgoing
                                ? "#00e676"
                                : "#29b6f6"
                            }
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              s.callDetailLabel,
                              isMissed && { color: "#ff5252", fontWeight: "700" },
                            ]}
                          >
                            {isMissed
                              ? isOutgoing
                                ? "Unanswered"
                                : "Missed Call"
                              : isOutgoing
                              ? "Outgoing"
                              : "Incoming"}
                          </Text>

                          {call.computedDuration > 0 && (
                            <Text style={s.callBullet}>•</Text>
                          )}
                          {call.computedDuration > 0 && (
                            <Text style={s.callDurationText}>
                              {formatDuration(call.computedDuration)}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={s.cardTrailingCol}>
                        <Text style={s.timeStringText}>{formatTime(callTime)}</Text>
                        <View style={s.callbackBtnGroup}>
                          <Pressable
                            style={s.callbackActionCircle}
                            onPress={() => handleCallBack(call, "audio")}
                            hitSlop={6}
                          >
                            <Ionicons name="call" size={13} color="#ffffff" />
                          </Pressable>
                          <Pressable
                            style={s.callbackActionCircle}
                            onPress={() => handleCallBack(call, "video")}
                            hitSlop={6}
                          >
                            <Ionicons name="videocam" size={13} color="#ffffff" />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyView
                icon="phone-off"
                title="No call records yet"
                subtitle="Voice and video calls with bunkmates will appear here"
              />
            )
          ) : (
            /* ═══════════════════════════════════════════════════════════
               2. CHATS FEED (Direct & Group Conversations)
               ═══════════════════════════════════════════════════════════ */
            displayedList.length > 0 ? (
              <View style={s.cardsStack}>
                {displayedList.map((item: any) => {
                  const isGroup = item.type === "group";
                  const isUnread = item.unreadCount > 0;
                  const peerUid =
                    item.rawItem?.uid ||
                    (item.id.includes("_")
                      ? item.id.split("_").find((x: string) => x !== user?.uid)
                      : item.id);
                  const isPeerOnline =
                    !isGroup &&
                    (realtimeOnlineUsers.some((u) => u.uid === peerUid) ||
                      item.rawItem?.online);

                  return (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (e) {}
                        isGroup
                          ? router.push(`/(tabs)/group-chatroom/${item.id}` as any)
                          : router.push(`/chat/${item.id}` as any);
                      }}
                      onLongPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        } catch (e) {}
                        setSelectedChatAction(item);
                      }}
                      style={({ pressed }) => [
                        s.modernCard,
                        isUnread && s.modernCardUnread,
                        pressed && s.modernCardPressed,
                      ]}
                    >
                      {/* Avatar with status */}
                      <Pressable
                        onPress={(e) =>
                          !isGroup
                            ? handleAvatarPress(peerUid, e)
                            : null
                        }
                        style={s.avatarContainer}
                      >
                        <ExpoImage
                          source={{ uri: item.avatar }}
                          style={s.avatarImage}
                          contentFit="cover"
                        />
                        {isGroup ? (
                          <View style={s.avatarBadgeGroup}>
                            <Ionicons name="people" size={10} color="#ffffff" />
                          </View>
                        ) : isPeerOnline ? (
                          <View style={s.avatarBadgeOnline} />
                        ) : null}
                      </Pressable>

                      {/* Middle Texts */}
                      <View style={s.cardBodyMiddle}>
                        <View style={s.cardHeadlineRow}>
                          <Text
                            style={[
                              s.cardHeadlineTitle,
                              isUnread && s.cardHeadlineTitleUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>

                          {isGroup && (
                            <View style={s.groupChipBadge}>
                              <Text style={s.groupChipText}>Group</Text>
                            </View>
                          )}
                        </View>

                        <View style={s.cardMessageSnippetRow}>
                          {/* Prefix icon */}
                          {item.subtitle?.includes("📹") || item.subtitle?.includes("Video") ? (
                            <Ionicons
                              name="videocam-outline"
                              size={14}
                              color="#38bdf8"
                              style={{ marginRight: 4 }}
                            />
                          ) : item.subtitle?.includes("📞") || item.subtitle?.includes("Voice") ? (
                            <Ionicons
                              name="call-outline"
                              size={14}
                              color="#38bdf8"
                              style={{ marginRight: 4 }}
                            />
                          ) : null}

                          <Text
                            style={[
                              s.messageSnippetText,
                              isUnread && s.messageSnippetTextUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {item.subtitle}
                          </Text>
                        </View>
                      </View>

                      {/* Right Timestamp & Unread */}
                      <View style={s.cardTrailingCol}>
                        <Text style={[s.timeStringText, isUnread && s.timeStringTextUnread]}>
                          {formatTime(item.timestamp)}
                        </Text>

                        {isUnread ? (
                          <View style={s.unreadNumberBadge}>
                            <Text style={s.unreadNumberText}>
                              {item.unreadCount}
                            </Text>
                          </View>
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color="rgba(255, 255, 255, 0.2)"
                            style={{ marginTop: 6 }}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <EmptyView
                icon="message-square"
                title={
                  searchQuery
                    ? `No chats match "${searchQuery}"`
                    : activeScope === "Unread"
                    ? "All caught up! No unread messages"
                    : activeScope === "Groups"
                    ? "No group chats found"
                    : "No conversations yet"
                }
                subtitle={
                  activeScope === "Groups"
                    ? "Create a travel group to coordinate trips together"
                    : "Connect with bunkmates and start a new conversation"
                }
                actionLabel={
                  activeScope === "Groups" ? "Create Group" : "Start New Chat"
                }
                onAction={() => {
                  if (activeScope === "Groups") {
                    setCreateGroupModalVisible(true);
                  } else {
                    setAddFriendModalVisible(true);
                  }
                }}
              />
            )
          )}
        </ScrollView>
      )}

      {/* ── FLOATING ACTION BUTTON (FAB) ── */}
      <View
        style={[s.floatingFabAnchor, { bottom: insets.bottom + 85 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e) {}
            setComposeMenuVisible(true);
          }}
          style={s.fabButtonSquare}
          hitSlop={8}
        >
          <Feather name="edit-3" size={21} color="#ffffff" />
        </Pressable>
      </View>

      {/* ── COMPOSE SHEET MODAL ── */}
      <Modal
        visible={composeMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setComposeMenuVisible(false)}
      >
        <Pressable
          style={s.bottomSheetOverlay}
          onPress={() => setComposeMenuVisible(false)}
        >
          <View style={s.bottomSheetPanel}>
            <View style={s.sheetHandleBar} />
            <Text style={s.sheetMainTitle}>Start Conversation</Text>
            <Text style={s.sheetMainSubtitle}>
              Connect with fellow travelers and travel companions
            </Text>

            <Pressable
              style={s.sheetActionItem}
              onPress={() => {
                setComposeMenuVisible(false);
                setAddFriendModalVisible(true);
              }}
            >
              <View style={s.sheetIconBox}>
                <Ionicons name="chatbubble-outline" size={20} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetActionTitle}>Direct Message</Text>
                <Text style={s.sheetActionDesc}>
                  Chat 1-on-1 with another traveler
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.4)" />
            </Pressable>

            <Pressable
              style={s.sheetActionItem}
              onPress={() => {
                setComposeMenuVisible(false);
                setCreateGroupModalVisible(true);
              }}
            >
              <View style={[s.sheetIconBox, { backgroundColor: "rgba(59, 130, 246, 0.2)" }]}>
                <Ionicons name="people-outline" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetActionTitle}>Create Group Chat</Text>
                <Text style={s.sheetActionDesc}>
                  Plan & coordinate trips with multiple bunkmates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.4)" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── QUICK CHAT ACTION LONG-PRESS MODAL ── */}
      <Modal
        visible={!!selectedChatAction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedChatAction(null)}
      >
        <Pressable
          style={s.bottomSheetOverlay}
          onPress={() => setSelectedChatAction(null)}
        >
          <View style={s.bottomSheetPanel}>
            <View style={s.sheetHandleBar} />
            <Text style={s.sheetMainTitle}>{selectedChatAction?.title}</Text>
            <Text style={s.sheetMainSubtitle} numberOfLines={1}>
              {selectedChatAction?.subtitle}
            </Text>

            <Pressable
              style={s.sheetActionItem}
              onPress={() => {
                const item = selectedChatAction;
                setSelectedChatAction(null);
                item?.type === "group"
                  ? router.push(`/(tabs)/group-chatroom/${item.id}` as any)
                  : router.push(`/chat/${item.id}` as any);
              }}
            >
              <View style={s.sheetIconBox}>
                <Ionicons name="chatbubbles-outline" size={20} color="#ffffff" />
              </View>
              <Text style={s.sheetActionTitle}>Open Conversation</Text>
            </Pressable>

            <Pressable
              style={s.sheetActionItem}
              onPress={() => handleStartCallFromChat(selectedChatAction, "audio")}
            >
              <View style={[s.sheetIconBox, { backgroundColor: "rgba(0, 230, 176, 0.15)" }]}>
                <Ionicons name="call-outline" size={20} color="#00e6b0" />
              </View>
              <Text style={s.sheetActionTitle}>Voice Call</Text>
            </Pressable>

            <Pressable
              style={s.sheetActionItem}
              onPress={() => handleStartCallFromChat(selectedChatAction, "video")}
            >
              <View style={[s.sheetIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                <Ionicons name="videocam-outline" size={20} color="#38bdf8" />
              </View>
              <Text style={s.sheetActionTitle}>Video Call</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── PROFILE MODAL ── */}
      <UserProfileModal
        userId={selectedProfileUid}
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onStartChat={(targetUid) => {
          setProfileModalVisible(false);
          router.push(`/chat/${targetUid}` as any);
        }}
      />

      {/* ── ADD FRIEND MODAL ── */}
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

      {/* ── CREATE GROUP MODAL ── */}
      <CreateGroupModal
        visible={createGroupModalVisible}
        onClose={() => setCreateGroupModalVisible(false)}
        onGroupCreated={(groupId) => {
          router.push(`/(tabs)/group-chatroom/${groupId}` as any);
        }}
      />
    </View>
  );
}

function EmptyView({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.emptyStateContainer}>
      <Feather name={icon} size={42} color="rgba(255, 255, 255, 0.2)" />
      <Text style={s.emptyMainTitle}>{title}</Text>
      <Text style={s.emptySubText}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable style={s.emptyCtaButton} onPress={onAction}>
          <Text style={s.emptyCtaText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color="#000000" style={{ marginLeft: 6 }} />
        </Pressable>
      )}
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

/* ═════════════════════════════════════════════════════════════════════ */
/* STYLES (Ultra-Clean, High-Contrast, Unified Design Language)          */
/* ═════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
  },

  // 1. Top Header
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeftCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatarWrap: {
    position: "relative",
  },
  profileAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#161922",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  avatarOnlineRing: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00e676",
    borderWidth: 2,
    borderColor: "#000000",
  },
  headerTitleText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  headerSubtitleText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  headerRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. Search Row
  searchRow: {
    marginBottom: 12,
  },
  searchFieldBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0f14",
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchInputField: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },

  // 3. Scope Chips
  scopeChipsContainer: {
    marginBottom: 14,
  },
  scopeChipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  scopeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#0d0f14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  scopeChipSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  scopeChipText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    fontWeight: "600",
  },
  scopeChipTextSelected: {
    color: "#000000",
    fontWeight: "700",
  },
  scopeCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
  },
  scopeCountBadgeSelected: {
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  scopeCountBadgeText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "700",
  },
  scopeCountBadgeTextSelected: {
    color: "#000000",
  },

  // 4. Active Bunkmates Tray
  activeBunkmatesSection: {
    marginBottom: 16,
  },
  activeSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  activeSectionTitle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeSectionCount: {
    color: "#00e676",
    fontSize: 11.5,
    fontWeight: "600",
  },
  activeTrayScroll: {
    gap: 14,
  },
  activeTrayItem: {
    alignItems: "center",
    width: 56,
  },
  activeTrayAddCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#00e6b0",
    borderStyle: "dashed",
    backgroundColor: "rgba(0, 230, 176, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  activeTrayAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#00e6b0",
    position: "relative",
    padding: 1.5,
    marginBottom: 4,
  },
  activeTrayAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    backgroundColor: "#1c202a",
  },
  activeTrayOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#00e676",
    borderWidth: 2,
    borderColor: "#000000",
  },
  activeTrayName: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },

  // 5. Cards Stack
  mainListScroll: {
    paddingTop: 2,
  },
  cardsStack: {
    gap: 10,
  },
  modernCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0f14",
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modernCardUnread: {
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "#11141b",
  },
  modernCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },

  // Avatar Container
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#181b22",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  avatarBadgeGroup: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1f2533",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0d0f14",
  },
  avatarBadgeOnline: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00e676",
    borderWidth: 2,
    borderColor: "#0d0f14",
  },
  callTypeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0d0f14",
  },
  callTypeBadgeVideo: {
    backgroundColor: "#00e676",
  },
  callTypeBadgeAudio: {
    backgroundColor: "#38bdf8",
  },

  // Card Body
  cardBodyMiddle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  cardHeadlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeadlineTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    maxWidth: "80%",
  },
  cardHeadlineTitleUnread: {
    fontWeight: "800",
  },
  cardHandleSub: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    marginLeft: 6,
  },
  groupChipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: 6,
  },
  groupChipText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10,
    fontWeight: "600",
  },

  // Message Snippet
  cardMessageSnippetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  messageSnippetText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  messageSnippetTextUnread: {
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "600",
  },

  // Call Details
  callDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  callDetailLabel: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 12,
    fontWeight: "500",
  },
  callBullet: {
    color: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
  },
  callDurationText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11.5,
  },

  // Trailing / Right Info
  cardTrailingCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  timeStringText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11.5,
    fontWeight: "500",
  },
  timeStringTextUnread: {
    color: "#ffffff",
    fontWeight: "700",
  },
  unreadNumberBadge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadNumberText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  callbackBtnGroup: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  callbackActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },

  // 6. FAB Button (Matches Notes FAB)
  floatingFabAnchor: {
    position: "absolute",
    right: 20,
    zIndex: 99,
  },
  fabButtonSquare: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#161922",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  // 7. Bottom Sheet
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  bottomSheetPanel: {
    backgroundColor: "#13151b",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetMainTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  sheetMainSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginBottom: 20,
  },
  sheetActionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
    gap: 12,
  },
  sheetIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetActionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  sheetActionDesc: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
  },

  // 8. Empty & Loading states
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyMainTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  emptySubText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 18,
  },
  emptyCtaText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
});