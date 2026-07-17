import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Switch,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

import { db, auth } from "../lib/firebase";

function formatDateLabel(timestamp: any) {
  if (!timestamp?.toDate) return "UNKNOWN";
  const date = timestamp.toDate();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSame(date, today)) return "TODAY";
  if (isSame(date, yesterday)) return "YESTERDAY";
  return date.toLocaleDateString().toUpperCase();
}

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [prefs, setPrefs] = useState({ chat: true, friends: true, alerts: true });
  
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubNotif = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubNotif;
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.seen).length, [notifications]);

  // Updated Filter Logic
  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unreads") return notifications.filter((n) => !n.seen);
    if (filter === "chat") return notifications.filter((n) => n.type === "chat");
    return notifications;
  }, [notifications, filter]);

  const groupedByDate = useMemo(() => {
    const groups: any = {};
    filtered.forEach((n) => {
      const date = formatDateLabel(n.timestamp);
      if (!groups[date]) groups[date] = [];
      groups[date].push(n);
    });
    return groups;
  }, [filtered]);

  // Navigation Logic
  const handleNotificationPress = async (item: any) => {
    // 1. Mark as read immediately
    if (!item.seen) {
      await updateDoc(doc(db, "notifications", item.id), { seen: true });
    }

    // 2. Route based on type
    if (item.type === "chat") {
      // Navigate to chat page with the sender's ID
      router.push(`/chat/${item.senderId}`);
    } else if (item.type === "friend_request") {
      router.push("/friends");
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.seen).forEach(n => batch.update(doc(db, "notifications", n.id), { seen: true }));
    await batch.commit();
  };

  const confirmClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert("Clear All?", "Remove all notifications permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => {
          const batch = writeBatch(db);
          notifications.forEach(n => batch.delete(doc(db, "notifications", n.id)));
          await batch.commit();
      }}
    ]);
  };

  const deleteNotif = async (id: string) => deleteDoc(doc(db, "notifications", id));

  const renderLeftActions = (progress: any, dragX: any, item: any) => {
    const trans = dragX.interpolate({ inputRange: [0, 80], outputRange: [-20, 0] });
    return (
      <TouchableOpacity onPress={() => updateDoc(doc(db, "notifications", item.id), { seen: true })} style={styles.readAction}>
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <Ionicons name="checkmark-done" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderRightActions = (progress: any, dragX: any, id: string) => {
    const trans = dragX.interpolate({ inputRange: [-80, 0], outputRange: [0, 20] });
    return (
      <TouchableOpacity onPress={() => deleteNotif(id)} style={styles.deleteAction}>
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <Ionicons name="trash" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#ff6b3d" /></View>;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={confirmClearAll}><Ionicons name="trash-outline" size={22} color="#ff3b30" /></TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)}><Ionicons name="settings-outline" size={22} color="#fff" /></TouchableOpacity>
          </View>
        </View>

        {/* UPDATED FILTERS */}
        <View style={styles.filters}>
          {["all", "unreads", "chat"].map((f) => (
            <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.activeChip]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && styles.activeChipText]}>{f.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={Object.keys(groupedByDate)}
          keyExtractor={(i) => i}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b3d" />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No notifications here.</Text></View>}
          renderItem={({ item: date }) => (
            <View>
              <Text style={styles.sectionLabel}>{date}</Text>
              {groupedByDate[date].map((item: any) => (
                <Swipeable key={item.id} renderLeftActions={(p, d) => renderLeftActions(p, d, item)} renderRightActions={(p, d) => renderRightActions(p, d, item.id)}>
                  <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => handleNotificationPress(item)}
                    style={[styles.card, !item.seen && styles.unreadCard]}
                  >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(item.title || "N")[0]}</Text>
                        {item.type === 'chat' && <View style={styles.chatIconBadge}><Ionicons name="chatbubble" size={10} color="#fff" /></View>}
                    </View>
                    <View style={styles.content}>
                      <Text style={[styles.title, !item.seen && styles.boldText]}>{item.title}</Text>
                      <Text style={styles.message} numberOfLines={1}>{item.content || item.message}</Text>
                    </View>
                    <View style={styles.meta}>
                      <Text style={styles.time}>{item.timestamp?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      {!item.seen && <View style={styles.dot} />}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </View>
          )}
        />

        {/* MODAL SETTINGS (Same as before) */}
        <Modal visible={settingsVisible} animationType="slide" transparent>
           {/* ... Settings implementation ... */}
           <View style={styles.modalOverlay}>
              <View style={styles.settingsBox}>
                  <TouchableOpacity onPress={() => setSettingsVisible(false)} style={{alignSelf: 'flex-end'}}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={styles.modalTitle}>Preferences</Text>
                  <View style={styles.settingRow}><Text style={styles.settingLabel}>Chat Notifications</Text><Switch value={prefs.chat} trackColor={{true: '#ff6b3d'}} /></View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSettingsVisible(false)}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
              </View>
           </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#000' },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 60, marginBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  headerIcons: { flexDirection: "row", gap: 15, alignItems: "center" },
  filters: { flexDirection: "row", marginBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a", marginRight: 10 },
  activeChip: { backgroundColor: "#ff6b3d" },
  chipText: { color: "#888", fontWeight: "600", fontSize: 12 },
  activeChipText: { color: "#000" },
  sectionLabel: { color: "#444", fontSize: 11, fontWeight: "800", marginTop: 20, marginBottom: 10, textTransform: "uppercase" },
  card: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#0f0f0f", borderRadius: 16, marginBottom: 8 },
  unreadCard: { backgroundColor: "#141414", borderLeftWidth: 3, borderLeftColor: '#ff6b3d' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#222", justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  chatIconBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#007aff', borderRadius: 10, padding: 3, borderWidth: 2, borderColor: '#000' },
  content: { flex: 1 },
  title: { color: "#ccc", fontSize: 15, marginBottom: 2 },
  boldText: { fontWeight: "800", color: "#fff" },
  message: { color: "#777", fontSize: 13 },
  meta: { alignItems: "flex-end", gap: 8 },
  time: { color: "#555", fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff6b3d" },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#444', fontSize: 16 },
  readAction: { backgroundColor: "#007aff", justifyContent: "center", alignItems: "center", width: 70, borderRadius: 16, marginBottom: 8 },
  deleteAction: { backgroundColor: "#ff3b30", justifyContent: "center", alignItems: "center", width: 70, borderRadius: 16, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  settingsBox: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 50 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingLabel: { color: '#ccc', fontSize: 16 },
  closeBtn: { backgroundColor: '#ff6b3d', padding: 15, borderRadius: 15, alignItems: 'center' },
  btnText: { fontWeight: 'bold' }
});