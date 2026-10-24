import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { auth, db } from "../lib/firebase";
import { sendFriendAcceptedNotification } from "../lib/sendAppNotification";
import { useUserChats } from "../hooks/useUserChats";
import { useUserGroups } from "../hooks/useUserGroups";

// Enable experimental layout animations on Android (only on legacy architecture; Fabric natively supports it)
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  const isFabric = Boolean((globalThis as any).nativeFabricUIManager || (globalThis as any)._IS_FABRIC);
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
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

function getDateSectionInfo(timestamp: any): { key: string; title: string; sortTimestamp: number } {
  const date = toDate(timestamp);
  if (!date) {
    return { key: "earlier", title: "EARLIER", sortTimestamp: 0 };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { key: "today", title: "TODAY", sortTimestamp: itemDate.getTime() };
  }
  if (diffDays === 1) {
    return { key: "yesterday", title: "YESTERDAY", sortTimestamp: itemDate.getTime() };
  }
  if (diffDays >= 2 && diffDays < 7) {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    return { key: `day_${itemDate.getTime()}`, title: dayName, sortTimestamp: itemDate.getTime() };
  }

  const formatted = date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
  return { key: `date_${itemDate.getTime()}`, title: formatted, sortTimestamp: itemDate.getTime() };
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
  if (item.groupId && typeof item.groupId === "string" && item.groupId.trim()) return item.groupId.trim();
  if (item.metadata?.groupId && typeof item.metadata.groupId === "string" && item.metadata.groupId.trim()) return item.metadata.groupId.trim();
  if (item.data?.groupId && typeof item.data.groupId === "string" && item.data.groupId.trim()) return item.data.groupId.trim();

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
  if (item.type === "group_chat" || item.type === "group" || item.category === "group_chat") {
    if (item.chatId && typeof item.chatId === "string" && item.chatId.trim() && !item.chatId.includes("_")) {
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
  if (item.type === "group_chat" || item.type === "group" || item.category === "group_chat") return true;
  if (Boolean(extractGroupId(item))) return true;
  if (typeof item.route === "string" && item.route.includes("group-chatroom")) return true;
  if (Boolean(item.groupName)) return true;
  return false;
}

function getTargetFriendId(item: AppNotification, myUid?: string): string | null {
  if (!item) return null;

  // 1. Check item.route e.g. "/chat/friendId" or "/chat/uidA_uidB"
  if (typeof item.route === "string" && item.route.includes("/chat/")) {
    const rawTarget = item.route.split("/chat/")[1]?.split("?")[0]?.replace(/^\//, "").trim();
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
  const metaSender = item.metadata?.senderId || item.data?.senderId || item.metadata?.friendId || item.data?.friendId;
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
  groups: any[] = []
): NotificationDestination | null {
  if (!item) return null;

  // 1. Friend requests have inline action buttons
  if (item.type === "friend_request") return null;

  // 2. Pure feedback / system tickets: expanded in-place
  if (isFeedbackOrGeneralNotification(item)) return null;

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
        (groupNameLower && (gName === groupNameLower || gTripName === groupNameLower)) ||
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
    const rawSender = (item.senderName || item.title || "").toLowerCase().trim();
    if (rawSender) {
      const match = chats.find((c: any) => {
        if (!c) return false;
        const cName = (c.name || c.displayName || "").toLowerCase().trim();
        return cName === rawSender || c.uid === item.senderId || c.id === item.chatId;
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
  if (item.route && typeof item.route === "string" && item.route !== "/notifications") {
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
    Boolean(item.feedbackId) ||
    Boolean(item.ticketId)
  ) {
    return true;
  }
  const title = (item.title || "").toLowerCase();
  if (
    title.includes("feedback") ||
    title.includes("received") ||
    title.includes("general") ||
    title.includes("#fb-") ||
    title.includes("ticket") ||
    title.includes("support") ||
    title.includes("notice") ||
    title.includes("announcement")
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

function isExpandableDetailNotification(item: AppNotification): boolean {
  if (!item) return false;
  // If friend request, inline buttons are used instead of expansion
  if (item.type === "friend_request" || item.type === "friend_accepted") {
    return false;
  }
  // Calls, chats, group chats, and trips have their own dedicated navigation
  if (
    item.type === "chat" ||
    item.type === "call" ||
    item.type === "missed_call" ||
    Boolean(item.senderId) ||
    Boolean(item.chatId) ||
    Boolean(item.callId) ||
    Boolean(item.tripId) ||
    Boolean(item.callType) ||
    isGroupNotification(item)
  ) {
    return false;
  }

  // Feedback / General / System tickets are expandable detail items
  return isFeedbackOrGeneralNotification(item);
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

function getTypeConfig(type?: string, isGroup?: boolean, title?: string): TypeConfig {
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
  const { isDark, scaleFont } = useThemeToggle();
  const { t } = useLanguage();

  const [currentUser, setCurrentUser] = useState<any>(() => auth.currentUser);
  const { chats = [] } = useUserChats(currentUser?.uid || auth.currentUser?.uid || null);
  const { groups = [] } = useUserGroups(currentUser?.uid || auth.currentUser?.uid || null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
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

  // 2. 0ms Offline Hydration from AsyncStorage (Safe CursorWindow handling)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(parsed);
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn("[notifications] Cache hydration error, clearing bloated cache:", err);
        // Automatically purge oversized or corrupted cache row to fix Android CursorWindow errors
        AsyncStorage.removeItem(NOTIFICATIONS_CACHE_KEY).catch(() => { });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Realtime Firestore Sync
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const currentUid = currentUser.uid;
    let unsubUid: (() => void) | null = null;
    let unsubRecipient: (() => void) | null = null;
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

      setNotifications(mergedList);
      setLoading(false);
      setRefreshing(false);

      // Async Cache to AsyncStorage: save only latest 40 items with sanitized fields
      // Strictly prevents SQLite 2MB CursorWindow limit crashes on Android
      const sanitizedCache = mergedList.slice(0, 40).map((item) => ({
        id: item.id,
        uid: item.uid,
        title: item.title,
        body: item.body || item.content || item.message,
        type: item.type,
        timestamp: item.timestamp?.toMillis ? item.timestamp.toMillis() : item.timestamp,
        seen: item.seen,
        isRead: item.isRead,
        read: item.read,
        groupId: item.groupId,
        chatId: item.chatId,
        route: item.route,
        senderName: item.senderName,
        pic: item.pic && !item.pic.startsWith("data:") ? item.pic : undefined,
      }));

      AsyncStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(sanitizedCache)).catch(() => { });
    };

    // Query 1: where uid == currentUid
    const qUid = query(collection(db, "notifications"), where("uid", "==", currentUid));
    unsubUid = onSnapshot(
      qUid,
      (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          docMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as AppNotification);
        });
        updateAndCache();
      },
      (error) => {
        console.warn("[notifications] Firestore uid listener error:", error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // Query 2: where recipientId == currentUid
    const qRecipient = query(
      collection(db, "notifications"),
      where("recipientId", "==", currentUid)
    );
    unsubRecipient = onSnapshot(
      qRecipient,
      (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          docMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as AppNotification);
        });
        updateAndCache();
      },
      (error) => {
        // Ignored if index or recipientId isn't populated
      }
    );

    return () => {
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

  // Custom layout animation configuration for fast, snappy height expansion/collapse
  const SPRING_LAYOUT_CONFIG = useMemo(
    () => ({
      duration: 250,
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
    }),
    []
  );

  // Inline Accordion Toggle Handler with Snappy Layout Animation
  const toggleStack = useCallback(
    (stackId: string) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
      LayoutAnimation.configureNext(SPRING_LAYOUT_CONFIG);
      setExpandedStackId((prev) => (prev === stackId ? null : stackId));
    },
    [SPRING_LAYOUT_CONFIG]
  );

  // 5. Read / Direct Action Handlers
  const markAsRead = useCallback(async (item: AppNotification) => {
    if (item.isRead || item.seen || item.read) return;

    // Optimistic local update
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true, seen: true, read: true } : n))
    );

    try {
      await updateDoc(doc(db, "notifications", item.id), {
        isRead: true,
        seen: true,
        read: true,
      });
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  }, []);

  const handleNotificationPress = useCallback(
    (item: AppNotification) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
      markAsRead(item);

      const currentUid = auth.currentUser?.uid || currentUser?.uid;

      // 1. If friend request, inline buttons are used (Accept / Decline)
      if (item.type === "friend_request") {
        return;
      }

      // 1.5. If pure feedback/ticket notification without chat/group context, toggle expansion
      if (isFeedbackOrGeneralNotification(item)) {
        const targetStackKey = `stack_${item.id}`;
        toggleStack(targetStackKey);
        return;
      }

      // 2. High-precision destination resolver (uses real Firestore groups and chats data)
      const destination = resolveNotificationDestination(item, currentUid, chats, groups);
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
      if (item.route && typeof item.route === "string" && item.route !== "/notifications") {
        router.push(item.route as any);
        return;
      }
    },
    [router, markAsRead, toggleStack, currentUser?.uid, chats, groups]
  );

  // 6. Inline Friend Request Accept / Decline Handlers (Optimistic + Firestore)
  const handleAcceptFriendRequest = useCallback(async (item: AppNotification) => {
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
          : n
      )
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
        doc(db, "notifications", `${targetSenderId}_${currentUid}_friend_accepted_${Date.now()}`),
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
        }
      );

      sendFriendAcceptedNotification({
        receiverId: targetSenderId,
        senderId: currentUid,
        senderName: auth.currentUser?.displayName || "A BunkMate",
        senderAvatar: auth.currentUser?.photoURL || "",
      }).catch((err) => console.warn("[notifications] sendFriendAcceptedNotification error:", err));
    } catch (err) {
      console.error("Error accepting friend request:", err);
      Alert.alert("Error", "Could not accept friend request.");
    }
  }, []);

  const handleRejectFriendRequest = useCallback(async (item: AppNotification) => {
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
          : n
      )
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
  }, []);

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
                  n.type !== "like"))))
      );
    } else if (activeCategory === "group_chat") {
      result = result.filter(isGroupNotification);
    } else if (activeCategory === "calls") {
      result = result.filter(
        (n) =>
          n.type === "call" ||
          n.type === "missed_call" ||
          Boolean(n.callId) ||
          Boolean(n.callType)
      );
    } else if (activeCategory === "feedback") {
      result = result.filter(isFeedbackOrGeneralNotification);
    }

    return result;
  }, [notifications, activeCategory]);

  const groupedDateSections = useMemo(() => {
    const sectionMap = new Map<string, { title: string; sortTimestamp: number; items: AppNotification[] }>();

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
          } else if (item.type === "call" || item.type === "missed_call" || item.callId) {
            const sender = grpId ? `group_${grpId}` : item.senderId || item.senderName || item.title || "calls";
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
            const sender = item.chatId || item.senderId || item.senderName || item.title || "chat";
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
          } else if (item.type === "call" || item.type === "missed_call" || item.callId) {
            const sender = grpId ? `group_${grpId}` : item.senderId || item.senderName || item.title || "calls";
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
            const sender = item.chatId || item.senderId || item.senderName || item.title || "chat";
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
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" />

      {/* 1. TOP APP BAR (Screenshot 3) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch { }
            router.back();
          }}
          style={styles.circleIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { fontSize: scaleFont(22) }]}>
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
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("all")}
          />
          <FilterPill
            label="Unreads"
            active={activeCategory === "unreads"}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("unreads")}
          />
          <FilterPill
            label="Chat"
            active={activeCategory === "chat"}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("chat")}
          />
          <FilterPill
            label="Group Chat"
            active={activeCategory === "group_chat"}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("group_chat")}
          />
          <FilterPill
            label="Calls"
            active={activeCategory === "calls"}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("calls")}
          />
          <FilterPill
            label="Feedback"
            active={activeCategory === "feedback"}
            scaleFont={scaleFont}
            onPress={() => handleSelectCategory("feedback")}
          />
        </ScrollView>
      </View>

      {/* 3. MAIN NOTIFICATION SCROLLVIEW */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
          }
        >
          <View style={styles.emptyGlowCircle}>
            <Ionicons name="notifications-off-outline" size={38} color="#7E8590" />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: scaleFont(18) }]}>
            {activeCategory === "unreads" ? "You're all caught up! ✨" : "No notifications yet"}
          </Text>
          <Text style={[styles.emptyDescription, { fontSize: scaleFont(13) }]}>
            {activeCategory === "unreads"
              ? "Zero unread alerts remaining."
              : "When your friends message, call, or invite you, they'll show up right here."}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === "android"}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listScrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
          }
        >
          {groupedDateSections.map((section) => (
            <View key={section.key} style={styles.sectionBlock}>
              {/* Chronological Timeline Header: e.g. "YESTERDAY", "THURSDAY", "SUNDAY" */}
              <Text style={[styles.sectionTitle, { fontSize: scaleFont(12) }]}>
                {section.title}
              </Text>

              {section.stackGroups.map((group) => {
                const isExpanded = expandedStackId === group.groupKey;

                return (
                  <NotificationStackGroupItem
                    key={group.groupKey}
                    group={group}
                    isExpanded={isExpanded}
                    scaleFont={scaleFont}
                    onToggleStack={toggleStack}
                    onPressItem={handleNotificationPress}
                    onAccept={handleAcceptFriendRequest}
                    onReject={handleRejectFriendRequest}
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
  scaleFont,
  onPress,
}: {
  label: string;
  active: boolean;
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
          active ? styles.filterPillActive : styles.filterPillInactive,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Text
          style={[
            styles.filterPillText,
            { fontSize: scaleFont(13) },
            active ? styles.filterPillTextActive : styles.filterPillTextInactive,
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

const NotificationStackGroupItem = React.memo(function NotificationStackGroupItem({
  group,
  isExpanded,
  scaleFont,
  onToggleStack,
  onPressItem,
  onAccept,
  onReject,
}: {
  group: NotificationStackGroup;
  isExpanded: boolean;
  scaleFont: (size: number) => number;
  onToggleStack: (stackId: string) => void;
  onPressItem: (item: AppNotification) => void;
  onAccept: (item: AppNotification) => void;
  onReject: (item: AppNotification) => void;
}) {
  const isStacked = group.items.length > 1;
  const isDetailItem = !isStacked && isExpandableDetailNotification(group.masterItem);
  const isExpandable = isStacked || isDetailItem;

  const expandAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const [isRendered, setIsRendered] = useState(isExpanded);

  // Synchronously ensure children are mounted in DOM tree when expanding
  if (isExpanded && !isRendered) {
    setIsRendered(true);
  }

  // Individual animation values for each child card to achieve distinct staggered cascading
  const itemAnimsRef = useRef<Animated.Value[]>([]);
  if (itemAnimsRef.current.length !== group.items.length) {
    itemAnimsRef.current = group.items.map(
      (_, i) => itemAnimsRef.current[i] || new Animated.Value(isExpanded ? 1 : 0)
    );
  }

  const isMountedRef = useRef(true);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (!isExpanded) return;
    }

    if (isExpanded) {
      setIsRendered(true);

      // Buttery smooth container expand
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start();

      // Reset individual item animations to 0 before starting staggered cascade
      itemAnimsRef.current.forEach((anim) => anim.setValue(0));

      // 24ms micro-stagger per card for an organic, silky cascading flow
      const staggerDelay = isDetailItem ? 0 : 24;
      const staggerAnimations = itemAnimsRef.current.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      );

      Animated.stagger(staggerDelay, staggerAnimations).start();
    } else {
      // Smooth sequential collapse: sub-cards tuck away one by one in reverse order (bottom card first)
      const reversedAnims = [...itemAnimsRef.current].reverse();
      const collapseStaggerDelay = isDetailItem ? 0 : 20;

      const reverseAnimations = reversedAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 130,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        })
      );

      // Micro-stagger each sub-card out one by one
      Animated.stagger(collapseStaggerDelay, reverseAnimations).start();

      // Fold container in parallel with the tucking cards
      const totalCollapseTime = Math.min(190, 130 + reversedAnims.length * collapseStaggerDelay);
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: totalCollapseTime,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (isMountedRef.current) {
          setIsRendered(false);
        }
      });
    }
  }, [isExpanded, isDetailItem]);

  const handleToggle = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { }

    onToggleStack(group.groupKey);
  }, [onToggleStack, group.groupKey]);

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
        if (group.categoryLabel === "Group Chat" && !extractGroupId(itemToRoute)) {
          const fallbackGrp =
            extractGroupId(group.masterItem) ||
            (group.groupKey
              ? group.groupKey.split("_group_")[1] || group.groupKey.replace(/^.*?group_/, "")
              : null);
          if (fallbackGrp) {
            itemToRoute.groupId = fallbackGrp;
          }
        }
        onPressItem(itemToRoute);
      }
    },
    [isDetailItem, handleToggle, onPressItem, group]
  );

  const handleAcceptMaster = useCallback(() => {
    onAccept(group.masterItem);
  }, [onAccept, group.masterItem]);

  const handleRejectMaster = useCallback(() => {
    onReject(group.masterItem);
  }, [onReject, group.masterItem]);

  // Peek Layer 1: fades out cleanly when unstacking so it never clashes with child cards
  const layer1Style = {
    opacity: expandAnim.interpolate({
      inputRange: [0, 0.2],
      outputRange: [1, 0],
    }),
  };

  // Peek Layer 2: fades out cleanly when unstacking
  const layer2Style = {
    opacity: expandAnim.interpolate({
      inputRange: [0, 0.15],
      outputRange: [1, 0],
    }),
  };

  // Inset child list container: sliding down from top, fading in with spring
  const insetContainerStyle = {
    opacity: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0],
        }),
      },
      {
        scale: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  return (
    <View
      style={[
        styles.groupWrapper,
        isStacked && !isExpanded && styles.groupWrapperStacked,
      ]}
    >
      {/* 3D Layered Cards behind (Deck of Cards visual when collapsed) */}

      {/* Back card layers */}
      {isStacked && !isExpanded && group.items.length >= 3 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stackedPeekLayer2,
            layer2Style,
          ]}
        />
      )}

      {isStacked && !isExpanded && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stackedPeekLayer1,
            layer1Style,
          ]}
        />
      )}

      {/* Front / Master notification card: tapping ALWAYS toggles stack/unstack */}
      <View style={styles.masterCardLayer}>
        <NotificationMasterCard
          item={group.masterItem}
          stackCount={group.items.length}
          categoryLabel={group.categoryLabel}
          isExpanded={isExpanded}
          isDetailItem={isDetailItem}
          expandAnim={expandAnim}
          scaleFont={scaleFont}
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
        />
      </View>


      {/* INLINE CARD STACKING / ACCORDION CONTAINER */}
      {isExpandable && isRendered && (
        <Animated.View
          pointerEvents={isExpanded ? "auto" : "none"}
          style={[styles.stackInsetContainer, insetContainerStyle]}
        >
          {/* Stack Header Row: 5 Stacked Calls Alerts | Collapse ∧ OR 1 Detail Item | Collapse ∧ */}
          <View style={styles.stackHeaderRow}>
            <Text style={[styles.stackHeaderTitle, { fontSize: scaleFont(13) }]}>
              {isDetailItem
                ? "1 Detail Item"
                : `${group.items.length} Stacked ${group.categoryLabel} Alerts`}
            </Text>

            <TouchableOpacity
              onPress={handleToggle}
              style={styles.collapseButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.collapseButtonText, { fontSize: scaleFont(11) }]}>
                Collapse
              </Text>
              <Ionicons
                name="chevron-up"
                size={13}
                color="#F1F1F1"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          </View>

          {/* Indented Nested Cards with Staggered Cascading Animation */}
          {group.items.map((subItem, index) => {
            const itemAnim = itemAnimsRef.current[index] || expandAnim;
            const itemStyle = {
              zIndex: group.items.length - index,
              opacity: itemAnim.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0, 0.7, 1],
              }),
              transform: [
                {
                  translateY: itemAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-16, 0],
                  }),
                },
                {
                  scale: itemAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            };

            return (
              <Animated.View key={subItem.id} style={itemStyle}>
                <StackedChildCard
                  item={subItem}
                  isDetail={isDetailItem}
                  scaleFont={scaleFont}
                  onPress={() => handlePressChild(subItem)}
                />
              </Animated.View>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
});

/* ============================================================
   COMPONENT: NOTIFICATION MASTER CARD (Screenshots 1, 2, 3)
============================================================ */

const NotificationMasterCard = React.memo(function NotificationMasterCard({
  item,
  stackCount,
  categoryLabel,
  isExpanded,
  isDetailItem = false,
  expandAnim,
  scaleFont,
  onPress,
  onToggleStack,
  onAccept,
  onReject,
}: {
  item: AppNotification;
  stackCount: number;
  categoryLabel: string;
  isExpanded: boolean;
  isDetailItem?: boolean;
  expandAnim?: Animated.Value;
  scaleFont: (size: number) => number;
  onPress: () => void;
  onToggleStack: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isStacked = stackCount > 1;
  const isFriendRequest = item.type === "friend_request";
  const isFriendAccepted = item.type === "friend_accepted";
  const isPendingRequest =
    isFriendRequest && item.status !== "accepted" && item.status !== "rejected";
  const isMissedCall = item.type === "missed_call";

  const isGroup = isGroupNotification(item);
  const typeConfig = getTypeConfig(item.type, isGroup, item.title);

  // Clean and formatted title
  let titleText = item.senderName || item.title || typeConfig.label;
  if (item.type === "call" || item.type === "missed_call" || Boolean(item.callId)) {
    if (item.senderName) {
      titleText = item.senderName;
    } else if (titleText.startsWith("Missed Call from ")) {
      titleText = titleText.replace(/^Missed Call from /i, "");
    } else if (titleText.startsWith("Incoming ") && titleText.includes(" from ")) {
      titleText = titleText.split(" from ")[1] || titleText;
    }
  }
  if (isFriendRequest) titleText = "Friend Request Received";
  if (isFriendAccepted) titleText = "Friend Request Accepted";

  // Clean body snippet
  const rawCleanBody = stripHtml(
    item.body || item.content || item.message || (isFriendAccepted ? `${item.senderName || "User"} accepted your friend request.` : "")
  );
  let displayBody = rawCleanBody;
  if (isMissedCall && displayBody.toLowerCase().includes("missed audio call")) {
    displayBody = "1 missed audio call";
  } else if (isMissedCall && displayBody.toLowerCase().includes("missed video call")) {
    displayBody = "1 missed video call";
  }

  const isFeedbackItem = isFeedbackOrGeneralNotification(item);
  const avatarUrl = item.pic || item.senderAvatar;
  const fallbackInitial = isFeedbackItem ? "" : (titleText.trim()[0] || "B").toUpperCase();
  const fallbackBg = isFeedbackItem ? "#FFFFFF" : getAvatarInitialBg(titleText);

  // Interactive Hover and Touch Highlight animation
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.985,
        useNativeDriver: true,
        stiffness: 450,
        damping: 25,
        mass: 0.7,
      }),
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 350,
        damping: 20,
        mass: 0.7,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleHoverIn = () => {
    Animated.timing(highlightAnim, {
      toValue: 0.65,
      duration: 120,
      useNativeDriver: false,
    }).start();
  };

  const handleHoverOut = () => {
    Animated.timing(highlightAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const cardBgColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isExpanded ? "#1A1A1E" : "#161618", "#24242A"],
  });


  const chevronRotate = expandAnim
    ? expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    })
    : isExpanded
      ? "180deg"
      : "0deg";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              backgroundColor: cardBgColor,
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
                <View style={[styles.cardAvatarFallback, { backgroundColor: fallbackBg }]}>
                  {fallbackInitial ? (
                    <Text style={[styles.avatarInitialText, { fontSize: scaleFont(19) }]}>
                      {fallbackInitial}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Bottom-right Mini Status Badge */}
              <View style={[styles.avatarMiniBadge, { backgroundColor: typeConfig.bgColor }]}>
                <Ionicons
                  name={typeConfig.icon}
                  size={10}
                  color="#FFFFFF"
                  style={isMissedCall ? { transform: [{ rotate: "135deg" }] } : undefined}
                />
              </View>

              {/* Top-right Stack Count Badge (White circle with black counter e.g. 5, 3, 2) */}
              {isStacked && (
                <View style={styles.stackBadge}>
                  <Text style={[styles.stackBadgeText, { fontSize: scaleFont(10.5) }]}>
                    {stackCount}
                  </Text>
                </View>
              )}
            </View>

            {/* Content Column */}
            <View style={styles.cardContent}>
              {/* Header Row: Title and Timestamp */}
              <View style={styles.cardHeaderRow}>
                <Text numberOfLines={1} style={[styles.cardTitle, { fontSize: scaleFont(15) }]}>
                  {titleText}
                </Text>
                <Text style={[styles.cardTimeText, { fontSize: scaleFont(12) }]}>
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
                    style={{ marginRight: 5, transform: [{ rotate: "135deg" }] }}
                  />
                  <Text style={[styles.missedCallLabel, { fontSize: scaleFont(12) }]}>
                    Missed Call
                  </Text>
                </View>
              )}

              {/* Message / Subtitle */}
              {displayBody.length > 0 && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.cardMessage,
                    { fontSize: scaleFont(13.5) },
                    isMissedCall && styles.cardMessageWhite,
                  ]}
                >
                  {displayBody}
                </Text>
              )}

              {/* Group Summary Row for Multi-card Stacks (Matching Image 1) */}
              {isStacked && (
                <View
                  style={styles.groupSummaryRow}
                  pointerEvents="none"
                >
                  <Ionicons name="layers" size={13} color="#F1F1F1" style={styles.summaryLayersIcon} />
                  <Text numberOfLines={1} style={[styles.groupSummaryText, { fontSize: scaleFont(12) }]}>
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
                      color="#F1F1F1"
                    />
                  </Animated.View>
                </View>
              )}

              {/* Single Detail Notification Summary Row (Matching screenshot for Feedback/General) */}
              {isDetailItem && (
                <View
                  style={styles.groupSummaryRow}
                  pointerEvents="none"
                >
                  <Ionicons
                    name="open-outline"
                    size={13}
                    color="#F1F1F1"
                    style={styles.summaryLayersIcon}
                  />
                  <Text numberOfLines={1} style={[styles.groupSummaryText, { fontSize: scaleFont(12) }]}>
                    {isExpanded ? "Tap to hide details" : "Tap to view details"}
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
                    style={styles.acceptButton}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.acceptButtonText, { fontSize: scaleFont(13) }]}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      onReject();
                    }}
                    style={styles.declineButton}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.declineButtonText, { fontSize: scaleFont(13) }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

/* ============================================================
   COMPONENT: STACKED CHILD CARD (Screenshot 1 & 4 Inset List)
============================================================ */

const StackedChildCard = React.memo(function StackedChildCard({
  item,
  isDetail = false,
  scaleFont,
  onPress,
}: {
  item: AppNotification;
  isDetail?: boolean;
  scaleFont: (size: number) => number;
  onPress: () => void;
}) {
  const isMissedCall = item.type === "missed_call";
  const isGroup = isGroupNotification(item);
  const typeConfig = getTypeConfig(item.type, isGroup, item.title);
  const cleanBody = stripHtml(item.body || item.content || item.message || "");
  const isFeedbackItem = isFeedbackOrGeneralNotification(item);
  const avatarUrl = item.pic || item.senderAvatar;
  const fallbackInitial = isFeedbackItem ? "" : (item.title || item.senderName || "B")[0]?.toUpperCase() || "B";
  const fallbackBg = isFeedbackItem ? "#FFFFFF" : getAvatarInitialBg(item.title || item.senderName || "B");

  // Tactile press & hover animation
  const pressScale = useRef(new Animated.Value(1)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 0.98,
        useNativeDriver: true,
        stiffness: 450,
        damping: 25,
        mass: 0.7,
      }),
      Animated.timing(highlightAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 350,
        damping: 20,
        mass: 0.7,
      }),
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleHoverIn = () => {
    Animated.timing(highlightAnim, {
      toValue: 0.6,
      duration: 120,
      useNativeDriver: false,
    }).start();
  };

  const handleHoverOut = () => {
    Animated.timing(highlightAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const cardBgColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#161618", "#222228"],
  });


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

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Animated.View
          style={[
            styles.stackedCardContainer,
            isDetail && styles.stackedDetailCardContainer,
            {
              backgroundColor: cardBgColor,
              borderWidth: 0,
            },
          ]}
        >
          {/* Avatar with mini badge */}
          <View style={styles.stackedAvatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.stackedAvatar} />
            ) : (
              <View style={[styles.stackedAvatarFallback, { backgroundColor: fallbackBg }]}>
                {fallbackInitial ? (
                  <Text style={[styles.stackedInitialText, { fontSize: scaleFont(16) }]}>
                    {fallbackInitial}
                  </Text>
                ) : null}
              </View>
            )}

            <View style={[styles.stackedMiniBadge, { backgroundColor: typeConfig.bgColor }]}>
              <Ionicons
                name={typeConfig.icon}
                size={9}
                color="#FFFFFF"
                style={isMissedCall ? { transform: [{ rotate: "135deg" }] } : undefined}
              />
            </View>
          </View>

          {/* Card Details */}
          <View style={[styles.stackedCardContent, isDetail && { paddingTop: 2 }]}>
            {isMissedCall ? (
              <>
                <View style={styles.missedCallHeaderRow}>
                  <Ionicons
                    name="call"
                    size={12}
                    color="#FF5A5F"
                    style={{ marginRight: 5, transform: [{ rotate: "135deg" }] }}
                  />
                  <Text style={[styles.missedCallBadgeText, { fontSize: scaleFont(12) }]}>
                    Missed Call
                  </Text>
                </View>
                <Text
                  numberOfLines={isDetail ? undefined : 1}
                  style={[
                    styles.stackedMessageTitle,
                    isDetail && styles.stackedMessageTitleMultiline,
                    { fontSize: scaleFont(13.5) },
                  ]}
                >
                  {callDisplayTitle}
                </Text>
              </>
            ) : (
              <Text
                numberOfLines={isDetail ? undefined : 1}
                style={[
                  styles.stackedMessageTitle,
                  isDetail && styles.stackedMessageTitleMultiline,
                  { fontSize: scaleFont(13.5) },
                ]}
              >
                {callDisplayTitle}
              </Text>
            )}

            <Text style={[styles.stackedTimestampText, { fontSize: scaleFont(11.5) }]}>
              {formatStackedTime(item.timestamp)}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

/* ============================================================
   STYLES (AMOLED Pitch Black `#000000`, Zero-Red, 26px Cards)
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  /* 1. Top App Bar */
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  circleIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#161618",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "800",
    color: "#FFFFFF",
    marginLeft: 14,
    letterSpacing: -0.3,
  },

  /* 2. Filter Pills */
  filtersWrapper: {
    paddingVertical: 10,
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
    boxShadow:
      "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)",
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
  },
  filterPillInactive: {
    backgroundColor: "#000000",
  },
  filterPillText: {
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  filterPillTextInactive: {
    color: "#F1F1F1",
  },

  /* 3. Chronological Timeline Grouping */
  listScrollContent: {
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
  cardContainer: {
    backgroundColor: "#161618",
    borderRadius: 26,
    marginHorizontal: 16,
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
    color: "#FFFFFF",
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
    borderColor: "#161618",
  },
  stackBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#161618",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  stackBadgeText: {
    color: "#000000",
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
    color: "#FFFFFF",
    marginRight: 8,
  },
  cardTimeText: {
    color: "#7E8590",
    fontWeight: "500",
  },
  cardMessage: {
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 18,
  },
  cardMessageWhite: {
    color: "#FFFFFF",
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
    color: "#F1F1F1",
    fontWeight: "500",
    letterSpacing: -0.1,
    flexShrink: 1,
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
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonText: {
    color: "#000000",
    fontWeight: "700",
  },
  declineButton: {
    height: 36,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: "#242428",
    justifyContent: "center",
    alignItems: "center",
  },
  declineButtonText: {
    color: "#FFFFFF",
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
    borderLeftColor: "rgba(255, 255, 255, 0.12)",
    marginTop: 8,
    marginBottom: 8,
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
    color: "#FFFFFF",
  },
  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E22",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  collapseButtonText: {
    fontWeight: "600",
    color: "#F1F1F1",
  },
  stackedCardContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
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
    color: "#FFFFFF",
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
    borderColor: "#161618",
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
    color: "#FFFFFF",
    marginBottom: 2,
  },
  stackedMessageTitleMultiline: {
    lineHeight: 20,
    color: "#FFFFFF",
    marginTop: 0,
    marginBottom: 8,
  },
  stackedTimestampText: {
    color: "#7E8590",
    fontWeight: "400",
  },

  /* 6. Empty / Loading State */
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  emptyDescription: {
    lineHeight: 19,
    color: "#7E8590",
    textAlign: "center",
    marginTop: 8,
  },
});
