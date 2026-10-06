import React, { useEffect, useState } from "react";
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
  Image,
  Platform,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
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
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../contexts/LanguageContext";
import NotificationBell from '../../components/NotificationBell';
import Animated, { FadeIn } from "../reanimatedShim";
// ...existing code...
import { MotiView } from "moti";


const { width } = Dimensions.get("window");

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  color: string;
  userId: string;
  // Added properties to match UI mockups
  pinned?: boolean;
  shared?: boolean;
  trial?: boolean; 
}

const NOTE_COLORS = [
  "#fffbe6", // Yellow
  "#e3f2fd", // Blue
  "#e8f5e9", // Green
  "#fce4ec", // Pink
  "#fff3e0", // Orange
  "#ede7f6", // Purple
];

const COLOR_ICONS = ["#ffb300", "#1976d2", "#43a047", "#d81b60", "#f57c00", "#7b1fa2"];

export default function NotesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [authInitialized, setAuthInitialized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // ═══════════════════════════════════════════════════════════════
  // 1. AUTH INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthInitialized(true);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. FETCH NOTES
  // ═══════════════════════════════════════════════════════════════
useEffect(() => {
  if (!authInitialized || !user) return;

  const notesQuery = query(
    collection(db, "notes"),
    where("owners", "array-contains", user.uid) // ✅ FIXED
  );

  const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
    const fetchedNotes: Note[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      fetchedNotes.push({
        id: docSnap.id,
        title: data.title || "Untitled",
        content: data.content || "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        color: data.color || NOTE_COLORS[0],
        userId: user.uid,
        pinned: data.pinned || false,
        shared: data.sharedWith?.length > 0, // ✅ FIXED
        trial: data.trial || false,
      });
    });

    // Sort newest first
    fetchedNotes.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    setNotes(fetchedNotes);
  });

  return () => unsubscribe();
}, [authInitialized, user]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

const createNote = async () => {
  if (!user || !newNoteTitle.trim()) {
    Alert.alert("Error", "Please enter a title");
    return;
  }

  try {
    await addDoc(collection(db, "notes"), {
      title: newNoteTitle,
      content: newNoteContent,
      color: NOTE_COLORS[selectedColor],

      owners: [user.uid],      // ✅ FIXED (IMPORTANT)
      sharedWith: [],          // ✅ match your DB
      pinned: false,
      trial: false,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setNewNoteTitle("");
    setNewNoteContent("");
    setSelectedColor(0);
    setShowCreateModal(false);
  } catch (error) {
    console.error("Error creating note:", error);
    Alert.alert("Error", "Failed to create note");
  }
};

  const deleteNote = async (noteId: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "notes", noteId));
          } catch (error) {
            console.error("Error deleting note:", error);
            Alert.alert("Error", "Failed to delete note");
          }
        },
      },
    ]);
  };

  // Filtered notes based on search & pills
  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchText.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchText.toLowerCase());
    
    let matchesFilter = true;
    if (activeFilter === "Pinned") matchesFilter = note.pinned === true;
    if (activeFilter === "Shared") matchesFilter = note.shared === true;
    if (activeFilter === "Trial") matchesFilter = note.trial === true;

    return matchesSearch && matchesFilter;
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0e0e" />
      <View style={styles.container}>
        
        {/* MATCHING HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("notes", "Notes")}</Text>
          <NotificationBell />
        </View>

        {/* MATCHING SEARCH BAR */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("search_notes", "Search notes...")}
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* MATCHING SORT & VIEW TOGGLES */}
        <View style={styles.sortToggleRow}>
          <View>
             <Text style={styles.sortLabel}>{t("sort_by", "Sort by")}</Text>
             <Pressable style={styles.sortDropdown}>
                <Text style={styles.sortText}>{t("newest_first", "Newest First")}</Text>
                <MaterialCommunityIcons name="menu-down" size={20} color="#fff" />
             </Pressable>
          </View>
          <View style={styles.viewToggles}>
             <Pressable style={styles.viewToggleBtnActive}>
                <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#fff" />
             </Pressable>
             <Pressable style={styles.viewToggleBtn}>
                <MaterialCommunityIcons name="view-grid" size={20} color="#888" />
             </Pressable>
          </View>
        </View>

        {/* MATCHING PILL FILTERS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
           {["All", "Pinned", "Shared", "Trial"].map((filter) => (
             <Pressable 
               key={filter} 
               onPress={() => setActiveFilter(filter)}
               style={[styles.pill, activeFilter === filter && styles.pillActive]}
             >
               {filter === "Pinned" && <MaterialCommunityIcons name="pin" size={12} color={activeFilter === filter ? "#000" : "#d94a4a"} style={{marginRight: 4}} />}
               <Text style={[styles.pillText, activeFilter === filter && styles.pillTextActive]}>
                 {filter === "All" ? t("all", "All") : filter === "Pinned" ? t("pinned", "Pinned") : filter === "Shared" ? t("shared", "Shared") : t("trial", "Trial")}
               </Text>
             </Pressable>
           ))}
        </ScrollView>

        {/* NOTES LIST */}
        {filteredNotes.length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredNotes.map((note, index) => (
              <NoteCard
                key={note.id}
                note={note}
                index={index}
                onPress={() => {
                  // Navigate to note detail
                }}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
            </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="note-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>
              {searchText ? t("no_notes_found", "No notes found") : t("no_notes_yet", "No notes yet")}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchText ? "Try a different search" : "Create your first note"}
            </Text>
          </View>
        )}

        {/* MATCHING FAB */}
        <Pressable onPress={() => setShowCreateModal(true)} style={styles.fab}>
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>


        {/* Create Note Modal (Kept Logic Intact) */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.modalTitle}>{t("new_note", "New Note")}</Text>
                <Pressable onPress={createNote}>
                  <MaterialCommunityIcons name="check" size={24} color="#b36a22" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Title"
                  placeholderTextColor="#666"
                  value={newNoteTitle}
                  onChangeText={setNewNoteTitle}
                />
                <TextInput
                  style={styles.contentInput}
                  placeholder="Write something..."
                  placeholderTextColor="#666"
                  value={newNoteContent}
                  onChangeText={setNewNoteContent}
                  multiline={true}
                  textAlignVertical="top"
                />
                
                <View style={styles.colorPickerContainer}>
                  <Text style={styles.colorLabel}>Note Color (UI Fallback)</Text>
                  <View style={styles.colorPicker}>
                    {NOTE_COLORS.map((color, index) => (
                      <Pressable
                        key={index}
                        onPress={() => setSelectedColor(index)}
                        style={[
                          styles.colorOption,
                          {
                            backgroundColor: color,
                            borderWidth: selectedColor === index ? 3 : 0,
                            borderColor: "#fff",
                          },
                        ]}
                      >
                        {selectedColor === index && (
                          <MaterialCommunityIcons name="check" size={16} color={COLOR_ICONS[index]} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
// MATCHING NOTE CARD COMPONENT
// ════════════════════════════════════════════════════════════════

function NoteCard({
  note,
  index,
  onPress,
  onDelete,
}: {
  note: Note;
  index: number;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: index * 50 }}
      style={styles.noteCardWrapper}
    >
      <Pressable onPress={onPress} onLongPress={onDelete} style={styles.noteCard}>
        
        <View style={styles.noteCardHeader}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {note.title} {note.pinned && <MaterialCommunityIcons name="pin" size={14} color="#4ade80" />}
          </Text>
          <Pressable onPress={onDelete}>
             <MaterialCommunityIcons name="dots-vertical" size={20} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.notePreview} numberOfLines={2}>
          {note.content}
        </Text>

        {note.trial && (
           <View style={styles.trialBadge}>
             <Text style={styles.trialText}>Trial</Text>
           </View>
        )}
      </Pressable>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// EXACT STYLES FOR DARK THEME & IMAGE MATCH
// ════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, backgroundColor: "#0e0e0e", paddingHorizontal: 16 },
  centerContent: { justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Platform.OS === 'android' ? 20 : 10,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#fff" },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 16 },

  // Sort & Toggles
  sortToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  sortLabel: {
    color: "#888",
    fontSize: 10,
    marginBottom: 2,
    marginLeft: 4,
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
  viewToggles: {
    flexDirection: "row",
    backgroundColor: "#1c1c1e",
    borderRadius: 8,
    padding: 4,
  },
  viewToggleBtn: {
    padding: 6,
    borderRadius: 6,
  },
  viewToggleBtnActive: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#333",
  },

  // Filter Pills
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 5,
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: "#fff",
  },
  pillText: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#000",
  },

  // Scroll Content
  scrollContent: {
    paddingBottom: 40,
  },

  // Dark Notes List
  noteCardWrapper: {
    marginBottom: 12,
  },
  noteCard: {
    backgroundColor: "#1c1c1e", // Dark grey background matching image
    borderRadius: 16,
    padding: 16,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
  },
  notePreview: {
    fontSize: 14,
    color: "#aaa",
    lineHeight: 20,
    marginBottom: 8,
  },
  trialBadge: {
    backgroundColor: "#333",
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  trialText: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: 'bold',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 56,
    height: 56,
    backgroundColor: '#b38f6d', // Soft beige/brown from image
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },


  // Empty State
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#fff", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#888", marginTop: 6 },

  // Modal
  modalSafeArea: { flex: 1, backgroundColor: "#0e0e0e" },
  modalContainer: { flex: 1, backgroundColor: "#0e0e0e" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1c1c1e" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  modalContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  titleInput: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 16, paddingVertical: 8 },
  contentInput: { fontSize: 16, color: "#fff", marginBottom: 24, paddingVertical: 12, minHeight: 120 },

  // Color Picker (Fallback for create note)
  colorPickerContainer: { marginBottom: 24 },
  colorLabel: { fontSize: 13, fontWeight: "600", color: "#888", marginBottom: 12 },
  colorPicker: { flexDirection: "row", gap: 12 },
  colorOption: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
});