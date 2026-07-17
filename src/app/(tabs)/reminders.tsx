import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Pressable,
  FlatList,
  Text,
  TextInput,
  Modal,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { getTheme } from "../../theme/theme";
import { useNotifications } from "../../hooks/useNotifications";
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
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "../reanimatedShim";
// ...existing code...
import { MotiView } from "moti";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width } = Dimensions.get("window");

interface Reminder {
  id: string;
  text: string;
  date: Date;
  time: string;
  completed: boolean;
  createdAt: any;
  userId: string;
  recurring?: string; // "none" | "daily" | "weekly"
}

export default function RemindersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { mode } = useThemeToggle();
  const theme = getTheme(mode);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // local loading toggles while we're waiting for the first snapshot
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [searchText, setSearchText] = useState("");
  const { expoPushToken } = useNotifications();
  // notification state is tracked by useNotifications hook; no local copy needed

  // Form states
  const [reminderText, setReminderText] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);


  // ═══════════════════════════════════════════════════════════════
  // 2. FETCH REMINDERS
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (authLoading || !user) {
      // when user is not ready we don't need the spinner anymore, auth
      // spinner is handled by authLoading itself above
      setLoading(false);
      return;
    }

    setLoading(true);

    // we filter using the same `uid` field used elsewhere (home.tsx, createReminder).
    // older docs may have used `userId`, but every new reminder writes both fields.
    // if you need to support legacy data you can switch to an OR query or
    // run two snapshots and merge the results.
    const remindersQuery = query(
      collection(db, "reminders"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(remindersQuery, (snapshot) => {
      const fetchedReminders: Reminder[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const reminderDate = data.date?.toDate?.() || new Date(data.date);
        
        fetchedReminders.push({
          id: doc.id,
          text: data.text || "Reminder",
          date: reminderDate,
          time: data.time || "10:00",
          completed: data.completed || false,
          createdAt: data.createdAt,
          userId: data.userId || data.uid, // backwards compatibility
          // priority field removed, ignore older values if any
          recurring: data.recurring || "none",
        });
      });

      // Sort by date (upcoming first)
      fetchedReminders.sort((a, b) => a.date.getTime() - b.date.getTime());

      setReminders(fetchedReminders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading, user]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const createReminder = async () => {
    if (!user || !reminderText.trim()) {
      Alert.alert("Error", "Please enter a reminder");
      return;
    }

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const reminderDateTime = new Date(selectedDate);
      reminderDateTime.setHours(hours, minutes, 0);

      await addDoc(collection(db, "reminders"), {
        text: reminderText,
        date: reminderDateTime,
        time: selectedTime,
        completed: false,
        uid: user.uid,        // also store uid for new docs (optional)
        userId: user.uid,     // query field (legacy)
        recurring: "none",
        createdAt: serverTimestamp(),
      });

      setReminderText("");
      setSelectedDate(new Date());
      setSelectedTime("10:00");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating reminder:", error);
      Alert.alert("Error", "Failed to create reminder");
    }
  };

  const toggleComplete = async (reminderId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "reminders", reminderId), {
        completed: !currentStatus,
      });
    } catch (error) {
      console.error("Error updating reminder:", error);
    }
  };

  const deleteReminder = async (reminderId: string) => {
    Alert.alert("Delete Reminder", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "reminders", reminderId));
          } catch (error) {
            console.error("Error deleting reminder:", error);
          }
        },
      },
    ]);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setSelectedTime(`${hours}:${minutes}`);
    }
  };

  // Filter & categorize reminders (active, past, completed)
  const {
    active: filteredActiveReminders,
    past: filteredPastReminders,
    completed: filteredCompletedReminders,
  } = useMemo(() => {
    const now = new Date();
    const past: Reminder[] = [];
    const active: Reminder[] = [];
    const completed: Reminder[] = [];

    reminders.forEach((r) => {
      // apply search filter first
      if (!r.text.toLowerCase().includes(searchText.toLowerCase())) return;

      if (r.completed) {
        completed.push(r);
      } else {
        if (r.date < now) {
          past.push(r);
        } else {
          active.push(r);
        }
      }
    });

    // sort active (soonest first)
    active.sort((a, b) => a.date.getTime() - b.date.getTime());
    // sort past (oldest past first)
    past.sort((a, b) => a.date.getTime() - b.date.getTime());
    // sort completed by createdAt desc
    completed.sort((a, b) => {
      const ca = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const cb = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return cb.getTime() - ca.getTime();
    });

    return { past, active, completed };
  }, [reminders, searchText]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#00f721" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Stay on track</Text>
            <Text style={styles.headerTitle}>Reminders</Text>
          </View>
          <Pressable
            onPress={() => setShowCreateModal(true)}
            style={styles.createButton}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color="#888"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reminders..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Reminders List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredActiveReminders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Active Reminders
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{filteredActiveReminders.length}</Text>
                </View>
              </Text>
              {filteredActiveReminders.map((reminder, index) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  index={index}
                  onToggle={() => toggleComplete(reminder.id, reminder.completed)}
                  onDelete={() => deleteReminder(reminder.id)}
                />
              ))}
            </View>
          )}

          {/* Past reminders button/collapse */}
          {filteredPastReminders.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.collapseButton}
                onPress={() => setShowPast(!showPast)}
              >
                <Text style={[styles.collapseButtonText, { color: "#ef4444" }]}>🔴 Past Reminders ({filteredPastReminders.length})</Text>
                <Ionicons
                  name={showPast ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#ef4444"
                />
              </Pressable>
              {showPast &&
                filteredPastReminders.map((reminder, index) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    index={index}
                    isPast={true}
                    onToggle={() => toggleComplete(reminder.id, reminder.completed)}
                    onDelete={() => deleteReminder(reminder.id)}
                  />
                ))}
              {/* divider */}
              <View style={styles.divider} />
            </View>
          )}

          {/* Completed reminders button/collapse */}
          {filteredCompletedReminders.length > 0 && (
            <View style={styles.section}>
              <Pressable
                style={styles.collapseButton}
                onPress={() => setShowCompleted(!showCompleted)}
              >
                <Text style={styles.collapseButtonText}>Completed ({filteredCompletedReminders.length})</Text>
                <Ionicons
                  name={showCompleted ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#fff"
                />
              </Pressable>
              {showCompleted &&
                filteredCompletedReminders.map((reminder, index) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    index={index}
                    isCompleted={true}
                    onToggle={() => toggleComplete(reminder.id, reminder.completed)}
                    onDelete={() => deleteReminder(reminder.id)}
                  />
                ))}
            </View>
          )}



          {filteredActiveReminders.length === 0 &&
            (!showCompleted || filteredCompletedReminders.length === 0) &&
            (!showPast || filteredPastReminders.length === 0) && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={48}
                  color="rgba(255,255,255,0.2)"
                />
                <Text style={styles.emptyText}>
                  {searchText ? "No reminders found" : "No reminders yet"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchText ? "Try a different search" : "Create one to get started"}
                </Text>
              </View>
            )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Create Reminder Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            {/* keep view at bottom to mimic sheet */}
            <View style={styles.modalContainer}>
              {/* drag handle */}
              <View style={styles.modalHandle} />
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Reminder</Text>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </Pressable>
              </View>

              {/* Modal Content */}
              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Text Input */}
                <TextInput
                  style={styles.modalInput}
                  placeholder="Reminder Text"
                  placeholderTextColor="#888"
                  value={reminderText}
                  onChangeText={setReminderText}
                  multiline={true}
                />

                {/* Date Picker */}
                <View style={styles.pickerSection}>
                  <Text style={styles.pickerLabel}>Date</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={styles.pickerButton}
                  >
                    <MaterialCommunityIcons
                      name="calendar"
                      size={18}
                      color="#00f721"
                    />
                    <Text style={styles.pickerButtonText}>
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </Pressable>
                </View>

                {/* Time Picker */}
                <View style={styles.pickerSection}>
                  <Text style={styles.pickerLabel}>Time</Text>
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    style={styles.pickerButton}
                  >
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={18}
                      color="#00f721"
                    />
                    <Text style={styles.pickerButtonText}>{selectedTime}</Text>
                  </Pressable>
                </View>

              </ScrollView>
              {/* footer buttons */}
              <View style={styles.modalFooterArea}>
                <Pressable style={styles.modalCancelButton} onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalAddButton} onPress={createReminder}>
                  <Text style={styles.modalAddText}>Add Reminder</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Date Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={new Date(`2000-01-01T${selectedTime}`)}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
// REMINDER CARD COMPONENT
// ════════════════════════════════════════════════════════════════

function ReminderCard({
  reminder,
  index,
  isPast,
  isCompleted,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  index: number;
  isPast?: boolean;
  isCompleted?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 50 }}
      style={styles.reminderCardWrapper}
    >
      <View
        style={[
          styles.reminderCard,
          isCompleted && { opacity: 0.6 },
          isPast && { borderLeftColor: "#ef4444", borderLeftWidth: 3 },
        ]}
      >
        {/* Checkbox */}
        <Pressable onPress={onToggle} style={styles.reminderCheckbox}>
          {isCompleted ? (
            <View style={styles.checkboxChecked}>
              <MaterialCommunityIcons
                name="check"
                size={16}
                color="#fff"
              />
            </View>
          ) : (
            <View
              style={styles.checkboxUnchecked}
            />
          )}
        </Pressable>

        {/* Content */}
        <View style={styles.reminderContent}>
          <Text
            style={[
              styles.reminderText,
              isCompleted && { textDecorationLine: "line-through" },
            ]}
            numberOfLines={2}
          >
            {reminder.text}
          </Text>

          <View style={styles.reminderMeta}>
            <MaterialCommunityIcons
              name="calendar-clock"
              size={14}
              color="#888"
            />
            <Text style={styles.reminderDate}>
              {reminder.date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

          </View>
        </View>

        {/* Delete Button */}
        <Pressable onPress={onDelete} style={styles.reminderDeleteButton}>
          <MaterialCommunityIcons name="close" size={18} color="#888" />
        </Pressable>
      </View>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  container: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#BDBDBD",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 14,
  },

  // Toggles
  togglesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    backgroundColor: "#00f721",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "700",
  },
  collapseButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    marginBottom: 12,
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Reminder Card
  reminderCardWrapper: {
    marginBottom: 12,
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderLeftWidth: 0,
  },
  reminderCheckbox: {
    padding: 4,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#00f721",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
  },
  reminderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reminderDate: {
    fontSize: 12,
    color: "#888",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderDeleteButton: {
    padding: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#888",
    marginTop: 6,
  },

  // Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0c0c0c",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  modalFooterArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0c0c0c",
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 24,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: "#0066ff",
    borderRadius: 24,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalAddText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  textInput: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
  },

  // Pickers
  pickerSection: {
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 12,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#BDBDBD",
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  // Priority Buttons
});
