// src/contexts/ChatSettingsContext.tsx
// Enterprise-Grade Chat Settings Context for Bunkmates
// Manages application-wide chat preferences: wallpaper, enter is send, read receipts,
// typing indicators, media auto-download, disappearing messages, and archive management.
// Cleanly decoupled from global Appearance (theme/font scale are mirrored from ThemeContext).

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export type ChatTheme = "system" | "light" | "dark";
export type DisappearingTimer = "off" | "24h" | "7d" | "30d" | "90d";

export interface WallpaperOption {
  id: string;
  name: string;
  category: "minimal" | "nature" | "space" | "urban";
  uri: string;
}

export const wallpaperList: WallpaperOption[] = [
  { id: "default", name: "Default (Theme Dynamic)", category: "minimal", uri: "" },
  { id: "space1", name: "Deep Cosmos", category: "space", uri: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d" },
  { id: "nebula1", name: "Stellar Nebula", category: "space", uri: "https://images.unsplash.com/photo-1478720568477-152d9b164e26" },
  { id: "moon", name: "Lunar Eclipse", category: "space", uri: "https://images.unsplash.com/photo-1529921879218-f5f994d8f07d" },
  { id: "mountain1", name: "Alpine Peak", category: "nature", uri: "https://images.unsplash.com/photo-1501785888041-af3ef285b470" },
  { id: "forest1", name: "Misty Pine", category: "nature", uri: "https://images.unsplash.com/photo-1506765515384-028b60a970df" },
  { id: "ocean1", name: "Pacific Azure", category: "nature", uri: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e" },
  { id: "desert1", name: "Sahara Dunes", category: "nature", uri: "https://images.unsplash.com/photo-1518810458646-6f7f93c606f5" },
  { id: "valley", name: "Emerald Valley", category: "nature", uri: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438" },
  { id: "aurora", name: "Northern Lights", category: "nature", uri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" },
  { id: "city1", name: "Neon Metropolis", category: "urban", uri: "https://images.unsplash.com/photo-1492528459143-9e8efeb3c23b" },
  { id: "redmountain", name: "Crimson Ridge", category: "nature", uri: "https://images.unsplash.com/photo-1549888834-0e916ee2bfdc" },
];

export interface ChatPreferences {
  wallpaper: string;
  enterIsSend: boolean;
  readReceipts: boolean;
  typingIndicator: boolean;
  autoDownloadMedia: boolean;
  saveToGallery: boolean;
  linkPreviews: boolean;
  disappearingTimer: DisappearingTimer;
  keepArchived: boolean;
  clearedAt?: string | null;
  deletedAt?: string | null;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  wallpaper: "default",
  enterIsSend: false,
  readReceipts: true,
  typingIndicator: true,
  autoDownloadMedia: true,
  saveToGallery: false,
  linkPreviews: true,
  disappearingTimer: "off",
  keepArchived: true,
  clearedAt: null,
  deletedAt: null,
};

export interface ChatSettingsContextType extends ChatPreferences {
  // Legacy backward-compatibility getters & setters
  theme: ChatTheme;
  setTheme: (t: ChatTheme) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  setWallpaper: (w: string) => void;

  // Modern setters
  setEnterIsSend: (val: boolean) => void;
  setReadReceipts: (val: boolean) => void;
  setTypingIndicator: (val: boolean) => void;
  setAutoDownloadMedia: (val: boolean) => void;
  setSaveToGallery: (val: boolean) => void;
  setLinkPreviews: (val: boolean) => void;
  setDisappearingTimer: (timer: DisappearingTimer) => void;
  setKeepArchived: (val: boolean) => void;

  // Archive & Storage Management
  archivedChatIds: string[];
  isChatArchived: (chatId: string) => boolean;
  toggleArchiveChat: (chatId: string) => Promise<void>;
  clearedAt: string | null;
  deletedAt: string | null;

  // Unified updater & management
  updateChatPreferences: (prefs: Partial<ChatPreferences>) => Promise<void>;
  clearAllChats: () => Promise<void>;
  deleteAllChats: () => Promise<void>;
  resetChatPreferences: () => Promise<void>;
}

const ChatSettingsContext = createContext<ChatSettingsContextType | undefined>(undefined);

export const ChatSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // Core settings state
  const [wallpaper, setWallpaperState] = useState<string>(DEFAULT_CHAT_PREFERENCES.wallpaper);
  const [enterIsSend, setEnterIsSendState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.enterIsSend);
  const [readReceipts, setReadReceiptsState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.readReceipts);
  const [typingIndicator, setTypingIndicatorState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.typingIndicator);
  const [autoDownloadMedia, setAutoDownloadMediaState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.autoDownloadMedia);
  const [saveToGallery, setSaveToGalleryState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.saveToGallery);
  const [linkPreviews, setLinkPreviewsState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.linkPreviews);
  const [disappearingTimer, setDisappearingTimerState] = useState<DisappearingTimer>(DEFAULT_CHAT_PREFERENCES.disappearingTimer);
  const [keepArchived, setKeepArchivedState] = useState<boolean>(DEFAULT_CHAT_PREFERENCES.keepArchived);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>([]);

  // Backward compatibility legacy values
  const [legacyTheme, setLegacyTheme] = useState<ChatTheme>("system");
  const [legacyFontSize, setLegacyFontSize] = useState<number>(15);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Restore cached settings from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [cachedPrefs, cachedCleared, cachedDeleted, cachedArchived] = await Promise.all([
          AsyncStorage.getItem("@bunkmates_chat_preferences"),
          AsyncStorage.getItem("@bunkmates_chats_cleared_at"),
          AsyncStorage.getItem("@bunkmates_chats_deleted_at"),
          AsyncStorage.getItem("@bunkmates_archived_chat_ids"),
        ]);

        if (cachedPrefs) {
          const parsed = JSON.parse(cachedPrefs);
          if (parsed.wallpaper !== undefined) setWallpaperState(parsed.wallpaper);
          if (parsed.enterIsSend !== undefined) setEnterIsSendState(parsed.enterIsSend);
          if (parsed.readReceipts !== undefined) setReadReceiptsState(parsed.readReceipts);
          if (parsed.typingIndicator !== undefined) setTypingIndicatorState(parsed.typingIndicator);
          if (parsed.autoDownloadMedia !== undefined) setAutoDownloadMediaState(parsed.autoDownloadMedia);
          if (parsed.saveToGallery !== undefined) setSaveToGalleryState(parsed.saveToGallery);
          if (parsed.linkPreviews !== undefined) setLinkPreviewsState(parsed.linkPreviews);
          if (parsed.disappearingTimer !== undefined) setDisappearingTimerState(parsed.disappearingTimer);
          if (parsed.keepArchived !== undefined) setKeepArchivedState(parsed.keepArchived);
        }

        if (cachedCleared) setClearedAt(cachedCleared);
        if (cachedDeleted) setDeletedAt(cachedDeleted);
        if (cachedArchived) {
          try {
            setArchivedChatIds(JSON.parse(cachedArchived));
          } catch {}
        }
      } catch (e) {
        console.warn("Failed to load @bunkmates_chat_preferences from AsyncStorage:", e);
      }
    })();
  }, []);

  // Real-time Firestore sync
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.chatPreferences) {
          const cp = data.chatPreferences;
          if (cp.wallpaper !== undefined) setWallpaperState(cp.wallpaper);
          if (cp.enterIsSend !== undefined) setEnterIsSendState(cp.enterIsSend);
          if (cp.readReceipts !== undefined) setReadReceiptsState(cp.readReceipts);
          if (cp.typingIndicator !== undefined) setTypingIndicatorState(cp.typingIndicator);
          if (cp.autoDownloadMedia !== undefined) setAutoDownloadMediaState(cp.autoDownloadMedia);
          if (cp.saveToGallery !== undefined) setSaveToGalleryState(cp.saveToGallery);
          if (cp.linkPreviews !== undefined) setLinkPreviewsState(cp.linkPreviews);
          if (cp.disappearingTimer !== undefined) setDisappearingTimerState(cp.disappearingTimer);
          if (cp.keepArchived !== undefined) setKeepArchivedState(cp.keepArchived);
          if (cp.clearedAt !== undefined) setClearedAt(cp.clearedAt);
          if (cp.deletedAt !== undefined) setDeletedAt(cp.deletedAt);
          if (Array.isArray(cp.archivedChatIds)) setArchivedChatIds(cp.archivedChatIds);
        }
      },
      (err) => {
        console.log("ChatPreferences onSnapshot error:", err);
      }
    );
    return () => unsub();
  }, [user]);

  // Persistence handler
  const updateChatPreferences = useCallback(
    async (prefs: Partial<ChatPreferences>) => {
      if (prefs.wallpaper !== undefined) setWallpaperState(prefs.wallpaper);
      if (prefs.enterIsSend !== undefined) setEnterIsSendState(prefs.enterIsSend);
      if (prefs.readReceipts !== undefined) setReadReceiptsState(prefs.readReceipts);
      if (prefs.typingIndicator !== undefined) setTypingIndicatorState(prefs.typingIndicator);
      if (prefs.autoDownloadMedia !== undefined) setAutoDownloadMediaState(prefs.autoDownloadMedia);
      if (prefs.saveToGallery !== undefined) setSaveToGalleryState(prefs.saveToGallery);
      if (prefs.linkPreviews !== undefined) setLinkPreviewsState(prefs.linkPreviews);
      if (prefs.disappearingTimer !== undefined) setDisappearingTimerState(prefs.disappearingTimer);
      if (prefs.keepArchived !== undefined) setKeepArchivedState(prefs.keepArchived);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_chat_preferences");
        const existing = cached ? JSON.parse(cached) : DEFAULT_CHAT_PREFERENCES;
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_chat_preferences",
          JSON.stringify(updated)
        );
        if (prefs.wallpaper !== undefined) {
          await AsyncStorage.setItem("chat_wallpaper", prefs.wallpaper);
        }
      } catch (e) {
        console.warn("AsyncStorage save chat preferences error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            chatPreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("Firestore write chatPreferences error:", e);
        }
      }
    },
    [user]
  );

  // Archive handlers
  const toggleArchiveChat = useCallback(
    async (chatId: string) => {
      setArchivedChatIds((prev) => {
        const isArchived = prev.includes(chatId);
        const next = isArchived ? prev.filter((id) => id !== chatId) : [...prev, chatId];
        AsyncStorage.setItem("@bunkmates_archived_chat_ids", JSON.stringify(next)).catch(() => {});
        if (user) {
          updateDoc(doc(db, "users", user.uid), {
            "chatPreferences.archivedChatIds": next,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
        return next;
      });
    },
    [user]
  );

  const isChatArchived = useCallback(
    (chatId: string) => archivedChatIds.includes(chatId),
    [archivedChatIds]
  );

  // Modern setters calling updateChatPreferences
  const setWallpaper = useCallback((w: string) => updateChatPreferences({ wallpaper: w }), [updateChatPreferences]);
  const setEnterIsSend = useCallback((v: boolean) => updateChatPreferences({ enterIsSend: v }), [updateChatPreferences]);
  const setReadReceipts = useCallback((v: boolean) => updateChatPreferences({ readReceipts: v }), [updateChatPreferences]);
  const setTypingIndicator = useCallback((v: boolean) => updateChatPreferences({ typingIndicator: v }), [updateChatPreferences]);
  const setAutoDownloadMedia = useCallback((v: boolean) => updateChatPreferences({ autoDownloadMedia: v }), [updateChatPreferences]);
  const setSaveToGallery = useCallback((v: boolean) => updateChatPreferences({ saveToGallery: v }), [updateChatPreferences]);
  const setLinkPreviews = useCallback((v: boolean) => updateChatPreferences({ linkPreviews: v }), [updateChatPreferences]);
  const setDisappearingTimer = useCallback((t: DisappearingTimer) => updateChatPreferences({ disappearingTimer: t }), [updateChatPreferences]);
  const setKeepArchived = useCallback((v: boolean) => updateChatPreferences({ keepArchived: v }), [updateChatPreferences]);

  // Reset all preferences
  const resetChatPreferences = useCallback(async () => {
    await updateChatPreferences(DEFAULT_CHAT_PREFERENCES);
  }, [updateChatPreferences]);

  // Clear all chats: resets messages
  const clearAllChats = useCallback(async () => {
    try {
      const ts = new Date().toISOString();
      setClearedAt(ts);
      await AsyncStorage.setItem("@bunkmates_chats_cleared_at", ts);
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          "chatPreferences.clearedAt": ts,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("clearAllChats error:", e);
    }
  }, [user]);

  // Delete all chats
  const deleteAllChats = useCallback(async () => {
    try {
      const ts = new Date().toISOString();
      setDeletedAt(ts);
      setClearedAt(ts);
      setArchivedChatIds([]);
      await Promise.all([
        AsyncStorage.setItem("@bunkmates_chats_deleted_at", ts),
        AsyncStorage.setItem("@bunkmates_chats_cleared_at", ts),
        AsyncStorage.removeItem("@bunkmates_archived_chat_ids"),
      ]);
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          "chatPreferences.deletedAt": ts,
          "chatPreferences.clearedAt": ts,
          "chatPreferences.archivedChatIds": [],
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("deleteAllChats error:", e);
    }
  }, [user]);

  const contextValue: ChatSettingsContextType = {
    // Current preferences
    wallpaper,
    enterIsSend,
    readReceipts,
    typingIndicator,
    autoDownloadMedia,
    saveToGallery,
    linkPreviews,
    disappearingTimer,
    keepArchived,
    clearedAt,
    deletedAt,
    archivedChatIds,
    isChatArchived,
    toggleArchiveChat,

    // Setters
    setWallpaper,
    setEnterIsSend,
    setReadReceipts,
    setTypingIndicator,
    setAutoDownloadMedia,
    setSaveToGallery,
    setLinkPreviews,
    setDisappearingTimer,
    setKeepArchived,

    // Actions
    updateChatPreferences,
    clearAllChats,
    deleteAllChats,
    resetChatPreferences,

    // Legacy backward-compatibility
    theme: legacyTheme,
    setTheme: setLegacyTheme,
    fontSize: legacyFontSize,
    setFontSize: setLegacyFontSize,
  };

  return (
    <ChatSettingsContext.Provider value={contextValue}>
      {children}
    </ChatSettingsContext.Provider>
  );
};

export const useChatSettings = (): ChatSettingsContextType => {
  const ctx = useContext(ChatSettingsContext);
  if (!ctx) {
    throw new Error("useChatSettings must be used within ChatSettingsProvider");
  }
  return ctx;
};
