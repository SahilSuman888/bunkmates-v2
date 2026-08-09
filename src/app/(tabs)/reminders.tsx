import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  TextInput,
  Modal,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Feather, Ionicons } from "@expo/vector-icons";

interface ReminderItem {
  id: string;
  text: string;
  date: string;
  time: string;
  completed: boolean;
  createdAt: any;
  uid: string;
}

export default function RemindersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Form Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [formText, setFormText] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");

  const formatDateDefault = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatTimeDefault = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // Realtime Firestore subscription matching bunk-mates-master Reminders.js
  useEffect(() => {
    if (authLoading || !user) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "reminders"), where("uid", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ReminderItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          let dateStr = typeof data.date === "string" ? data.date : "";
          let timeStr = typeof data.time === "string" ? data.time : "";

          if (!dateStr && data.date?.toDate) {
            dateStr = formatDateDefault(data.date.toDate());
          }

          list.push({
            id: docSnap.id,
            text: data.text || "Reminder",
            date: dateStr || formatDateDefault(new Date()),
            time: timeStr || "10:00",
            completed: data.completed || false,
            createdAt: data.createdAt || null,
            uid: data.uid || user.uid,
          });
        });

        setReminders(list);
        setLoading(false);
      },
      (err) => {
        console.log("Reminders query error:", err);
        setReminders([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Grouping into Active, Past (Overdue), and Completed matching bunk-mates-master Reminders.js
  const groupedReminders = useMemo(() => {
    const past: ReminderItem[] = [];
    const active: ReminderItem[] = [];
    const completed: ReminderItem[] = [];
    const now = new Date();

    reminders.forEach((r) => {
      const matchesSearch = r.text
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());

      if (matchesSearch) {
        if (r.completed) {
          completed.push(r);
        } else {
          const rDateStr = r.date || formatDateDefault(now);
          const rTimeStr = r.time || "00:00";
          const rDateTime = new Date(`${rDateStr}T${rTimeStr}:00`);

          if (rDateTime < now) {
            past.push(r);
          } else {
            active.push(r);
          }
        }
      }
    });

    active.sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}:00`).getTime();
      const dbTime = new Date(`${b.date}T${b.time}:00`).getTime();
      return da - dbTime;
    });

    past.sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}:00`).getTime();
      const dbTime = new Date(`${b.date}T${b.time}:00`).getTime();
      return da - dbTime;
    });

    completed.sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dbTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return dbTime - da;
    });

    return { active, past, completed };
  }, [reminders, searchQuery]);

  // Form Handlers
  const handleOpenForm = (item?: ReminderItem) => {
    if (item) {
      setEditingReminder(item);
      setFormText(item.text);
      setFormDate(item.date);
      setFormTime(item.time);
    } else {
      setEditingReminder(null);
      setFormText("");
      setFormDate(formatDateDefault(new Date()));
      setFormTime(formatTimeDefault(new Date()));
    }
    setModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!user || !formText.trim() || !formDate.trim() || !formTime.trim()) {
      Alert.alert("Required", "Please fill in all reminder fields.");
      return;
    }

    try {
      if (editingReminder) {
        await updateDoc(doc(db, "reminders", editingReminder.id), {
          text: formText.trim(),
          date: formDate.trim(),
          time: formTime.trim(),
        });
      } else {
        await addDoc(collection(db, "reminders"), {
          text: formText.trim(),
          date: formDate.trim(),
          time: formTime.trim(),
          completed: false,
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      setModalOpen(false);
    } catch (e: any) {
      console.log("Error saving reminder:", e);
      Alert.alert("Error", e.message || "Failed to save reminder.");
    }
  };

  const handleToggleComplete = async (id: string, status: boolean) => {
    try {
      await updateDoc(doc(db, "reminders", id), {
        completed: !status,
      });
    } catch (e) {
      console.log("Toggle complete error:", e);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Reminder", "Are you sure you want to delete this reminder?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "reminders", id));
          } catch (e) {
            console.log("Delete error:", e);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Reminders</Text>
            <Text style={styles.headerSubtitle}>
              {groupedReminders.active.length} Active • {groupedReminders.past.length} Overdue
            </Text>
          </View>
          <Pressable onPress={() => handleOpenForm()} style={styles.headerAddBtn}>
            <Ionicons name="add" size={22} color="#000000" />
          </Pressable>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBar}>
          <Feather name="search" size={17} color="#888" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search reminders..."
            placeholderTextColor="#666"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#888" />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00e6b0" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
            {/* ACTIVE REMINDERS */}
            <Text style={styles.sectionHeader}>UPCOMING & ACTIVE</Text>
            {groupedReminders.active.length > 0 ? (
              groupedReminders.active.map((item) => (
                <View key={item.id} style={styles.reminderCard}>
                  <Pressable
                    onPress={() => handleToggleComplete(item.id, item.completed)}
                    style={styles.checkbox}
                  >
                    <Ionicons name="ellipse-outline" size={22} color="#00e6b0" />
                  </Pressable>

                  <Pressable onPress={() => handleOpenForm(item)} style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.reminderText}>{item.text}</Text>
                    <View style={styles.tagRow}>
                      <View style={styles.timeTag}>
                        <Ionicons name="time-outline" size={12} color="#00e6b0" />
                        <Text style={styles.timeTagText}>
                          {item.date} • {item.time}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={18} color="#888888" />
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={{ color: "#666", fontSize: 12 }}>No active reminders right now ✨</Text>
              </View>
            )}

            {/* OVERDUE / PAST REMINDERS ACCORDION */}
            {groupedReminders.past.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => setShowPast(!showPast)}
                  style={styles.accordionHeader}
                >
                  <Text style={styles.accordionTitle}>
                    OVERDUE ({groupedReminders.past.length})
                  </Text>
                  <Ionicons
                    name={showPast ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#ff4757"
                  />
                </Pressable>

                {showPast &&
                  groupedReminders.past.map((item) => (
                    <View key={item.id} style={[styles.reminderCard, styles.pastCard]}>
                      <Pressable
                        onPress={() => handleToggleComplete(item.id, item.completed)}
                        style={styles.checkbox}
                      >
                        <Ionicons name="alert-circle" size={22} color="#ff4757" />
                      </Pressable>

                      <Pressable onPress={() => handleOpenForm(item)} style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.reminderText}>{item.text}</Text>
                        <View style={styles.tagRow}>
                          <View style={[styles.timeTag, { backgroundColor: "rgba(255,71,87,0.12)" }]}>
                            <Ionicons name="time-outline" size={12} color="#ff4757" />
                            <Text style={[styles.timeTagText, { color: "#ff4757" }]}>
                              {item.date} • {item.time} (Overdue)
                            </Text>
                          </View>
                        </View>
                      </Pressable>

                      <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color="#888888" />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}

            {/* COMPLETED REMINDERS ACCORDION */}
            {groupedReminders.completed.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Pressable
                  onPress={() => setShowCompleted(!showCompleted)}
                  style={styles.accordionHeader}
                >
                  <Text style={styles.accordionTitle}>
                    COMPLETED ({groupedReminders.completed.length})
                  </Text>
                  <Ionicons
                    name={showCompleted ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#888888"
                  />
                </Pressable>

                {showCompleted &&
                  groupedReminders.completed.map((item) => (
                    <View key={item.id} style={[styles.reminderCard, { opacity: 0.6 }]}>
                      <Pressable
                        onPress={() => handleToggleComplete(item.id, item.completed)}
                        style={styles.checkbox}
                      >
                        <Ionicons name="checkmark-circle" size={22} color="#00e6b0" />
                      </Pressable>

                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={[styles.reminderText, styles.completedText]}>
                          {item.text}
                        </Text>
                      </View>

                      <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color="#888888" />
                      </Pressable>
                    </View>
                  ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* ADD / EDIT REMINDER MODAL */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalOpen}
          onRequestClose={() => setModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingReminder ? "Edit Reminder" : "Add New Reminder"}
                </Text>
                <Pressable onPress={() => setModalOpen(false)}>
                  <Ionicons name="close" size={22} color="#ffffff" />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Reminder Note</Text>
              <TextInput
                value={formText}
                onChangeText={setFormText}
                placeholder="What do you need to remember?"
                placeholderTextColor="#666"
                style={styles.formInput}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={formDate}
                    onChangeText={setFormDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#666"
                    style={styles.formInput}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Time (HH:mm)</Text>
                  <TextInput
                    value={formTime}
                    onChangeText={setFormTime}
                    placeholder="HH:mm"
                    placeholderTextColor="#666"
                    style={styles.formInput}
                  />
                </View>
              </View>

              <Pressable onPress={handleSaveForm} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save Reminder</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#1e1e24",
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e1e24",
  },
  pastCard: {
    borderColor: "rgba(255,71,87,0.3)",
    backgroundColor: "rgba(255,71,87,0.05)",
  },
  checkbox: {
    marginRight: 12,
  },
  reminderText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  completedText: {
    textDecorationLine: "line-through",
    color: "#888888",
  },
  tagRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,230,176,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeTagText: {
    color: "#00e6b0",
    fontSize: 10,
    fontWeight: "700",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  accordionTitle: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  emptyCard: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "#0d0d0f",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a1a1e",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    backgroundColor: "#121214",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#25252e",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  fieldLabel: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  formInput: {
    height: 44,
    backgroundColor: "#18181c",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#ffffff",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#282832",
    marginBottom: 12,
  },
  saveBtn: {
    height: 46,
    backgroundColor: "#00e6b0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: {
    color: "#00140f",
    fontSize: 14,
    fontWeight: "800",
  },
});
