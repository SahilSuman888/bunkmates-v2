import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type ChatTheme = "system" | "light" | "dark";

// small collection of placeholder wallpapers, export so other screens can
// reference the same URI mapping (chat settings picker + chat room).
export const wallpaperList = [
  { id: "default", uri: "" },
  { id: "space1", uri: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d" },
  { id: "mountain1", uri: "https://images.unsplash.com/photo-1501785888041-af3ef285b470" },
  { id: "forest1", uri: "https://images.unsplash.com/photo-1506765515384-028b60a970df" },
  { id: "desert1", uri: "https://images.unsplash.com/photo-1518810458646-6f7f93c606f5" },
  { id: "ocean1", uri: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e" },
  { id: "city1", uri: "https://images.unsplash.com/photo-1492528459143-9e8efeb3c23b" },
  { id: "nebula1", uri: "https://images.unsplash.com/photo-1478720568477-152d9b164e26" },
  { id: "redmountain", uri: "https://images.unsplash.com/photo-1549888834-0e916ee2bfdc" },
  { id: "valley", uri: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438" },
  { id: "moon", uri: "https://images.unsplash.com/photo-1529921879218-f5f994d8f07d" },
  { id: "aurora", uri: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" },
];

export interface ChatSettingsType {
  theme: ChatTheme;
  setTheme: (t: ChatTheme) => void;
  wallpaper: string;
  setWallpaper: (w: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
}

const ChatSettingsContext = createContext<ChatSettingsType | undefined>(undefined);

export const ChatSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ChatTheme>("system");
  const [wallpaper, setWallpaperState] = useState<string>("default");
  const [fontSize, setFontSizeState] = useState<number>(14);

  useEffect(() => {
    (async () => {
      try {
        const t = (await AsyncStorage.getItem("chat_theme")) as ChatTheme | null;
        const w = await AsyncStorage.getItem("chat_wallpaper");
        const f = await AsyncStorage.getItem("chat_font_size");
        if (t) setThemeState(t);
        if (w) setWallpaperState(w);
        if (f) setFontSizeState(parseInt(f, 10));
      } catch (e) {
        console.warn("failed to load chat settings", e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("chat_theme", theme);
  }, [theme]);

  useEffect(() => {
    AsyncStorage.setItem("chat_wallpaper", wallpaper);
  }, [wallpaper]);

  useEffect(() => {
    AsyncStorage.setItem("chat_font_size", fontSize.toString());
  }, [fontSize]);

  // listen to system changes when using system theme
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (theme === "system") {
        // no-op but trigger update if needed
        setThemeState((prev) => (prev === "system" ? "system" : prev));
      }
    });
    return () => sub.remove();
  }, [theme]);

  const contextValue: ChatSettingsType = {
    theme,
    setTheme: setThemeState,
    wallpaper,
    setWallpaper: setWallpaperState,
    fontSize,
    setFontSize: setFontSizeState,
  };

  return (
    <ChatSettingsContext.Provider value={contextValue}>
      {children}
    </ChatSettingsContext.Provider>
  );
};

export const useChatSettings = () => {
  const ctx = useContext(ChatSettingsContext);
  if (!ctx) {
    throw new Error("useChatSettings must be used within ChatSettingsProvider");
  }
  return ctx;
};
