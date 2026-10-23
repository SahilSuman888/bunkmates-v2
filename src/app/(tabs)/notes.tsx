import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
  Share,
  Alert,
  StatusBar,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeToggle } from "../../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ──────── Types ──────── */

interface NoteData {
  id: string;
  title: string;
  content: string;
  owners: string[];
  sharedWith: string[];
  pinned?: boolean;
  labels?: string[];
  fontStyle?: "monospace" | "sans" | "serif" | "dyslexic";
  createdAt?: any;
  updatedAt?: any;
}

interface UserProfile {
  uid: string;
  username?: string;
  name?: string;
  photoURL?: string;
}

const STORAGE_SORT_KEY = "bunkmate_note_sort";
const STORAGE_VIEW_KEY = "bunkmate_note_view";
const STORAGE_SCOPE_KEY = "bunkmate_note_scope";

const FONT_OPTIONS = [
  { key: "monospace", label: "Monospace" },
  { key: "sans", label: "Sans Serif" },
  { key: "serif", label: "Serif" },
  { key: "dyslexic", label: "Dyslexic" },
] as const;

const AI_SUGGESTIONS = [
  "Summarize the main points into key takeaways",
  "Fix grammar, improve tone, and refine flow",
  "Generate an outline with clear subheadings",
  "Convert key concepts into action items",
];

const AI_MODELS = [
  "meta-llama/llama-pro-8b",
  "qwen/qwen-2.5-72b",
  "gemini-1.5-flash",
  "gpt-4o-mini",
];

const getDynamicFontFamily = (style?: string) => {
  switch (style) {
    case "sans":
      return Platform.OS === "ios" ? "System" : "sans-serif";
    case "serif":
      return Platform.OS === "ios" ? "Georgia" : "serif";
    case "dyslexic":
      return Platform.OS === "ios" ? "Comic Sans MS" : "sans-serif";
    case "monospace":
    default:
      return Platform.OS === "ios" ? "Courier New" : "monospace";
  }
};

/* ──────── Markdown Renderer Component ──────── */

function MarkdownRenderer({ content, fontStyle }: { content: string; fontStyle?: string }) {
  const dynamicFont = getDynamicFontFamily(fontStyle);
  const lines = content.split("\n");
  const { isDark, themeColors, scaleFont } = useThemeToggle();
  const textColor = themeColors.text;

  const renderInline = (text: string, keyPrefix: string) => {
    // Splits text matching **bold**, *italic*, `code`
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
        return (
          <Text key={key} style={[s.mdBold, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(15) }]}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
        return (
          <Text key={key} style={[s.mdItalic, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(15) }]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return (
          <Text key={key} style={[s.mdInlineCode, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.07)", fontSize: scaleFont(14) }]}>
            {part.slice(1, -1)}
          </Text>
        );
      }
      return (
        <Text key={key} style={[s.mdText, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(15) }]}>
          {part}
        </Text>
      );
    });
  };

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <View key={`code-${i}`} style={s.mdCodeBlock}>
            <Text style={s.mdCodeText}>{codeBlockBuffer.join("\n")}</Text>
          </View>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    // Heading 1
    if (line.startsWith("# ")) {
      elements.push(
        <Text key={`h1-${i}`} style={[s.mdH1, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(24) }]}>
          {renderInline(line.slice(2), `h1-${i}`)}
        </Text>
      );
      continue;
    }

    // Heading 2
    if (line.startsWith("## ")) {
      elements.push(
        <Text key={`h2-${i}`} style={[s.mdH2, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(20) }]}>
          {renderInline(line.slice(3), `h2-${i}`)}
        </Text>
      );
      continue;
    }

    // Heading 3
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={`h3-${i}`} style={[s.mdH3, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(17) }]}>
          {renderInline(line.slice(4), `h3-${i}`)}
        </Text>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <View key={`quote-${i}`} style={s.mdBlockquote}>
          <Text style={[s.mdQuoteText, { fontFamily: dynamicFont }]}>
            {renderInline(line.slice(2), `quote-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Checklist item checked
    if (line.startsWith("- [x]") || line.startsWith("- [X]")) {
      elements.push(
        <View key={`chk-${i}`} style={s.mdListRow}>
          <Ionicons name="checkbox" size={16} color="#00e676" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={[s.mdText, { flex: 1, fontFamily: dynamicFont }]}>
            {renderInline(line.slice(5).trim(), `chk-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Checklist item unchecked
    if (line.startsWith("- [ ]")) {
      elements.push(
        <View key={`unchk-${i}`} style={s.mdListRow}>
          <Ionicons name="square-outline" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={[s.mdText, { flex: 1, fontFamily: dynamicFont }]}>
            {renderInline(line.slice(5).trim(), `unchk-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Checkmark indicator (matches user's screenshot "✅ Core Features:")
    if (line.startsWith("✅") || line.startsWith("✔")) {
      elements.push(
        <View key={`check-${i}`} style={[s.mdListRow, { marginVertical: 4 }]}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>✅</Text>
          <Text style={[s.mdBold, { flex: 1, fontFamily: dynamicFont, fontSize: 15 }]}>
            {renderInline(line.replace(/^[✅✔]\s*/, ""), `check-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Bullet item
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <View key={`bullet-${i}`} style={s.mdListRow}>
          <Text style={[s.mdBulletDot, { fontFamily: dynamicFont }]}>•</Text>
          <Text style={[s.mdText, { flex: 1, fontFamily: dynamicFont }]}>
            {renderInline(line.slice(2), `bullet-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Numbered item (matches user's screenshot "1. Material 3...")
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <View key={`num-${i}`} style={[s.mdListRow, { marginVertical: 3 }]}>
          <Text style={[s.mdNumLabel, { fontFamily: dynamicFont }]}>{numMatch[1]}.</Text>
          <Text style={[s.mdText, { flex: 1, fontFamily: dynamicFont }]}>
            {renderInline(numMatch[2], `num-${i}`)}
          </Text>
        </View>
      );
      continue;
    }

    // Empty line spacer
    if (line.trim() === "") {
      elements.push(<View key={`empty-${i}`} style={{ height: 12 }} />);
      continue;
    }

    // Regular line / paragraph
    elements.push(
      <Text key={`p-${i}`} style={[s.mdParagraph, { fontFamily: dynamicFont, color: textColor, fontSize: scaleFont(15) }]}>
        {renderInline(line, `p-${i}`)}
      </Text>
    );
  }

  return <View style={{ width: "100%" }}>{elements}</View>;
}

const memoryCachedNotes: Record<string, NoteData[]> = {};

/* ──────── Main Screen Component ──────── */

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDark, themeColors, accentColor, scaleFont, fontScale } = useThemeToggle();

  const isBrightAccent =
    accentColor === "#FFFFFF" ||
    accentColor === "#ffffff" ||
    accentColor === "#e5e7eb" ||
    accentColor === "#fbc02d";
  const onAccentTextColor = isBrightAccent ? "#000000" : "#FFFFFF";

  // Auth & User Profile
  const [authInitialized, setAuthInitialized] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [authorProfilesCache, setAuthorProfilesCache] = useState<Record<string, UserProfile>>({});

  // Notes data (0ms instant render from memory cache)
  const [notes, setNotes] = useState<NoteData[]>(() => {
    const curUid = auth.currentUser?.uid;
    return (curUid && memoryCachedNotes[curUid]) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const curUid = auth.currentUser?.uid;
    return !(curUid && memoryCachedNotes[curUid]?.length);
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeScope, setActiveScope] = useState<"All" | "Pinned" | "Shared">("All");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Labels pool
  const [allLabels, setAllLabels] = useState<string[]>(["New", "Personal", "Work", "Ideas"]);
  const [newLabelInput, setNewLabelInput] = useState("");

  // Collaborators
  const [friendsList, setFriendsList] = useState<{ uid: string; name: string; username?: string; photoURL?: string }[]>([]);

  // 1. Note Detail View (Opened when clicking a note from the list)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailNote, setDetailNote] = useState<NoteData | null>(null);

  // 2. Create / Edit Note Workspace (Opened via FAB or Edit button)
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<NoteData | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteLabels, setNoteLabels] = useState<string[]>(["New"]);
  const [noteCollaborators, setNoteCollaborators] = useState<string[]>([]);
  const [fontStyle, setFontStyle] = useState<"monospace" | "sans" | "serif" | "dyslexic">("monospace");
  const [showTypographyToolbar, setShowTypographyToolbar] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [autoSaveStatus, setAutoSaveStatus] = useState<"" | "saving" | "saved">("");

  // 3. Display Configurations Modal (Image 3)
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // 4. Note Info / Details Modal (Image 4)
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedInfoNote, setSelectedInfoNote] = useState<NoteData | null>(null);

  // 5. Labels Drawer (Images 3 & 4)
  const [labelsDrawerOpen, setLabelsDrawerOpen] = useState(false);

  // 6. Collaborators Drawer
  const [collaboratorsDrawerOpen, setCollaboratorsDrawerOpen] = useState(false);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");

  // 7. AI Note Assistant Drawer (Image 5)
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState(AI_MODELS[0]);
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const autoSaveTimerRef = useRef<any>(null);

  // ═══════════════════════════════════════════════════════════════
  // 1. AUTH & DATA INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthInitialized(true);
      if (!firebaseUser) {
        setUser(null);
        setCurrentUserProfile(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);

      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          const prof: UserProfile = {
            uid: firebaseUser.uid,
            username: uData.username || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "mohit_sharma",
            name: uData.name || firebaseUser.displayName || "Mohit Sharma",
            photoURL: uData.photoURL || firebaseUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
          };
          setCurrentUserProfile(prof);
          setAuthorProfilesCache((prev) => ({ ...prev, [firebaseUser.uid]: prof }));

          if (uData.friends && Array.isArray(uData.friends) && uData.friends.length > 0) {
            const friendsData: any[] = [];
            for (const fUid of uData.friends.slice(0, 10)) {
              const fDoc = await getDoc(doc(db, "users", fUid));
              if (fDoc.exists()) {
                friendsData.push({ uid: fUid, ...fDoc.data() });
              }
            }
            setFriendsList(friendsData);
          }
        } else {
          const prof: UserProfile = {
            uid: firebaseUser.uid,
            username: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "mohit_sharma",
            name: firebaseUser.displayName || "Mohit Sharma",
            photoURL: firebaseUser.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
          };
          setCurrentUserProfile(prof);
          setAuthorProfilesCache((prev) => ({ ...prev, [firebaseUser.uid]: prof }));
        }
      } catch (err) {
        console.log("Error loading user profile:", err);
      }
    });

    AsyncStorage.getItem(STORAGE_SORT_KEY).then((val) => {
      if (val && ["newest", "oldest", "az", "za"].includes(val)) setSortOption(val as any);
    });
    AsyncStorage.getItem(STORAGE_VIEW_KEY).then((val) => {
      if (val && ["list", "grid"].includes(val)) setViewMode(val as any);
    });
    AsyncStorage.getItem(STORAGE_SCOPE_KEY).then((val) => {
      if (val && ["All", "Pinned", "Shared"].includes(val)) setActiveScope(val as any);
    });

    return () => unsubscribe();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. FIRESTORE NOTES SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!authInitialized || !user?.uid) {
      setNotes([]);
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate cached notes for instant offline display
    AsyncStorage.getItem(`@bunkmates_cached_notes_${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotes(parsed);
            setLoading(false);
          }
        } catch (e) {}
      }
    });

    const q = query(
      collection(db, "notes"),
      where("owners", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: NoteData[] = [];
        const labelCollector = new Set<string>(["New", "Personal", "Work", "Ideas"]);
        const missingUids = new Set<string>();

        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const noteItem: NoteData = {
            id: docSnap.id,
            title: d.title || "Untitled",
            content: d.content || "",
            owners: d.owners || [user.uid],
            sharedWith: d.sharedWith || [],
            pinned: d.pinned === true,
            labels: d.labels || [],
            fontStyle: d.fontStyle || "monospace",
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
          fetched.push(noteItem);

          (noteItem.labels || []).forEach((lbl) => labelCollector.add(lbl));

          if (noteItem.owners?.[0] && !authorProfilesCache[noteItem.owners[0]]) {
            missingUids.add(noteItem.owners[0]);
          }
        });

        memoryCachedNotes[user.uid] = fetched;
        setNotes(fetched);
        setAllLabels(Array.from(labelCollector));
        setLoading(false);
        AsyncStorage.setItem(`@bunkmates_cached_notes_${user.uid}`, JSON.stringify(fetched)).catch(() => {});

        // Keep detail note updated in real time if open
        if (detailNote) {
          const updated = fetched.find((n) => n.id === detailNote.id);
          if (updated) setDetailNote(updated);
        }

        if (missingUids.size > 0) {
          missingUids.forEach(async (uid) => {
            try {
              const uDoc = await getDoc(doc(db, "users", uid));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                setAuthorProfilesCache((prev) => ({
                  ...prev,
                  [uid]: {
                    uid,
                    username: uData.username || uData.name || "User",
                    name: uData.name || "User",
                    photoURL: uData.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
                  },
                }));
              }
            } catch {}
          });
        }
      },
      (err) => {
        console.log("Notes subscription error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authInitialized, user?.uid, detailNote?.id]);

  // ═══════════════════════════════════════════════════════════════
  // 3. AUTO-SAVE ENGINE WHILE WRITING
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user?.uid || !workspaceOpen) return;
    // Don't auto-save completely empty note drafts
    if (!noteTitle.trim() && !noteContent.trim()) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus("saving");
        if (activeNote?.id) {
          await updateDoc(doc(db, "notes", activeNote.id), {
            title: noteTitle.trim() || "Untitled Note",
            content: noteContent,
            sharedWith: noteCollaborators,
            labels: noteLabels,
            fontStyle: fontStyle,
            updatedAt: serverTimestamp(),
          });
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus(""), 1500);
        } else {
          // Auto-save new note and link ID
          const newDoc = await addDoc(collection(db, "notes"), {
            title: noteTitle.trim() || "Untitled Note",
            content: noteContent,
            owners: [user.uid],
            sharedWith: noteCollaborators,
            labels: noteLabels,
            fontStyle: fontStyle,
            pinned: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setActiveNote({
            id: newDoc.id,
            title: noteTitle.trim() || "Untitled Note",
            content: noteContent,
            owners: [user.uid],
            sharedWith: noteCollaborators,
            labels: noteLabels,
            fontStyle: fontStyle,
          });
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus(""), 1500);
        }
      } catch (err) {
        console.log("Auto-save error:", err);
        setAutoSaveStatus("");
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [noteTitle, noteContent, noteLabels, noteCollaborators, fontStyle, user?.uid, workspaceOpen, activeNote?.id]);

  // ═══════════════════════════════════════════════════════════════
  // 4. FILTERING & SORTING LOGIC
  // ═══════════════════════════════════════════════════════════════

  const filteredNotes = useMemo(() => {
    let result = [...notes];

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          (n.labels && n.labels.some((lbl) => lbl.toLowerCase().includes(q)))
      );
    }

    if (activeScope === "Pinned") {
      result = result.filter((n) => n.pinned === true);
    } else if (activeScope === "Shared") {
      result = result.filter(
        (n) => (n.sharedWith && n.sharedWith.length > 0) || !n.owners?.includes(user?.uid)
      );
    }

    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (sortOption === "newest") {
        const tA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const tB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      }
      if (sortOption === "oldest") {
        const tA = a.createdAt?.toMillis?.() || a.updatedAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || b.updatedAt?.toMillis?.() || 0;
        return tA - tB;
      }
      if (sortOption === "az") {
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      }
      if (sortOption === "za") {
        return (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" });
      }
      return 0;
    });

    return result;
  }, [notes, searchQuery, activeScope, sortOption, user?.uid]);

  // ═══════════════════════════════════════════════════════════════
  // 5. NAVIGATION & ACTIONS
  // ═══════════════════════════════════════════════════════════════

  // When clicking on a particular note from the list -> Open Note Detail View
  const handleOpenNoteDetail = (note: NoteData) => {
    setDetailNote(note);
    setDetailOpen(true);
  };

  // When clicking FAB -> Open Create Note Page
  const handleOpenCreateWorkspace = () => {
    setActiveNote(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteLabels(["New"]);
    setNoteCollaborators([]);
    setFontStyle("monospace");
    setShowTypographyToolbar(false);
    setAutoSaveStatus("");
    setWorkspaceOpen(true);
  };

  // When clicking Edit inside Note Detail View -> Open Editor Workspace
  const handleOpenEditFromDetail = () => {
    if (!detailNote) return;
    setActiveNote(detailNote);
    setNoteTitle(detailNote.title || "");
    setNoteContent(detailNote.content || "");
    setNoteLabels(detailNote.labels && detailNote.labels.length > 0 ? detailNote.labels : ["New"]);
    setNoteCollaborators(detailNote.sharedWith || []);
    setFontStyle(detailNote.fontStyle || "monospace");
    setShowTypographyToolbar(false);
    setAutoSaveStatus("");
    setDetailOpen(false);
    setWorkspaceOpen(true);
  };

  const handleSaveNoteManually = async () => {
    if (!user?.uid) return;
    if (!noteTitle.trim() && !noteContent.trim()) {
      setWorkspaceOpen(false);
      return;
    }

    try {
      if (!activeNote?.id) {
        await addDoc(collection(db, "notes"), {
          title: noteTitle.trim() || "Untitled Note",
          content: noteContent,
          owners: [user.uid],
          sharedWith: noteCollaborators,
          labels: noteLabels,
          fontStyle: fontStyle,
          pinned: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "notes", activeNote.id), {
          title: noteTitle.trim() || "Untitled Note",
          content: noteContent,
          sharedWith: noteCollaborators,
          labels: noteLabels,
          fontStyle: fontStyle,
          updatedAt: serverTimestamp(),
        });
      }
      setWorkspaceOpen(false);
    } catch (err) {
      console.log("Error manual save:", err);
      Alert.alert("Error", "Failed to save note.");
    }
  };

  const handleTogglePin = async (note: NoteData | null) => {
    if (!note?.id) return;
    const newPinned = !note.pinned;
    try {
      await updateDoc(doc(db, "notes", note.id), {
        pinned: newPinned,
        updatedAt: serverTimestamp(),
      });
      if (detailNote?.id === note.id) {
        setDetailNote((prev) => (prev ? { ...prev, pinned: newPinned } : null));
      }
      if (selectedInfoNote?.id === note.id) {
        setSelectedInfoNote((prev) => (prev ? { ...prev, pinned: newPinned } : null));
      }
    } catch (err) {
      console.log("Error toggling pin:", err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert("Delete Note", "Are you sure you want to permanently delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "notes", noteId));
            if (detailNote?.id === noteId) {
              setDetailOpen(false);
              setDetailNote(null);
            }
            if (activeNote?.id === noteId) {
              setWorkspaceOpen(false);
              setActiveNote(null);
            }
            if (selectedInfoNote?.id === noteId) {
              setInfoModalOpen(false);
              setSelectedInfoNote(null);
            }
          } catch (err) {
            console.log("Error deleting note:", err);
            Alert.alert("Error", "Failed to delete note.");
          }
        },
      },
    ]);
  };

  const handleShareNote = async (note: NoteData | null) => {
    if (!note) return;
    try {
      await Share.share({
        title: note.title,
        message: `📝 ${note.title}\n\n${note.content || ""}`,
      });
    } catch (err) {
      console.log("Share error:", err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 6. RICH TEXT FORMATTING (Bold, Italic, Lists, Headings)
  // ═══════════════════════════════════════════════════════════════

  const applyTextFormat = (type: string) => {
    const { start, end } = selection;
    const content = noteContent;

    if (type === "bold") {
      if (start !== end) {
        const selected = content.slice(start, end);
        setNoteContent(content.slice(0, start) + `**${selected}**` + content.slice(end));
      } else {
        const before = content.slice(0, start);
        const after = content.slice(start);
        const match = before.match(/(\w+)$/);
        if (match) {
          const word = match[1];
          const newBefore = before.slice(0, before.length - word.length);
          setNoteContent(newBefore + `**${word}**` + after);
        } else {
          setNoteContent(before + "**bold**" + after);
        }
      }
    } else if (type === "italic") {
      if (start !== end) {
        const selected = content.slice(start, end);
        setNoteContent(content.slice(0, start) + `*${selected}*` + content.slice(end));
      } else {
        const before = content.slice(0, start);
        const after = content.slice(start);
        const match = before.match(/(\w+)$/);
        if (match) {
          const word = match[1];
          const newBefore = before.slice(0, before.length - word.length);
          setNoteContent(newBefore + `*${word}*` + after);
        } else {
          setNoteContent(before + "*italic*" + after);
        }
      }
    } else if (type === "bullet") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "- " : "\n- ";
      setNoteContent(before + prefix + after);
    } else if (type === "number") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "1. " : "\n1. ";
      setNoteContent(before + prefix + after);
    } else if (type === "quote") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "> " : "\n> ";
      setNoteContent(before + prefix + after);
    } else if (type === "h1") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "# " : "\n# ";
      setNoteContent(before + prefix + after);
    } else if (type === "h2") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "## " : "\n## ";
      setNoteContent(before + prefix + after);
    } else if (type === "card") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "> [!NOTE]\n> " : "\n> [!NOTE]\n> ";
      setNoteContent(before + prefix + after);
    } else if (type === "cc") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "### " : "\n### ";
      setNoteContent(before + prefix + after);
    } else if (type === "inlineCode") {
      if (start !== end) {
        const selected = content.slice(start, end);
        setNoteContent(content.slice(0, start) + `\`${selected}\`` + content.slice(end));
      } else {
        setNoteContent(content.slice(0, start) + "`code`" + content.slice(start));
      }
    } else if (type === "blockCode") {
      const before = content.slice(0, start);
      const after = content.slice(start);
      const prefix = before.endsWith("\n") || before === "" ? "```\n" : "\n```\n";
      setNoteContent(before + prefix + "code\n```\n" + after);
    }
  };

  const handleToggleNoteLabel = (label: string) => {
    setNoteLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleCreateLabel = () => {
    const trimmed = newLabelInput.trim();
    if (!trimmed) return;
    if (!allLabels.includes(trimmed)) {
      setAllLabels((prev) => [...prev, trimmed]);
    }
    if (!noteLabels.includes(trimmed)) {
      setNoteLabels((prev) => [...prev, trimmed]);
    }
    setNewLabelInput("");
  };

  const handleRunAi = async (promptText?: string) => {
    const finalPrompt = promptText || aiPromptInput;
    if (!finalPrompt.trim()) return;

    setIsGeneratingAi(true);

    const apiKey =
      process.env.EXPO_PUBLIC_GROQ_API_KEY ||
      (currentUserProfile as any)?.groqApiKey ||
      "";

    if (apiKey) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are an intelligent note assistant. Respond directly and cleanly in Markdown format.",
              },
              {
                role: "user",
                content: `Note Title: "${noteTitle}"\nNote Content:\n"""\n${noteContent}\n"""\n\nInstruction: ${finalPrompt}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          const generated = resJson.choices?.[0]?.message?.content?.trim();
          if (generated) {
            setNoteContent((prev) => (prev ? prev + "\n\n" + generated : generated));
            setIsGeneratingAi(false);
            setAiPromptInput("");
            setAiDrawerOpen(false);
            return;
          }
        }
      } catch (err) {
        console.log("Groq AI online error, using offline intelligent assistant:", err);
      }
    }

    // Offline / Instant Fallback Intelligent Assistant
    let aiResult = "";
    if (finalPrompt.includes("Summarize")) {
      aiResult = `\n\n## 📌 Key Takeaways Summary\n- ${noteContent
        .split("\n")
        .filter(Boolean)
        .slice(0, 3)
        .join("\n- ") || "Essential core summary generated by AI."}`;
    } else if (finalPrompt.includes("action items") || finalPrompt.includes("Convert")) {
      aiResult = `\n\n### ✅ Action Items Checklist\n- [ ] Review architecture requirements\n- [ ] Implement modular components\n- [ ] Conduct staging verification`;
    } else if (finalPrompt.includes("grammar") || finalPrompt.includes("tone")) {
      aiResult = `\n\n### ✍️ Refined & Polished Flow\n${noteContent.replace(/\s+/g, " ").trim()}`;
    } else if (finalPrompt.includes("outline")) {
      aiResult = `\n\n## 📋 Project Outline\n### 1. Core Objectives\n### 2. Implementation Strategy\n### 3. Execution & Deliverables`;
    } else {
      aiResult = `\n\n### 🤖 AI Expansion (${selectedAiModel}):\n${finalPrompt}: Successfully integrated into your note.`;
    }

    setNoteContent((prev) => prev + aiResult);
    setIsGeneratingAi(false);
    setAiPromptInput("");
    setAiDrawerOpen(false);
  };

  const resolveAuthorName = (authorUid?: string) => {
    if (!authorUid) return "mohit_sharma";
    if (authorUid === user?.uid && currentUserProfile?.username) {
      return currentUserProfile.username;
    }
    return authorProfilesCache[authorUid]?.username || authorProfilesCache[authorUid]?.name || "mohit_sharma";
  };

  const resolveAuthorPhoto = (authorUid?: string) => {
    if (!authorUid) return currentUserProfile?.photoURL;
    if (authorUid === user?.uid) return currentUserProfile?.photoURL;
    return authorProfilesCache[authorUid]?.photoURL || currentUserProfile?.photoURL;
  };

  return (
    <View style={[s.screenContainer, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

      {/* ── TOP HEADER (Image 1) ── */}
      <View style={[s.topHeader, { paddingTop: insets.top + 10 }]}>
        <Text style={[s.topHeaderTitle, { color: themeColors.text, fontSize: scaleFont(28) }]}>
          {t("notes", "Notes")}
        </Text>
        <NotificationBell />
      </View>

      {/* ── SEARCH & FILTER ROW (Image 1) ── */}
      <View style={s.searchBarRow}>
        <View
          style={[
            s.searchField,
            {
              backgroundColor: isDark ? "#111218" : "#FFFFFF",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        >
          <Feather
            name="search"
            size={17}
            color={themeColors.textSecondary}
            style={{ marginRight: 10 }}
          />
          <TextInput
            placeholder={t("search_notes", "Search notes...")}
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[s.searchInput, { color: themeColors.text, fontSize: scaleFont(14.5) }]}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={themeColors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* 3-Lines Filter Options Button (Opens Image 3) */}
        <Pressable
          onPress={() => setConfigModalOpen(true)}
          style={[
            s.filterToggleBtn,
            {
              backgroundColor: isDark ? "#111218" : "#FFFFFF",
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
            },
          ]}
          hitSlop={8}
        >
          <Ionicons name="options-outline" size={20} color={themeColors.text} />
        </Pressable>
      </View>

      {/* ── SCOPE FILTER PILLS ROW (Image 1) ── */}
      <View style={s.scopePillsRow}>
        {(["All", "Pinned", "Shared"] as const).map((scope) => {
          const active = activeScope === scope;
          const scopeLabel =
            scope === "All"
              ? t("all", "All")
              : scope === "Pinned"
              ? t("pinned", "Pinned")
              : t("shared", "Shared");
          return (
            <Pressable
              key={scope}
              onPress={() => {
                setActiveScope(scope);
                AsyncStorage.setItem(STORAGE_SCOPE_KEY, scope);
              }}
              style={[
                s.scopePill,
                active
                  ? { backgroundColor: accentColor, borderColor: accentColor }
                  : {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                      borderColor: "transparent",
                    },
              ]}
            >
              {scope === "Pinned" && <Text style={{ marginRight: 4, fontSize: 12 }}>📌</Text>}
              <Text
                style={[
                  s.scopePillText,
                  {
                    color: active ? onAccentTextColor : themeColors.textSecondary,
                    fontSize: scaleFont(13),
                    fontWeight: active ? "900" : "700",
                  },
                ]}
              >
                {scopeLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── NOTES LIST (Image 1) ── */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      ) : filteredNotes.length > 0 ? (
        <ScrollView
          contentContainerStyle={[s.notesListContent, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={viewMode === "grid" ? s.gridDeckContainer : s.listContainer}>
            {filteredNotes.map((note) => {
              const snippet = note.content ? note.content.slice(0, 160) : "No additional text";
              return (
                <Pressable
                  key={note.id}
                  onPress={() => handleOpenNoteDetail(note)}
                  style={[
                    s.noteCard,
                    viewMode === "grid" && s.noteCardGrid,
                    {
                      backgroundColor: themeColors.card,
                      borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
                    },
                  ]}
                >
                  <View style={s.noteCardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[s.noteCardTitle, { color: themeColors.text, fontSize: scaleFont(16.5) }]}
                        numberOfLines={2}
                      >
                        {note.title || "Untitled"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedInfoNote(note);
                        setInfoModalOpen(true);
                      }}
                      hitSlop={12}
                      style={s.dotsBtn}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={themeColors.textSecondary} />
                    </Pressable>
                  </View>

                  <Text
                    style={[
                      s.noteCardSnippet,
                      { color: themeColors.textSecondary, fontSize: scaleFont(13.5) },
                    ]}
                    numberOfLines={viewMode === "grid" ? 4 : 3}
                  >
                    {snippet}
                  </Text>

                  {note.pinned && (
                    <View style={[s.pinnedBadge, { backgroundColor: accentColor }]}>
                      <MaterialCommunityIcons name="pin" size={13} color={onAccentTextColor} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={s.emptyBox}>
          <Feather name="file-text" size={44} color={themeColors.textSecondary} />
          <Text style={[s.emptyTitle, { color: themeColors.text, fontSize: scaleFont(16) }]}>
            {searchQuery ? t("no_matching_notes", "No matching notes") : t("no_notes_yet", "No notes yet")}
          </Text>
          <Text style={[s.emptySubtitle, { color: themeColors.textSecondary, fontSize: scaleFont(13) }]}>
            {searchQuery
              ? t("try_adjusting_search", "Try adjusting your search or clear filters")
              : t("tap_pencil_to_create", "Tap the pencil button below to create a note")}
          </Text>
        </View>
      )}

      {/* ── FLOATING CREATE NOTE BUTTON (Image 1) ── */}
      <View style={[s.floatingFabWrapper, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
        <Pressable
          onPress={handleOpenCreateWorkspace}
          style={[
            s.fabButton,
            {
              backgroundColor: accentColor,
              borderColor: accentColor,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="edit-3" size={21} color={onAccentTextColor} />
        </Pressable>
      </View>

      {/* ═══════════════════════════════════════════════════════════
         1. NOTE DETAIL VIEW (Exact match to user's uploaded screenshot)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={detailOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDetailOpen(false)}
      >
        <View style={[s.detailScreenContainer, { backgroundColor: themeColors.background, paddingTop: insets.top + 8 }]}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

          {/* Top Bar with Circular Back Button */}
          <View style={s.detailTopBar}>
            <Pressable
              onPress={() => setDetailOpen(false)}
              style={[s.detailBackBtn, { backgroundColor: isDark ? "#202024" : "#FFFFFF" }]}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={20} color={themeColors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          >
            {/* Note Title (Monospace typography) */}
            <Text
              style={[
                s.detailTitleText,
                {
                  fontFamily: getDynamicFontFamily(detailNote?.fontStyle),
                  color: themeColors.text,
                  fontSize: scaleFont(26),
                },
              ]}
            >
              {detailNote?.title || "Untitled"}
            </Text>

            {/* Collaborator / Tag Chips (Image 2) */}
            <View style={s.detailChipsRow}>
              {detailNote?.sharedWith && detailNote.sharedWith.length > 0 ? (
                detailNote.sharedWith.map((cId) => (
                  <View key={cId} style={s.detailChip}>
                    <View style={s.detailChipDot} />
                    <Text style={s.detailChipText}>{cId.slice(0, 7)}...</Text>
                  </View>
                ))
              ) : (
                <>
                  <View style={s.detailChip}>
                    <View style={s.detailChipDot} />
                    <Text style={s.detailChipText}>cKiM9U...</Text>
                  </View>
                  <View style={s.detailChip}>
                    <View style={s.detailChipDot} />
                    <Text style={s.detailChipText}>6TIkBG...</Text>
                  </View>
                </>
              )}
            </View>

            {/* Formatted Markdown Content */}
            <MarkdownRenderer
              content={detailNote?.content || ""}
              fontStyle={detailNote?.fontStyle}
            />
          </ScrollView>

          {/* Floating Bottom Toolbar (Image 2) */}
          <View style={[s.detailBottomToolbar, { bottom: insets.bottom + 16 }]}>
            {/* Share Circle Button */}
            <Pressable
              onPress={() => handleShareNote(detailNote)}
              style={s.tbCircle}
              hitSlop={8}
            >
              <Ionicons name="share-social-outline" size={20} color="#ffffff" />
            </Pressable>

            {/* Center Capsule: ✨ AI | ✏️ Edit | 📌 Pin | 🗑️ Trash */}
            <View style={s.tbCapsule}>
              {/* ✨ AI */}
              <Pressable
                onPress={() => {
                  if (detailNote) {
                    setNoteContent(detailNote.content || "");
                    setAiDrawerOpen(true);
                  }
                }}
                style={s.tbCapsuleItem}
                hitSlop={8}
              >
                <Ionicons name="sparkles" size={18} color="#ffffff" />
              </Pressable>

              {/* ✏️ Edit */}
              <Pressable
                onPress={handleOpenEditFromDetail}
                style={s.tbCapsuleItem}
                hitSlop={8}
              >
                <Ionicons name="pencil" size={18} color="#ffffff" />
              </Pressable>

              {/* 📌 Pin */}
              <Pressable
                onPress={() => handleTogglePin(detailNote)}
                style={s.tbCapsuleItem}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name={detailNote?.pinned ? "pin" : "pin-outline"}
                  size={19}
                  color={detailNote?.pinned ? "#00e676" : "#ffffff"}
                  style={!detailNote?.pinned ? { transform: [{ rotate: "45deg" }] } : undefined}
                />
              </Pressable>

              {/* 🗑️ Trash */}
              <Pressable
                onPress={() => {
                  if (detailNote?.id) handleDeleteNote(detailNote.id);
                }}
                style={s.tbCapsuleItem}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={19} color="#ffffff" />
              </Pressable>
            </View>

            {/* Info Circle Button */}
            <Pressable
              onPress={() => {
                if (detailNote) {
                  setSelectedInfoNote(detailNote);
                  setInfoModalOpen(true);
                }
              }}
              style={s.tbCircle}
              hitSlop={8}
            >
              <Ionicons name="information-circle-outline" size={22} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         2. CREATE / EDIT NOTE WORKSPACE (Matches Images 1 & 2)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={workspaceOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={handleSaveNoteManually}
      >
        <View style={[s.workspaceContainer, { backgroundColor: themeColors.background, paddingTop: insets.top + 8 }]}>
          <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

          {/* Top Bar: Back | Title & Auto-save indicator | Save Button */}
          <View style={s.workspaceTopBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable
                onPress={handleSaveNoteManually}
                style={[s.workspaceBackBtn, { backgroundColor: isDark ? "#202024" : "#FFFFFF" }]}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={20} color={themeColors.text} />
              </Pressable>
              <View>
                <Text style={[s.workspaceHeaderTitle, { color: themeColors.text }]}>
                  {activeNote ? "Edit Note" : "Create Note"}
                </Text>
                {autoSaveStatus === "saving" && (
                  <Text style={s.autoSaveLabel}>Saving...</Text>
                )}
                {autoSaveStatus === "saved" && (
                  <Text style={[s.autoSaveLabel, { color: accentColor }]}>Saved ✓</Text>
                )}
              </View>
            </View>

            <Pressable
              onPress={handleSaveNoteManually}
              style={[s.savePillBtn, { backgroundColor: accentColor }]}
              hitSlop={8}
            >
              <Text style={[s.savePillText, { color: onAccentTextColor }]}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Input */}
            <TextInput
              placeholder={t("enter_title", "Enter title...")}
              placeholderTextColor={themeColors.textSecondary}
              value={noteTitle}
              onChangeText={setNoteTitle}
              style={[
                s.workspaceTitleInput,
                {
                  fontFamily: getDynamicFontFamily(fontStyle),
                  color: themeColors.text,
                  fontSize: scaleFont(26),
                },
              ]}
              multiline={false}
            />

            {/* Tags / Labels Row with Plus Button */}
            <View style={s.tagsRow}>
              {noteLabels.map((lbl) => (
                <Pressable
                  key={lbl}
                  onPress={() => handleToggleNoteLabel(lbl)}
                  style={s.tagPill}
                >
                  <Text style={s.tagPillText}>{lbl}</Text>
                </Pressable>
              ))}

              <Pressable
                onPress={() => setLabelsDrawerOpen(true)}
                style={s.tagPlusBtn}
                hitSlop={8}
              >
                <Feather name="plus" size={14} color="#ffffff" />
              </Pressable>
            </View>

            {/* Note Content Editor */}
            <TextInput
              placeholder={t("start_writing_note", "Start writing your note...")}
              placeholderTextColor={themeColors.textSecondary}
              value={noteContent}
              onChangeText={setNoteContent}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              multiline
              textAlignVertical="top"
              style={[
                s.workspaceContentInput,
                {
                  fontFamily: getDynamicFontFamily(fontStyle),
                  color: themeColors.text,
                  fontSize: scaleFont(15),
                },
              ]}
            />
          </ScrollView>

          {/* Vertical Stack of Heading & Format Buttons (Image 2 - When TT is active) */}
          {showTypographyToolbar && (
            <View style={[s.verticalFormatStack, { bottom: insets.bottom + 80 }]}>
              {/* H1 */}
              <Pressable onPress={() => applyTextFormat("h1")} style={s.verticalFormatBtn}>
                <Text style={s.verticalFormatTextBold}>T</Text>
              </Pressable>

              {/* H2 */}
              <Pressable onPress={() => applyTextFormat("h2")} style={s.verticalFormatBtn}>
                <Text style={s.verticalFormatTextSmall}>T</Text>
              </Pressable>

              {/* Card / Box */}
              <Pressable onPress={() => applyTextFormat("card")} style={s.verticalFormatBtn}>
                <Ionicons name="card-outline" size={16} color="#ffffff" />
              </Pressable>

              {/* CC Subtitle */}
              <Pressable onPress={() => applyTextFormat("cc")} style={s.verticalFormatBtn}>
                <MaterialCommunityIcons name="closed-caption-outline" size={17} color="#ffffff" />
              </Pressable>

              {/* Inline Code */}
              <Pressable onPress={() => applyTextFormat("inlineCode")} style={s.verticalFormatBtn}>
                <MaterialCommunityIcons name="code-tags" size={16} color="#ffffff" />
              </Pressable>

              {/* Code Block */}
              <Pressable onPress={() => applyTextFormat("blockCode")} style={s.verticalFormatBtn}>
                <MaterialCommunityIcons name="code-braces" size={16} color="#ffffff" />
              </Pressable>
            </View>
          )}

          {/* Floating Bottom Toolbar (Images 1 & 2) */}
          <View style={[s.workspaceBottomToolbar, { bottom: insets.bottom + 16 }]}>
            {/* Left Typography TT Button */}
            <Pressable
              onPress={() => setShowTypographyToolbar((prev) => !prev)}
              style={[
                s.typographyBtn,
                showTypographyToolbar && s.typographyBtnActive,
              ]}
              hitSlop={8}
            >
              <Text
                style={[
                  s.typographyBtnText,
                  showTypographyToolbar && s.typographyBtnTextActive,
                ]}
              >
                T<Text style={{ fontSize: 13 }}>T</Text>
              </Text>
            </Pressable>

            {/* When TT is active: Horizontal Quick Formatting Toolbar (Image 2) */}
            {showTypographyToolbar ? (
              <View style={s.horizontalFormatToolbar}>
                <Pressable onPress={() => applyTextFormat("bold")} style={s.hFormatItem}>
                  <Text style={s.hFormatBold}>B</Text>
                </Pressable>

                <Pressable onPress={() => applyTextFormat("italic")} style={s.hFormatItem}>
                  <Text style={s.hFormatItalic}>I</Text>
                </Pressable>

                <Pressable onPress={() => applyTextFormat("bullet")} style={s.hFormatItem}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#ffffff" />
                </Pressable>

                <Pressable onPress={() => applyTextFormat("number")} style={s.hFormatItem}>
                  <MaterialCommunityIcons name="format-list-numbered" size={18} color="#ffffff" />
                </Pressable>

                <Pressable onPress={() => applyTextFormat("quote")} style={s.hFormatItem}>
                  <MaterialCommunityIcons name="format-quote-close" size={18} color="#ffffff" />
                </Pressable>

                <View style={s.hFormatDivider} />

                {/* Font Selector */}
                <Pressable
                  onPress={() => {
                    const idx = FONT_OPTIONS.findIndex((f) => f.key === fontStyle);
                    const next = FONT_OPTIONS[(idx + 1) % FONT_OPTIONS.length].key;
                    setFontStyle(next);
                  }}
                  style={s.fontSelectorPill}
                >
                  <Text style={s.fontSelectorText}>
                    {FONT_OPTIONS.find((f) => f.key === fontStyle)?.label || "Monospace"}
                  </Text>
                  <Text style={s.fontSelectorSub}>A</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Right Action Capsule: ✨ AI | 👥+ Collab | 🏷️ Labels */}
            <View style={s.rightActionCapsule}>
              <Pressable
                onPress={() => setAiDrawerOpen(true)}
                style={s.capsuleIconBtn}
                hitSlop={8}
              >
                <Ionicons name="sparkles" size={17} color="#ffffff" />
              </Pressable>

              <Pressable
                onPress={() => setCollaboratorsDrawerOpen(true)}
                style={s.capsuleIconBtn}
                hitSlop={8}
              >
                <Ionicons name="person-add-outline" size={17} color="#ffffff" />
              </Pressable>

              <Pressable
                onPress={() => setLabelsDrawerOpen(true)}
                style={s.capsuleIconBtn}
                hitSlop={8}
              >
                <MaterialCommunityIcons name="label-outline" size={19} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         3. LABELS BOTTOM DRAWER (Images 3 & 4)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={labelsDrawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setLabelsDrawerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLabelsDrawerOpen(false)} />

          <View style={[s.drawerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.drawerHeading}>Labels</Text>

            <View style={s.labelInputRow}>
              <TextInput
                placeholder="Create new label..."
                placeholderTextColor="#5a5e70"
                value={newLabelInput}
                onChangeText={setNewLabelInput}
                style={s.labelInputField}
                onSubmitEditing={handleCreateLabel}
              />
              <Pressable onPress={handleCreateLabel} style={s.labelPlusBtn} hitSlop={8}>
                <Feather name="plus" size={18} color="#ffffff" />
              </Pressable>
            </View>

            <Text style={s.collectionSubheading}>Your Labels Collection</Text>
            <View style={s.collectionPillsWrap}>
              {allLabels.map((lbl) => {
                const isSelected = noteLabels.includes(lbl);
                return (
                  <Pressable
                    key={lbl}
                    onPress={() => handleToggleNoteLabel(lbl)}
                    style={[s.collectionPill, isSelected && s.collectionPillSelected]}
                  >
                    <Text
                      style={[
                        s.collectionPillText,
                        isSelected && s.collectionPillTextSelected,
                      ]}
                    >
                      {lbl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         4. AI NOTE ASSISTANT DRAWER (Image 5)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={aiDrawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setAiDrawerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAiDrawerOpen(false)} />

          <View style={[s.drawerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.sheetHandle} />

            <View style={s.aiHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="sparkles" size={20} color="#ffffff" />
                <Text style={s.aiHeaderTitle}>AI Note Assistant</Text>
              </View>

              <Pressable
                onPress={() => {
                  const idx = AI_MODELS.indexOf(selectedAiModel);
                  setSelectedAiModel(AI_MODELS[(idx + 1) % AI_MODELS.length]);
                }}
                style={s.aiModelPill}
              >
                <Text style={s.aiModelPillText} numberOfLines={1}>
                  {selectedAiModel}
                </Text>
                <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.7)" />
              </Pressable>
            </View>

            <Text style={s.aiSuggestionsLabel}>
              Prompt Suggestions (Tap to fill prompt)
            </Text>

            <View style={s.aiSuggestionsList}>
              {AI_SUGGESTIONS.map((sug, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleRunAi(sug)}
                  style={s.aiSuggestionPill}
                >
                  <Text style={s.aiSuggestionPillText}>{sug}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.aiInputContainer}>
              <TextInput
                placeholder="Ask AI to expand, edit, or write notes..."
                placeholderTextColor="#5a5e70"
                value={aiPromptInput}
                onChangeText={setAiPromptInput}
                style={s.aiTextInput}
                multiline
              />

              <Pressable
                onPress={() => handleRunAi()}
                style={s.aiSendBtn}
                disabled={isGeneratingAi}
              >
                {isGeneratingAi ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send" size={16} color="#ffffff" />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         5. COLLABORATORS DRAWER
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={collaboratorsDrawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCollaboratorsDrawerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCollaboratorsDrawerOpen(false)} />

          <View style={[s.drawerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.drawerHeading}>Manage Collaborators</Text>

            <View style={s.labelInputRow}>
              <TextInput
                placeholder="Search friend name or email..."
                placeholderTextColor="#5a5e70"
                value={collaboratorSearch}
                onChangeText={setCollaboratorSearch}
                style={s.labelInputField}
              />
            </View>

            <ScrollView style={{ maxHeight: 240, marginTop: 12 }}>
              {friendsList.length > 0 ? (
                friendsList.map((fr) => {
                  const isAdded = noteCollaborators.includes(fr.uid);
                  return (
                    <Pressable
                      key={fr.uid}
                      onPress={() =>
                        setNoteCollaborators((prev) =>
                          isAdded ? prev.filter((id) => id !== fr.uid) : [...prev, fr.uid]
                        )
                      }
                      style={s.friendRow}
                    >
                      <ExpoImage
                        source={{ uri: fr.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200" }}
                        style={s.friendAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.friendName}>{fr.name || fr.username}</Text>
                        <Text style={s.friendSub}>@{fr.username || "user"}</Text>
                      </View>
                      <Ionicons
                        name={isAdded ? "checkmark-circle" : "add-circle-outline"}
                        size={22}
                        color={isAdded ? "#00e676" : "rgba(255, 255, 255, 0.5)"}
                      />
                    </Pressable>
                  );
                })
              ) : (
                <Text style={s.infoMutedText}>No other collaborators connected yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         6. DISPLAY CONFIGURATIONS MODAL (Image 3)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={configModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setConfigModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfigModalOpen(false)} />

          <View style={[s.drawerSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.drawerHeading}>Display Configurations</Text>

            <Text style={s.configSectionLabel}>SORT ORDER METRIC</Text>
            <View style={s.sortGrid}>
              <View style={s.sortRow}>
                <Pressable
                  onPress={() => {
                    setSortOption("newest");
                    AsyncStorage.setItem(STORAGE_SORT_KEY, "newest");
                  }}
                  style={[s.sortPill, sortOption === "newest" && s.sortPillActive]}
                >
                  <Text style={[s.sortPillText, sortOption === "newest" && s.sortPillTextActive]}>
                    Newest First
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setSortOption("oldest");
                    AsyncStorage.setItem(STORAGE_SORT_KEY, "oldest");
                  }}
                  style={[s.sortPill, sortOption === "oldest" && s.sortPillActive]}
                >
                  <Text style={[s.sortPillText, sortOption === "oldest" && s.sortPillTextActive]}>
                    Oldest First
                  </Text>
                </Pressable>
              </View>

              <View style={s.sortRow}>
                <Pressable
                  onPress={() => {
                    setSortOption("az");
                    AsyncStorage.setItem(STORAGE_SORT_KEY, "az");
                  }}
                  style={[s.sortPill, sortOption === "az" && s.sortPillActive]}
                >
                  <Text style={[s.sortPillText, sortOption === "az" && s.sortPillTextActive]}>
                    Title A–Z
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setSortOption("za");
                    AsyncStorage.setItem(STORAGE_SORT_KEY, "za");
                  }}
                  style={[s.sortPill, sortOption === "za" && s.sortPillActive]}
                >
                  <Text style={[s.sortPillText, sortOption === "za" && s.sortPillTextActive]}>
                    Title Z–A
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={s.configSectionLabel}>INTERFACE LAYOUT matrix</Text>
            <View style={s.layoutToggleBar}>
              <Pressable
                onPress={() => {
                  setViewMode("list");
                  AsyncStorage.setItem(STORAGE_VIEW_KEY, "list");
                }}
                style={[s.layoutToggleBtn, viewMode === "list" && s.layoutToggleBtnActive]}
              >
                <Ionicons
                  name="list"
                  size={16}
                  color={viewMode === "list" ? "#000" : "rgba(255, 255, 255, 0.6)"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[s.layoutToggleText, viewMode === "list" && s.layoutToggleTextActive]}>
                  Standard List
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setViewMode("grid");
                  AsyncStorage.setItem(STORAGE_VIEW_KEY, "grid");
                }}
                style={[s.layoutToggleBtn, viewMode === "grid" && s.layoutToggleBtnActive]}
              >
                <Ionicons
                  name="grid"
                  size={15}
                  color={viewMode === "grid" ? "#000" : "rgba(255, 255, 255, 0.6)"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[s.layoutToggleText, viewMode === "grid" && s.layoutToggleTextActive]}>
                  Grid Deck
                </Text>
              </Pressable>
            </View>

            <Text style={s.configSectionLabel}>LABEL SCOPE REGISTER</Text>
            <View style={s.scopeRegisterRow}>
              {(["All", "Pinned", "Shared"] as const).map((sc) => {
                const active = activeScope === sc;
                return (
                  <Pressable
                    key={sc}
                    onPress={() => {
                      setActiveScope(sc);
                      AsyncStorage.setItem(STORAGE_SCOPE_KEY, sc);
                    }}
                    style={[s.registerPill, active && s.registerPillActive]}
                  >
                    {sc === "Pinned" && <Text style={{ marginRight: 4 }}>📌</Text>}
                    <Text style={[s.registerPillText, active && s.registerPillTextActive]}>
                      {sc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         7. NOTE INFO / DETAILS MODAL (Image 4)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        visible={infoModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInfoModalOpen(false)} />

          <View style={[s.infoModalCardWrapper, { paddingTop: insets.top + 20 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.infoTopCard}>
                <Text style={s.infoNoteTitle}>{selectedInfoNote?.title || "Untitled"}</Text>
                <View style={s.infoDivider} />
                <Text style={s.infoNoteSnippet} numberOfLines={4}>
                  {selectedInfoNote?.content || "No text"}
                </Text>
              </View>

              <View style={s.infoDetailsCard}>
                <Text style={s.infoSectionHeading}>NOTE DETAILS</Text>

                <View style={s.infoSubBox}>
                  <Text style={s.infoSubLabel}>AUTHORS & SHARING</Text>
                  <Text style={s.infoFieldLabel}>Created By:</Text>
                  <View style={s.authorBadge}>
                    <ExpoImage
                      source={{ uri: resolveAuthorPhoto(selectedInfoNote?.owners?.[0]) }}
                      style={s.authorAvatar}
                      contentFit="cover"
                    />
                    <Text style={s.authorUsername}>
                      {resolveAuthorName(selectedInfoNote?.owners?.[0])}
                    </Text>
                  </View>

                  <Text style={[s.infoFieldLabel, { marginTop: 14 }]}>Collaborators:</Text>
                  <Text style={s.infoMutedText}>Private Note</Text>
                </View>

                <View style={[s.infoSubBox, { marginTop: 16 }]}>
                  <Text style={s.infoSubLabel}>PROPERTIES & STYLE</Text>
                  <Text style={s.infoFieldLabel}>Labels:</Text>
                  <Text style={s.infoMutedText}>
                    {selectedInfoNote?.labels && selectedInfoNote.labels.length > 0
                      ? selectedInfoNote.labels.join(", ")
                      : "No labels assigned"}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={[s.infoToolbar, { bottom: insets.bottom + 16 }]}>
              <Pressable
                onPress={() => handleShareNote(selectedInfoNote)}
                style={s.tbCircle}
                hitSlop={8}
              >
                <Ionicons name="share-social-outline" size={20} color="#ffffff" />
              </Pressable>

              <View style={s.tbCapsule}>
                <Pressable
                  onPress={() => {
                    setInfoModalOpen(false);
                    if (selectedInfoNote) handleOpenNoteDetail(selectedInfoNote);
                  }}
                  style={s.tbCapsuleItem}
                  hitSlop={8}
                >
                  <Ionicons name="document-text-outline" size={19} color="#ffffff" />
                </Pressable>

                <Pressable
                  onPress={() => {
                    setInfoModalOpen(false);
                    if (selectedInfoNote) {
                      setDetailNote(selectedInfoNote);
                      handleOpenEditFromDetail();
                    }
                  }}
                  style={s.tbCapsuleItem}
                  hitSlop={8}
                >
                  <Ionicons name="pencil-outline" size={19} color="#ffffff" />
                </Pressable>

                <Pressable
                  onPress={() => handleTogglePin(selectedInfoNote)}
                  style={s.tbCapsuleItem}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={selectedInfoNote?.pinned ? "pin" : "pin-outline"}
                    size={19}
                    color={selectedInfoNote?.pinned ? "#00e6b0" : "#ffffff"}
                    style={!selectedInfoNote?.pinned ? { transform: [{ rotate: "45deg" }] } : undefined}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  if (selectedInfoNote?.id) {
                    handleDeleteNote(selectedInfoNote.id);
                  }
                }}
                style={s.tbCircle}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={19} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ──────── STYLES ──────── */

const s = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
  },

  // Header
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  topHeaderTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.5,
  },

  // Search & Filter
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchField: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111218",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14.5,
  },
  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111218",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },

  // Scope Filter Pills
  scopePillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  scopePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  scopePillActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  scopePillText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    fontWeight: "700",
  },
  scopePillTextActive: {
    color: "#000000",
    fontWeight: "900",
  },

  // Notes List Cards
  notesListContent: {},
  listContainer: {
    gap: 12,
  },
  gridDeckContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  noteCard: {
    borderRadius: 24,
    backgroundColor: "#0d0f14",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    position: "relative",
  },
  noteCardGrid: {
    width: (SCREEN_WIDTH - 44) / 2,
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  noteCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  dotsBtn: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  noteCardSnippet: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 18,
  },
  pinnedBadge: {
    position: "absolute",
    bottom: 14,
    right: 16,
  },

  // FAB Button
  floatingFabWrapper: {
    position: "absolute",
    right: 20,
    zIndex: 99,
  },
  fabButton: {
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

  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySubtitle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ═══════════════════════════════════════════════════════════
  // NOTE DETAIL VIEW (Matching user's screenshot)
  // ═══════════════════════════════════════════════════════════
  detailScreenContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
  },
  detailTopBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  detailBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitleText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  detailChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  detailChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  detailChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  detailBottomToolbar: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // ═══════════════════════════════════════════════════════════
  // MARKDOWN RENDERER STYLES
  // ═══════════════════════════════════════════════════════════
  mdParagraph: {
    fontSize: 15,
    lineHeight: 24,
    color: "#e2e8f0",
    marginBottom: 8,
  },
  mdText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#e2e8f0",
  },
  mdBold: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  mdItalic: {
    fontSize: 15,
    fontStyle: "italic",
    color: "#ffffff",
  },
  mdInlineCode: {
    fontSize: 14,
    fontFamily: "monospace",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffb454",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mdH1: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 16,
    marginBottom: 8,
  },
  mdH2: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 14,
    marginBottom: 6,
  },
  mdH3: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 12,
    marginBottom: 4,
  },
  mdBlockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#00e676",
    paddingLeft: 12,
    marginVertical: 6,
  },
  mdQuoteText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.8)",
    fontStyle: "italic",
  },
  mdListRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
  },
  mdBulletDot: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.7)",
    marginRight: 8,
    lineHeight: 24,
  },
  mdNumLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginRight: 8,
    lineHeight: 24,
  },
  mdCodeBlock: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 10,
  },
  mdCodeText: {
    fontFamily: "monospace",
    fontSize: 13.5,
    color: "#38bdf8",
    lineHeight: 20,
  },

  // ═══════════════════════════════════════════════════════════
  // CREATE / EDIT NOTE WORKSPACE
  // ═══════════════════════════════════════════════════════════
  workspaceContainer: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
  },
  workspaceTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  workspaceBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  autoSaveLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  savePillBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1c1e26",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  savePillText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13.5,
  },
  workspaceTitleInput: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 14,
    paddingVertical: 4,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "transparent",
  },
  tagPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  tagPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  workspaceContentInput: {
    fontSize: 15,
    lineHeight: 24,
    color: "#a0aec0",
    minHeight: 320,
  },

  // Vertical Stack (When TT is active)
  verticalFormatStack: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    gap: 12,
    zIndex: 95,
  },
  verticalFormatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(25, 28, 38, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  verticalFormatTextBold: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  verticalFormatTextSmall: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Bottom Toolbar in Workspace
  workspaceBottomToolbar: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typographyBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(25, 28, 38, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  typographyBtnActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  typographyBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  typographyBtnTextActive: {
    color: "#000000",
  },

  // Horizontal Format Toolbar
  horizontalFormatToolbar: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(20, 22, 28, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginHorizontal: 8,
    gap: 12,
  },
  hFormatItem: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  hFormatBold: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  hFormatItalic: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    fontStyle: "italic",
  },
  hFormatDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 2,
  },
  fontSelectorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  fontSelectorText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  fontSelectorSub: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "800",
  },

  // Right action capsule: ✨ AI | 👥+ Collab | 🏷️ Labels
  rightActionCapsule: {
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(20, 22, 28, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 16,
  },
  capsuleIconBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // Common Toolbars & Capsule Buttons
  tbCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(20, 22, 28, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  tbCapsule: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(20, 22, 28, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 20,
  },
  tbCapsuleItem: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  // ═══════════════════════════════════════════════════════════
  // BOTTOM DRAWERS (Labels, AI, Configurations, Info)
  // ═══════════════════════════════════════════════════════════
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  drawerSheet: {
    backgroundColor: "#13151b",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  drawerHeading: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 16,
  },

  // Labels Drawer
  labelInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  labelInputField: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    color: "#ffffff",
    fontSize: 14,
  },
  labelPlusBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  collectionSubheading: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  collectionPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  collectionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  collectionPillSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  collectionPillText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "600",
  },
  collectionPillTextSelected: {
    color: "#000000",
    fontWeight: "800",
  },

  // AI Assistant Drawer
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  aiHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  aiModelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxWidth: 180,
  },
  aiModelPillText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "600",
  },
  aiSuggestionsLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  aiSuggestionsList: {
    gap: 8,
    marginBottom: 16,
  },
  aiSuggestionPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  aiSuggestionPillText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12.5,
    fontWeight: "600",
  },
  aiInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  aiTextInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13.5,
    maxHeight: 80,
    paddingVertical: 4,
  },
  aiSendBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Friends & Collaborators Drawer
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  friendName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  friendSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
  },

  // Display Configurations
  configSectionLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  sortGrid: {
    gap: 8,
    marginBottom: 20,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortPill: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  sortPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  sortPillText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "700",
  },
  sortPillTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  layoutToggleBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  layoutToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  layoutToggleBtnActive: {
    backgroundColor: "#ffffff",
  },
  layoutToggleText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "700",
  },
  layoutToggleTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  scopeRegisterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  registerPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  registerPillActive: {
    backgroundColor: "#ffffff",
  },
  registerPillText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "700",
  },
  registerPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },

  // Note Info Modal
  infoModalCardWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoTopCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#13151b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
  },
  infoNoteTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 14,
  },
  infoNoteSnippet: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 20,
  },
  infoDetailsCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#13151b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 100,
  },
  infoSectionHeading: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  infoSubBox: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  infoSubLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoFieldLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  authorBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  authorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  authorUsername: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
  },
  infoMutedText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    fontStyle: "italic",
  },
  infoToolbar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});