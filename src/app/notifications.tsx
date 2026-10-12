import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { haptic } from "../constants/authTheme";

/* ============================================================
   TYPES
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

export interface NotificationItem {
  id: string;
  uid?: string;
  type?: NotificationType;
  title?: string;
  content?: string;
  message?: string;
  senderId?: string;
  senderName?: string;
  pic?: string;
  seen?: boolean;
  read?: boolean;
  status?: string;
  timestamp?: any;
  route?: string;
  chatId?: string;
  groupId?: string;
  groupName?: string;
  callId?: string;
  callType?: "audio" | "video";
  tripId?: string;
  [key: string]: any;
}

export type FilterCategory =
  | "all"
  | "unread"
  | "messages"
  | "calls"
  | "requests"
  | "system";

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

function formatRelativeTime(timestamp: any): string {
  const date = toDate(timestamp);
  if (!date) return "--";

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatExactDateTime(timestamp: any): string {
  const date = toDate(timestamp);
  if (!date) return "Unknown time";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDateSection(timestamp: any): string {
  const date = toDate(timestamp);
  if (!date) return "Earlier";

  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (date > sevenDaysAgo) return "This Week";

  return "Earlier";
}

function stripHtml(value?: string): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/* ============================================================
   TYPE METADATA (ICONS, COLORS & BADGES)
============================================================ */

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badgeBg: string;
  label: string;
}

function getTypeConfig(type?: string): TypeConfig {
  switch (type) {
    case "chat":
      return {
        icon: "chatbubble-ellipses",
        color: "#38bdf8", // Sky blue
        badgeBg: "rgba(56, 189, 248, 0.15)",
        label: "Chat",
      };
    case "group_chat":
      return {
        icon: "chatbubbles",
        color: "#a855f7", // Purple
        badgeBg: "rgba(168, 85, 247, 0.15)",
        label: "Group Chat",
      };
    case "call":
      return {
        icon: "call",
        color: "#ffffff", // Pure white luxury accent
        badgeBg: "rgba(255, 255, 255, 0.14)",
        label: "Incoming Call",
      };
    case "missed_call":
      return {
        icon: "call-outline",
        color: "#ef4444", // Red
        badgeBg: "rgba(239, 68, 68, 0.15)",
        label: "Missed Call",
      };
    case "friend_request":
      return {
        icon: "person-add",
        color: "#ffffff", // Pure white luxury accent
        badgeBg: "rgba(255, 255, 255, 0.14)",
        label: "Friend Request",
      };
    case "friend_accepted":
      return {
        icon: "people",
        color: "#ffffff", // Pure white luxury accent
        badgeBg: "rgba(255, 255, 255, 0.14)",
        label: "New Friend",
      };
    case "trip":
      return {
        icon: "airplane",
        color: "#f59e0b", // Amber
        badgeBg: "rgba(245, 158, 11, 0.15)",
        label: "Trip",
      };
    case "like":
      return {
        icon: "heart",
        color: "#f43f5e", // Rose
        badgeBg: "rgba(244, 63, 94, 0.15)",
        label: "Like",
      };
    case "feedback":
      return {
        icon: "bulb",
        color: "#eab308", // Yellow
        badgeBg: "rgba(234, 179, 8, 0.15)",
        label: "Feedback",
      };
    default:
      return {
        icon: "notifications",
        color: "#f9971f", // Bunkmates orange
        badgeBg: "rgba(249, 151, 31, 0.15)",
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
  const { themeColors, accentColor } = useThemeToggle();

  // State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Modals & Selection
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Firestore Realtime Listener
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("uid", "==", currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as NotificationItem[];

        setNotifications(data);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Notifications Firestore error:", error);
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  // Deep Link / Param Listener
  useEffect(() => {
    if (!params.notificationId || notifications.length === 0) return;
    const target = notifications.find((item) => item.id === params.notificationId);
    if (target) {
      setSelectedNotification(target);
      markAsRead(target);
    }
  }, [params.notificationId, notifications]);

  // Manual Refresh
  const handleRefresh = useCallback(() => {
    haptic("light");
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  /* ============================================================
     ACTIONS: READ, DELETE, BATCH
  ============================================================ */

  const markAsRead = async (item: NotificationItem) => {
    if (item.seen && item.read) return;
    try {
      await updateDoc(doc(db, "notifications", item.id), {
        seen: true,
        read: true,
      });
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const toggleReadStatus = async (item: NotificationItem) => {
    haptic("light");
    const nextStatus = !item.seen;
    try {
      await updateDoc(doc(db, "notifications", item.id), {
        seen: nextStatus,
        read: nextStatus,
      });
    } catch (err) {
      console.warn("Failed to toggle read status:", err);
    }
  };

  const markAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.seen);
    if (unreadItems.length === 0) return;

    haptic("medium");
    try {
      const batch = writeBatch(db);
      unreadItems.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), {
          seen: true,
          read: true,
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      Alert.alert("Error", "Could not mark all notifications as read.");
    }
  };

  const deleteSingleNotification = async (id: string) => {
    haptic("light");
    try {
      await deleteDoc(doc(db, "notifications", id));
      if (selectedNotification?.id === id) {
        setSelectedNotification(null);
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const clearAllReadNotifications = async () => {
    const readItems = notifications.filter((n) => n.seen);
    if (readItems.length === 0) {
      Alert.alert("No read notifications", "You don't have any read notifications to clear.");
      return;
    }

    Alert.alert(
      "Clear Read Notifications",
      `Are you sure you want to remove ${readItems.length} read notification(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            haptic("heavy");
            setClearing(true);
            try {
              const batch = writeBatch(db);
              readItems.forEach((item) => {
                batch.delete(doc(db, "notifications", item.id));
              });
              await batch.commit();
              setShowOptionsModal(false);
            } catch (err) {
              console.error("Failed to clear read notifications:", err);
              Alert.alert("Error", "Failed to clear read notifications.");
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  /* ============================================================
     ACTIONS: FRIEND REQUESTS
  ============================================================ */

  const handleAcceptFriendRequest = async (item: NotificationItem) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid || !item.senderId) return;

    haptic("heavy");
    try {
      await updateDoc(doc(db, "notifications", item.id), {
        status: "accepted",
        seen: true,
        read: true,
        message: "You are now friends! 🎉",
        content: "You are now friends! 🎉",
      });

      await Promise.all([
        updateDoc(doc(db, "users", currentUid), {
          friends: arrayUnion(item.senderId),
        }),
        updateDoc(doc(db, "users", item.senderId), {
          friends: arrayUnion(currentUid),
        }),
      ]);

      await setDoc(
        doc(db, "notifications", `${item.senderId}_${currentUid}_friend_accepted_${Date.now()}`),
        {
          type: "friend_accepted",
          senderId: currentUid,
          uid: item.senderId,
          title: "Friend Request Accepted",
          content: `${auth.currentUser?.displayName || "A user"} accepted your friend request.`,
          message: `${auth.currentUser?.displayName || "A user"} accepted your friend request.`,
          pic: auth.currentUser?.photoURL || "",
          seen: false,
          read: false,
          timestamp: new Date(),
        }
      );

      Alert.alert("Connected! 🎉", "You are now friends on BunkMates.");
    } catch (err) {
      console.error("Error accepting friend request:", err);
      Alert.alert("Error", "Could not accept friend request.");
    }
  };

  const handleRejectFriendRequest = async (item: NotificationItem) => {
    haptic("medium");
    try {
      await updateDoc(doc(db, "notifications", item.id), {
        status: "rejected",
        seen: true,
        read: true,
        message: "Friend request declined.",
        content: "Friend request declined.",
      });
    } catch (err) {
      console.error("Error rejecting friend request:", err);
    }
  };

  /* ============================================================
     ACTIONS: DIRECT NAVIGATION
  ============================================================ */

  const handleNotificationPress = (item: NotificationItem) => {
    haptic("light");
    markAsRead(item);

    // If item has a direct target route or type:
    if (item.type === "chat" && item.senderId) {
      router.push({
        pathname: `/chat/${item.senderId}` as any,
        params: {
          displayName: item.title || item.senderName || "Chat",
          photoURL: item.pic || "",
        },
      });
      return;
    }

    if (item.type === "group_chat" && item.groupId) {
      router.push({
        pathname: `/chat/${item.groupId}` as any,
        params: {
          displayName: item.title || item.groupName || "Group Chat",
          isGroup: "true",
        },
      });
      return;
    }

    if (item.type === "missed_call" && item.senderId) {
      // Prompt callback or open detail
      setSelectedNotification(item);
      return;
    }

    if (item.type === "friend_request") {
      setSelectedNotification(item);
      return;
    }

    // Default: open the full detail sheet
    setSelectedNotification(item);
  };

  /* ============================================================
     FILTERING & GROUPING
  ============================================================ */

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.seen).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // 1. Category Filter
    if (activeCategory === "unread") {
      result = result.filter((n) => !n.seen);
    } else if (activeCategory === "messages") {
      result = result.filter((n) => n.type === "chat" || n.type === "group_chat");
    } else if (activeCategory === "calls") {
      result = result.filter((n) => n.type === "call" || n.type === "missed_call");
    } else if (activeCategory === "requests") {
      result = result.filter((n) => n.type === "friend_request" || n.type === "friend_accepted");
    } else if (activeCategory === "system") {
      result = result.filter((n) =>
        ["system", "feedback", "like", "trip"].includes(n.type || "")
      );
    }

    // 2. Search Query Filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((n) => {
        const title = (n.title || "").toLowerCase();
        const content = (n.content || n.message || "").toLowerCase();
        const sender = (n.senderName || "").toLowerCase();
        return title.includes(q) || content.includes(q) || sender.includes(q);
      });
    }

    return result;
  }, [notifications, activeCategory, searchQuery]);

  // Group by Date sections ("Today", "Yesterday", "This Week", "Earlier")
  const groupedSections = useMemo(() => {
    const sections: { title: string; data: NotificationItem[] }[] = [];
    const sectionMap = new Map<string, NotificationItem[]>();

    const order = ["Today", "Yesterday", "This Week", "Earlier"];
    order.forEach((sec) => sectionMap.set(sec, []));

    filteredNotifications.forEach((item) => {
      const sec = getDateSection(item.timestamp);
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(item);
    });

    order.forEach((title) => {
      const items = sectionMap.get(title) || [];
      if (items.length > 0) {
        sections.push({ title, data: items });
      }
    });

    return sections;
  }, [filteredNotifications]);

  /* ============================================================
     RENDER
  ============================================================ */

  const activeAccent = "#ffffff";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#09090b" }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* 1. TOP HEADER BAR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              haptic("light");
              router.back();
            }}
            style={styles.circleIconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadCountPill, { backgroundColor: "#ffffff" }]}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              haptic("light");
              setSearchOpen(!searchOpen);
              if (searchOpen) setSearchQuery("");
            }}
            style={[
              styles.circleIconButton,
              searchOpen && { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "#ffffff" },
            ]}
            activeOpacity={0.7}
          >
            <Ionicons name={searchOpen ? "close" : "search"} size={18} color="#ffffff" />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={[styles.actionPillButton, { borderColor: "rgba(255, 255, 255, 0.25)" }]}
              activeOpacity={0.75}
            >
              <Ionicons name="checkmark-done" size={15} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={[styles.actionPillText, { color: "#ffffff" }]}>Read All</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              haptic("light");
              setShowOptionsModal(true);
            }}
            style={styles.circleIconButton}
            activeOpacity={0.7}
          >
            <Feather name="more-horizontal" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. EXPANDABLE SEARCH BAR */}
      {searchOpen && (
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBarInner}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search notifications or senders..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              autoFocus
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* 3. CATEGORY PILL FILTER CHIPS */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          <CategoryChip
            label="All"
            icon="layers-outline"
            count={notifications.length}
            active={activeCategory === "all"}
            accent={activeAccent}
            onPress={() => {
              haptic("light");
              setActiveCategory("all");
            }}
          />
          <CategoryChip
            label="Unread"
            icon="ellipse"
            count={unreadCount}
            active={activeCategory === "unread"}
            accent={activeAccent}
            highlight={unreadCount > 0}
            onPress={() => {
              haptic("light");
              setActiveCategory("unread");
            }}
          />
          <CategoryChip
            label="Messages"
            icon="chatbubbles-outline"
            active={activeCategory === "messages"}
            accent={activeAccent}
            onPress={() => {
              haptic("light");
              setActiveCategory("messages");
            }}
          />
          <CategoryChip
            label="Calls"
            icon="call-outline"
            active={activeCategory === "calls"}
            accent={activeAccent}
            onPress={() => {
              haptic("light");
              setActiveCategory("calls");
            }}
          />
          <CategoryChip
            label="Requests"
            icon="person-add-outline"
            active={activeCategory === "requests"}
            accent={activeAccent}
            onPress={() => {
              haptic("light");
              setActiveCategory("requests");
            }}
          />
          <CategoryChip
            label="System"
            icon="notifications-outline"
            active={activeCategory === "system"}
            accent={activeAccent}
            onPress={() => {
              haptic("light");
              setActiveCategory("system");
            }}
          />
        </ScrollView>
      </View>

      {/* 4. UNREAD STATUS QUICK BANNER */}
      {unreadCount > 0 && activeCategory !== "unread" && (
        <View style={styles.unreadBannerContainer}>
          <View style={[styles.unreadBanner, { borderColor: "rgba(255,255,255,0.12)" }]}>
            <View style={styles.unreadBannerLeft}>
              <View style={[styles.pulseDot, { backgroundColor: "#ffffff" }]} />
              <Text style={styles.unreadBannerText}>
                <Text style={{ fontWeight: "800", color: "#ffffff" }}>{unreadCount} unread</Text> notification
                {unreadCount > 1 ? "s" : ""}
              </Text>
            </View>
            <TouchableOpacity
              onPress={markAllAsRead}
              activeOpacity={0.7}
              style={[styles.bannerActionBtn, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}
            >
              <Text style={[styles.bannerActionText, { color: "#ffffff" }]}>Mark all read</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. NOTIFICATION LIST CONTENT */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={activeAccent} />
          <Text style={styles.loadingSubtitle}>Fetching your alerts...</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={activeAccent} />}
        >
          <View style={styles.emptyGlowCircle}>
            <Ionicons name="notifications-off-outline" size={38} color="rgba(255,255,255,0.4)" />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery
              ? "No matching alerts"
              : activeCategory === "unread"
              ? "You're all caught up! ✨"
              : "No notifications yet"}
          </Text>
          <Text style={styles.emptyDescription}>
            {searchQuery
              ? `No alerts found for "${searchQuery}". Try a different keyword.`
              : activeCategory === "unread"
              ? "Zero unread alerts remaining. New messages, calls, and invites will appear here."
              : "When your bunkmates message, call, or invite you to trips, they'll show up right here."}
          </Text>

          {activeCategory !== "all" && (
            <TouchableOpacity
              style={[styles.emptyResetBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              onPress={() => {
                haptic("light");
                setActiveCategory("all");
                setSearchQuery("");
              }}
            >
              <Text style={styles.emptyResetText}>View All Notifications</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listScrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={activeAccent} />}
        >
          {groupedSections.map((section) => (
            <View key={section.title} style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                <View style={styles.sectionDivider} />
              </View>

              {section.data.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  accent={activeAccent}
                  onPress={() => handleNotificationPress(item)}
                  onToggleRead={() => toggleReadStatus(item)}
                  onDelete={() => deleteSingleNotification(item.id)}
                  onAccept={() => handleAcceptFriendRequest(item)}
                  onReject={() => handleRejectFriendRequest(item)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* 6. DETAIL BOTTOM SHEET MODAL */}
      <Modal
        visible={Boolean(selectedNotification)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        {selectedNotification && (
          <NotificationDetailSheet
            item={selectedNotification}
            accent={activeAccent}
            onClose={() => setSelectedNotification(null)}
            onAccept={() => handleAcceptFriendRequest(selectedNotification)}
            onReject={() => handleRejectFriendRequest(selectedNotification)}
            onDelete={() => deleteSingleNotification(selectedNotification.id)}
            onToggleRead={() => toggleReadStatus(selectedNotification)}
            onOpenTarget={() => {
              const item = selectedNotification;
              setSelectedNotification(null);
              if (item.type === "chat" && item.senderId) {
                router.push({
                  pathname: `/chat/${item.senderId}` as any,
                  params: {
                    displayName: item.title || item.senderName || "Chat",
                    photoURL: item.pic || "",
                  },
                });
              } else if (item.type === "group_chat" && item.groupId) {
                router.push({
                  pathname: `/chat/${item.groupId}` as any,
                  params: { displayName: item.title || item.groupName || "Group Chat", isGroup: "true" },
                });
              } else if (item.tripId) {
                router.push(`/trips/${item.tripId}` as any);
              }
            }}
          />
        )}
      </Modal>

      {/* 7. MORE OPTIONS / MANAGEMENT MODAL */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.optionsPopup}>
            <View style={styles.optionsHandle} />
            <Text style={styles.optionsTitle}>Notification Options</Text>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setShowOptionsModal(false);
                markAllAsRead();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "rgba(255, 255, 255, 0.12)" }]}>
                <Ionicons name="checkmark-done" size={20} color="#ffffff" />
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionRowTitle}>Mark All as Read</Text>
                <Text style={styles.optionRowSubtitle}>Clear all unread notification badges</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setShowOptionsModal(false);
                clearAllReadNotifications();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionRowTitle}>Clear Read Alerts</Text>
                <Text style={styles.optionRowSubtitle}>Remove all opened notifications from list</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setShowOptionsModal(false);
                router.push("/general-settings" as any);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "rgba(255, 255, 255, 0.08)" }]}>
                <Ionicons name="settings-outline" size={20} color="#ffffff" />
              </View>
              <View style={styles.optionTextBox}>
                <Text style={styles.optionRowTitle}>Alert & Sound Settings</Text>
                <Text style={styles.optionRowSubtitle}>Configure app ringtone, vibration, and push</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionsCloseBtn}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionsCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   COMPONENT: CATEGORY CHIP
============================================================ */

function CategoryChip({
  label,
  icon,
  count,
  active,
  accent,
  highlight,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  active: boolean;
  accent: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryChip,
        active && styles.categoryChipActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={13}
        color={active ? "#000000" : highlight ? "#ffffff" : "rgba(255,255,255,0.65)"}
        style={{ marginRight: 6 }}
      />
      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{label}</Text>
      {typeof count === "number" && count > 0 && (
        <View
          style={[
            styles.chipBadge,
            active ? styles.chipBadgeActive : styles.chipBadgeInactive,
          ]}
        >
          <Text style={[styles.chipBadgeText, { color: active ? "#ffffff" : "#ffffff" }]}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/* ============================================================
   COMPONENT: NOTIFICATION CARD
============================================================ */

function NotificationCard({
  item,
  accent,
  onPress,
  onToggleRead,
  onDelete,
  onAccept,
  onReject,
}: {
  item: NotificationItem;
  accent: string;
  onPress: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isUnread = !item.seen;
  const typeConfig = getTypeConfig(item.type);
  const isFriendRequest = item.type === "friend_request";
  const isPendingRequest = isFriendRequest && item.status !== "accepted" && item.status !== "rejected";
  const cleanBody = stripHtml(item.content || item.message || "New activity notification");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        isUnread && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Left Active Glow Indicator Strip */}
      {isUnread && <View style={[styles.unreadStrip, { backgroundColor: "#ffffff" }]} />}

      {/* Avatar Container with Type Badge */}
      <View style={styles.avatarWrapper}>
        {item.pic ? (
          <Image source={{ uri: item.pic }} style={styles.cardAvatar} />
        ) : (
          <View style={[styles.cardAvatarFallback, { backgroundColor: typeConfig.badgeBg }]}>
            <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
          </View>
        )}

        {/* Small floating corner icon */}
        <View style={[styles.avatarMiniBadge, { backgroundColor: typeConfig.color }]}>
          <Ionicons
            name={typeConfig.icon}
            size={10}
            color={typeConfig.color === "#ffffff" ? "#000000" : "#ffffff"}
          />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text numberOfLines={1} style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
            {item.title || item.senderName || typeConfig.label}
          </Text>
          <Text style={styles.cardTimeText}>{formatRelativeTime(item.timestamp)}</Text>
        </View>

        <Text numberOfLines={2} style={[styles.cardMessage, isUnread && styles.cardMessageUnread]}>
          {cleanBody}
        </Text>

        {/* Interactive action row for Friend Requests */}
        {isPendingRequest ? (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              style={[styles.primaryActionBtn, { backgroundColor: "#ffffff" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={14} color="#000000" style={{ marginRight: 4 }} />
              <Text style={[styles.primaryActionText, { color: "#000000" }]}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onReject();
              }}
              style={styles.secondaryActionBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={14} color="#ff6b6b" style={{ marginRight: 4 }} />
              <Text style={styles.secondaryActionText}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : item.type === "chat" && isUnread ? (
          <View style={styles.inlineActionHint}>
            <Ionicons name="return-down-forward" size={13} color="#38bdf8" style={{ marginRight: 4 }} />
            <Text style={[styles.inlineActionText, { color: "#38bdf8" }]}>Tap to reply</Text>
          </View>
        ) : item.type === "missed_call" ? (
          <View style={styles.inlineActionHint}>
            <Ionicons name="call" size={12} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={[styles.inlineActionText, { color: "#ffffff" }]}>Missed call • Tap to callback</Text>
          </View>
        ) : null}
      </View>

      {/* Right Quick Actions (Read indicator / Delete) */}
      <View style={styles.cardRightActions}>
        {isUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: "#ffffff" }]} />
        ) : (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.cardDeleteIcon}
          >
            <Ionicons name="close-circle-outline" size={17} color="rgba(255,255,255,0.25)" />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
}

/* ============================================================
   COMPONENT: NOTIFICATION DETAIL SHEET (MODAL)
============================================================ */

function NotificationDetailSheet({
  item,
  accent,
  onClose,
  onAccept,
  onReject,
  onDelete,
  onToggleRead,
  onOpenTarget,
}: {
  item: NotificationItem;
  accent: string;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onOpenTarget: () => void;
}) {
  const typeConfig = getTypeConfig(item.type);
  const cleanBody = stripHtml(item.content || item.message || "No content provided");
  const isPendingRequest = item.type === "friend_request" && item.status !== "accepted" && item.status !== "rejected";

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />

      <View style={styles.detailSheetContainer}>
        {/* Top Drag Indicator */}
        <View style={styles.sheetHandleBar} />

        {/* Header Row */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderAvatarRow}>
            {item.pic ? (
              <Image source={{ uri: item.pic }} style={styles.sheetAvatar} />
            ) : (
              <View style={[styles.sheetAvatarFallback, { backgroundColor: typeConfig.badgeBg }]}>
                <Ionicons name={typeConfig.icon} size={26} color={typeConfig.color} />
              </View>
            )}

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.sheetSenderName} numberOfLines={1}>
                  {item.title || item.senderName || "BunkMates Alert"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                <View style={[styles.sheetTypeBadge, { backgroundColor: typeConfig.badgeBg }]}>
                  <Ionicons name={typeConfig.icon} size={11} color={typeConfig.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.sheetTypeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
                </View>
                <Text style={styles.sheetTimeText}>• {formatRelativeTime(item.timestamp)}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.sheetCloseButton}>
            <Ionicons name="close" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Timestamp Meta */}
        <View style={styles.exactTimeBox}>
          <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.4)" style={{ marginRight: 6 }} />
          <Text style={styles.exactTimeText}>{formatExactDateTime(item.timestamp)}</Text>
        </View>

        {/* Message Content Box */}
        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetMessageText}>{cleanBody}</Text>

          {/* Action Box for Requests */}
          {isPendingRequest && (
            <View style={styles.sheetRequestActions}>
              <TouchableOpacity
                onPress={() => {
                  onAccept();
                  onClose();
                }}
                style={[styles.sheetAcceptBtn, { backgroundColor: "#ffffff" }]}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#000000" style={{ marginRight: 6 }} />
                <Text style={[styles.sheetActionBtnText, { color: "#000000" }]}>Accept Friend Request</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onReject();
                  onClose();
                }}
                style={styles.sheetRejectBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={18} color="#ff6b6b" style={{ marginRight: 6 }} />
                <Text style={[styles.sheetActionBtnText, { color: "#ff6b6b" }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick CTA to Chat or Calls */}
          {item.type === "chat" && item.senderId && (
            <TouchableOpacity
              onPress={onOpenTarget}
              style={[styles.sheetPrimaryCta, { backgroundColor: "#0284c7" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble" size={17} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.sheetPrimaryCtaText}>Open Conversation</Text>
            </TouchableOpacity>
          )}

          {item.type === "missed_call" && item.senderId && (
            <TouchableOpacity
              onPress={onOpenTarget}
              style={[styles.sheetPrimaryCta, { backgroundColor: "#ffffff" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={17} color="#000000" style={{ marginRight: 8 }} />
              <Text style={[styles.sheetPrimaryCtaText, { color: "#000000" }]}>Call Back</Text>
            </TouchableOpacity>
          )}

          {item.tripId && (
            <TouchableOpacity
              onPress={onOpenTarget}
              style={[styles.sheetPrimaryCta, { backgroundColor: "#ffffff" }]}
              activeOpacity={0.8}
            >
              <Ionicons name="airplane" size={17} color="#000000" style={{ marginRight: 8 }} />
              <Text style={[styles.sheetPrimaryCtaText, { color: "#000000" }]}>View Trip Details</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.sheetFooter}>
          <TouchableOpacity
            onPress={() => {
              onToggleRead();
            }}
            style={styles.sheetSecondaryBtn}
          >
            <Ionicons
              name={item.seen ? "mail-unread-outline" : "checkmark-circle-outline"}
              size={16}
              color="rgba(255,255,255,0.7)"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sheetSecondaryBtnText}>
              {item.seen ? "Mark Unread" : "Mark as Read"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onDelete();
              onClose();
            }}
            style={[styles.sheetSecondaryBtn, { borderColor: "rgba(239,68,68,0.3)" }]}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={[styles.sheetSecondaryBtnText, { color: "#ef4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Header */
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  unreadCountPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadCountText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "900",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionPillButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* Search Bar */
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchBarInner: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    paddingVertical: 0,
  },

  /* Filters */
  filtersWrapper: {
    paddingVertical: 10,
  },
  filtersScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  categoryChipActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  categoryChipText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    marginLeft: 6,
  },
  chipBadgeActive: {
    backgroundColor: "#000000",
  },
  chipBadgeInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },

  /* Unread Quick Banner */
  unreadBannerContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  unreadBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unreadBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  unreadBannerText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12.5,
  },
  bannerActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bannerActionText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* List & Sections */
  listScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 6,
  },
  sectionTitle: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginRight: 10,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  /* Notification Card */
  cardContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(22, 22, 26, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    position: "relative",
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: "rgba(30, 30, 36, 0.95)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  unreadStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#202024",
  },
  cardAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
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
    borderWidth: 1.5,
    borderColor: "#09090b",
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
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    marginRight: 8,
  },
  cardTitleUnread: {
    fontWeight: "800",
    color: "#ffffff",
  },
  cardTimeText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "500",
  },
  cardMessage: {
    fontSize: 12.5,
    lineHeight: 17,
    color: "rgba(255, 255, 255, 0.55)",
  },
  cardMessageUnread: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  cardRightActions: {
    marginLeft: 6,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 2,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardDeleteIcon: {
    padding: 2,
  },

  /* In-card Action Buttons */
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  primaryActionText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  secondaryActionText: {
    color: "#ff6b6b",
    fontSize: 11,
    fontWeight: "700",
  },
  inlineActionHint: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  inlineActionText: {
    fontSize: 11.5,
    fontWeight: "600",
  },

  /* Empty State */
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginTop: 12,
    fontWeight: "600",
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
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    marginTop: 8,
  },
  emptyResetBtn: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyResetText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },

  /* Detail Bottom Sheet */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  detailSheetContainer: {
    backgroundColor: "#121216",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxHeight: "85%",
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  sheetHeaderAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  sheetAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#202024",
  },
  sheetAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSenderName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
  },
  sheetTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  sheetTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sheetTimeText: {
    fontSize: 11.5,
    color: "rgba(255, 255, 255, 0.4)",
    marginLeft: 6,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  exactTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  exactTimeText: {
    fontSize: 11.5,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "500",
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.88)",
  },
  sheetRequestActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  sheetAcceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
  },
  sheetRejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  sheetActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  sheetPrimaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 23,
    marginTop: 20,
    backgroundColor: "#ffffff",
  },
  sheetPrimaryCtaText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },
  sheetFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  sheetSecondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetSecondaryBtnText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12.5,
    fontWeight: "600",
  },

  /* Options Popup Modal */
  optionsPopup: {
    backgroundColor: "#16161b",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    marginTop: "auto",
  },
  optionsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 14,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionTextBox: {
    flex: 1,
  },
  optionRowTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#ffffff",
  },
  optionRowSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
    marginTop: 2,
  },
  optionsCloseBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  optionsCloseText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
