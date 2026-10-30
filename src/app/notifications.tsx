import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import {
  markNotificationIdsAsDeleted,
  markNotificationIdsAsRead,
} from "../hooks/useUnreadNotifications";
import { useUserChats } from "../hooks/useUserChats";
import { useUserGroups } from "../hooks/useUserGroups";
import { auth, db } from "../lib/firebase";
import { sendFriendAcceptedNotification } from "../lib/sendAppNotification";
import SettingsHeaderGradientMask from "./settings/_components/SettingsHeaderGradientMask";

// Enable experimental layout animations on Android (only on legacy architecture; Fabric natively supports it)
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  const isFabric = Boolean(
    (globalThis as any).nativeFabricUIManager || (globalThis as any)._IS_FABRIC,
  );
  if (!isFabric) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const NOTIFICATIONS_CACHE_KEY = "@bunkmates_notifications_cache";

/* ============================================================
   TYPES & DATA SPECIFICATION
============================================================ */

export type NotificationType =
  | "chat"
  | "group_chat"
  | "call"
  | "missed_call"
  | "friend_request"
  | "friend_accepted"
  | "trip"
  | "like"
  | "feedback"
  | "system"
  | string;

export interface AppNotification {
  id: string;
  recipientId?: string;
  uid?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  pic?: string;
  type?: NotificationType;
  title?: string;
  body?: string;
  content?: string;
  message?: string;
  timestamp?: any;
  isRead?: boolean;
  seen?: boolean;
  read?: boolean;
  status?: string;
  stackId?: string;
  groupId?: string;
  groupName?: string;
  chatId?: string;
  callId?: string;
  callType?: "audio" | "video";
  tripId?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

// Module-level in-memory cache for instant 0ms mount render
let memoryNotificationsCache: AppNotification[] = [];

export type FilterCategory =
  | "all"
  | "unreads"
  | "chat"
  | "group_chat"
  | "calls"
  | "feedback";

interface NotificationStackGroup {
  groupKey: string;
  categoryLabel: string;
  masterItem: AppNotification;
  items: AppNotification[];
}

interface DateSectionGroup {
  key: string;
  title: string;
  sortTimestamp: number;
  stackGroups: NotificationStackGroup[];
}

/* ============================================================
   HELPERS & DATE FORMATTERS
============================================================ */

function toDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "number") return new Date(timestamp);
  if (typeof timestamp === "string") {
    const d = new Date(timestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatCardTime(timestamp: any): string {
  const date = toDate(timestamp);
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatStackedTime(timestamp: any): string {
  const date = toDate(timestamp);
  if (!date) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return `Today • ${time}`;
  if (diffDays === 1) return `Yesterday • ${time}`;
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} • ${time}`;
}

function getDateSectionInfo(timestamp: any): {
  key: string;
  title: string;
  sortTimestamp: number;
} {
  const date = toDate(timestamp);
  if (!date) {
    return { key: "earlier", title: "EARLIER", sortTimestamp: 0 };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { key: "today", title: "TODAY", sortTimestamp: itemDate.getTime() };
  }
  if (diffDays === 1) {
    return {
      key: "yesterday",
      title: "YESTERDAY",
      sortTimestamp: itemDate.getTime(),
    };
  }
  if (diffDays >= 2 && diffDays < 7) {
    const dayName = date
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase();
    return {
      key: `day_${itemDate.getTime()}`,
      title: dayName,
      sortTimestamp: itemDate.getTime(),
    };
  }

  const formatted = date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
  return {
    key: `date_${itemDate.getTime()}`,
    title: formatted,
    sortTimestamp: itemDate.getTime(),
  };
}

function stripHtml(value?: string): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function getAvatarInitialBg(name: string): string {
  const palette = [
    "#204E4A", // Slate Teal (like 'R' for Ratan devi)
    "#0F766E", // Deep Teal (like 'M' for Bunk1)
    "#1E3A5F", // Muted Navy
    "#3B2D54", // Muted Plum
    "#4A3224", // Muted Bronze
    "#2B3A4A", // Charcoal Slate
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/* ============================================================
   GROUP DETECTION & EXTRACTION HELPERS
============================================================ */

function extractGroupId(item: AppNotification): string | null {
  if (!item) return null;
  if (item.groupId && typeof item.groupId === "string" && item.groupId.trim())
    return item.groupId.trim();
  if (
    item.metadata?.groupId &&
    typeof item.metadata.groupId === "string" &&
    item.metadata.groupId.trim()
  )
    return item.metadata.groupId.trim();
  if (
    item.data?.groupId &&
    typeof item.data.groupId === "string" &&
    item.data.groupId.trim()
  )
    return item.data.groupId.trim();

  // From route string, e.g. "/group-chatroom/xyz" or "/(tabs)/group-chatroom/xyz"
  const routeStr = typeof item.route === "string" ? item.route : "";
  if (routeStr.includes("group-chatroom/")) {
    const parts = routeStr.split("group-chatroom/");
    if (parts[1]) {
      const extracted = parts[1].split("?")[0].replace(/^\//, "").trim();
      if (extracted) return extracted;
    }
  }

  // If item.type is group_chat or group, chatId is often the groupId
  if (
    item.type === "group_chat" ||
    item.type === "group" ||
    item.category === "group_chat"
  ) {
    if (
      item.chatId &&
      typeof item.chatId === "string" &&
      item.chatId.trim() &&
      !item.chatId.includes("_")
    ) {
      return item.chatId.trim();
    }
    if ((item as any).groupId && typeof (item as any).groupId === "string") {
      return (item as any).groupId.trim();
    }
  }

  return null;
}

function isGroupNotification(item: AppNotification): boolean {
  if (!item) return false;
  if (
    item.type === "group_chat" ||
    item.type === "group" ||
    item.category === "group_chat"
  )
    return true;
  if (Boolean(extractGroupId(item))) return true;
  if (typeof item.route === "string" && item.route.includes("group-chatroom"))
    return true;
  if (Boolean(item.groupName)) return true;
  return false;
}

function getTargetFriendId(
  item: AppNotification,
  myUid?: string,
): string | null {
  if (!item) return null;

  // 1. Check item.route e.g. "/chat/friendId" or "/chat/uidA_uidB"
  if (typeof item.route === "string" && item.route.includes("/chat/")) {
    const rawTarget = item.route
      .split("/chat/")[1]
      ?.split("?")[0]
      ?.replace(/^\//, "")
      .trim();
    if (rawTarget) {
      if (rawTarget.includes("_") && myUid) {
        const other = rawTarget.split("_").find((p) => p !== myUid);
        if (other) return other;
      } else if (rawTarget !== myUid) {
        return rawTarget;
      }
    }
  }

  // 2. Check item.senderId (other party who sent the message)
  if (item.senderId && item.senderId !== myUid) {
    return item.senderId;
  }

  // 3. Check item.recipientId (if user was sender and viewing notification)
  if (item.recipientId && item.recipientId !== myUid) {
    return item.recipientId;
  }

  // 4. Check item.chatId composite "uidA_uidB"
  if (item.chatId && myUid && item.chatId.includes("_")) {
    const parts = item.chatId.split("_");
    const other = parts.find((p) => p !== myUid);
    if (other) return other;
  }

  // 5. Check metadata & data
  const metaSender =
    item.metadata?.senderId ||
    item.data?.senderId ||
    item.metadata?.friendId ||
    item.data?.friendId;
  if (metaSender && metaSender !== myUid) {
    return metaSender;
  }

  // 6. Direct chatId without underscore (if not myUid)
  if (item.chatId && !item.chatId.includes("_") && item.chatId !== myUid) {
    return item.chatId;
  }

  return null;
}

interface NotificationDestination {
  type: "group" | "chat" | "call" | "trip" | "generic";
  path: string;
}

function resolveNotificationDestination(
  item: AppNotification,
  currentUid: string | undefined,
  chats: any[] = [],
  groups: any[] = [],
): NotificationDestination | null {
  if (!item) return null;

  // 1. Friend requests have inline action buttons
  if (item.type === "friend_request") return null;

  // 2. Expandable detail notifications (Feedback, Accepted info): stay in-place, do not navigate
  if (isExpandableDetailNotification(item)) return null;

  // 3. Created Group Chat detection (Redirects to group chatroom if notification belongs to any created group)
  const isGroup = isGroupNotification(item);
  let resolvedGroupId = extractGroupId(item);

  // If notification belongs to any created group in user's groups list, resolve its exact ID
  if (groups.length > 0) {
    const matchedGroup = groups.find((g: any) => {
      if (!g || !g.id) return false;
      if (item.groupId && g.id === item.groupId) return true;
      if (item.chatId && g.id === item.chatId) return true;
      const gName = (g.name || "").toLowerCase().trim();
      const gTripName = (g.tripName || "").toLowerCase().trim();
      const titleLower = (item.title || "").toLowerCase().trim();
      const groupNameLower = (item.groupName || "").toLowerCase().trim();
      return (
        (groupNameLower &&
          (gName === groupNameLower || gTripName === groupNameLower)) ||
        (titleLower && (gName === titleLower || gTripName === titleLower))
      );
    });
    if (matchedGroup && matchedGroup.id) {
      resolvedGroupId = matchedGroup.id;
    }
  }

  // If this notification belongs to any created group, ALWAYS redirect to that group chatroom!
  if (resolvedGroupId) {
    return {
      type: "group",
      path: `/(tabs)/group-chatroom/${resolvedGroupId}`,
    };
  }

  // 4. Trip notification
  if (item.tripId) {
    return {
      type: "trip",
      path: `/trips/${item.tripId}`,
    };
  }

  // 5. 1-on-1 Chat Friend ID resolution
  let friendId = getTargetFriendId(item, currentUid);

  // Match against user chats list by peer name or ID
  if (!friendId && chats.length > 0) {
    const rawSender = (item.senderName || item.title || "")
      .toLowerCase()
      .trim();
    if (rawSender) {
      const match = chats.find((c: any) => {
        if (!c) return false;
        const cName = (c.name || c.displayName || "").toLowerCase().trim();
        return (
          cName === rawSender || c.uid === item.senderId || c.id === item.chatId
        );
      });
      if (match) {
        friendId =
          match.uid ||
          (match.id?.includes("_") && currentUid
            ? match.id.split("_").find((p: string) => p !== currentUid)
            : match.id) ||
          null;
      }
    }
  }

  // Strict safeguard against self-chat
  if (friendId === currentUid) {
    friendId = null;
  }

  // 6. Call or Missed call
  if (item.type === "call" || item.type === "missed_call" || item.callId) {
    if (resolvedGroupId) {
      return {
        type: "group",
        path: `/(tabs)/group-chatroom/${resolvedGroupId}`,
      };
    }
    if (friendId) {
      return {
        type: "call",
        path: `/chat/${friendId}`,
      };
    }
  }

  // 7. Route 1-on-1 Chat
  if (friendId) {
    return {
      type: "chat",
      path: `/chat/${friendId}`,
    };
  }

  // 8. Generic route fallback
  if (
    item.route &&
    typeof item.route === "string" &&
    item.route !== "/notifications"
  ) {
    if (item.route.includes("group-chatroom")) {
      const gId = extractGroupId(item) || resolvedGroupId;
      if (gId) {
        return {
          type: "group",
          path: `/(tabs)/group-chatroom/${gId}`,
        };
      }
    }
    if (item.route.includes("/chat/")) {
      const parts = item.route.split("/chat/");
      if (parts[1]) {
        const rawFId = parts[1].split("?")[0].replace(/^\//, "").trim();
        if (rawFId && rawFId !== currentUid) {
          const cleanFId =
            rawFId.includes("_") && currentUid
              ? rawFId.split("_").find((p) => p !== currentUid) || rawFId
              : rawFId;
          return {
            type: "chat",
            path: `/chat/${cleanFId}`,
          };
        }
      }
    }
    return {
      type: "generic",
      path: item.route,
    };
  }

  return null;
}

function isFeedbackOrGeneralNotification(item: AppNotification): boolean {
  if (!item) return false;
  const t = (item.type || "").toLowerCase().trim();
  if (
    t === "feedback" ||
    t === "feedback_received" ||
    t === "general" ||
    t === "general_received" ||
    t === "ticket" ||
    t === "support" ||
    t === "system" ||
    t === "announcement" ||
    t.includes("feedback") ||
    t.includes("thank") ||
    Boolean(item.feedbackId) ||
    Boolean(item.ticketId)
  ) {
    return true;
  }
  const title = (item.title || "").toLowerCase();
  const body = (
    item.body ||
    item.content ||
    item.message ||
    item.description ||
    item.info ||
    ""
  ).toLowerCase();
  if (
    title.includes("feedback") ||
    title.includes("thank") ||
    title.includes("received") ||
    title.includes("general") ||
    title.includes("#fb-") ||
    title.includes("ticket") ||
    title.includes("support") ||
    title.includes("notice") ||
    title.includes("announcement") ||
    title.includes("appreciate") ||
    body.includes("feedback") ||
    body.includes("thank you") ||
    body.includes("thankyou") ||
    body.includes("thanks for") ||
    body.includes("thanking you") ||
    body.includes("appreciate")
  ) {
    return true;
  }
  if (
    item.metadata?.feedbackId ||
    item.data?.feedbackId ||
    item.metadata?.ticketId ||
    item.data?.ticketId
  ) {
    return true;
  }
  return false;
}

function isAcceptedNotification(item: AppNotification): boolean {
  if (!item) return false;
  const t = (item.type || "").toLowerCase().trim();
  const s = (item.status || "").toLowerCase().trim();
  const title = (item.title || "").toLowerCase();

  return (
    t === "friend_accepted" ||
    t === "trip_accepted" ||
    t.includes("accepted") ||
    s === "accepted" ||
    title.includes("accepted")
  );
}

function isExpandableDetailNotification(item: AppNotification): boolean {
  if (!item) return false;

  // Pending friend requests have inline Accept/Decline action buttons (do not expand)
  if (item.type === "friend_request" && item.status !== "accepted") {
    return false;
  }

  // Chats, calls, missed calls, and groups have dedicated navigation (do not expand)
  if (
    item.type === "chat" ||
    item.type === "call" ||
    item.type === "missed_call" ||
    Boolean(item.callId) ||
    Boolean(item.callType) ||
    isGroupNotification(item)
  ) {
    return false;
  }

  // Feedback / General / System tickets are expandable detail items
  if (isFeedbackOrGeneralNotification(item)) {
    return true;
  }

  // Accepted notifications with info are expandable detail items
  if (isAcceptedNotification(item)) {
    return true;
  }

  return false;
}

/* ============================================================
   TYPE BADGES (Overlayed at bottom-right of Avatar)
============================================================ */

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  label: string;
}

function getTypeConfig(
  type?: string,
  isGroup?: boolean,
  title?: string,
): TypeConfig {
  if (isGroup || type === "group_chat" || type === "group") {
    return {
      icon: "chatbubbles",
      color: "#FFFFFF",
      bgColor: "#06B6D4", // Cyan / Teal
      label: "Group Chat",
    };
  }
  const normTitle = (title || "").toLowerCase();
  const normType = (type || "").toLowerCase();
  if (
    normType === "feedback" ||
    normType === "feedback_received" ||
    normType === "general" ||
    normType === "general_received" ||
    normType === "ticket" ||
    normType === "support" ||
    normTitle.includes("feedback") ||
    normTitle.includes("received") ||
    normTitle.includes("general") ||
    normTitle.includes("#fb-")
  ) {
    return {
      icon: "chatbubble",
      color: "#FFFFFF",
      bgColor: "#F59E0B", // Warm Amber (matches feedback screenshot badge)
      label: "Feedback",
    };
  }
  switch (type) {
    case "chat":
      return {
        icon: "chatbubble",
        color: "#FFFFFF",
        bgColor: "#3B82F6", // Sky / Royal Blue
        label: "Chat",
      };
    case "call":
      return {
        icon: "call",
        color: "#FFFFFF",
        bgColor: "#10B981", // Emerald Green
        label: "Call",
      };
    case "missed_call":
      return {
        icon: "call",
        color: "#FFFFFF",
        bgColor: "#FF5A5F", // Brand Coral (Zero-Red Rule)
        label: "Missed Call",
      };
    case "friend_request":
    case "friend_accepted":
      return {
        icon: "people",
        color: "#FFFFFF",
        bgColor: "#8B5CF6", // Purple
        label: "Friend",
      };
    case "trip":
      return {
        icon: "airplane",
        color: "#FFFFFF",
        bgColor: "#F59E0B", // Amber
        label: "Trip",
      };
    default:
      return {
        icon: "notifications",
        color: "#FFFFFF",
        bgColor: "#F59E0B", // Amber
        label: "Alert",
      };
  }
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function Notifications() {
  const router = useRouter();
  const params = useLocalSearchParams<{ notificationId?: string }>();
  const { isDark, scaleFont, themeColors, accentColor } = useThemeToggle();
  const colors = useMemo(
    () => ({
      bg: themeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      textPrimary: themeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
    }),
    [themeColors, isDark],
  );
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === "android"
        ? StatusBar.currentHeight || 24
        : 44;

  const [currentUser, setCurrentUser] = useState<any>(() => auth.currentUser);
  const { chats = [] } = useUserChats(
    currentUser?.uid || auth.currentUser?.uid || null,
  );
  const { groups = [] } = useUserGroups(
    currentUser?.uid || auth.currentUser?.uid || null,
  );

  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const [notifications, setNotifications] = useState<AppNotification[]>(
    () => memoryNotificationsCache,
  );
  const [loading, setLoading] = useState(
    () => memoryNotificationsCache.length === 0,
  );
  const [refreshing, setRefreshing] = useState(false);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");

  // Inline Accordion Stack Expansion State (Single active stack to prevent multi-expansion bug)
  const [expandedStackId, setExpandedStackId] = useState<string | null>(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // 2. Instant Offline Hydration from AsyncStorage
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (memoryNotificationsCache.length === 0) {
              memoryNotificationsCache = parsed;
              setNotifications(parsed);
              setLoading(false);
            }
          }
        }
      } catch (err) {
        AsyncStorage.removeItem(NOTIFICATIONS_CACHE_KEY).catch(() => { });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Realtime Firestore Sync with 50-limit and batched updates
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const currentUid = currentUser.uid;
    let unsubUid: (() => void) | null = null;
    let unsubRecipient: (() => void) | null = null;
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    const docMap = new Map<string, AppNotification>();

    const updateAndCache = () => {
      const mergedList = Array.from(docMap.values()).sort((a, b) => {
        const tA = a.timestamp?.toMillis
          ? a.timestamp.toMillis()
          : a.timestamp
            ? new Date(a.timestamp).getTime()
            : 0;
        const tB = b.timestamp?.toMillis
          ? b.timestamp.toMillis()
          : b.timestamp
            ? new Date(b.timestamp).getTime()
            : 0;
        return tB - tA;
      });

      memoryNotificationsCache = mergedList;
      setNotifications(mergedList);
      setLoading(false);
      setRefreshing(false);

      // Async Cache to AsyncStorage: save only latest 40 items with sanitized fields
      const sanitizedCache = mergedList.slice(0, 40).map((item) => ({
        id: item.id,
        uid: item.uid,
        title: item.title,
        body: item.body || item.content || item.message,
        type: item.type,
        timestamp: item.timestamp?.toMillis
          ? item.timestamp.toMillis()
          : item.timestamp,
        seen: item.seen,
        isRead: item.isRead,
        read: item.read,
        groupId: item.groupId,
        chatId: item.chatId,
        route: item.route,
        senderName: item.senderName,
        pic: item.pic && !item.pic.startsWith("data:") ? item.pic : undefined,
      }));

      AsyncStorage.setItem(
        NOTIFICATIONS_CACHE_KEY,
        JSON.stringify(sanitizedCache),
      ).catch(() => { });
    };

    const scheduleUpdate = () => {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateAndCache();
      }, 35);
    };

    // Query 1: where uid == currentUid (capped at latest 50 for instantaneous response)
    const qUid = query(
      collection(db, "notifications"),
      where("uid", "==", currentUid),
      limit(50),
    );
    unsubUid = onSnapshot(
      qUid,
      (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          docMap.set(docSnap.id, {
            id: docSnap.id,
            ...docSnap.data(),
          } as AppNotification);
        });
        scheduleUpdate();
      },
      (error) => {
        console.warn("[notifications] Firestore uid listener error:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    // Query 2: where recipientId == currentUid (capped at latest 50)
    const qRecipient = query(
      collection(db, "notifications"),
      where("recipientId", "==", currentUid),
      limit(50),
    );
    unsubRecipient = onSnapshot(
      qRecipient,
      (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          docMap.set(docSnap.id, {
            id: docSnap.id,
            ...docSnap.data(),
          } as AppNotification);
        });
        scheduleUpdate();
      },
      (error) => {
        // Ignored if index or recipientId isn't populated
      },
    );

    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      if (unsubUid) unsubUid();
      if (unsubRecipient) unsubRecipient();
    };
  }, [currentUser]);

  // 4. Manual Refresh
  const handleRefresh = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Inline Accordion Toggle Handler with instantaneous response (0ms delay)
  const toggleStack = useCallback((stackId: string) => {
    setExpandedStackId((prev) => (prev === stackId ? null : stackId));
  }, []);

  // 5. Read / Direct Action Handlers (Production-grade cross-screen synchronization)
  const markAsRead = useCallback(async (item: AppNotification) => {
    if (item.isRead || item.seen || item.read) return;

    // 1. Optimistic React state update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? { ...n, isRead: true, seen: true, read: true, status: "read" }
          : n,
      ),
    );

    // 2. Module-level in-memory cache update
    memoryNotificationsCache = memoryNotificationsCache.map((n) =>
      n.id === item.id
        ? { ...n, isRead: true, seen: true, read: true, status: "read" }
        : n,
    );

    // 3. Global unread badge decrement & Firestore batch write
    markNotificationIdsAsRead(item.id);
  }, []);

  // Slide-to-action: Mark notification(s) as read with atomic Firestore batch & global badge sync
  const handleToggleRead = useCallback(
    async (target: AppNotification | AppNotification[]) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
      const items = Array.isArray(target) ? target : [target];
      if (items.length === 0) return;

      const ids = items.map((n) => n.id);

      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch { }

      // 1. Optimistic React state update
      setNotifications((prev) =>
        prev.map((n) =>
          ids.includes(n.id)
            ? { ...n, isRead: true, seen: true, read: true, status: "read" }
            : n,
        ),
      );

      // 2. Module-level in-memory cache update
      memoryNotificationsCache = memoryNotificationsCache.map((n) =>
        ids.includes(n.id)
          ? { ...n, isRead: true, seen: true, read: true, status: "read" }
          : n,
      );

      // 3. Global unread badge update & atomic Firestore batch write
      await markNotificationIdsAsRead(ids);

      // 4. Persistent offline AsyncStorage cache update
      AsyncStorage.setItem(
        NOTIFICATIONS_CACHE_KEY,
        JSON.stringify(memoryNotificationsCache),
      ).catch(() => { });
    },
    [],
  );

  // Slide-to-action: Delete notification(s) with atomic Firestore batch & global badge sync
  const handleDeleteNotification = useCallback(
    async (target: AppNotification | AppNotification[]) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
      const items = Array.isArray(target) ? target : [target];
      if (items.length === 0) return;

      const ids = items.map((n) => n.id);

      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch { }

      // 1. Optimistic React state update
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));

      // 2. Module-level in-memory cache update
      memoryNotificationsCache = memoryNotificationsCache.filter(
        (n) => !ids.includes(n.id),
      );

      // 3. Global unread badge update & atomic Firestore batch delete
      await markNotificationIdsAsDeleted(ids);

      // 4. Persistent offline AsyncStorage cache update
      AsyncStorage.setItem(
        NOTIFICATIONS_CACHE_KEY,
        JSON.stringify(memoryNotificationsCache),
      ).catch(() => { });
    },
    [],
  );

  const handleNotificationPress = useCallback(
    (item: AppNotification) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
      markAsRead(item);

      const currentUid = auth.currentUser?.uid || currentUser?.uid;

      // 1. If pending friend request, inline buttons are used (Accept / Decline)
      if (item.type === "friend_request" && item.status !== "accepted") {
        return;
      }

      // 1.5. If expandable detail notification (Feedback or Accepted info), do not navigate away
      if (isExpandableDetailNotification(item)) {
        return;
      }

      // 2. High-precision destination resolver (uses real Firestore groups and chats data)
      const destination = resolveNotificationDestination(
        item,
        currentUid,
        chatsRef.current,
        groupsRef.current,
      );
      if (destination && destination.path) {
        router.push(destination.path as any);
        return;
      }

      // 3. Fallback: Trip navigation
      if (item.tripId) {
        router.push(`/trips/${item.tripId}` as any);
        return;
      }

      // 4. Fallback: 1-on-1 Chat with friend
      const friendId = getTargetFriendId(item, currentUid);
      if (friendId && friendId !== currentUid) {
        router.push(`/chat/${friendId}` as any);
        return;
      }

      // 5. Fallback: Generic route
      if (
        item.route &&
        typeof item.route === "string" &&
        item.route !== "/notifications"
      ) {
        router.push(item.route as any);
        return;
      }
    },
    [router, markAsRead, currentUser?.uid],
  );

  // 6. Inline Friend Request Accept / Decline Handlers (Optimistic + Firestore)
  const handleAcceptFriendRequest = useCallback(
    async (item: AppNotification) => {
      const currentUid = auth.currentUser?.uid;
      const targetSenderId = item.senderId;
      if (!currentUid || !targetSenderId) return;

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }

      // Instant local optimistic UI update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? {
              ...n,
              status: "accepted",
              isRead: true,
              seen: true,
              read: true,
              content: "You are now friends! 🎉",
              message: "You are now friends! 🎉",
              body: "You are now friends! 🎉",
            }
            : n,
        ),
      );

      try {
        await updateDoc(doc(db, "notifications", item.id), {
          status: "accepted",
          isRead: true,
          seen: true,
          read: true,
          content: "You are now friends! 🎉",
          message: "You are now friends! 🎉",
          body: "You are now friends! 🎉",
        });

        await Promise.all([
          updateDoc(doc(db, "users", currentUid), {
            friends: arrayUnion(targetSenderId),
          }),
          updateDoc(doc(db, "users", targetSenderId), {
            friends: arrayUnion(currentUid),
          }),
        ]);

        await setDoc(
          doc(
            db,
            "notifications",
            `${targetSenderId}_${currentUid}_friend_accepted_${Date.now()}`,
          ),
          {
            type: "friend_accepted",
            senderId: currentUid,
            uid: targetSenderId,
            recipientId: targetSenderId,
            title: "Friend Request Accepted",
            content: `${auth.currentUser?.displayName || "A user"} accepted your friend request.`,
            message: `${auth.currentUser?.displayName || "A user"} accepted your friend request.`,
            body: `${auth.currentUser?.displayName || "A user"} accepted your friend request.`,
            pic: auth.currentUser?.photoURL || "",
            senderAvatar: auth.currentUser?.photoURL || "",
            isRead: false,
            seen: false,
            read: false,
            timestamp: new Date(),
            viaOneSignal: true,
            pushSent: true,
          },
        );

        sendFriendAcceptedNotification({
          receiverId: targetSenderId,
          senderId: currentUid,
          senderName: auth.currentUser?.displayName || "A BunkMate",
          senderAvatar: auth.currentUser?.photoURL || "",
        }).catch((err) =>
          console.warn(
            "[notifications] sendFriendAcceptedNotification error:",
            err,
          ),
        );
      } catch (err) {
        console.error("Error accepting friend request:", err);
        Alert.alert("Error", "Could not accept friend request.");
      }
    },
    [],
  );

  const handleRejectFriendRequest = useCallback(
    async (item: AppNotification) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }

      // Instant local optimistic UI update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? {
              ...n,
              status: "rejected",
              isRead: true,
              seen: true,
              read: true,
              content: "Friend request declined.",
              message: "Friend request declined.",
              body: "Friend request declined.",
            }
            : n,
        ),
      );

      try {
        await updateDoc(doc(db, "notifications", item.id), {
          status: "rejected",
          isRead: true,
          seen: true,
          read: true,
          content: "Friend request declined.",
          message: "Friend request declined.",
          body: "Friend request declined.",
        });
      } catch (err) {
        console.error("Error rejecting friend request:", err);
      }
    },
    [],
  );

  const handleSelectCategory = useCallback((cat: FilterCategory) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(cat);
  }, []);

  /* ============================================================
     FILTERING & CHRONOLOGICAL TIMELINE GROUPING
  ============================================================ */

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (activeCategory === "unreads") {
      result = result.filter((n) => !n.isRead && !n.seen && !n.read);
    } else if (activeCategory === "chat") {
      result = result.filter(
        (n) =>
          !isGroupNotification(n) &&
          !isFeedbackOrGeneralNotification(n) &&
          (n.type === "chat" ||
            (!n.groupId &&
              (n.chatId ||
                (n.senderId &&
                  n.type !== "call" &&
                  n.type !== "missed_call" &&
                  n.type !== "friend_request" &&
                  n.type !== "friend_accepted" &&
                  n.type !== "trip" &&
                  n.type !== "like")))),
      );
    } else if (activeCategory === "group_chat") {
      result = result.filter(isGroupNotification);
    } else if (activeCategory === "calls") {
      result = result.filter(
        (n) =>
          n.type === "call" ||
          n.type === "missed_call" ||
          Boolean(n.callId) ||
          Boolean(n.callType),
      );
    } else if (activeCategory === "feedback") {
      result = result.filter(isFeedbackOrGeneralNotification);
    }

    return result;
  }, [notifications, activeCategory]);

  const groupedDateSections = useMemo(() => {
    const sectionMap = new Map<
      string,
      { title: string; sortTimestamp: number; items: AppNotification[] }
    >();

    filteredNotifications.forEach((item) => {
      const sec = getDateSectionInfo(item.timestamp);
      if (!sectionMap.has(sec.key)) {
        sectionMap.set(sec.key, {
          title: sec.title,
          sortTimestamp: sec.sortTimestamp,
          items: [],
        });
      }
      sectionMap.get(sec.key)!.items.push(item);
    });

    const sortedSections: DateSectionGroup[] = [];

    sectionMap.forEach((val, key) => {
      const stackGroups: NotificationStackGroup[] = [];
      const groupMap = new Map<string, AppNotification[]>();
      const groupCategoryMap = new Map<string, string>();

      val.items.forEach((item) => {
        let groupKey = item.stackId || `single_${item.id}`;
        let catLabel = "Alerts";

        const grpId = extractGroupId(item);
        const isGroup = isGroupNotification(item);

        if (!item.stackId) {
          if (isFeedbackOrGeneralNotification(item)) {
            // General / Feedback / System tickets: single expandable detail item per notification
            groupKey = `feedback_${item.id}`;
            catLabel = "Feedback";
          } else if (isAcceptedNotification(item)) {
            // Accepted info: single expandable detail item per notification
            groupKey = `accepted_${item.id}`;
            catLabel = "Accepted";
          } else if (
            item.type === "call" ||
            item.type === "missed_call" ||
            item.callId
          ) {
            const sender = grpId
              ? `group_${grpId}`
              : item.senderId || item.senderName || item.title || "calls";
            groupKey = `calls_${sender}`;
            catLabel = "Calls";
          } else if (isGroup || grpId) {
            const grp = grpId || item.groupName || item.title || "group";
            groupKey = `group_${grp}`;
            catLabel = "Group Chat";
          } else if (
            item.type === "chat" ||
            item.chatId ||
            (item.senderId &&
              item.type !== "friend_request" &&
              item.type !== "friend_accepted" &&
              item.type !== "trip" &&
              item.type !== "like")
          ) {
            const sender =
              item.chatId ||
              item.senderId ||
              item.senderName ||
              item.title ||
              "chat";
            groupKey = `chat_${sender}`;
            catLabel = "Chat";
          }
        }

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
          groupCategoryMap.set(groupKey, catLabel);
        }
        groupMap.get(groupKey)!.push(item);
      });

      const seenKeys = new Set<string>();
      val.items.forEach((item) => {
        let groupKey = item.stackId || `single_${item.id}`;
        const grpId = extractGroupId(item);
        const isGroup = isGroupNotification(item);

        if (!item.stackId) {
          if (isFeedbackOrGeneralNotification(item)) {
            groupKey = `feedback_${item.id}`;
          } else if (isAcceptedNotification(item)) {
            groupKey = `accepted_${item.id}`;
          } else if (
            item.type === "call" ||
            item.type === "missed_call" ||
            item.callId
          ) {
            const sender = grpId
              ? `group_${grpId}`
              : item.senderId || item.senderName || item.title || "calls";
            groupKey = `calls_${sender}`;
          } else if (isGroup || grpId) {
            const grp = grpId || item.groupName || item.title || "group";
            groupKey = `group_${grp}`;
          } else if (
            item.type === "chat" ||
            item.chatId ||
            (item.senderId &&
              item.type !== "friend_request" &&
              item.type !== "friend_accepted" &&
              item.type !== "trip" &&
              item.type !== "like")
          ) {
            const sender =
              item.chatId ||
              item.senderId ||
              item.senderName ||
              item.title ||
              "chat";
            groupKey = `chat_${sender}`;
          }
        }

        if (!seenKeys.has(groupKey)) {
          seenKeys.add(groupKey);
          const items = groupMap.get(groupKey) || [item];
          // Strictly unique & stable stack identifier per date section and group
          const uniqueStackKey = `${key}_${groupKey}`;

          stackGroups.push({
            groupKey: uniqueStackKey,
            categoryLabel: groupCategoryMap.get(groupKey) || "Alerts",
            masterItem: items[0],
            items,
          });
        }
      });

      sortedSections.push({
        key,
        title: val.title,
        sortTimestamp: val.sortTimestamp,
        stackGroups,
      });
    });

    sortedSections.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
    return sortedSections;
  }, [filteredNotifications]);

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask matching Settings */}
      <SettingsHeaderGradientMask
        backgroundColor={colors.bg}
        height={topInset + (Platform.OS === "android" ? 6 : 4) + 88 + 128 + 42}
        zIndex={15}
      />

      {/* 1. TOP APP BAR — Exact circular back button matching Settings page */}
      <View style={[styles.header, { zIndex: 20 }]}>
        <Pressable
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch { }
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/chats" as any);
          }}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: isDark ? "#161616" : "#e6e6e6",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>

        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, fontSize: scaleFont(22) },
          ]}
          numberOfLines={1}
        >
          {t("notifications", "Notifications")}
        </Text>


      </View>

      {/* 2. FILTER PILLS (Horizontal Scrollable - Screenshot 3) */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          <FilterPill
            label="All"
            active={activeCategory === "all"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("all")}
          />
          <FilterPill
            label="Unreads"
            active={activeCategory === "unreads"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("unreads")}
          />
          <FilterPill
            label="Chat"
            active={activeCategory === "chat"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("chat")}
          />
          <FilterPill
            label="Group Chat"
            active={activeCategory === "group_chat"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("group_chat")}
          />
          <FilterPill
            label="Calls"
            active={activeCategory === "calls"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("calls")}
          />
          <FilterPill
            label="Feedback"
            active={activeCategory === "feedback"}
            isDark={isDark}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("feedback")}
          />
        </ScrollView>
      </View>

      {/* 3. MAIN NOTIFICATION SCROLLVIEW */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((k) => (
            <View
              key={k}
              style={[
                styles.skeletonCard,
                {
                  backgroundColor: isDark ? "#161618" : "#FFFFFF",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E2E8F0",
                },
              ]}
            >
              <View
                style={[
                  styles.skeletonAvatar,
                  { backgroundColor: isDark ? "#242428" : "#E2E8F0" },
                ]}
              />
              <View style={styles.skeletonContent}>
                <View
                  style={[
                    styles.skeletonLineTitle,
                    { backgroundColor: isDark ? "#242428" : "#E2E8F0" },
                  ]}
                />
                <View
                  style={[
                    styles.skeletonLineBody,
                    { backgroundColor: isDark ? "#1F1F22" : "#F1F5F9" },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={isDark ? "#FFFFFF" : "#000000"}
            // progressViewOffset={200}
            />
          }
        >
          <View
            style={[
              styles.emptyGlowCircle,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.04)",
                boxShadow: isDark
                  ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                  : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              },
            ]}
          >
            <Ionicons
              name="notifications-off-outline"
              size={38}
              color={isDark ? "#7E8590" : "#6E7682"}
            />
          </View>
          <Text
            style={[
              styles.emptyTitle,
              {
                fontSize: scaleFont(18),
                color: isDark ? "#FFFFFF" : "#11141A",
              },
            ]}
          >
            {activeCategory === "unreads"
              ? "You're all caught up! ✨"
              : "No notifications yet"}
          </Text>
          <Text
            style={[
              styles.emptyDescription,
              {
                fontSize: scaleFont(13),
                color: isDark ? "#7E8590" : "#6B7280",
              },
            ]}
          >
            {activeCategory === "unreads"
              ? "Zero unread alerts remaining."
              : "When your friends message, call, or invite you, they'll show up right here."}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.notificationListOverlay}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={isDark ? "#FFFFFF" : "#000000"}
              progressViewOffset={125}
            />
          }
        >
          {groupedDateSections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              {/* Chronological Timeline Header: e.g. "YESTERDAY", "THURSDAY", "SUNDAY" */}
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    fontSize: scaleFont(12),
                    color: isDark ? "#7E8590" : "#6E7682",
                  },
                ]}
              >
                {section.title}
              </Text>

              {section.stackGroups.map((group) => {
                const isExpanded = expandedStackId === group.groupKey;

                return (
                  <NotificationStackGroupItem
                    key={group.groupKey}
                    group={group}
                    isExpanded={isExpanded}
                    isDark={isDark}
                    scaleFont={scaleFont}
                    accentColor={accentColor}
                    onToggleStack={toggleStack}
                    onPressItem={handleNotificationPress}
                    onAccept={handleAcceptFriendRequest}
                    onReject={handleRejectFriendRequest}
                    onToggleRead={handleToggleRead}
                    onDelete={handleDeleteNotification}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ============================================================
   COMPONENT: FILTER PILL (Screenshot 3)
============================================================ */

const FilterPill = React.memo(function FilterPill({
  label,
  active,
  isDark,
  scaleFont,
  onPress,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  scaleFont: (size: number) => number;
  onPress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.94,
      useNativeDriver: true,
      stiffness: 450,
      damping: 25,
      mass: 0.7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 350,
      damping: 20,
      mass: 0.7,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.filterPill,
          {
            backgroundColor: active
              ? (isDark ? "#FFFFFF" : "#000000")
              : (isDark ? "#161616" : "#e6e6e6"),
            boxShadow: isDark
              ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
              : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
            transform: [{ scale: pressScale }],
          },
        ]}
      >
        <Text
          style={[
            styles.filterPillText,
            {
              fontSize: scaleFont(13),
              color: active
                ? (isDark ? "#000000" : "#FFFFFF")
                : (isDark ? "#F1F1F1" : "#11141A"),
              fontWeight: active ? "700" : "600",
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

/* ============================================================
   COMPONENT: NOTIFICATION STACK GROUP ITEM (Layered Deck Animation)
============================================================ */

const NotificationStackGroupItem = React.memo(
  function NotificationStackGroupItem({
    group,
    isExpanded,
    isDark,
    scaleFont,
    accentColor,
    onToggleStack,
    onPressItem,
    onAccept,
    onReject,
    onToggleRead,
    onDelete,
  }: {
    group: NotificationStackGroup;
    isExpanded: boolean;
    isDark: boolean;
    scaleFont: (size: number) => number;
    accentColor?: string;
    onToggleStack: (stackId: string) => void;
    onPressItem: (item: AppNotification) => void;
    onAccept: (item: AppNotification) => void;
    onReject: (item: AppNotification) => void;
    onToggleRead: (items: AppNotification | AppNotification[]) => void;
    onDelete: (items: AppNotification | AppNotification[]) => void;
  }) {
    const isStacked = group.items.length > 1;
    const isDetailItem =
      !isStacked && isExpandableDetailNotification(group.masterItem);
    const isExpandable = isStacked || isDetailItem;

    const INITIAL_VISIBLE_COUNT = 10;
    const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_COUNT);
    const [isAnimating, setIsAnimating] = useState(false);
    const [measuredHeight, setMeasuredHeight] = useState<number>(0);

    const heightAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
    const cardsAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
    const prevExpandedRef = useRef(isExpanded);

    const count = group.items.length;

    // Snappy, 60fps-optimized 300ms bezier curve duration
    const animDuration = 300;

    const renderedItems = useMemo(() => {
      if (isDetailItem) return group.items.slice(0, 1);
      return group.items.slice(0, visibleLimit);
    }, [isDetailItem, group.items, visibleLimit]);

    const hasMore = !isDetailItem && group.items.length > renderedItems.length;
    const remainingCount = group.items.length - renderedItems.length;

    // Generous estimated content height to prevent any clipping during animation
    const estimatedHeight = useMemo(() => {
      if (isDetailItem) return 240;
      return 56 + renderedItems.length * 115 + (hasMore ? 64 : 0) + 36;
    }, [isDetailItem, renderedItems.length, hasMore]);

    const runExpandAnimation = useCallback(() => {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 1,
          duration: 290,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: false,
        }),
        Animated.timing(cardsAnim, {
          toValue: 1,
          duration: 290,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAnimating(false);
      });
    }, [heightAnim, cardsAnim]);

    const runCollapseAnimation = useCallback(() => {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: false,
        }),
        Animated.timing(cardsAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        setIsAnimating(false);
        if (finished) {
          setVisibleLimit(INITIAL_VISIBLE_COUNT);
        }
      });
    }, [heightAnim, cardsAnim]);

    const handleToggle = useCallback(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }

      const willExpand = !isExpanded;
      prevExpandedRef.current = willExpand;

      if (willExpand) {
        runExpandAnimation();
      } else {
        runCollapseAnimation();
      }

      onToggleStack(group.groupKey);
    }, [isExpanded, runExpandAnimation, runCollapseAnimation, onToggleStack, group.groupKey]);

    useEffect(() => {
      if (prevExpandedRef.current !== isExpanded) {
        prevExpandedRef.current = isExpanded;
        if (isExpanded) {
          runExpandAnimation();
        } else {
          runCollapseAnimation();
        }
      }
    }, [isExpanded, runExpandAnimation, runCollapseAnimation]);

    const handlePressMaster = useCallback(() => {
      onPressItem(group.masterItem);
    }, [onPressItem, group.masterItem]);

    const handlePressChild = useCallback(
      (subItem: AppNotification) => {
        if (isDetailItem) {
          handleToggle();
        } else {
          const itemToRoute = { ...subItem };
          // Deep inheritance from master item for rock-solid routing
          if (!itemToRoute.groupId && group.masterItem?.groupId) {
            itemToRoute.groupId = group.masterItem.groupId;
          }
          if (!itemToRoute.chatId && group.masterItem?.chatId) {
            itemToRoute.chatId = group.masterItem.chatId;
          }
          if (!itemToRoute.senderId && group.masterItem?.senderId) {
            itemToRoute.senderId = group.masterItem.senderId;
          }
          if (!itemToRoute.groupName && group.masterItem?.groupName) {
            itemToRoute.groupName = group.masterItem.groupName;
          }
          if (!itemToRoute.route && group.masterItem?.route) {
            itemToRoute.route = group.masterItem.route;
          }
          if (!itemToRoute.tripId && group.masterItem?.tripId) {
            itemToRoute.tripId = group.masterItem.tripId;
          }
          if (
            group.categoryLabel === "Group Chat" &&
            !extractGroupId(itemToRoute)
          ) {
            const fallbackGrp =
              extractGroupId(group.masterItem) ||
              (group.groupKey
                ? group.groupKey.split("_group_")[1] ||
                group.groupKey.replace(/^.*?group_/, "")
                : null);
            if (fallbackGrp) {
              itemToRoute.groupId = fallbackGrp;
            }
          }
          onPressItem(itemToRoute);
        }
      },
      [isDetailItem, handleToggle, onPressItem, group],
    );

    const handleAcceptMaster = useCallback(() => {
      onAccept(group.masterItem);
    }, [onAccept, group.masterItem]);

    const handleRejectMaster = useCallback(() => {
      onReject(group.masterItem);
    }, [onReject, group.masterItem]);

    return (
      <View
        style={[
          styles.groupWrapper,
          isStacked && !isExpanded && styles.groupWrapperStacked,
        ]}
      >
        {/* 3D Layered Cards behind (Deck of Cards visual when collapsed, smooth fade when unstacking) */}
        {isStacked && (
          <>
            {group.items.length >= 3 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.stackedPeekLayer2,
                  {
                    backgroundColor: isDark ? "#131315" : "#DADAE0",
                    boxShadow: isDark
                      ? undefined
                      : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.05)",
                    opacity: cardsAnim.interpolate({
                      inputRange: [0, 0.4, 1],
                      outputRange: [1, 0, 0],
                    }),
                  },
                ]}
              />
            )}

            <Animated.View
              pointerEvents="none"
              style={[
                styles.stackedPeekLayer1,
                {
                  backgroundColor: isDark ? "#1B1B1D" : "#E5E5E8",
                  boxShadow: isDark
                    ? undefined
                    : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.05)",
                  opacity: cardsAnim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [1, 0, 0],
                  }),
                },
              ]}
            />
          </>
        )}

        {/* Front / Master notification card: tapping ALWAYS toggles stack/unstack */}
        <View style={styles.masterCardLayer}>
          <NotificationMasterCard
            item={group.masterItem}
            stackCount={group.items.length}
            categoryLabel={group.categoryLabel}
            hasUnread={group.items.some((n) => !n.isRead && !n.seen && !n.read)}
            isExpanded={isExpanded}
            isDark={isDark}
            isDetailItem={isDetailItem}
            expandAnim={cardsAnim}
            scaleFont={scaleFont}
            accentColor={accentColor}
            onPress={() => {
              if (isExpandable) {
                handleToggle();
              } else {
                handlePressMaster();
              }
            }}
            onToggleStack={handleToggle}
            onAccept={handleAcceptMaster}
            onReject={handleRejectMaster}
            onToggleRead={() => onToggleRead(group.items)}
            onDelete={() => onDelete(group.items)}
          />
        </View>

        {/* INLINE CARD STACKING / ACCORDION CONTAINER */}
        {isStacked && (
          <Animated.View
            pointerEvents={isExpanded ? "auto" : "none"}
            style={[
              styles.stackInsetContainer,
              {
                height: isExpanded && !isAnimating
                  ? undefined
                  : heightAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(measuredHeight, estimatedHeight)],
                  }),
                overflow: isExpanded && !isAnimating ? "visible" : "hidden",
                marginTop: heightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
                marginBottom: heightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
                opacity: heightAnim.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [0, 1, 1],
                }),
                borderLeftColor: isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.10)",
              },
            ]}
          >
            <View
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (h > 0 && Math.abs(h - measuredHeight) > 4) {
                  setMeasuredHeight(h);
                }
              }}
            >
              {/* Stack Header Row with animated slide/fade */}
              <Animated.View
                style={{
                  opacity: cardsAnim.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0, 1, 1],
                  }),
                  transform: [
                    {
                      translateY: cardsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.stackHeaderRow}>
                  <Text
                    style={[
                      styles.stackHeaderTitle,
                      {
                        fontSize: scaleFont(13),
                        color: isDark ? "#FFFFFF" : "#11141A",
                      },
                    ]}
                  >
                    {isDetailItem
                      ? "1 Detail Item"
                      : `${group.items.length} Stacked ${group.categoryLabel} Alerts`}
                  </Text>

                  <TouchableOpacity
                    onPress={handleToggle}
                    style={[
                      styles.collapseButton,
                      {
                        backgroundColor: isDark ? "#1E1E22" : "#E6E6E6",
                        boxShadow: isDark
                          ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                          : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.collapseButtonText,
                        {
                          fontSize: scaleFont(11),
                          color: isDark ? "#F1F1F1" : "#11141A",
                        },
                      ]}
                    >
                      Collapse
                    </Text>
                    <Ionicons
                      name="chevron-up"
                      size={13}
                      color={isDark ? "#F1F1F1" : "#11141A"}
                      style={{ marginLeft: 3 }}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Indented Nested Cards with Symmetrical One-by-One Accordion Unstack/Stack */}
              {renderedItems.map((subItem, index) => {
                const activeCount = Math.min(renderedItems.length, INITIAL_VISIBLE_COUNT);
                const transitionSpan = Math.max(0.2, 0.8 / Math.max(1, activeCount));
                const step = activeCount > 1 ? (1 - transitionSpan) / (activeCount - 1) : 0;
                const p1 = Math.max(0.001, Math.min(index, INITIAL_VISIBLE_COUNT - 1) * step);
                const p2 = Math.min(0.999, p1 + transitionSpan);

                const startY = -8;
                const isAnimatedCard = index < INITIAL_VISIBLE_COUNT;

                const cardTranslateY = isAnimatedCard
                  ? cardsAnim.interpolate({
                    inputRange: [0, p1, p2, 1],
                    outputRange: [startY, startY, 0, 0],
                    extrapolate: "clamp",
                  })
                  : 0;

                const cardOpacity = isAnimatedCard
                  ? cardsAnim.interpolate({
                    inputRange: [0, p1, p2, 1],
                    outputRange: [0, 0, 1, 1],
                    extrapolate: "clamp",
                  })
                  : 1;

                return (
                  <Animated.View
                    key={subItem.id}
                    style={{
                      zIndex: count - index,
                      opacity: cardOpacity,
                      transform: [{ translateY: cardTranslateY }],
                    }}
                  >
                    <StackedChildCard
                      item={subItem}
                      isDetail={isDetailItem}
                      isDark={isDark}
                      scaleFont={scaleFont}
                      accentColor={accentColor}
                      onPress={handlePressChild}
                      onToggleRead={(item) => onToggleRead(item)}
                      onDelete={(item) => onDelete(item)}
                    />
                  </Animated.View>
                );
              })}

              {/* Progressive Load More pill for stacks larger than 10 */}
              {hasMore && (
                <Animated.View
                  style={{
                    opacity: cardsAnim.interpolate({
                      inputRange: [0, 0.75, 1],
                      outputRange: [0, 0, 1],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        translateY: cardsAnim.interpolate({
                          inputRange: [0, 0.75, 1],
                          outputRange: [-8, -8, 0],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch { }
                      setVisibleLimit((prev) => Math.min(group.items.length, prev + 15));
                    }}
                    style={[
                      styles.showMoreButton,
                      {
                        backgroundColor: isDark ? "#1C1C1F" : "#EAEAEA",
                        boxShadow: isDark
                          ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                          : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color={isDark ? "#A0A5B0" : "#555A64"}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.showMoreText,
                        {
                          fontSize: scaleFont(12.5),
                          color: isDark ? "#F1F1F1" : "#11141A",
                        },
                      ]}
                    >
                      +{remainingCount} more in this stack • Tap to view
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    );
  },
);

/* ============================================================
   COMPONENT: NOTIFICATION MASTER CARD (Screenshots 1, 2, 3)
============================================================ */


/* ============================================================
   SWIPE ACTIONS VIEW COMPONENTS (OPACITY 0 UNTIL SWIPED)
============================================================ */

const SwipeActionsMasterView = React.memo(function SwipeActionsMasterView({
  progress,
  showReadAction,
  onDelete,
  onToggleRead,
  isDark,
  closeSwipe,
  handleDeletePress,
}: {
  progress?: any;
  showReadAction: boolean;
  onDelete?: () => void;
  onToggleRead?: () => void;
  isDark: boolean;
  closeSwipe: () => void;
  handleDeletePress: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (!progress) return { opacity: 0 };
    const p = typeof progress.value === "number" ? progress.value : 0;
    return {
      opacity: p > 0.06 ? Math.min(1, (p - 0.06) * 3) : 0,
    };
  });

  const gradientColors = isDark
    ? showReadAction
      ? ["#202020", "#193426", "#35191B"]
      : ["#202020", "#292021", "#35191B"]
    : showReadAction
      ? ["#E0E0E0", "#C4DEC9", "#E8C3C3"]
      : ["#E0E0E0", "#E1CACA", "#E8C3C3"];

  return (
    <Reanimated.View
      style={[
        styles.swipeActionsContainer,
        {
          width: showReadAction ? 136 : 72,
          backgroundColor: "transparent",
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={gradientColors as any}
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
      {showReadAction && (
        <TouchableOpacity
          style={styles.swipeActionButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch { }
            onToggleRead?.();
            closeSwipe();
          }}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityLabel="Mark as read"
        >
          <View
            style={[
              styles.swipeActionIconCircle,
              { backgroundColor: isDark ? "rgba(34, 197, 94, 0.22)" : "#DCFCE7" },
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={21}
              color={isDark ? "#4ADE80" : "#16A34A"}
            />
          </View>
        </TouchableOpacity>
      )}
      {onDelete && (
        <TouchableOpacity
          style={styles.swipeActionButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleDeletePress();
          }}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          activeOpacity={0.75}
          accessibilityLabel="Delete notification"
        >
          <View
            style={[
              styles.swipeActionIconCircle,
              { backgroundColor: isDark ? "rgba(239, 68, 68, 0.22)" : "#FEE2E2" },
            ]}
          >
            <Ionicons
              name="trash"
              size={18}
              color={isDark ? "#EF4444" : "#DC2626"}
            />
          </View>
        </TouchableOpacity>
      )}
    </Reanimated.View>
  );
});

const SwipeActionsChildView = React.memo(function SwipeActionsChildView({
  progress,
  showReadAction,
  onDelete,
  onToggleRead,
  item,
  isDark,
  closeSwipe,
  handleDeletePress,
}: {
  progress?: any;
  showReadAction: boolean;
  onDelete?: () => void;
  onToggleRead?: () => void;
  item: AppNotification;
  isDark: boolean;
  closeSwipe: () => void;
  handleDeletePress: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (!progress) return { opacity: 0 };
    const p = typeof progress.value === "number" ? progress.value : 0;
    return {
      opacity: p > 0.06 ? Math.min(1, (p - 0.06) * 3) : 0,
    };
  });

  const gradientColors = isDark
    ? showReadAction
      ? ["#202020", "#193426", "#35191B"]
      : ["#202020", "#292021", "#35191B"]
    : showReadAction
      ? ["#E0E0E0", "#C4DEC9", "#E8C3C3"]
      : ["#E0E0E0", "#E1CACA", "#E8C3C3"];

  return (
    <Reanimated.View
      style={[
        styles.childSwipeActionsContainer,
        {
          width: showReadAction ? 126 : 68,
          backgroundColor: "transparent",
        },
        animStyle,
      ]}
    >
      <LinearGradient
        colors={gradientColors as any}
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
      {showReadAction && (
        <TouchableOpacity
          style={styles.childSwipeActionButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch { }
            onToggleRead?.();
            closeSwipe();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          activeOpacity={0.75}
          accessibilityLabel="Mark as read"
        >
          <View
            style={[
              styles.childSwipeActionIconCircle,
              { backgroundColor: isDark ? "rgba(34, 197, 94, 0.22)" : "#DCFCE7" },
            ]}
          >
            <Ionicons
              name="checkmark-done"
              size={19}
              color={isDark ? "#4ADE80" : "#16A34A"}
            />
          </View>
        </TouchableOpacity>
      )}
      {onDelete && (
        <TouchableOpacity
          style={styles.childSwipeActionButton}
          onPress={(e) => {
            e?.stopPropagation?.();
            handleDeletePress();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          activeOpacity={0.75}
          accessibilityLabel="Delete notification"
        >
          <View
            style={[
              styles.childSwipeActionIconCircle,
              { backgroundColor: isDark ? "rgba(239, 68, 68, 0.22)" : "#FEE2E2" },
            ]}
          >
            <Ionicons
              name="trash"
              size={17}
              color={isDark ? "#EF4444" : "#DC2626"}
            />
          </View>
        </TouchableOpacity>
      )}
    </Reanimated.View>
  );
});

const NotificationMasterCard = React.memo(function NotificationMasterCard({
  item,
  stackCount,
  categoryLabel,
  isExpanded,
  isDark,
  isDetailItem = false,
  expandAnim,
  scaleFont,
  accentColor,
  onPress,
  onToggleStack,
  onAccept,
  onReject,
  onToggleRead,
  onDelete,
  hasUnread,
}: {
  item: AppNotification;
  stackCount: number;
  categoryLabel: string;
  isExpanded: boolean;
  isDark: boolean;
  isDetailItem?: boolean;
  expandAnim?: Animated.Value;
  scaleFont: (size: number) => number;
  accentColor?: string;
  onPress: () => void;
  onToggleStack: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;
  hasUnread?: boolean;
}) {
  const isStacked = stackCount > 1;
  const isExpandable = isStacked || isDetailItem;
  const isFriendRequest = item.type === "friend_request";
  const isFriendAccepted = item.type === "friend_accepted";
  const isPendingRequest =
    isFriendRequest && item.status !== "accepted" && item.status !== "rejected";
  const isMissedCall = item.type === "missed_call";

  const isGroup = isGroupNotification(item);
  const typeConfig = getTypeConfig(item.type, isGroup, item.title);

  // Clean and formatted title
  let titleText = item.senderName || item.title || typeConfig.label;
  if (
    item.type === "call" ||
    item.type === "missed_call" ||
    Boolean(item.callId)
  ) {
    if (item.senderName) {
      titleText = item.senderName;
    } else if (titleText.startsWith("Missed Call from ")) {
      titleText = titleText.replace(/^Missed Call from /i, "");
    } else if (
      titleText.startsWith("Incoming ") &&
      titleText.includes(" from ")
    ) {
      titleText = titleText.split(" from ")[1] || titleText;
    }
  }
  if (isFriendRequest) titleText = "Friend Request Received";
  if (isFriendAccepted) titleText = "Friend Request Accepted";

  // Clean body snippet
  const rawCleanBody = stripHtml(
    item.body ||
    item.content ||
    item.message ||
    item.info ||
    item.description ||
    item.details ||
    item.notes ||
    (isFriendAccepted
      ? `${item.senderName || "User"} accepted your friend request.`
      : ""),
  );
  let displayBody = rawCleanBody;
  if (isMissedCall && displayBody.toLowerCase().includes("missed audio call")) {
    displayBody = "1 missed audio call";
  } else if (
    isMissedCall &&
    displayBody.toLowerCase().includes("missed video call")
  ) {
    displayBody = "1 missed video call";
  }

  const isFeedbackItem = isFeedbackOrGeneralNotification(item);
  const avatarUrl = item.pic || item.senderAvatar;
  const fallbackInitial = isFeedbackItem
    ? ""
    : (titleText.trim()[0] || "B").toUpperCase();
  const fallbackBg = isFeedbackItem
    ? (isDark ? "#FFFFFF" : "#E2E8F0")
    : getAvatarInitialBg(titleText);

  // Swipeable ref to close after slide action click
  const swipeableRef = useRef<any>(null);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);

  // Tactile press animation
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.985,
      useNativeDriver: true,
      stiffness: 600,
      damping: 28,
      mass: 0.5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 500,
      damping: 24,
      mass: 0.5,
    }).start();
  };

  const handlePress = () => {
    if (isExpandable) {
      try {
        LayoutAnimation.configureNext({
          duration: 280,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        });
      } catch { }
      onToggleStack();
      return;
    }
    onPress();
  };

  const cardBgColor = isDark
    ? isExpanded
      ? "#1A1A1E"
      : "#161618"
    : isExpanded
      ? "#F5F5F7"
      : "#FFFFFF";

  const chevronRotate = expandAnim
    ? expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    })
    : isExpanded
      ? "180deg"
      : "0deg";

  const isUnread = hasUnread !== undefined
    ? hasUnread
    : (!item.isRead && !item.seen && !item.read);

  // Deletion animation state
  const deleteAnim = useRef(new Animated.Value(1)).current;
  const isDeletingRef = useRef(false);

  const handleDeletePress = () => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }
    try {
      swipeableRef.current?.close();
    } catch { }
    Animated.parallel([
      Animated.timing(deleteAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.25, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start(() => {
      onDelete?.();
    });
  };

  const showReadAction = isUnread && Boolean(onToggleRead);

  const renderRightActions = (
    progress?: any,
    _translation?: any,
    swipeableMethods?: any,
  ) => {
    if (!onDelete && !showReadAction) return null;
    const closeSwipe = () => {
      try {
        swipeableMethods?.close();
      } catch { }
      try {
        swipeableRef.current?.close();
      } catch { }
    };

    return (
      <SwipeActionsMasterView
        progress={progress}
        showReadAction={showReadAction}
        onDelete={onDelete ? handleDeletePress : undefined}
        onToggleRead={onToggleRead}
        isDark={isDark}
        closeSwipe={closeSwipe}
        handleDeletePress={handleDeletePress}
      />
    );
  };

  return (
    <Animated.View
      pointerEvents={isDeletingRef.current ? "none" : "auto"}
      style={{
        opacity: deleteAnim,
        maxHeight: deleteAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1000],
        }),
        transform: [
          {
            scale: deleteAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
          {
            translateX: deleteAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-90, 0],
            }),
          },
        ],
        overflow: "hidden",
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={() => setIsSwipeOpen(true)}
        onSwipeableWillClose={() => setIsSwipeOpen(false)}
        overshootRight={false}
        rightThreshold={showReadAction ? 40 : 25}
        friction={1.5}
        childrenContainerStyle={{ width: "100%" }}
        containerStyle={[
          styles.masterSwipeableContainer,
          { backgroundColor: cardBgColor },
        ]}
      >
        <Pressable
          style={{ width: "100%" }}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={{ width: "100%", transform: [{ scale: pressScale }] }}>
            <Animated.View
              style={[
                styles.cardContainer,
                { width: "100%" },
                {
                  backgroundColor: cardBgColor,
                  boxShadow: isDark
                    ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                    : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                  borderWidth: 0,
                },
              ]}
            >
              <View style={styles.cardMainRow}>
                {/* Avatar with Badges */}
                <View style={styles.avatarWrapper}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.cardAvatar} />
                  ) : (
                    <View
                      style={[
                        styles.cardAvatarFallback,
                        { backgroundColor: fallbackBg },
                      ]}
                    >
                      {fallbackInitial ? (
                        <Text
                          style={[
                            styles.avatarInitialText,
                            {
                              fontSize: scaleFont(19),
                              color: isFeedbackItem
                                ? (isDark ? "#000000" : "#11141A")
                                : "#FFFFFF",
                            },
                          ]}
                        >
                          {fallbackInitial}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Bottom-right Mini Status Badge */}
                  <View
                    style={[
                      styles.avatarMiniBadge,
                      {
                        backgroundColor: typeConfig.bgColor,
                        borderColor: isDark ? "#161618" : "#FFFFFF",
                      },
                    ]}
                  >
                    <Ionicons
                      name={typeConfig.icon}
                      size={10}
                      color="#FFFFFF"
                      style={
                        isMissedCall
                          ? { transform: [{ rotate: "135deg" }] }
                          : undefined
                      }
                    />
                  </View>

                  {/* Top-right Stack Count Badge (White circle with black counter e.g. 5, 3, 2 in dark mode, inverted in light) */}
                  {isStacked && (
                    <View
                      style={[
                        styles.stackBadge,
                        {
                          backgroundColor: isDark ? "#FFFFFF" : "#000000",
                          borderColor: isDark ? "#161618" : "#FFFFFF",
                          boxShadow: isDark
                            ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                            : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stackBadgeText,
                          {
                            fontSize: scaleFont(10.5),
                            color: isDark ? "#000000" : "#FFFFFF",
                          },
                        ]}
                      >
                        {stackCount}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Content Column */}
                <View style={styles.cardContent}>
                  {/* Header Row: Title and Timestamp */}
                  <View style={styles.cardHeaderRow}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardTitle,
                        {
                          fontSize: scaleFont(15),
                          color: isDark ? "#FFFFFF" : "#11141A",
                        },
                      ]}
                    >
                      {titleText}
                    </Text>
                    <Text
                      style={[
                        styles.cardTimeText,
                        {
                          fontSize: scaleFont(12),
                          color: isDark ? "#7E8590" : "#8A909A",
                        },
                      ]}
                    >
                      {formatCardTime(item.timestamp)}
                    </Text>
                  </View>

                  {/* Missed Call Banner inside parent card only if solitary */}
                  {isMissedCall && !isStacked && (
                    <View style={styles.missedCallBadgeRow}>
                      <Ionicons
                        name="call"
                        size={12}
                        color="#FF5A5F"
                        style={{
                          marginRight: 5,
                          transform: [{ rotate: "135deg" }],
                        }}
                      />
                      <Text
                        style={[
                          styles.missedCallLabel,
                          { fontSize: scaleFont(12) },
                        ]}
                      >
                        Missed Call
                      </Text>
                    </View>
                  )}

                  {/* Message / Subtitle */}
                  {displayBody.length > 0 && (
                    <Text
                      numberOfLines={isDetailItem && isExpanded ? undefined : 1}
                      style={[
                        styles.cardMessage,
                        {
                          fontSize: scaleFont(13.5),
                          color: isDark ? "rgba(255, 255, 255, 0.65)" : "#555A64",
                        },
                        isDetailItem && isExpanded && {
                          fontSize: scaleFont(14),
                          lineHeight: 21,
                          marginTop: 6,
                          color: isDark ? "#F4F4F5" : "#18181B",
                        },
                        isMissedCall && (isDark ? styles.cardMessageWhite : { color: "#11141A", fontWeight: "500" }),
                      ]}
                    >
                      {displayBody}
                      {isUnread && (
                        <Text style={{ color: isDark ? "#FFFFFF" : "#11141A", fontWeight: "800" }}> •</Text>
                      )}
                    </Text>
                  )}

                  {/* Extended Feedback / Support / Info details when expanded in place */}
                  {isDetailItem && isExpanded && (
                    <View style={styles.detailContentContainer}>
                      {(item.reply || item.response || item.adminReply || item.notes) && (
                        <View
                          style={[
                            styles.feedbackResponseBox,
                            {
                              backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#F8FAFC",
                              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
                            },
                          ]}
                        >
                          <View style={styles.feedbackResponseHeader}>
                            <Ionicons
                              name="chatbubble-ellipses-outline"
                              size={13}
                              color={isDark ? "#60A5FA" : "#2563EB"}
                            />
                            <Text
                              style={[
                                styles.feedbackResponseTitle,
                                {
                                  fontSize: scaleFont(12),
                                  color: isDark ? "#93C5FD" : "#1D4ED8",
                                },
                              ]}
                            >
                              Response
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.feedbackResponseText,
                              {
                                fontSize: scaleFont(13),
                                color: isDark ? "#E4E4E7" : "#334155",
                              },
                            ]}
                          >
                            {stripHtml(item.reply || item.response || item.adminReply || item.notes)}
                          </Text>
                        </View>
                      )}

                      {(item.feedbackId || item.ticketId || item.status || item.category) && (
                        <View style={styles.feedbackMetaRow}>
                          {(item.feedbackId || item.ticketId) && (
                            <View
                              style={[
                                styles.feedbackMetaChip,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(255, 255, 255, 0.08)"
                                    : "#F1F5F9",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.feedbackMetaChipText,
                                  {
                                    fontSize: scaleFont(11),
                                    color: isDark ? "#A1A1AA" : "#64748B",
                                  },
                                ]}
                              >
                                Ref #{item.feedbackId || item.ticketId}
                              </Text>
                            </View>
                          )}
                          {item.status && (
                            <View
                              style={[
                                styles.feedbackMetaChip,
                                {
                                  backgroundColor: isDark
                                    ? "rgba(34, 197, 94, 0.16)"
                                    : "#DCFCE7",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.feedbackMetaChipText,
                                  {
                                    fontSize: scaleFont(11),
                                    color: isDark ? "#4ADE80" : "#16A34A",
                                  },
                                ]}
                              >
                                {String(item.status).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Group Summary Row for Multi-card Stacks (Matching Image 1) */}
                  {isStacked && (
                    <View style={styles.groupSummaryRow} pointerEvents="none">
                      <Ionicons
                        name="layers"
                        size={13}
                        color={isDark ? "#F1F1F1" : "#555860"}
                        style={styles.summaryLayersIcon}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.groupSummaryText,
                          {
                            fontSize: scaleFont(12),
                            color: isDark ? "#F1F1F1" : "#4B5563",
                          },
                        ]}
                      >
                        {isExpanded
                          ? `Tap to collapse ${stackCount} stacked alerts`
                          : `+${stackCount - 1} more in ${categoryLabel} • Tap to unstack`}
                      </Text>
                      <Animated.View
                        style={{
                          marginLeft: 4,
                          transform: [{ rotate: chevronRotate }],
                        }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={13}
                          color={isDark ? "#F1F1F1" : "#555860"}
                        />
                      </Animated.View>
                      {isUnread && (
                        <Text
                          style={{
                            marginLeft: 6,
                            color: isDark ? "#FFFFFF" : "#11141A",
                            fontWeight: "800",
                            fontSize: scaleFont(13),
                          }}
                        >
                          •
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Single Detail Notification Summary Row (Matching screenshot for Feedback/General/Accepted) */}
                  {isDetailItem && (
                    <View style={styles.groupSummaryRow} pointerEvents="none">
                      <Animated.View
                        style={{
                          transform: [{ rotate: chevronRotate }],
                          marginRight: 6,
                        }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={13}
                          color={isDark ? "#F1F1F1" : "#555860"}
                          style={styles.summaryLayersIcon}
                        />
                      </Animated.View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.groupSummaryText,
                          {
                            fontSize: scaleFont(12),
                            color: isDark ? "#F1F1F1" : "#4B5563",
                          },
                        ]}
                      >
                        {isExpanded ? "Tap to collapse" : "Tap to view full info"}
                      </Text>
                    </View>
                  )}

                  {/* Dual Pill Action Buttons (inline for Friend Requests) */}
                  {isPendingRequest && (
                    <View style={styles.friendButtonsRow}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          onAccept();
                        }}
                        style={[
                          styles.acceptButton,
                          {
                            backgroundColor: isDark ? "#FFFFFF" : "#000000",
                            boxShadow: isDark
                              ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                              : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.acceptButtonText,
                            {
                              fontSize: scaleFont(13),
                              color: isDark ? "#000000" : "#FFFFFF",
                            },
                          ]}
                        >
                          Accept
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          onReject();
                        }}
                        style={[
                          styles.declineButton,
                          {
                            backgroundColor: isDark ? "#242428" : "#E6E6E6",
                            boxShadow: isDark
                              ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                              : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.declineButtonText,
                            {
                              fontSize: scaleFont(13),
                              color: isDark ? "#FFFFFF" : "#11141A",
                            },
                          ]}
                        >
                          Decline
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {isSwipeOpen && (
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    isDark
                      ? [
                        cardBgColor,
                        "rgba(22, 22, 24, 0.92)",
                        "rgba(22, 22, 24, 0.48)",
                        "rgba(22, 22, 24, 0)",
                      ]
                      : [
                        cardBgColor,
                        "rgba(255, 255, 255, 0.92)",
                        "rgba(255, 255, 255, 0.45)",
                        "rgba(255, 255, 255, 0)",
                      ]
                  }
                  locations={[0, 0.42, 0.74, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.swipeEdgeFade, { width: 88 }]}
                />
              )}
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
});

/* ============================================================
   COMPONENT: STACKED CHILD CARD (Screenshot 1 & 4 Inset List)
============================================================ */

const StackedChildCard = React.memo(function StackedChildCard({
  item,
  isDetail = false,
  isDark,
  scaleFont,
  accentColor,
  onPress,
  onToggleRead,
  onDelete,
}: {
  item: AppNotification;
  isDetail?: boolean;
  isDark: boolean;
  scaleFont: (size: number) => number;
  accentColor?: string;
  onPress: (item: AppNotification) => void;
  onToggleRead?: (item: AppNotification) => void;
  onDelete?: (item: AppNotification) => void;
}) {
  const isMissedCall = item.type === "missed_call";
  const isGroup = isGroupNotification(item);
  const typeConfig = getTypeConfig(item.type, isGroup, item.title);
  const cleanBody = stripHtml(item.body || item.content || item.message || "");
  const isFeedbackItem = isFeedbackOrGeneralNotification(item);
  const avatarUrl = item.pic || item.senderAvatar;
  const fallbackInitial = isFeedbackItem
    ? ""
    : (item.title || item.senderName || "B")[0]?.toUpperCase() || "B";
  const fallbackBg = isFeedbackItem
    ? (isDark ? "#FFFFFF" : "#E2E8F0")
    : getAvatarInitialBg(item.title || item.senderName || "B");

  // Swipeable ref to close after slide action click
  const swipeableRef = useRef<any>(null);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  // Tactile press animation (native driver)
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.98,
      useNativeDriver: true,
      stiffness: 600,
      damping: 28,
      mass: 0.5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 500,
      damping: 24,
      mass: 0.5,
    }).start();
  };

  const handleCardPress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  const cardBgColor = isDark ? "#161618" : "#FFFFFF";

  let callDisplayTitle = cleanBody || item.title || "";
  if (!callDisplayTitle) {
    if (item.type === "missed_call") {
      callDisplayTitle = "1 missed audio call";
    } else if (item.callType === "video") {
      callDisplayTitle = "Incoming video call";
    } else {
      callDisplayTitle = "Incoming voice call";
    }
  }

  const isUnread = !item.isRead && !item.seen && !item.read;

  // Deletion animation state
  const deleteAnim = useRef(new Animated.Value(1)).current;
  const isDeletingRef = useRef(false);

  const handleDeletePress = () => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }
    try {
      swipeableRef.current?.close();
    } catch { }
    Animated.parallel([
      Animated.timing(deleteAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.25, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start(() => {
      onDelete?.(item);
    });
  };

  const showReadAction = isUnread && Boolean(onToggleRead);

  const renderRightActions = (
    progress?: any,
    _translation?: any,
    swipeableMethods?: any,
  ) => {
    if (!onDelete && !showReadAction) return null;
    const closeSwipe = () => {
      try {
        swipeableMethods?.close();
      } catch { }
      try {
        swipeableRef.current?.close();
      } catch { }
    };

    return (
      <SwipeActionsChildView
        progress={progress}
        showReadAction={showReadAction}
        onDelete={onDelete ? handleDeletePress : undefined}
        onToggleRead={onToggleRead ? () => onToggleRead(item) : undefined}
        item={item}
        isDark={isDark}
        closeSwipe={closeSwipe}
        handleDeletePress={handleDeletePress}
      />
    );
  };

  return (
    <Animated.View
      pointerEvents={isDeletingRef.current ? "none" : "auto"}
      style={{
        opacity: deleteAnim,
        maxHeight: deleteAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 180],
        }),
        marginBottom: deleteAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
        transform: [
          {
            scale: deleteAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.85, 1],
            }),
          },
          {
            translateX: deleteAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-70, 0],
            }),
          },
        ],
        overflow: "hidden",
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={() => setIsSwipeOpen(true)}
        onSwipeableWillClose={() => setIsSwipeOpen(false)}
        overshootRight={false}
        rightThreshold={showReadAction ? 35 : 22}
        friction={1.5}
        childrenContainerStyle={{ width: "100%" }}
        containerStyle={[
          styles.childSwipeableContainer,
          { backgroundColor: cardBgColor, width: "100%" },
        ]}
      >
        <Pressable
          style={{ width: "100%" }}
          onPress={handleCardPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={{ width: "100%", transform: [{ scale: pressScale }] }}>
            <Animated.View
              style={[
                styles.stackedCardContainer,
                isDetail && styles.stackedDetailCardContainer,
                {
                  width: "100%",
                  backgroundColor: cardBgColor,
                  boxShadow: isDark
                    ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                    : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                  borderWidth: 0,
                },
              ]}
            >
              {/* Avatar with mini badge */}
              <View style={styles.stackedAvatarWrapper}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.stackedAvatar} />
                ) : (
                  <View
                    style={[
                      styles.stackedAvatarFallback,
                      { backgroundColor: fallbackBg },
                    ]}
                  >
                    {fallbackInitial ? (
                      <Text
                        style={[
                          styles.stackedInitialText,
                          {
                            fontSize: scaleFont(16),
                            color: isFeedbackItem
                              ? (isDark ? "#000000" : "#11141A")
                              : "#FFFFFF",
                          },
                        ]}
                      >
                        {fallbackInitial}
                      </Text>
                    ) : null}
                  </View>
                )}

                <View
                  style={[
                    styles.stackedMiniBadge,
                    {
                      backgroundColor: typeConfig.bgColor,
                      borderColor: isDark ? "#161618" : "#FFFFFF",
                    },
                  ]}
                >
                  <Ionicons
                    name={typeConfig.icon}
                    size={9}
                    color="#FFFFFF"
                    style={
                      isMissedCall
                        ? { transform: [{ rotate: "135deg" }] }
                        : undefined
                    }
                  />
                </View>
              </View>

              {/* Card Details */}
              <View
                style={[styles.stackedCardContent, isDetail && { paddingTop: 2 }]}
              >
                {isMissedCall ? (
                  <>
                    <View style={styles.missedCallHeaderRow}>
                      <Ionicons
                        name="call"
                        size={12}
                        color="#FF5A5F"
                        style={{
                          marginRight: 5,
                          transform: [{ rotate: "135deg" }],
                        }}
                      />
                      <Text
                        style={[
                          styles.missedCallBadgeText,
                          { fontSize: scaleFont(12) },
                        ]}
                      >
                        Missed Call
                      </Text>
                    </View>
                    <Text
                      numberOfLines={isDetail ? undefined : 1}
                      style={[
                        styles.stackedMessageTitle,
                        isDetail && styles.stackedMessageTitleMultiline,
                        {
                          fontSize: scaleFont(13.5),
                          color: isDark ? "#FFFFFF" : "#11141A",
                        },
                      ]}
                    >
                      {callDisplayTitle}
                      {isUnread && (
                        <Text style={{ color: isDark ? "#FFFFFF" : "#11141A", fontWeight: "800" }}> •</Text>
                      )}
                    </Text>
                  </>
                ) : (
                  <Text
                    numberOfLines={isDetail ? undefined : 1}
                    style={[
                      styles.stackedMessageTitle,
                      isDetail && styles.stackedMessageTitleMultiline,
                      {
                        fontSize: scaleFont(13.5),
                        color: isDark ? "#FFFFFF" : "#11141A",
                      },
                    ]}
                  >
                    {callDisplayTitle}
                  </Text>
                )}

                <Text
                  style={[
                    styles.stackedTimestampText,
                    {
                      fontSize: scaleFont(11.5),
                      color: isDark ? "#7E8590" : "#8A909A",
                    },
                  ]}
                >
                  {formatStackedTime(item.timestamp)}
                </Text>
              </View>

              {isSwipeOpen && (
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    isDark
                      ? [
                          cardBgColor,
                          "rgba(22, 22, 24, 0.92)",
                          "rgba(22, 22, 24, 0.48)",
                          "rgba(22, 22, 24, 0)",
                        ]
                      : [
                          cardBgColor,
                          "rgba(255, 255, 255, 0.92)",
                          "rgba(255, 255, 255, 0.45)",
                          "rgba(255, 255, 255, 0)",
                        ]
                  }
                  locations={[0, 0.42, 0.74, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.swipeEdgeFade, { width: 88 }]}
                />
              )}
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
});

/* ============================================================
   STYLES (AMOLED Pitch Black `#000000`, Zero-Red, 26px Cards)
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  /* 1. Top App Bar */
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 20,
    backgroundColor: "transparent",
  },
  swipeEdgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 104,
    zIndex: 10,
    elevation: 10,
  },
  modernHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationListOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  headerTitle: {
    fontWeight: "700",
    marginLeft: 12,
    letterSpacing: -0.4,
    flex: 1,
  },


  /* 2. Filter Pills */
  filtersWrapper: {
    paddingVertical: 10,
    position: "relative",
    zIndex: 20,
    elevation: 20,
    backgroundColor: "transparent",
  },
  filtersScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
  },
  filterPillText: {
    fontWeight: "600",
  },

  /* 3. Chronological Timeline Grouping */
  listScrollContent: {
    paddingTop: 150,
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#7E8590",
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },

  groupWrapper: {
    position: "relative",
    marginBottom: 8,
    overflow: "visible",
  },

  groupWrapperStacked: {
    marginBottom: 20,
  },

  stackedPeekLayer1: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: -6,
    height: 24,
    borderRadius: 16,
    backgroundColor: "#1B1B1D",
    zIndex: 1,
    elevation: 0,
  },

  stackedPeekLayer2: {
    position: "absolute",
    left: 54,
    right: 54,
    bottom: -12,
    height: 24,
    borderRadius: 16,
    backgroundColor: "#131315",
    zIndex: 0,
    elevation: 0,
  },

  masterCardLayer: {
    position: "relative",
    zIndex: 10,
    elevation: 10,
  },

  /* 4. Parent / Master Card (Border Radius = 26px) */
  masterSwipeableContainer: {
    marginHorizontal: 16,
    borderRadius: 26,
    overflow: "hidden",
  },
  swipeActionsContainer: {
    width: 136,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    
    position: "relative",
    overflow: "hidden",
    paddingRight: 16,
    gap: 10,
    backgroundColor: "transparent",
  },
  swipeActionButton: {
    width: 44,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeActionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  readIconCircle: {
    backgroundColor: "#184726",
  },
  deleteIconCircle: {
    backgroundColor: "#4E201D",
  },
  cardContainer: {
    width: "100%",
    borderRadius: 26,
    marginHorizontal: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0,
    // zIndex: 3,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  cardMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 14,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#202024",
  },
  cardAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialText: {
    fontWeight: "700",
  },
  avatarMiniBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  stackBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  stackBadgeText: {
    fontWeight: "800",
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  cardTitle: {
    flex: 1,
    fontWeight: "700",
    marginRight: 8,
  },
  cardTimeText: {
    fontWeight: "500",
  },
  cardMessage: {
    lineHeight: 18,
  },
  cardMessageWhite: {
    fontWeight: "500",
  },
  missedCallBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  missedCallLabel: {
    color: "#FF5A5F",
    fontWeight: "700",
  },

  /* Group Summary Row (Directly below message preview, matching reference) */
  groupSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    minHeight: 18,
  },
  summaryLayersIcon: {
    marginRight: 6,
  },
  groupSummaryText: {
    fontWeight: "500",
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  detailContentContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  feedbackResponseBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackResponseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  feedbackResponseTitle: {
    fontWeight: "600",
  },
  feedbackResponseText: {
    lineHeight: 18,
  },
  feedbackMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  feedbackMetaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feedbackMetaChipText: {
    fontWeight: "600",
  },

  /* Inline Friend Request Action Buttons */
  friendButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  acceptButton: {
    height: 36,
    paddingHorizontal: 26,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
  },
  acceptButtonText: {
    fontWeight: "700",
  },
  declineButton: {
    height: 36,
    paddingHorizontal: 22,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
  },
  declineButtonText: {
    fontWeight: "600",
  },

  /* Unstack / Accordion Bottom Bar (legacy compatibility) */
  unstackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  unstackRowText: {
    fontWeight: "500",
    color: "#F1F1F1",
    marginLeft: 6,
  },

  /* 5. Inline Accordion Stack Container (Screenshot 1 & 4) */
  stackInsetContainer: {
    marginLeft: 20,
    paddingLeft: 14,
    borderLeftWidth: 1.5,
    paddingRight: 16,
  },
  stackHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  stackHeaderTitle: {
    fontWeight: "700",
  },
  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0,
  },
  collapseButtonText: {
    fontWeight: "600",
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 0,
  },
  showMoreText: {
    fontWeight: "600",
  },
  childSwipeableContainer: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 8,
  },
  childSwipeActionsContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "flex-end",
    height: "100%",
    backgroundColor: "#101010",
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  childSwipeActionButton: {
    width: 50,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  childSwipeActionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedCardContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    minHeight: 66,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 0,
    borderWidth: 0,
  },
  stackedDetailCardContainer: {
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  stackedAvatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  stackedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#202024",
  },
  stackedAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedInitialText: {
    fontWeight: "700",
  },
  stackedMiniBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  stackedCardContent: {
    flex: 1,
    justifyContent: "center",
  },
  missedCallHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  missedCallBadgeText: {
    color: "#FF5A5F",
    fontWeight: "700",
  },
  stackedMessageTitle: {
    fontWeight: "500",
    marginBottom: 2,
  },
  stackedMessageTitleMultiline: {
    lineHeight: 20,
    marginTop: 0,
    marginBottom: 8,
  },
  stackedTimestampText: {
    fontWeight: "400",
  },

  /* 6. Empty / Loading State */
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 26,
    minHeight: 74,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  skeletonLineTitle: {
    width: "48%",
    height: 14,
    borderRadius: 7,
  },
  skeletonLineBody: {
    width: "75%",
    height: 12,
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyGlowCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 0,
  },
  emptyTitle: {
    fontWeight: "800",
    textAlign: "center",
  },
  emptyDescription: {
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
});
