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
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../../contexts/UserContext";
import { useCall } from "../../contexts/CallContext";
import { useUserChats } from "../../hooks/useUserChats";
import { useUserGroups } from "../../hooks/useUserGroups";
import { useFriendRequests } from "../../hooks/useFriendRequests";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useChatSettings } from "../../contexts/ChatSettingsContext";
import NotificationBell from "../../components/NotificationBell";
import UserProfileModal from "../../components/UserProfileModal";
import AddFriendModal from "../../components/chat/AddFriendModal";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import PrivatePinModal from "../../components/chat/PrivatePinModal";
import PrivateLockSuccessModal from "../../components/chat/PrivateLockSuccessModal";
import StartCallModal from "../../components/chat/StartCallModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ChatFilterScope = "All" | "Unread" | "Group" | "Favourites" | "Private" | "Calls";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, userData, loading: authLoading } = useUser();
  const { startCall } = useCall();
  const { t } = useLanguage();
  const { isDark, themeColors, accentColor, scaleFont, fontScale } = useThemeToggle();
  const isBrightAccent =
    accentColor === "#FFFFFF" ||
    accentColor === "#ffffff" ||
    accentColor === "#f59e0b" ||
    accentColor === "#ffd700";
  const onAccentTextColor = isBrightAccent ? "#000000" : "#FFFFFF";

  const {
    archivedChatIds,
    isChatArchived,
    keepArchived,
    clearedAt,
    toggleArchiveChat,
  } = useChatSettings();

  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [activeScope, setActiveScope] = useState<ChatFilterScope>("All");
  const [isPrivateUnlocked, setIsPrivateUnlocked] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalActionTitle, setPinModalActionTitle] = useState("Private Chats Locked");
  const [pendingChatActionToLock, setPendingChatActionToLock] = useState<any | null>(null);

  const [privateChatIds, setPrivateChatIds] = useState<string[]>([]);
  const [favouriteChatIds, setFavouriteChatIds] = useState<string[]>([]);
  const [onlineUsersMap, setOnlineUsersMap] = useState<Record<string, boolean>>({});
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [callHistoryLoading, setCallHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Quick Action Menu on a chat
  const [selectedChatAction, setSelectedChatAction] = useState<any | null>(null);

  // Auto-lock private chats when switching tabs or backgrounding
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setIsPrivateUnlocked(false);
        setActiveScope((curr) => (curr === "Private" ? "All" : curr));
      };
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setIsPrivateUnlocked(false);
        setActiveScope((curr) => (curr === "Private" ? "All" : curr));
      }
    });
    return () => sub.remove();
  }, []);

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
  const [startCallModalVisible, setStartCallModalVisible] = useState(false);
  const [startCallDefaultType, setStartCallDefaultType] = useState<"audio" | "video">("audio");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalType, setSuccessModalType] = useState<"locked" | "unlocked">("locked");
  const [successModalChatName, setSuccessModalChatName] = useState("");

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
  // 2. PRIVACY & FAVOURITES PERSISTENCE
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Immediately hydrate from AsyncStorage for instant rendering
    AsyncStorage.getItem(`@bunkmates_private_chats_${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          if (Array.isArray(list)) setPrivateChatIds(list);
        } catch (e) {}
      }
    });

    AsyncStorage.getItem(`@bunkmates_favourite_chats_${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const list: string[] = JSON.parse(cached);
          if (Array.isArray(list)) setFavouriteChatIds(list);
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync on current user's profile
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const pList: string[] = d.privateChatIds || [];
        const fList: string[] = d.favouriteChatIds || [];
        setPrivateChatIds(pList);
        setFavouriteChatIds(fList);
        AsyncStorage.setItem(`@bunkmates_private_chats_${user.uid}`, JSON.stringify(pList)).catch(() => {});
        AsyncStorage.setItem(`@bunkmates_favourite_chats_${user.uid}`, JSON.stringify(fList)).catch(() => {});
      }
    });

    return () => unsubUser();
  }, [user?.uid]);

  // ═══════════════════════════════════════════════════════════
  // 3. GENUINE REALTIME ONLINE USERS LISTENER
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.uid) return;

    const qUsers = query(collection(db, "users"));
    const unsub = onSnapshot(
      qUsers,
      (snapshot) => {
        const map: Record<string, boolean> = {};
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          if (docSnap.id === user.uid) return; // Exclude current user
          const data = docSnap.data();
          const lastSeenMs = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : 0;
          // Genuine online check: explicitly online or active within last 5 minutes
          const isRecent = lastSeenMs > 0 && now - lastSeenMs < 5 * 60 * 1000;
          const isOnline = data.isOnline === true || data.online === true || isRecent;

          if (isOnline) {
            map[docSnap.id] = true;
          }
        });

        setOnlineUsersMap(map);
      },
      (err) => {
        console.warn("[Chats] Error listening to online users:", err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Privacy & Favourite Checkers
  const isItemPrivate = (item: any) => {
    if (!item) return false;
    const peerUid =
      item.rawItem?.uid ||
      (item.id.includes("_")
        ? item.id.split("_").find((x: string) => x !== user?.uid)
        : item.id);
    return (
      privateChatIds.includes(item.id) ||
      (peerUid ? privateChatIds.includes(peerUid) : false)
    );
  };

  const isItemFavourite = (item: any) => {
    if (!item) return false;
    const peerUid =
      item.rawItem?.uid ||
      (item.id.includes("_")
        ? item.id.split("_").find((x: string) => x !== user?.uid)
        : item.id);
    return (
      favouriteChatIds.includes(item.id) ||
      (peerUid ? favouriteChatIds.includes(peerUid) : false)
    );
  };

  const handlePinSuccess = () => {
    if (pendingChatActionToLock) {
      executeTogglePrivateChat(pendingChatActionToLock);
      setPendingChatActionToLock(null);
    } else {
      setIsPrivateUnlocked(true);
      setActiveScope("Private");
    }
  };

  const handleTogglePrivateChat = (item: any) => {
    if (!user?.uid || !item) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const isCurrentlyPrivate = isItemPrivate(item);
    setPendingChatActionToLock(item);
    setPinModalActionTitle(
      isCurrentlyPrivate ? `Unlock '${item.title}'` : `Lock '${item.title}'`
    );
    setSelectedChatAction(null);
    setPinModalVisible(true);
  };

  const executeTogglePrivateChat = async (item: any) => {
    if (!user?.uid || !item) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    const peerUid =
      item.rawItem?.uid ||
      (item.id.includes("_")
        ? item.id.split("_").find((x: string) => x !== user?.uid)
        : item.id);
    const chatId = item.id;
    const isCurrentlyPrivate = isItemPrivate(item);

    const userRef = doc(db, "users", user.uid);
    try {
      if (isCurrentlyPrivate) {
        const updated = privateChatIds.filter((id) => id !== chatId && id !== peerUid);
        setPrivateChatIds(updated);
        await updateDoc(userRef, {
          privateChatIds: arrayRemove(chatId, peerUid),
        });
        await AsyncStorage.setItem(
          `@bunkmates_private_chats_${user.uid}`,
          JSON.stringify(updated)
        );
        setSuccessModalType("unlocked");
        setSuccessModalChatName(item.title || "Chat");
        setSuccessModalVisible(true);
      } else {
        const updated = [...privateChatIds, chatId, peerUid].filter(Boolean);
        setPrivateChatIds(updated);
        await updateDoc(userRef, {
          privateChatIds: arrayUnion(chatId, peerUid),
        });
        await AsyncStorage.setItem(
          `@bunkmates_private_chats_${user.uid}`,
          JSON.stringify(updated)
        );
        setSuccessModalType("locked");
        setSuccessModalChatName(item.title || "Chat");
        setSuccessModalVisible(true);
      }
    } catch (err) {
      console.error("Error toggling private chat:", err);
    }
  };

  const handleToggleFavouriteChat = async (item: any) => {
    if (!user?.uid || !item) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const peerUid =
      item.rawItem?.uid ||
      (item.id.includes("_")
        ? item.id.split("_").find((x: string) => x !== user?.uid)
        : item.id);
    const chatId = item.id;
    const isCurrentlyFav = isItemFavourite(item);

    const userRef = doc(db, "users", user.uid);
    try {
      if (isCurrentlyFav) {
        const updated = favouriteChatIds.filter((id) => id !== chatId && id !== peerUid);
        setFavouriteChatIds(updated);
        await updateDoc(userRef, {
          favouriteChatIds: arrayRemove(chatId, peerUid),
        });
        await AsyncStorage.setItem(
          `@bunkmates_favourite_chats_${user.uid}`,
          JSON.stringify(updated)
        );
      } else {
        const updated = [...favouriteChatIds, chatId, peerUid].filter(Boolean);
        setFavouriteChatIds(updated);
        await updateDoc(userRef, {
          favouriteChatIds: arrayUnion(chatId, peerUid),
        });
        await AsyncStorage.setItem(
          `@bunkmates_favourite_chats_${user.uid}`,
          JSON.stringify(updated)
        );
      }
    } catch (err) {
      console.error("Error toggling favourite chat:", err);
    }
    setSelectedChatAction(null);
  };

  // ═══════════════════════════════════════════════════════════
  // 4. CONVERSATIONS & FILTERING (Removing Broken Dummy Chats)
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

  const getTimestampMs = (t: any): number => {
    if (!t) return 0;
    if (typeof t === "number") return t < 10000000000 ? t * 1000 : t;
    if (typeof t?.toMillis === "function") return t.toMillis();
    if (typeof t?.toDate === "function") return t.toDate().getTime();
    if (typeof t?.seconds === "number") return t.seconds * 1000;
    if (typeof t === "string") {
      const parsed = new Date(t).getTime();
      return isNaN(parsed) ? 0 : parsed;
    }
    if (t instanceof Date) return t.getTime();
    return 0;
  };

  const normalizedChats = useMemo(() => {
    const clearedMs = clearedAt ? new Date(clearedAt).getTime() : 0;
    // Exclude invalid/broken dummy chats with no messages or unknown names
    const validChats = (filteredChats || []).filter((c: any) => {
      if (!c || !c.id) return false;
      const isDummy =
        (!c.name || c.name === "Unknown User") &&
        (!c.lastMessage || c.lastMessage === "No messages yet");
      return !isDummy;
    });

    // Deduplicate by peer UID keeping the most recent chat
    const chatByPeer = new Map<string, any>();
    for (const c of validChats) {
      const anyC = c as any;
      const peerUid: string =
        anyC.uid ||
        (c.id.includes("_")
          ? c.id.split("_").find((x: string) => x !== user?.uid) || c.id
          : c.id);
      const existing = chatByPeer.get(peerUid);
      const cTime = getTimestampMs(anyC.lastTimestamp || anyC.timestamp || anyC.date);
      const isCleared = clearedMs > 0 && cTime > 0 && cTime < clearedMs;

      if (!existing || getTimestampMs(existing.timestamp) < cTime) {
        chatByPeer.set(peerUid, {
          id: c.id,
          type: "chat" as const,
          title: c.name || anyC.displayName || "Traveler",
          subtitle: isCleared ? "" : (c.lastMessage || ""),
          avatar:
            c.avatar ||
            anyC.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              c.name || "Traveler"
            )}&background=1f2937&color=fff`,
          timestamp: cTime,
          unreadCount: isCleared ? 0 : (c.unreadCount || 0),
          badge: null,
          rawItem: c,
        });
      }
    }

    return Array.from(chatByPeer.values());
  }, [filteredChats, user?.uid, clearedAt]);

  const normalizedGroups = useMemo(() => {
    const clearedMs = clearedAt ? new Date(clearedAt).getTime() : 0;
    const validGroups = (filteredGroups || []).filter((g: any) => !!g && !!g.id);

    return validGroups.map((g: any) => {
      const gTime = getTimestampMs(g.lastTimestamp || g.updatedAt || g.createdAt || 0);
      const isCleared = clearedMs > 0 && gTime > 0 && gTime < clearedMs;
      return {
        id: g.id,
        type: "group" as const,
        title: g.name || g.tripName || "Trip Group",
        subtitle: isCleared
          ? "Group conversation"
          : (g.lastMessage && g.lastMessage !== "No messages yet" ? g.lastMessage : "Group conversation"),
        avatar: g.iconURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(g.name || "Group")}&background=3b82f6&color=fff`,
        timestamp: gTime,
        unreadCount: isCleared ? 0 : (typeof g.unreadCount === "number" ? g.unreadCount : g.unreadCounts?.current || 0),
        badge: null,
        rawItem: g,
      };
    });
  }, [filteredGroups, clearedAt]);

  const combinedList = useMemo(() => {
    // Sort all single chats and group chats together so newest message is ALWAYS index 0 (top)
    const list = [...normalizedChats, ...normalizedGroups].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );

    // Guaranteed deduplication: DO NOT allow chat keys to collide with group keys!
    const seen = new Set<string>();
    return list.filter((item) => {
      const key = `${item.type}_${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [normalizedChats, normalizedGroups]);

  const archivedCount = useMemo(() => {
    return combinedList.filter((item) => isChatArchived(item.id)).length;
  }, [combinedList, isChatArchived, archivedChatIds]);

  // Filter based on activeScope (All, Unread, Group, Favourites, Private) & Archived status
  const displayedList = useMemo(() => {
    // 1. If viewing archived chats specifically
    if (showArchivedOnly) {
      return combinedList.filter((item) => isChatArchived(item.id));
    }

    // 2. Private tab shows ONLY private chats
    if (activeScope === "Private") {
      return combinedList.filter((item) => isItemPrivate(item));
    }

    // 3. Exclude private chats
    let nonPrivateList = combinedList.filter((item) => !isItemPrivate(item));

    // 4. If keepArchived is enabled (WhatsApp behavior), exclude archived chats from regular tabs
    if (keepArchived) {
      nonPrivateList = nonPrivateList.filter((item) => !isChatArchived(item.id));
    }

    if (activeScope === "Unread") {
      return nonPrivateList.filter((item) => item.unreadCount > 0);
    }
    if (activeScope === "Group") {
      return nonPrivateList.filter((item) => item.type === "group");
    }
    if (activeScope === "Favourites") {
      return nonPrivateList.filter((item) => isItemFavourite(item));
    }

    // "All" tab: non-private & non-archived
    return nonPrivateList;
  }, [combinedList, activeScope, showArchivedOnly, keepArchived, isChatArchived, archivedChatIds, privateChatIds, favouriteChatIds]);

  const totalUnreadCount = useMemo(() => {
    return combinedList.filter((c) => !isItemPrivate(c) && c.unreadCount > 0).length;
  }, [combinedList, privateChatIds]);

  const groupCountBadge = useMemo(() => {
    return combinedList.filter((item) => !isItemPrivate(item) && item.type === "group").length;
  }, [combinedList, privateChatIds]);

  const favouriteCountBadge = useMemo(() => {
    return combinedList.filter((item) => !isItemPrivate(item) && isItemFavourite(item)).length;
  }, [combinedList, privateChatIds, favouriteChatIds]);

  const privateCountBadge = useMemo(() => {
    return combinedList.filter((item) => isItemPrivate(item)).length;
  }, [combinedList, privateChatIds]);

  // Group Call History WhatsApp style: multiple calls with the same person are grouped
  // showing the count e.g. "Sahil Suman (5)" rather than multiple repetitive rows
  const groupedCallHistory = useMemo(() => {
    if (!callHistory || callHistory.length === 0) return [];

    const groups: any[] = [];
    let current: any = null;

    for (const call of callHistory) {
      const isOutgoing = call.callerId === user?.uid;
      const peerUid = isOutgoing ? call.receiverId : call.callerId;
      const peerName = isOutgoing
        ? call.receiverName || "BunkMate"
        : call.callerName || "BunkMate";
      const peerAvatar = isOutgoing ? call.receiverAvatar : call.callerAvatar;
      const peerHandle = isOutgoing ? call.receiverHandle : call.callerHandle;
      const isMissed = call.status === "missed" || call.status === "declined";
      const isVideo = call.callType === "video";

      // Group consecutive calls with the same contact
      if (current && current.peerUid === peerUid) {
        current.count += 1;
        current.calls.push(call);
        if (call.computedDuration) {
          current.totalDuration += call.computedDuration;
        }
      } else {
        current = {
          id: call.id,
          peerUid,
          peerName,
          peerAvatar,
          peerHandle,
          isOutgoing,
          isMissed,
          isVideo,
          callType: call.callType || "audio",
          status: call.status,
          createdAt: call.createdAt || call.timestamp,
          timestamp: call.timestamp || call.createdAt,
          computedDuration: call.computedDuration || 0,
          totalDuration: call.computedDuration || 0,
          count: 1,
          calls: [call],
          latestCall: call,
        };
        groups.push(current);
      }
    }

    if (!searchQuery.trim()) return groups;

    const q = searchQuery.toLowerCase().trim();
    return groups.filter((g) =>
      (g.peerName || "").toLowerCase().includes(q)
    );
  }, [callHistory, user?.uid, searchQuery]);

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

  const hasCachedItems = combinedList.length > 0 || (activeScope === "Calls" && groupedCallHistory.length > 0);
  const showBlockingLoader = authLoading ? true : (!hasCachedItems && (chatsLoading || groupsLoading));

  return (
    <View style={[s.screenContainer, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

      {/* ── TOP HEADER (Clean, Professional, WhatsApp Reference) ── */}
      <View style={[s.topHeader, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[s.headerTitleText, { color: themeColors.text, fontSize: scaleFont(26) }]}>{t("Chats", "Chats")}</Text>
          <Text style={[s.headerSubtitleText, { color: themeColors.textSecondary, fontSize: scaleFont(12) }]}>
            {activeScope === "Private"
              ? `${displayedList.length} locked chats`
              : activeScope === "Favourites"
              ? `${displayedList.length} favourite chats`
              : activeScope === "Group"
              ? `${displayedList.length} groups`
              : activeScope === "Unread"
              ? `${displayedList.length} unread chats`
              : activeScope === "Calls"
              ? `${groupedCallHistory.length} ${groupedCallHistory.length === 1 ? "call" : "calls"}`
              : `${displayedList.length} ${displayedList.length === 1 ? "chat" : "chats"}${totalUnreadCount > 0 ? ` • ${totalUnreadCount} unread` : ""}`}
          </Text>
        </View>

        <View style={s.headerRightCluster}>
          {/* Create Group Quick Button */}
          <Pressable
            style={[
              s.headerCircleBtn,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                borderColor: themeColors.border,
              },
            ]}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {}
              setCreateGroupModalVisible(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="people-outline" size={20} color={themeColors.text} />
          </Pressable>

          {/* New Chat Quick Button */}
          <Pressable
            style={[
              s.headerCircleBtn,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                borderColor: themeColors.border,
              },
            ]}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (e) {}
              setAddFriendModalVisible(true);
            }}
            hitSlop={8}
          >
            <Ionicons name="person-add-outline" size={19} color={themeColors.text} />
          </Pressable>

          <NotificationBell />
        </View>
      </View>

      {/* ── SEARCH BAR (High-Legibility, Sleek Floating Pill) ── */}
      <View style={s.searchRow}>
        <View
          style={[
            s.searchFieldBox,
            {
              backgroundColor: isDark ? "#0d0f14" : "#f3f4f6",
              borderColor: themeColors.border,
            },
          ]}
        >
          <Feather name="search" size={17} color={isDark ? "#7e8594" : "#9ca3af"} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search bunkmates, groups, chats..."
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[s.searchInputField, { color: themeColors.text, fontSize: scaleFont(14) }]}
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
              <Ionicons name="close-circle" size={18} color={isDark ? "#7e8594" : "#9ca3af"} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── HORIZONTAL CATEGORY CHIPS: Exactly All, Unread, Group, Favourites, Private, Calls ── */}
      <View style={s.scopeChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scopeChipsScroll}
        >
          {(
            [
              { key: "All", label: t("All", "All"), count: 0 },
              { key: "Unread", label: t("Unread", "Unread"), count: totalUnreadCount },
              { key: "Group", label: t("Group", "Group"), count: groupCountBadge },
              { key: "Favourites", label: t("Favourites", "Favourites"), count: favouriteCountBadge },
              { key: "Private", label: t("Private", "Private"), count: privateCountBadge },
              { key: "Calls", label: t("Calls", "Calls"), count: groupedCallHistory.length },
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
                  if (scope.key === "Private") {
                    if (!isPrivateUnlocked) {
                      setPendingChatActionToLock(null);
                      setPinModalActionTitle("Private Chats Locked");
                      setPinModalVisible(true);
                      return;
                    }
                  } else {
                    setIsPrivateUnlocked(false);
                  }
                  setActiveScope(scope.key);
                }}
                style={[
                  s.scopeChip,
                  {
                    backgroundColor: isDark ? "#0d0f14" : "#f3f4f6",
                    borderColor: themeColors.border,
                  },
                  isSelected && {
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  },
                ]}
              >
                {scope.key === "Group" && (
                  <Ionicons
                    name="people"
                    size={13}
                    color={isSelected ? onAccentTextColor : themeColors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                )}
                {scope.key === "Favourites" && (
                  <Ionicons
                    name="star"
                    size={12}
                    color={isSelected ? onAccentTextColor : themeColors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                )}
                {scope.key === "Private" && (
                  <Ionicons
                    name="lock-closed"
                    size={12}
                    color={isSelected ? onAccentTextColor : themeColors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                )}
                {scope.key === "Calls" && (
                  <Ionicons
                    name="call"
                    size={12}
                    color={isSelected ? onAccentTextColor : themeColors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text
                  style={[
                    s.scopeChipText,
                    { color: themeColors.textSecondary, fontSize: scaleFont(13) },
                    isSelected && { color: onAccentTextColor, fontWeight: "700" },
                  ]}
                >
                  {scope.label}
                </Text>
                {scope.count > 0 && (
                  <View
                    style={[
                      s.scopeCountBadge,
                      isSelected
                        ? {
                            backgroundColor: isBrightAccent
                              ? "rgba(0,0,0,0.15)"
                              : "rgba(255,255,255,0.25)",
                          }
                        : {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.12)"
                              : "rgba(0,0,0,0.08)",
                          },
                    ]}
                  >
                    <Text
                      style={[
                        s.scopeCountBadgeText,
                        {
                          color: isSelected
                            ? onAccentTextColor
                            : isDark
                            ? "#ffffff"
                            : "#111827",
                          fontSize: scaleFont(10.5),
                        },
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
      {showBlockingLoader ? (
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
          {/* ═══════════════════════════════════════════════════════════
             UNIFIED WHATSAPP-STYLE LIST (No separated floating card boxes)
             ═══════════════════════════════════════════════════════════ */}
          {activeScope === "Private" && (
            <View style={s.privateBannerRow}>
              <View style={s.privateBannerLeft}>
                <Ionicons name="shield-checkmark" size={15} color="#ffffff" />
                <Text style={s.privateBannerText}>Private Chats Unlocked</Text>
              </View>
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  setIsPrivateUnlocked(false);
                  setActiveScope("All");
                }}
                style={s.lockNowBtn}
              >
                <Ionicons name="lock-closed" size={12} color="#000000" style={{ marginRight: 4 }} />
                <Text style={s.lockNowBtnText}>Lock Now</Text>
              </Pressable>
            </View>
          )}

          {showArchivedOnly && (
            <View style={s.privateBannerRow}>
              <View style={s.privateBannerLeft}>
                <Ionicons name="archive" size={15} color="#ffffff" />
                <Text style={s.privateBannerText}>Archived Chats ({archivedCount})</Text>
              </View>
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  setShowArchivedOnly(false);
                }}
                style={s.lockNowBtn}
              >
                <Ionicons name="arrow-back" size={12} color="#000000" style={{ marginRight: 4 }} />
                <Text style={s.lockNowBtnText}>Back</Text>
              </Pressable>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════
             CALLS TAB FEED (WhatsApp Reference in White & Black Accent)
             ═══════════════════════════════════════════════════════════ */}
          {activeScope === "Calls" ? (
            <View style={s.callsContainer}>
              {/* Top Quick Actions Cards (Voice Call, Video Call, Group Call) */}
              <View style={s.callQuickActionsRow}>
                <Pressable
                  style={[
                    s.callActionCard,
                    {
                      backgroundColor: isDark ? "#0d0f14" : "#f3f4f6",
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    setStartCallDefaultType("audio");
                    setStartCallModalVisible(true);
                  }}
                >
                  <View
                    style={[
                      s.callActionIconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <Ionicons name="call" size={18} color={themeColors.text} />
                  </View>
                  <Text style={[s.callActionCardTitle, { color: themeColors.text, fontSize: scaleFont(12) }]}>Voice Call</Text>
                  <Text style={[s.callActionCardSub, { color: themeColors.textSecondary, fontSize: scaleFont(10) }]}>Single bunkmate</Text>
                </Pressable>

                <Pressable
                  style={[
                    s.callActionCard,
                    {
                      backgroundColor: isDark ? "#0d0f14" : "#f3f4f6",
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    setStartCallDefaultType("video");
                    setStartCallModalVisible(true);
                  }}
                >
                  <View
                    style={[
                      s.callActionIconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <Ionicons name="videocam" size={18} color={themeColors.text} />
                  </View>
                  <Text style={[s.callActionCardTitle, { color: themeColors.text, fontSize: scaleFont(12) }]}>Video Call</Text>
                  <Text style={[s.callActionCardSub, { color: themeColors.textSecondary, fontSize: scaleFont(10) }]}>HD Face to Face</Text>
                </Pressable>

                <Pressable
                  style={[
                    s.callActionCard,
                    {
                      backgroundColor: isDark ? "#0d0f14" : "#f3f4f6",
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    setCreateGroupModalVisible(true);
                  }}
                >
                  <View
                    style={[
                      s.callActionIconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <Ionicons name="people" size={18} color={themeColors.text} />
                  </View>
                  <Text style={[s.callActionCardTitle, { color: themeColors.text, fontSize: scaleFont(12) }]}>Group Call</Text>
                  <Text style={[s.callActionCardSub, { color: themeColors.textSecondary, fontSize: scaleFont(10) }]}>Travel crew</Text>
                </Pressable>
              </View>

              {/* Section Header: Recent Calls */}
              <View style={s.callsSectionHeader}>
                <Text style={[s.callsSectionTitle, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>Recent</Text>
                {groupedCallHistory.length > 0 && (
                  <View
                    style={[
                      s.callsBadgeCount,
                      {
                        backgroundColor: isDark
                          ? "rgba(255, 255, 255, 0.12)"
                          : "rgba(0, 0, 0, 0.08)",
                      },
                    ]}
                  >
                    <Text style={[s.callsBadgeCountText, { color: themeColors.text, fontSize: scaleFont(11) }]}>{groupedCallHistory.length}</Text>
                  </View>
                )}
              </View>

              {/* Recent Call Items Grouped WhatsApp Style */}
              {groupedCallHistory.length > 0 ? (
                <View style={s.callsListFeed}>
                  {groupedCallHistory.map((callItem: any) => {
                    const isOutgoing = callItem.isOutgoing;
                    const isMissed = callItem.isMissed;
                    const isVideo = callItem.isVideo;
                    const peerName = callItem.peerName || "BunkMate";
                    const peerAvatar = callItem.peerAvatar;
                    const peerUid = callItem.peerUid;
                    const callCount = callItem.count || 1;

                    return (
                      <Pressable
                        key={callItem.id}
                        style={({ pressed }) => [
                          s.callRowItem,
                          pressed && s.chatListRowPressed,
                        ]}
                        onPress={() => handleCallBack(callItem.latestCall || callItem)}
                      >
                        <Pressable
                          onPress={(e) => handleAvatarPress(peerUid, e)}
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
                            cachePolicy="memory-disk"
                          />
                        </Pressable>

                        <View style={s.callRowMiddle}>
                          <Text
                            style={[
                              s.callRowName,
                              { color: themeColors.text, fontSize: scaleFont(15) },
                              isMissed && s.callRowNameMissed,
                            ]}
                            numberOfLines={1}
                          >
                            {peerName}
                            {callCount > 1 ? ` (${callCount})` : ""}
                          </Text>

                          <View style={s.callRowMetaLine}>
                            {isMissed ? (
                              <Ionicons
                                name="call"
                                size={12}
                                color="#ef4444"
                                style={{ marginRight: 5 }}
                              />
                            ) : isOutgoing ? (
                              <Ionicons
                                name="arrow-up"
                                size={12}
                                color={themeColors.text}
                                style={{
                                  marginRight: 5,
                                  transform: [{ rotate: "45deg" }],
                                }}
                              />
                            ) : (
                              <Ionicons
                                name="arrow-down"
                                size={12}
                                color={themeColors.text}
                                style={{
                                  marginRight: 5,
                                  transform: [{ rotate: "45deg" }],
                                }}
                              />
                            )}

                            <Text
                              style={[
                                s.callRowMetaText,
                                { color: themeColors.textSecondary, fontSize: scaleFont(12.5) },
                                isMissed && { color: "#ef4444" },
                              ]}
                            >
                              {isMissed
                                ? `Missed ${isVideo ? "video" : "voice"} call`
                                : isOutgoing
                                ? "Outgoing"
                                : "Incoming"}
                              {" • "}
                              {formatTime(
                                callItem.createdAt || callItem.timestamp
                              )}
                              {callItem.totalDuration > 0
                                ? ` (${formatDuration(
                                    callItem.totalDuration
                                  )})`
                                : ""}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          style={[
                            s.callRowActionBtn,
                            {
                              backgroundColor: isDark
                                ? "rgba(255, 255, 255, 0.08)"
                                : "rgba(0, 0, 0, 0.05)",
                              borderColor: themeColors.border,
                            },
                          ]}
                          onPress={() =>
                            handleCallBack(
                              callItem.latestCall || callItem,
                              isVideo ? "video" : "audio"
                            )
                          }
                          hitSlop={10}
                        >
                          <Ionicons
                            name={isVideo ? "videocam" : "call"}
                            size={18}
                            color={themeColors.text}
                          />
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <EmptyView
                  icon="phone-call"
                  title="No Recent Calls"
                  subtitle="Stay in touch with your travel bunkmates via crisp voice and video calls"
                  actionLabel="Start a Call"
                  onAction={() => {
                    setStartCallDefaultType("audio");
                    setStartCallModalVisible(true);
                  }}
                />
              )}
            </View>
          ) : displayedList.length > 0 || (activeScope === "All" && archivedCount > 0) ? (
            <View style={s.chatListContainer}>
              {/* WhatsApp-Style Archived Row at the top of All chats */}
              {activeScope === "All" && !showArchivedOnly && archivedCount > 0 && (
                <Pressable
                  style={[
                    s.archivedRow,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#f3f4f6",
                      borderColor: themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    setShowArchivedOnly(true);
                  }}
                >
                  <View style={s.archivedRowLeft}>
                    <View
                      style={[
                        s.archivedIconBox,
                        {
                          backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e5e7eb",
                        },
                      ]}
                    >
                      <Ionicons name="archive-outline" size={18} color={themeColors.text} />
                    </View>
                    <Text
                      style={[
                        s.archivedRowText,
                        { color: themeColors.text, fontSize: scaleFont(14.5) },
                      ]}
                    >
                      Archived
                    </Text>
                  </View>
                  <View style={s.archivedBadge}>
                    <Text style={s.archivedBadgeText}>{archivedCount}</Text>
                  </View>
                </Pressable>
              )}

              {displayedList.map((item: any, index: number) => {
                const isGroup = item.type === "group";
                const isUnread = item.unreadCount > 0;
                const peerUid =
                  item.rawItem?.uid ||
                  (item.id.includes("_")
                    ? item.id.split("_").find((x: string) => x !== user?.uid)
                    : item.id);
                const isPeerOnline =
                  !isGroup &&
                  (onlineUsersMap[peerUid] === true ||
                    item.rawItem?.online === true ||
                    item.rawItem?.isOnline === true);

                const isFav = isItemFavourite(item);
                const isPriv = isItemPrivate(item);

                return (
                  <View key={`${item.type}-${item.id}`}>
                    <Pressable
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
                        s.chatListRow,
                        pressed && s.chatListRowPressed,
                      ]}
                    >
                      {/* Avatar with Genuine Realtime Online Green Dot */}
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
                          cachePolicy="memory-disk"
                        />
                        {isGroup ? (
                          <View style={s.avatarBadgeGroup}>
                            <Ionicons name="people" size={10} color="#ffffff" />
                          </View>
                        ) : isPeerOnline ? (
                          <View style={s.avatarBadgeOnline} />
                        ) : null}
                      </Pressable>

                      {/* Middle: Title, Badges & Last Message Snippet */}
                      <View style={s.cardBodyMiddle}>
                        <View style={s.cardHeadlineRow}>
                          <Text
                            style={[
                              s.cardHeadlineTitle,
                              { color: themeColors.text, fontSize: scaleFont(16) },
                              isUnread && s.cardHeadlineTitleUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>

                          {isFav && (
                            <Ionicons
                              name="star"
                              size={12}
                              color="#f59e0b"
                              style={{ marginLeft: 5 }}
                            />
                          )}

                          {isPriv && (
                            <Ionicons
                              name="lock-closed"
                              size={12}
                              color="#10b981"
                              style={{ marginLeft: 5 }}
                            />
                          )}

                          {isGroup && (
                            <View style={s.groupChipBadge}>
                              <Text style={s.groupChipText}>Group</Text>
                            </View>
                          )}
                        </View>

                        <View style={s.cardMessageSnippetRow}>
                          {/* Media / Call indicators in snippet */}
                          {item.subtitle?.includes("📷") || item.subtitle?.includes("Photo") || item.subtitle?.includes("Image") ? (
                            <Ionicons
                              name="camera-outline"
                              size={14}
                              color="#9ca3af"
                              style={{ marginRight: 4 }}
                            />
                          ) : item.subtitle?.includes("📹") || item.subtitle?.includes("Video") ? (
                            <Ionicons
                              name="videocam"
                              size={14}
                              color="#38bdf8"
                              style={{ marginRight: 4 }}
                            />
                          ) : item.subtitle?.includes("📞") || item.subtitle?.includes("Voice") || item.subtitle?.includes("call") ? (
                            <Ionicons
                              name="call"
                              size={13}
                              color={
                                item.subtitle?.includes("Missed") ||
                                item.subtitle?.includes("Declined")
                                  ? "#ff5252"
                                  : "#38bdf8"
                              }
                              style={{ marginRight: 4 }}
                            />
                          ) : null}

                          <Text
                            style={[
                              s.messageSnippetText,
                              { color: themeColors.textSecondary, fontSize: scaleFont(13) },
                              isUnread && { color: themeColors.text, fontWeight: "600" },
                            ]}
                            numberOfLines={1}
                          >
                            {item.subtitle || "Tap to chat"}
                          </Text>
                        </View>
                      </View>

                      {/* Right: Timestamp & Unread Badge / Pin */}
                      <View style={s.cardTrailingCol}>
                        <Text
                          style={[
                            s.timeStringText,
                            { color: themeColors.textSecondary, fontSize: scaleFont(11.5) },
                            isUnread && { color: accentColor, fontWeight: "700" },
                          ]}
                        >
                          {formatTime(item.timestamp)}
                        </Text>

                        {isUnread ? (
                          <View style={[s.unreadNumberBadge, { backgroundColor: accentColor }]}>
                            <Text style={[s.unreadNumberText, { color: onAccentTextColor, fontSize: scaleFont(11) }]}>
                              {item.unreadCount}
                            </Text>
                          </View>
                        ) : isFav ? (
                          <Ionicons
                            name="pin"
                            size={12}
                            color={accentColor}
                            style={{ marginTop: 6 }}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                );
                })}
              </View>
          ) : (
            <EmptyView
              icon={
                activeScope === "Private"
                  ? "shield"
                  : activeScope === "Favourites"
                  ? "star"
                  : activeScope === "Unread"
                  ? "check-circle"
                  : activeScope === "Group"
                  ? "users"
                  : "message-square"
              }
              title={
                searchQuery
                  ? `No chats match "${searchQuery}"`
                  : activeScope === "Private"
                  ? "No Private Chats Yet"
                  : activeScope === "Favourites"
                  ? "No Favourites Yet"
                  : activeScope === "Unread"
                  ? "All caught up! No unread messages"
                  : activeScope === "Group"
                  ? "No group chats found"
                  : "No conversations yet"
              }
              subtitle={
                activeScope === "Private"
                  ? "Lock any chat from user profile to securely hide it here"
                  : activeScope === "Favourites"
                  ? "Star any conversation from user profile for quick access here"
                  : activeScope === "Group"
                  ? "Create a travel group to coordinate trips together"
                  : "Connect with bunkmates and start a new conversation"
              }
              actionLabel={
                activeScope === "Group"
                  ? "Create Group"
                  : activeScope === "All"
                  ? "Start New Chat"
                  : undefined
              }
              onAction={
                activeScope === "Group"
                  ? () => setCreateGroupModalVisible(true)
                  : activeScope === "All"
                  ? () => setAddFriendModalVisible(true)
                  : undefined
              }
            />
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
            if (activeScope !== "Calls") {
              setActiveScope("Calls");
            } else {
              setStartCallDefaultType("audio");
              setStartCallModalVisible(true);
            }
          }}
          style={[s.fabButtonSquare, { backgroundColor: accentColor }]}
          hitSlop={8}
        >
          <Ionicons name="call" size={22} color={onAccentTextColor} />
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
        {selectedChatAction ? (
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

              {/* Lock / Unlock Chat (Private) */}
              <Pressable
                style={s.sheetActionItem}
                onPress={() => handleTogglePrivateChat(selectedChatAction)}
              >
                <View
                  style={[
                    s.sheetIconBox,
                    {
                      backgroundColor: isItemPrivate(selectedChatAction)
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(16, 185, 129, 0.15)",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      isItemPrivate(selectedChatAction)
                        ? "lock-open-outline"
                        : "lock-closed-outline"
                    }
                    size={20}
                    color={
                      isItemPrivate(selectedChatAction) ? "#ef4444" : "#10b981"
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetActionTitle}>
                    {isItemPrivate(selectedChatAction)
                      ? "Unlock Chat"
                      : "Lock Chat (Set as Private)"}
                  </Text>
                  <Text style={s.sheetActionDesc}>
                    {isItemPrivate(selectedChatAction)
                      ? "Restore to main chat feed"
                      : "Hide from All feed, only viewable in Private tab"}
                  </Text>
                </View>
              </Pressable>

              {/* Add / Remove Favourite */}
              <Pressable
                style={s.sheetActionItem}
                onPress={() => handleToggleFavouriteChat(selectedChatAction)}
              >
                <View
                  style={[
                    s.sheetIconBox,
                    { backgroundColor: "rgba(245, 158, 11, 0.15)" },
                  ]}
                >
                  <Ionicons
                    name={
                      isItemFavourite(selectedChatAction)
                        ? "star"
                        : "star-outline"
                    }
                    size={20}
                    color="#f59e0b"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetActionTitle}>
                    {isItemFavourite(selectedChatAction)
                      ? "Remove from Favourites"
                      : "Mark as Favourite"}
                  </Text>
                  <Text style={s.sheetActionDesc}>
                    {isItemFavourite(selectedChatAction)
                      ? "Remove from Favourites tab"
                      : "Pin to Favourites tab for quick access"}
                  </Text>
                </View>
              </Pressable>

              {/* Archive / Unarchive Chat */}
              <Pressable
                style={s.sheetActionItem}
                onPress={async () => {
                  if (!selectedChatAction?.id) return;
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  await toggleArchiveChat(selectedChatAction.id);
                  setSelectedChatAction(null);
                }}
              >
                <View style={[s.sheetIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <Ionicons
                    name={selectedChatAction?.id && isChatArchived(selectedChatAction.id) ? "arrow-up-circle-outline" : "archive-outline"}
                    size={20}
                    color="#38bdf8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetActionTitle}>
                    {selectedChatAction?.id && isChatArchived(selectedChatAction.id) ? "Unarchive Chat" : "Archive Chat"}
                  </Text>
                  <Text style={s.sheetActionDesc}>
                    {selectedChatAction?.id && isChatArchived(selectedChatAction.id) ? "Move back to main chats" : "Hide from main chats"}
                  </Text>
                </View>
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
        ) : null}
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

      {/* ── 6-DIGIT PRIVATE PIN MODAL ── */}
      <PrivatePinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSuccess={handlePinSuccess}
        actionTitle={pinModalActionTitle}
        mode="auto"
      />

      {/* ── START CALL MODAL ── */}
      <StartCallModal
        visible={startCallModalVisible}
        onClose={() => setStartCallModalVisible(false)}
        bunkmates={normalizedChats}
        groups={normalizedGroups}
        onStartSingleCall={(item, type) => {
          handleStartCallFromChat(item, type);
        }}
        onStartGroupCall={(grp) => {
          router.push(`/(tabs)/group-chatroom/${grp.id}` as any);
        }}
        defaultCallType={startCallDefaultType}
      />

      {/* ── STYLISH LOCK SUCCESS DIALOG WITH SWIPE RIGHT INSTRUCTION ── */}
      <PrivateLockSuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        type={successModalType}
        chatName={successModalChatName}
        onViewPrivateTab={() => {
          setActiveScope("Private");
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
  const { isDark, themeColors, accentColor, scaleFont } = useThemeToggle();
  const isBrightAccent =
    accentColor === "#FFFFFF" ||
    accentColor === "#ffffff" ||
    accentColor === "#f59e0b" ||
    accentColor === "#ffd700";
  const onAccentTextColor = isBrightAccent ? "#000000" : "#FFFFFF";

  return (
    <View style={s.emptyStateContainer}>
      <Feather name={icon} size={42} color={isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"} />
      <Text style={[s.emptyMainTitle, { color: themeColors.text, fontSize: scaleFont(17) }]}>{title}</Text>
      <Text style={[s.emptySubText, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable style={[s.emptyCtaButton, { backgroundColor: accentColor }]} onPress={onAction}>
          <Text style={[s.emptyCtaText, { color: onAccentTextColor, fontSize: scaleFont(13.5) }]}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={onAccentTextColor} style={{ marginLeft: 6 }} />
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

  // 5. WhatsApp-Style List Styles
  mainListScroll: {
    paddingTop: 4,
  },
  chatListContainer: {
    backgroundColor: "transparent",
  },
  chatListRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  chatListRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  privateBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  privateBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  privateBannerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  lockNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockNowBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
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
    borderColor: "#000000",
  },
  avatarBadgeOnline: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10b981",
    borderWidth: 2.5,
    borderColor: "#000000",
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
    color: "#10b981",
    fontWeight: "700",
  },
  unreadNumberBadge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
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

  // 9. Calls Tab Styles (WhatsApp Reference with White/Black Accent)
  callsContainer: {
    paddingHorizontal: 0,
    paddingTop: 4,
  },
  callQuickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  callActionCard: {
    flex: 1,
    backgroundColor: "#11141c",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  callActionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  callActionCardTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
  },
  callActionCardSub: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  callsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  callsSectionTitle: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  callsBadgeCount: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  callsBadgeCountText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  callsListFeed: {
    backgroundColor: "transparent",
  },
  callRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 2,
    backgroundColor: "transparent",
  },
  callRowMiddle: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  callRowName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  callRowNameMissed: {
    color: "#ef4444",
  },
  callRowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  callRowMetaText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12.5,
    fontWeight: "500",
  },
  callRowActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  // 10. FAB Anchor & White/Black Call Button
  floatingFabAnchor: {
    position: "absolute",
    right: 20,
    zIndex: 99,
  },
  fabButtonSquare: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  archivedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
  },
  archivedRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  archivedIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  archivedRowText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  archivedBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  archivedBadgeText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
});