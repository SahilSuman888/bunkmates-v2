import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type ChatTheme = "system" | "light" | "dark";

export const DEFAULT_WALLPAPER_ASSET = require("../../assets/images/chatbg/1.jpeg");

// Curated local bundled wallpapers from assets/images/chatbg (instant offline rendering, zero network lag)
export const wallpaperList = [
  { id: "default", asset: require("../../assets/images/chatbg/dark.png"), uri: "", label: "Dark Waves" },
  { id: "gargantua", asset: require("../../assets/images/chatbg/1.jpeg"), uri: "local:chatbg:1", label: "Gargantua" },
  { id: "gundam", asset: require("../../assets/images/chatbg/2.jpeg"), uri: "local:chatbg:2", label: "Mecha Gundam" },
  { id: "cybercity", asset: require("../../assets/images/chatbg/3.jpeg"), uri: "local:chatbg:3", label: "Cyber City" },
  { id: "aesthetic", asset: require("../../assets/images/chatbg/4.jpeg"), uri: "local:chatbg:4", label: "Neon Dusk" },
  { id: "solitary", asset: require("../../assets/images/chatbg/5.jpeg"), uri: "local:chatbg:5", label: "Solitary Star" },
  { id: "abstract", asset: require("../../assets/images/chatbg/6.jpeg"), uri: "local:chatbg:6", label: "Dark Texture" },
  { id: "drift", asset: require("../../assets/images/chatbg/7.jpeg"), uri: "local:chatbg:7", label: "Cosmic Drift" },
  { id: "portal", asset: require("../../assets/images/chatbg/8.jpeg"), uri: "local:chatbg:8", label: "Neon Horizon" },
  { id: "deepspace", asset: require("../../assets/images/chatbg/9.jpeg"), uri: "local:chatbg:9", label: "Deep Space" },
  { id: "cyberwave", asset: require("../../assets/images/chatbg/10.jpeg"), uri: "local:chatbg:10", label: "Cyberwave" },
  { id: "retrocity", asset: require("../../assets/images/chatbg/11.jpeg"), uri: "local:chatbg:11", label: "Retro City" },
  { id: "aurora", asset: require("../../assets/images/chatbg/12.jpeg"), uri: "local:chatbg:12", label: "Midnight Aurora" },
  { id: "eclipse", asset: require("../../assets/images/chatbg/13.jpeg"), uri: "local:chatbg:13", label: "Solar Eclipse" },
  { id: "lightmesh", asset: require("../../assets/images/chatbg/light.png"), uri: "local:chatbg:light", label: "Clean Mesh" },
];

export const getWallpaperSource = (wallpaperIdOrUri: string | null | undefined) => {
  if (!wallpaperIdOrUri || wallpaperIdOrUri === "default") {
    return DEFAULT_WALLPAPER_ASSET;
  }
  const str = String(wallpaperIdOrUri).trim();
  if (
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("file:") ||
    str.startsWith("content:") ||
    str.startsWith("data:") ||
    str.startsWith("/")
  ) {
    return { uri: str };
  }
  const match = wallpaperList.find(
    (w) => w.id === str || w.uri === str
  );
  if (match && match.asset) {
    return match.asset;
  }
  return DEFAULT_WALLPAPER_ASSET;
};

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
