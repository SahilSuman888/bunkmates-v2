import {
  Feather,
  Ionicons,
  MaterialIcons
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, // **@** Added Appearance for theme detection
  Animated, // **@** Added Platform import
  Appearance, // **@** Added Animated for header mask gradient reveal on scroll
  BackHandler,
  Dimensions,
  Easing,
  Image,
  Keyboard, // **@** Defer heavy work until after nav animation
  Linking, // **@** Added Keyboard for in-settings search dismissal
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonLoadingScreen } from "../../components/ui/SkeletonLoadingScreen";
import { useLanguage } from "../../contexts/LanguageContext"; // **@** Dynamic language hook
import { useThemeToggle } from "../../contexts/ThemeContext"; // **@** Added dynamic theme hook
import { useUser } from "../../contexts/UserContext";
import { db } from "../../lib/firebase";
import { SettingsHeaderGradientMask } from "./_components/SettingsHeaderGradientMask";
import { SwipeableDrawer } from "./_components/SwipeableDrawer";

type SettingsPage =
  | "main"
  | "about"
  | "appInfo"
  | "licenses"
  | "qr"
  | "developers";

type ProfileData = {
  name: string;
  username: string;
  email: string;
  mobile: string;
  bio: string;
  photoURL: string;
  type: string;
};

interface SearchItem {
  id: string;
  category: "ACCOUNT" | "APP SETTINGS" | "TRIP EXPERIENCE" | "SUPPORT" | "DEVELOPER";
  title: string;
  subtitle: string;
  keywords: string[];
  icon: string;
  iconFamily?: "ionicons" | "feather" | "material";
  badge?: string;
  rightText?: string;
  route?: string;
  onAction?: () => void;
}

// ============================================================
// RESPONSIVE UI HELPERS
// ============================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

// Base design size: 375 x 812
const SCALE = Math.min(SCREEN_WIDTH / 375, 1.15);

const rs = (size: number) =>
  Math.round(size * SCALE);

const verticalScale = (size: number) =>
  Math.round(
    size *
    Math.min(
      SCREEN_HEIGHT / 812,
      1.15
    )
  );

// **@** SettingRowContext provides dynamic theme colors and font scaling
// to all SettingRow items with stable component identity (zero inline re-creation)
const SettingsRowContext = React.createContext<{
  isDark: boolean;
  colors: any;
  fontScale: number;
}>({
  isDark: true,
  colors: null,
  fontScale: 1,
});

type SettingRowProps = {
  icon: any;
  iconFamily?: "ionicons" | "material" | "feather";
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  category?: string;
  rightText?: string;
  badge?: string;
  onPress?: () => void;
  isLast?: boolean;
  isDark?: boolean;
  colors?: {
    divider: string;
    textPrimary: string;
    textSecondary: string;
    chevron: string;
    coralBg: string;
    greyishWhite: string;
    iconBoxBg: string;
  };
};

const SettingRow = React.memo(function SettingRow({
  icon,
  iconFamily = "ionicons",
  iconColor,
  iconBg,
  title,
  subtitle,
  category,
  rightText,
  badge,
  onPress,
  isLast = false,
  isDark: propIsDark,
  colors: propColors,
}: SettingRowProps) {
  const rowCtx = React.useContext(SettingsRowContext);
  const isDark = propIsDark ?? rowCtx.isDark;
  const colors = propColors ?? rowCtx.colors;
  const fontScale = rowCtx.fontScale || 1.0;

  const textPrimary = colors?.textPrimary ?? (isDark ? "#FFFFFF" : "#11141A");
  const textSecondary = colors?.textSecondary ?? (isDark ? "#F1F1F1" : "#7E8590");
  const chevronColor = colors?.chevron ?? (isDark ? "#555860" : "#B4B9C2");
  const defaultIconColor = colors?.greyishWhite ?? (isDark ? "#F1F1F1" : "#4B5563");
  const finalIconColor = iconColor ?? defaultIconColor;
  const resolvedIconBg = iconBg ?? (colors?.iconBoxBg ?? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"));

  const scaleFont = (s: number) => Math.round(s * fontScale);

  return (
    <>
      <Pressable
        onPress={onPress}
        android_ripple={{
          color: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
        }}
        style={({ pressed }) => [
          styles.modernRow,
          Platform.OS === "ios" &&
          pressed && {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(0,0,0,0.03)",
          },
        ]}
      >
        <View style={[styles.modernIconBox, { backgroundColor: resolvedIconBg }]}>
          {iconFamily === "material" ? (
            <MaterialIcons name={icon as any} size={20} color={finalIconColor} />
          ) : iconFamily === "feather" ? (
            <Feather name={icon as any} size={19} color={finalIconColor} />
          ) : (
            <Ionicons name={icon as any} size={20} color={finalIconColor} />
          )}
        </View>

        <View style={styles.modernRowContent}>
          <View style={styles.modernRowTextGroup}>
            <View style={styles.modernRowTitleWrap}>
              <Text
                style={[
                  styles.modernRowTitle,
                  { color: textPrimary, fontSize: scaleFont(15) },
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {category ? (
                <View
                  style={[
                    styles.modernCategoryBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modernCategoryBadgeText,
                      { color: textSecondary, fontSize: scaleFont(9.5) },
                    ]}
                  >
                    {category}
                  </Text>
                </View>
              ) : null}
              {badge ? (
                <View style={styles.modernHotBadge}>
                  <Text style={[styles.modernHotBadgeText, { fontSize: scaleFont(10) }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Text
                style={[
                  styles.modernRowSubtitle,
                  { color: textSecondary, fontSize: scaleFont(12.5) },
                ]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.modernRowRightGroup}>
            {rightText ? (
              <Text
                style={[
                  styles.modernRowRightText,
                  { color: textSecondary, fontSize: scaleFont(13.5) },
                ]}
              >
                {rightText}
              </Text>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={17}
              color={chevronColor}
            />
          </View>
        </View>
      </Pressable>
      {!isLast && (
        <View
          style={[
            styles.modernDivider,
            {
              backgroundColor:
                colors?.divider ??
                (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"),
            },
          ]}
        />
      )}
    </>
  );
});

let lastNavigateTime = 0;

export default function ProfileSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useMemo(
    () =>
      insets.top > 0
        ? insets.top
        : Platform.OS === "android"
          ? (StatusBar.currentHeight || 24)
          : 44,
    [insets.top]
  );
  const { language: activeLanguage, t: tr } = useLanguage();

  // **@** Snappy, instant navigation helper with minimal 200ms double-tap protection
  const smoothNavigate = useCallback(
    (route: string) => {
      const now = Date.now();
      if (now - lastNavigateTime < 200) return;
      lastNavigateTime = now;
      router.push(route as any);
    },
    [router]
  );

  // **@** Redirect to Google Play Store to rate BunkMates
  const handleRateApp = useCallback(async () => {
    const playStoreUrl = "https://play.google.com/store/apps/details?id=com.bm.bunkmate";
    const marketUrl = "market://details?id=com.bm.bunkmate";

    try {
      if (Platform.OS === "android") {
        const canOpenMarket = await Linking.canOpenURL(marketUrl);
        if (canOpenMarket) {
          await Linking.openURL(marketUrl);
          return;
        }
      }
      await Linking.openURL(playStoreUrl);
    } catch {
      Linking.openURL(playStoreUrl).catch(() => { });
    }
  }, [tr]);

  const { user, loading: authLoading, userData } = useUser();

  const params = useLocalSearchParams<{ page?: string; search?: string }>();

  useEffect(() => {
    if (params?.page === "developers") {
      router.replace("/settings/developers" as any);
    }
  }, [params?.page, router]);

  // Developer mode — taps on Build ID opens the developer passkey modal
  const [tapCount, setTapCount] = useState(0);
  const [showDevDialog, setShowDevDialog] = useState(false);
  const [enteredKey, setEnteredKey] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedLanguage, setSelectedLanguage] = useState("English (India)");

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_locale_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.language) setSelectedLanguage(parsed.language);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Compact Floating Bottom Search Bar layout & positioning
  const BOTTOM_NAV_HEIGHT = 10;
  const BOTTOM_NAV_BASE_OFFSET = Math.max(insets.bottom, 10) + 8;
  const GAP_ABOVE_BOTTOM_NAV = 1;
  const searchBottomOffset = BOTTOM_NAV_BASE_OFFSET + BOTTOM_NAV_HEIGHT + GAP_ABOVE_BOTTOM_NAV;

  // **@** In-Place Single-Page Search Mode (Components change with 0.2s smooth mix-and-merge)
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const searchInputRef = useRef<TextInputInstance>(null);

  const searchMorphAnim = useRef(new Animated.Value(0)).current;
  const keyboardLift = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const RESTING_PILL_WIDTH = Math.min(185, SCREEN_WIDTH - 48);
  const EXPANDED_PILL_WIDTH = SCREEN_WIDTH - 32;

  const handleOpenSearch = useCallback(() => {
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(searchMorphAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSearchActive(true);
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
    });
  }, [contentFadeAnim, searchMorphAnim]);

  const handleCloseSearch = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(searchMorphAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsSearchActive(false);
      setSearchQuery("");
      setSelectedCategory("ALL");
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
  }, [contentFadeAnim, searchMorphAnim]);

  // Open search mode automatically if navigated with ?search=true or ?page=search
  useEffect(() => {
    if (params?.search === "true" || params?.page === "search") {
      handleOpenSearch();
    }
  }, [params?.search, params?.page, handleOpenSearch]);

  // Keyboard tracking for lifting the search bar smoothly above keyboard
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      const h = e.endCoordinates ? e.endCoordinates.height : 0;
      const targetOffset = -Math.max(0, h + 10 - searchBottomOffset);
      const isAndroid = Platform.OS === "android";
      const dur = isAndroid ? 100 : (e.duration || 180);

      Animated.timing(keyboardLift, {
        toValue: targetOffset,
        duration: dur,
        easing: isAndroid ? Easing.out(Easing.quad) : Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start();
    };

    const onHide = (e: any) => {
      const dur = Platform.OS === "ios" ? (e?.duration || 180) : 100;
      Animated.timing(keyboardLift, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [searchBottomOffset, keyboardLift]);

  const animatedSearchPillWidth = searchMorphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RESTING_PILL_WIDTH, EXPANDED_PILL_WIDTH],
  });

  const mainSettingsOpacity = searchMorphAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp",
  });

  const searchContentOpacity = searchMorphAnim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0.35, 1],
    extrapolate: "clamp",
  });

  // Initialize profile with cached data immediately so there is zero delay and zero layout jump
  const [profile, setProfile] = useState<ProfileData>(() => ({
    name: userData?.name || userData?.displayName || user?.displayName || "",
    username: userData?.username || "",
    email: userData?.email || user?.email || "",
    mobile: userData?.mobile || userData?.phone || user?.phoneNumber || "",
    bio: userData?.bio || "",
    photoURL: userData?.photoURL || user?.photoURL || "",
    type: userData?.type || "Member",
  }));

  // Keep profile synchronized with real-time userData without unnecessary re-renders
  useEffect(() => {
    if (userData) {
      setProfile((prev) => {
        const name = userData.name || userData.displayName || user?.displayName || "";
        const username = userData.username || "";
        const email = userData.email || user?.email || "";
        const mobile = userData.mobile || userData.phone || user?.phoneNumber || "";
        const bio = userData.bio || "";
        const photoURL = userData.photoURL || user?.photoURL || "";
        const type = userData.type || "Member";

        if (
          prev.name === name &&
          prev.username === username &&
          prev.email === email &&
          prev.mobile === mobile &&
          prev.bio === bio &&
          prev.photoURL === photoURL &&
          prev.type === type
        ) {
          return prev;
        }

        return { name, username, email, mobile, bio, photoURL, type };
      });
    } else if (user) {
      setProfile((prev) => {
        const name = user.displayName || "";
        const email = user.email || "";
        const photoURL = user.photoURL || "";
        if (prev.name === name && prev.email === email && prev.photoURL === photoURL) {
          return prev;
        }
        return { ...prev, name, email, photoURL };
      });
    }
  }, [userData, user]);

  // **@** Dynamic theme integration matching system or user preference
  // Helper for dynamic alpha tints
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  let themeMode: "dark" | "light" | "system" = "system";
  let toggleThemeFn: () => void = () => { };
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  let dynamicFontScale = 1.0;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
      toggleThemeFn = themeContext.toggleTheme;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
      dynamicFontScale = themeContext.fontScale || 1.0;
    }
  } catch (e) {
    // safe fallback
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // **@** Pure SOLID DYNAMIC COLORS (Zero glassmorphism in Settings, strictly solid dynamic cards)
  const colors = useMemo(() => {
    const isWhiteAccent =
      dynamicAccent === "white" ||
      dynamicAccent === "navWhite" ||
      dynamicAccent === "#FFFFFF" ||
      dynamicAccent === "#ffffff" ||
      dynamicAccent?.toLowerCase() === "#ffffff";

    const effectiveAccent = isWhiteAccent
      ? (isDark ? "#FFFFFF" : "#111827")
      : dynamicAccent;

    return {
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"), // Solid dynamic surface
      cardBorder: "transparent",
      divider: dynamicThemeColors?.divider ?? (isDark ? "#242428" : "#E6E7EB"),
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#F1F1F1" : "#7E8590"),
      sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#F1F1F1" : "#7E8590"),
      coral: effectiveAccent,
      coralAccent: effectiveAccent,
      coralBg: hexToRgba(effectiveAccent, isDark ? 0.16 : 0.09),
      greyishWhite: isDark ? "#F1F1F1" : "#4B5563",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6", // Solid neutral container
      chevron: isDark ? "#555860" : "#B4B9C2",
      logoutBorder: "transparent",
      logoutBg: isDark ? "rgba(239, 68, 68, 0.10)" : "rgba(239, 68, 68, 0.06)",
    };
  }, [isDark, dynamicAccent, dynamicThemeColors]);

  const allSettings: SearchItem[] = useMemo(() => {
    const list: SearchItem[] = [
      // 1. ACCOUNT
      {
        id: "account-security",
        category: "ACCOUNT",
        title: tr("accounts_security", "Account & Security"),
        subtitle: tr("Password, Two-factor auth & security"),
        keywords: ["account", "security", "password", "two factor", "2fa", "session", "login", "auth"],
        icon: "shield-checkmark-outline",
        route: "/settings/accounts",
      },
      {
        id: "privacy-data",
        category: "ACCOUNT",
        title: tr("Privacy & Data"),
        subtitle: tr("Profile visibility, location logs"),
        keywords: ["privacy", "data", "visibility", "tracking", "location", "logs"],
        icon: "lock-closed-outline",
        route: "/settings/privacy",
      },
      {
        id: "linked-devices",
        category: "ACCOUNT",
        title: tr("linked_devices", "Linked Devices"),
        subtitle: tr("Active sessions, phones & computers"),
        keywords: ["linked devices", "devices", "sessions", "login", "phone", "laptop", "computer", "active sessions"],
        icon: "devices",
        iconFamily: "material",
        route: "/settings/linked-devices",
      },

      // 2. APP SETTINGS
      {
        id: "appearance",
        category: "APP SETTINGS",
        title: tr("appearance", "Appearance"),
        subtitle: tr("Theme color, dark mode & light mode"),
        keywords: ["appearance", "theme", "dark mode", "light mode", "color", "display"],
        rightText:
          themeMode === "system"
            ? tr("System (Auto)")
            : themeMode === "dark"
              ? tr("Dark Mode")
              : tr("Light Mode"),
        icon: "color-filter-outline",
        route: "/settings/appearance",
      },
      {
        id: "language-region",
        category: "APP SETTINGS",
        title: tr("language_region_title", "Language & Region"),
        subtitle: `${activeLanguage || selectedLanguage}, ${tr("locale formats")}`,
        keywords: ["language", "region", "country", "english", "locale", "timezone", "hindi", "date", "time"],
        rightText: activeLanguage || selectedLanguage,
        icon: "globe-outline",
        route: "/settings/language-region",
      },
      {
        id: "accessibility",
        category: "APP SETTINGS",
        title: tr("accessibility", "Accessibility"),
        subtitle: tr("Vision support, high contrast, motion & haptics"),
        keywords: ["accessibility", "font", "contrast", "size", "zoom", "reader", "haptic", "motion", "color blind", "vision"],
        icon: "accessibility-outline",
        route: "/settings/accessibility",
      },
      {
        id: "chats",
        category: "APP SETTINGS",
        title: tr("chats", "Chats"),
        subtitle: tr("Theme, Wallpapers, and Chat Settings"),
        keywords: ["chats", "chat", "messages", "wallpaper", "chat theme", "bubbles"],
        icon: "chatbubble-ellipses-outline",
        route: "/settings/chat-settings",
      },
      {
        id: "ai-features",
        category: "APP SETTINGS",
        title: tr("ai_features", "AI Features"),
        subtitle: tr("Configure Groq API Key & AI settings"),
        keywords: ["ai", "groq", "artificial intelligence", "api key", "bot", "assistant", "model", "smart"],
        icon: "sparkles",
        route: "/settings/ai-settings",
      },

      // 3. TRIP EXPERIENCE
      {
        id: "notifications",
        category: "TRIP EXPERIENCE",
        title: tr("notifications", "Notifications"),
        subtitle: tr("Trip updates, chat pings, alerts"),
        keywords: ["notifications", "alerts", "ping", "updates", "trip notification", "messages"],
        icon: "notifications-outline",
        route: "/settings/notification",
      },
      {
        id: "trip-preferences",
        category: "TRIP EXPERIENCE",
        title: tr("trip_preferences", "Trip Preferences"),
        subtitle: tr("Dietary rules, accommodation styles, travel pace"),
        keywords: ["preferences", "diet", "food", "accommodation", "hotel", "travel pace", "style"],
        icon: "compass-outline",
        route: "/settings/trip-preference",
      },
      {
        id: "currency-expenses",
        category: "TRIP EXPERIENCE",
        title: tr("currency_expenses", "Currency & Expenses"),
        subtitle: tr("Default Split bills, home currency USD"),
        keywords: ["currency", "expenses", "split", "bills", "money", "budget", "cost", "dollar", "usd"],
        icon: "cash-outline",
        route: "/settings/currency-expenses",
      },
      {
        id: "backup-downloads",
        category: "TRIP EXPERIENCE",
        title: tr("backup_downloads", "Backup & Downloads"),
        subtitle: tr("Cloud backup, storage & offline maps"),
        keywords: ["backup", "restore", "cloud", "downloads", "storage", "cache", "offline maps", "data saving", "notes backup", "chat backup"],
        icon: "cloud-upload-outline",
        route: "/settings/backup-downloads",
      },
      {
        id: "maps-navigation",
        category: "TRIP EXPERIENCE",
        title: tr("maps_navigation", "Maps & Navigation"),
        subtitle: tr("Offline cache, route preferences"),
        keywords: ["maps", "navigation", "routes", "directions", "gps", "travel route"],
        icon: "location-outline",
        route: "/settings/maps-navigation",
      },
      {
        id: "weather",
        category: "TRIP EXPERIENCE",
        title: tr("weather", "Weather"),
        subtitle: tr("Local weather forecasts & rain warnings"),
        keywords: ["weather", "alerts", "aqi", "air quality", "rain", "temperature", "forecast"],
        icon: "partly-sunny-outline",
        route: "/settings/weather",
      },

      // 4. SUPPORT
      {
        id: "help-support",
        category: "SUPPORT",
        title: tr("help_support", "Help & Support"),
        subtitle: tr("Guides, FAQs, 24/7 BunkMates bot"),
        keywords: ["help", "support", "faq", "customer service", "guide", "problem", "ticket"],
        icon: "help-circle-outline",
        route: "/settings/help",
      },
      {
        id: "feedback",
        category: "SUPPORT",
        title: tr("send_feedback", "Send Feedback"),
        subtitle: tr("Feature requests, report bugs"),
        keywords: ["feedback", "bug", "issue", "suggestion", "report", "feature request"],
        icon: "megaphone-outline",
        route: "/settings/feedback",
      },
      {
        id: "rate-app",
        category: "SUPPORT",
        title: tr("Rate BunkMates"),
        subtitle: tr("Show us some love on the store"),
        keywords: ["rate", "review", "google play", "store", "star", "feedback"],
        icon: "ribbon-outline",
        onAction: handleRateApp,
      },
      {
        id: "licenses",
        category: "SUPPORT",
        title: tr("Third-Party Licenses"),
        subtitle: tr("Open source software & dependencies"),
        keywords: ["license", "licenses", "open source", "attribution", "third party", "libraries"],
        icon: "document-text-outline",
        iconFamily: "ionicons",
        route: "/settings/licenses",
      },
      {
        id: "invite-friend",
        category: "SUPPORT",
        title: tr("invite_friend", "Invite a Friend"),
        subtitle: tr("Share BunkMates with travel companions"),
        keywords: ["invite", "friend", "referral", "share", "refer"],
        icon: "person-add-outline",
        route: "/inviteFriend",
      },
      {
        id: "about-app",
        category: "SUPPORT",
        title: tr("about_app", "About BunkMates"),
        subtitle: "Version 3.4.1 (Build 4108)",
        keywords: ["about", "version", "build", "info", "release", "bunkmates"],
        icon: "information-circle-outline",
        route: "/settings/about",
      },
    ];

    if (isDeveloper) {
      list.push({
        id: "developer-tools",
        category: "DEVELOPER",
        title: tr("Developer Tools & Sandbox"),
        subtitle: tr("Access internal tools, sandboxes, and developer routes"),
        keywords: ["developer", "dev", "tools", "sandbox", "debug"],
        icon: "code-slash-outline",
        badge: "DEV",
        route: "/settings/developers",
      });
    }

    return list;
  }, [themeMode, activeLanguage, selectedLanguage, tr, isDeveloper, handleRateApp]);

  const searchCategories = useMemo(
    () => ["ALL", "ACCOUNT", "APP SETTINGS", "TRIP EXPERIENCE", "SUPPORT"],
    []
  );

  const filteredSearchList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSettings.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category === selectedCategory;

      if (!q) return matchesCategory;

      const titleMatch = item.title.toLowerCase().includes(q);
      const subMatch = item.subtitle.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      const keywordMatch = item.keywords.some((k) => k.toLowerCase().includes(q));

      return matchesCategory && (titleMatch || subMatch || catMatch || keywordMatch);
    });
  }, [searchQuery, selectedCategory, allSettings]);

  // **@** Track scroll position for header mask gradient reveal on slide/scroll
  const [scrollY] = useState(() => new Animated.Value(0));

  const headerMaskOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 16, 40],
        outputRange: [0, 0.85, 1],
        extrapolate: "clamp",
      }),
    [scrollY]
  );

  // =========================================================
  // LOAD USER — **@** Optimized: profile loads instantly after nav
  // animation completes via InteractionManager; trip count is
  // deferred to a second pass so the UI isn't blocked.
  // =========================================================

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/(auth)/login" as any);
    }
  }, [authLoading, user, router]);

  // Restore developer mode on this device, and refresh whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      AsyncStorage.getItem("isDeveloper").then((value) => {
        const isDev = value === "true";
        if (mounted) {
          setIsDeveloper((prev) => (prev !== isDev ? isDev : prev));
        }
      });
      return () => {
        mounted = false;
        if (tapTimer.current) clearTimeout(tapTimer.current);
      };
    }, [])
  );

  const [verifyingKey, setVerifyingKey] = useState(false);

  const handleBuildTap = () => {
    if (isDeveloper) {
      smoothNavigate("/settings/developers");
      return;
    }

    setTapCount((prev) => {
      const next = prev + 1;

      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => setTapCount(0), 1500);

      // Trigger modal when tapped 5 or 6 times (>= 5)
      if (next >= 5) {
        setTapCount(0);
        setEnteredKey("");
        setShowDevDialog(true);
      }

      return next;
    });
  };

  const handleVerifyDevKey = async () => {
    if (!enteredKey.trim()) {
      setPasskeyError("Please enter the developer key.");
      return;
    }

    try {
      setVerifyingKey(true);
      setPasskeyError(null);
      const keyDoc = await getDoc(doc(db, "secret", "devkey"));
      const validKey = keyDoc.exists() ? keyDoc.data().key : null;

      if (enteredKey.trim() === validKey) {
        setIsDeveloper(true);
        await AsyncStorage.setItem("isDeveloper", "true");
        setShowDevDialog(false);
        setEnteredKey("");
        setPasskeyError(null);
        smoothNavigate("/settings/developers");
      } else {
        setPasskeyError("The developer key is incorrect.");
      }
    } catch (error) {
      console.error("Error verifying developer key:", error);
      setPasskeyError("Could not verify the developer key. Try again later.");
    } finally {
      setVerifyingKey(false);
    }
  };

  const openDeveloperPage = () => {
    smoothNavigate("/settings/developers");
  };

  const handleInternalBack = useCallback(() => {
    if (isSearchActive) {
      handleCloseSearch();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)" as any);
    }
  }, [isSearchActive, handleCloseSearch, router]);

  // **@** Hardware back press listener for Android
  useEffect(() => {
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleInternalBack();
      return true;
    });
    return () => backSub.remove();
  }, [handleInternalBack]);


  // =========================================================
  // VALUES
  // =========================================================

  const displayName =
    userData?.name ||
    userData?.displayName ||
    profile.name ||
    user?.displayName ||
    "Mohit Sharma";

  const username =
    userData?.username ||
    profile.username ||
    displayName
      .toLowerCase()
      .replace(/\s+/g, "_");

  const backgroundImage =
    userData?.photoURL ||
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80";

  // **@** Stable Context value so all SettingRow instances re-render only when theme properties change
  const rowContextValue = useMemo(
    () => ({ isDark, colors, fontScale: dynamicFontScale }),
    [isDark, colors, dynamicFontScale]
  );

  // Loading check placed after all hooks to prevent hook count mismatch
  if (authLoading && !user) {
    return <SkeletonLoadingScreen title="Settings" />;
  }



  // =========================================================
  // QR CODE PAGE
  // =========================================================

  const renderDeveloperPasskeyModal = () => (
    <SwipeableDrawer
      visible={showDevDialog}
      onClose={() => {
        setShowDevDialog(false);
        setEnteredKey("");
      }}
      sheetStyle={styles.devModalCard}
      handleColor="#555"
    >
      <View style={{ paddingTop: 4, paddingBottom: 12 }}>
        <Text style={styles.devModalTitle}>Enter Developer Passkey</Text>
        <Text style={styles.devModalSubtitle}>
          This access is restricted to authorized developers only.
        </Text>

        <TextInput
          autoFocus
          value={enteredKey}
          onChangeText={setEnteredKey}
          placeholder="Developer Key"
          placeholderTextColor="#777"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleVerifyDevKey}
          style={styles.devModalInput}
        />

        {passkeyError ? (
          <Text style={{ color: "#EF4444", fontSize: 13, textAlign: "center", marginBottom: 10, fontWeight: "500" }}>
            {passkeyError}
          </Text>
        ) : null}

        <View style={styles.devModalActions}>
          <Pressable
            onPress={() => {
              setShowDevDialog(false);
              setEnteredKey("");
            }}
            style={styles.devCancelButton}
          >
            <Text style={styles.devCancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleVerifyDevKey}
            disabled={verifyingKey}
            style={styles.devVerifyButton}
          >
            {verifyingKey ? (
              <ActivityIndicator color="#00140f" size="small" />
            ) : (
              <Text style={styles.devVerifyText}>Verify</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SwipeableDrawer>
  );


  // =========================================================
  // =========================================================
  // DEVELOPER TOOLS — PORTED FROM THE WEB DEVELOPER PAGE
  // =========================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask */}
      <SettingsHeaderGradientMask
        backgroundColor={colors.bg}
        height={topInset + (Platform.OS === "android" ? 6 : 4) + 90 + 86}
        zIndex={15}
      />

      {/* **@** Invisible Floating App Bar: Back arrow, Settings Title, and QR Code in the header */}
      <View
        style={[
          styles.modernHeader,
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: topInset + (Platform.OS === "android" ? 6 : 4),
          },
        ]}
      >
        {/* Left side: Back navigation button + Settings Title */}
        <View style={styles.modernHeaderLeft}>
          <Pressable
            style={({ pressed }) => [
              styles.modernHeaderBtn,
              {
                backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
                boxShadow: isDark ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)" : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
              pressed && styles.pressed,
            ]}
            onPress={handleInternalBack}
            accessibilityLabel={isSearchActive ? "Exit search" : "Go back"}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={colors.textPrimary}
            />
          </Pressable>

          <Text
            style={[
              styles.modernHeaderTitle,
              { color: colors.textPrimary, fontSize: Math.round(22 * dynamicFontScale) },
            ]}
            numberOfLines={1}
          >
            {isSearchActive ? tr("Search Settings") : tr("Settings")}
          </Text>
        </View>

        {/* Right side: QR Code Action Button occupying original header action location (hidden in search) */}
        {!isSearchActive && (
          <View style={styles.modernHeaderIcons}>
            <Pressable
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                {
                  backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
                  boxShadow: isDark ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)" : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
                pressed && styles.pressed,
              ]}
              onPress={() => smoothNavigate("/qr-code")}
              accessibilityLabel="QR Code"
              hitSlop={8}
            >
              <Ionicons
                name="qr-code-outline"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>
        )}
      </View>

      <SettingsRowContext.Provider value={rowContextValue}>
        <Animated.ScrollView
          style={styles.modernScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.modernScrollContent,
            {
              paddingTop: topInset + (Platform.OS === "android" ? 6 : 4) + 48 + 14,
              paddingBottom: searchBottomOffset + 60,
              flexGrow: 1,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={Platform.OS === "ios"}
          decelerationRate="normal"
        >
          <Animated.View style={{ opacity: contentFadeAnim, width: "100%" }}>
            {isSearchActive ? (
              <View style={styles.searchViewContainer}>
                {/* Category filter chips */}
                <View style={styles.searchChipsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.searchChipsScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {searchCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const label = cat === "ALL" ? tr("All") : tr(cat);
                      return (
                        <Pressable
                          key={cat}
                          style={[
                            styles.searchChip,
                            {
                              backgroundColor: isSelected
                                ? (isDark ? "#FFFFFF" : "#11141A")
                                : (isDark ? "#1C1C1E" : "#E8EAEE"),
                            },
                          ]}
                          onPress={() => setSelectedCategory(cat)}
                        >
                          <Text
                            style={[
                              styles.searchChipText,
                              {
                                color: isSelected
                                  ? (isDark ? "#000000" : "#FFFFFF")
                                  : (isDark ? "#8E95A2" : "#6B7280"),
                                fontWeight: isSelected ? "700" : "500",
                              },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {filteredSearchList.length > 0 ? (
                  <View>
                    <Text style={[styles.searchSectionHeading, { color: colors.sectionHeader }]}>
                      {searchQuery.trim().length > 0
                        ? `${tr("MATCHING SETTINGS").toUpperCase()} (${filteredSearchList.length})`
                        : tr("SUGGESTED SETTINGS").toUpperCase()}
                    </Text>

                    <View style={[styles.modernCardGroup, { backgroundColor: colors.card }]}>
                      {filteredSearchList.map((item, idx) => {
                        const isLast = idx === filteredSearchList.length - 1;
                        return (
                          <View key={item.id}>
                            <Pressable
                              style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}
                              onPress={() => {
                                Keyboard.dismiss();
                                if (item.onAction) {
                                  item.onAction();
                                } else if (item.route) {
                                  smoothNavigate(item.route);
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={item.title}
                            >
                              <View style={[styles.searchResultIconBox, { backgroundColor: colors.iconBoxBg }]}>
                                {item.iconFamily === "material" ? (
                                  <MaterialIcons name={item.icon as any} size={20} color={colors.greyishWhite} />
                                ) : item.iconFamily === "feather" ? (
                                  <Feather name={item.icon as any} size={19} color={colors.greyishWhite} />
                                ) : (
                                  <Ionicons name={item.icon as any} size={20} color={colors.greyishWhite} />
                                )}
                              </View>

                              <View style={styles.searchResultContent}>
                                <View style={styles.searchResultTextGroup}>
                                  <View style={styles.searchResultTitleWrap}>
                                    <Text
                                      style={[styles.searchResultTitle, { color: colors.textPrimary }]}
                                      numberOfLines={1}
                                    >
                                      {item.title}
                                    </Text>
                                    {item.category && (
                                      <View
                                        style={[
                                          styles.searchCategoryBadge,
                                          {
                                            backgroundColor: isDark
                                              ? "rgba(255, 255, 255, 0.08)"
                                              : "rgba(0, 0, 0, 0.05)",
                                          },
                                        ]}
                                      >
                                        <Text style={[styles.searchCategoryBadgeText, { color: colors.textSecondary }]}>
                                          {item.category}
                                        </Text>
                                      </View>
                                    )}
                                    {item.badge && (
                                      <View style={styles.devBadge}>
                                        <Text style={styles.devBadgeText}>{item.badge}</Text>
                                      </View>
                                    )}
                                  </View>

                                  {item.subtitle ? (
                                    <Text
                                      style={[styles.searchResultSubtitle, { color: colors.textSecondary }]}
                                      numberOfLines={1}
                                    >
                                      {item.subtitle}
                                    </Text>
                                  ) : null}
                                </View>

                                <View style={styles.searchResultRightGroup}>
                                  {item.rightText ? (
                                    <Text style={[styles.searchResultRightText, { color: colors.textSecondary }]}>
                                      {item.rightText}
                                    </Text>
                                  ) : null}
                                  <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
                                </View>
                              </View>
                            </Pressable>

                            {!isLast && <View style={[styles.searchResultDivider, { backgroundColor: colors.divider }]} />}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={styles.searchEmptyContainer}>
                    <View style={[styles.emptyIconBox, { backgroundColor: colors.iconBoxBg }]}>
                      <Ionicons name="search-outline" size={34} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.emptySearchTitle, { color: colors.textPrimary }]}>
                      {tr("No Results for")} &ldquo;{searchQuery}&rdquo;
                    </Text>
                    <Text style={[styles.emptySearchSubtitle, { color: colors.textSecondary }]}>
                      {tr("Check the spelling or try a new search.")}
                    </Text>
                    <Pressable
                      style={[
                        styles.emptyClearBtn,
                        { backgroundColor: isDark ? "#2C2C30" : "#E5E7EB" },
                      ]}
                      onPress={() => setSearchQuery("")}
                    >
                      <Text style={[styles.emptyClearBtnText, { color: colors.textPrimary }]}>
                        {tr("Clear Search")}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* **@** User Profile Card with Avatar, Name, Email, and Edit Profile Pen Icon */}
                <Pressable
                  style={({ pressed }) => [
                    styles.modernProfileCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => smoothNavigate("/ProfileEdit")}
                  accessibilityRole="button"
                  accessibilityLabel="Edit Profile"
                >
                  <Image
                    source={{ uri: userData?.photoURL || profile.photoURL || user?.photoURL || backgroundImage }}
                    style={styles.modernProfileAvatar}
                  />
                  <View style={styles.modernProfileDetails}>
                    <Text
                      style={[
                        styles.modernProfileName,
                        { color: colors.textPrimary, fontSize: Math.round(18 * dynamicFontScale) },
                      ]}
                      numberOfLines={1}
                    >
                      {userData?.name || userData?.displayName || profile.name || user?.displayName || "Sasha Miller"}
                    </Text>
                    <Text
                      style={[
                        styles.modernProfileEmail,
                        { color: colors.textSecondary, fontSize: Math.round(13.5 * dynamicFontScale) },
                      ]}
                      numberOfLines={1}
                    >
                      {userData?.email ||
                        profile.email ||
                        user?.email ||
                        (userData?.username || profile.username
                          ? `${(userData?.username || profile.username).toLowerCase()}@bunkmates.xyz`
                          : "sasha.explorer@bunkmates.xyz")}
                    </Text>
                  </View>

                  {/* **@** Edit Profile Pen Icon Button with greyish-white icon */}
                  <View style={[styles.modernProfileEditBtn, { backgroundColor: colors.iconBoxBg }]}>
                    <Feather name="edit-3" size={19} color={colors.greyishWhite} />
                  </View>
                </Pressable>

                {/* =====================================================
                    1. ACCOUNT
                ====================================================== */}
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader, fontSize: Math.round(12 * dynamicFontScale) },
                  ]}
                >
                  {tr("account_section", "ACCOUNT")}
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <SettingRow
                    icon="shield-checkmark-outline"
                    title={tr("accounts_security", "Account & Security")}
                    subtitle={tr("Password, Two-factor auth & security")}
                    onPress={() => smoothNavigate("/settings/accounts")}
                  />
                  <SettingRow
                    icon="lock-closed-outline"
                    title={tr("Privacy & Data")}
                    subtitle={tr("Profile visibility, location logs")}
                    onPress={() => smoothNavigate("/settings/privacy")}
                  />
                  <SettingRow
                    icon="devices"
                    iconFamily="material"
                    title={tr("linked_devices", "Linked Devices")}
                    subtitle={tr("Active sessions, phones & computers")}
                    onPress={() => smoothNavigate("/settings/linked-devices")}
                  />
                  {/* <SettingRow
                    // icon="qr-code-outline"
                    // title={tr("scan_qr_login", "Scan QR to Log In")}
                    // subtitle={tr("Log in to BunkMates on desktop or web")}
                    // isLast
                    // onPress={() => smoothNavigate("/qr-login")}
                  /> */}
                </View>

                {/* =====================================================
                    2. APP SETTINGS
                ====================================================== */}
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader },
                  ]}
                >
                  {tr("app_settings_section", "APP SETTINGS")}
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <SettingRow
                    icon="color-filter-outline"
                    title={tr("appearance", "Appearance")}
                    rightText={
                      themeMode === "system"
                        ? tr("System (Auto)")
                        : themeMode === "dark"
                          ? tr("Dark Mode")
                          : tr("Light Mode")
                    }
                    onPress={() => smoothNavigate("/settings/appearance")}
                  />
                  <SettingRow
                    icon="globe-outline"
                    title={tr("language_region_title", "Language & Region")}
                    rightText={activeLanguage || selectedLanguage}
                    onPress={() => smoothNavigate("/settings/language-region")}
                  />
                  <SettingRow
                    icon="accessibility-outline"
                    title={tr("accessibility", "Accessibility")}
                    subtitle={tr("Vision support, high contrast, motion & haptics")}
                    onPress={() => smoothNavigate("/settings/accessibility")}
                  />
                  <SettingRow
                    icon="chatbubble-ellipses-outline"
                    title={tr("chats", "Chats")}
                    subtitle={tr("Theme, Wallpapers, and Chat Settings")}
                    onPress={() => smoothNavigate("/settings/chat-settings")}
                  />
                  <SettingRow
                    icon="sparkles"
                    title={tr("ai_features", "AI Features")}
                    subtitle={tr("Configure Groq API Key & AI settings")}
                    isLast
                    onPress={() => smoothNavigate("/settings/ai-settings")}
                  />
                </View>

                {/* =====================================================
                    3. TRIP EXPERIENCE
                ====================================================== */}
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader },
                  ]}
                >
                  {tr("trip_experience_section", "TRIP EXPERIENCE")}
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <SettingRow
                    icon="notifications-outline"
                    title={tr("notifications", "Notifications")}
                    subtitle={tr("Trip updates, chat pings, alerts")}
                    onPress={() => smoothNavigate("/settings/notification")}
                  />
                  <SettingRow
                    icon="compass-outline"
                    title={tr("trip_preferences", "Trip Preferences")}
                    subtitle={tr("Dietary rules, accommodation styles, travel pace")}
                    onPress={() => smoothNavigate("/settings/trip-preference")}
                  />
                  <SettingRow
                    icon="cash-outline"
                    title={tr("currency_expenses", "Currency & Expenses")}
                    subtitle={tr("Default Split bills, home currency USD")}
                    onPress={() => smoothNavigate("/settings/currency-expenses")}
                  />
                  <SettingRow
                    icon="cloud-upload-outline"
                    title={tr("backup_downloads", "Backup & Downloads")}
                    subtitle={tr("Cloud backup, storage & offline maps")}
                    onPress={() => smoothNavigate("/settings/backup-downloads")}
                  />
                  <SettingRow
                    icon="location-outline"
                    title={tr("maps_navigation", "Maps & Navigation")}
                    subtitle={tr("Offline cache, route preferences")}
                    onPress={() => smoothNavigate("/settings/maps-navigation")}
                  />
                  <SettingRow
                    icon="partly-sunny-outline"
                    title={tr("weather", "Weather")}
                    subtitle={tr("Local weather forecasts & rain warnings")}
                    isLast
                    onPress={() => smoothNavigate("/settings/weather")}
                  />
                </View>

                {/* =====================================================
                    4. SUPPORT
                ====================================================== */}
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader },
                  ]}
                >
                  {tr("support_section", "SUPPORT")}
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <SettingRow
                    icon="help-circle-outline"
                    title={tr("help_support", "Help & Support")}
                    subtitle={tr("Guides, FAQs, 24/7 BunkMates bot")}
                    onPress={() => smoothNavigate("/settings/help")}
                  />
                  <SettingRow
                    icon="megaphone-outline"
                    title={tr("send_feedback", "Send Feedback")}
                    subtitle={tr("Feature requests, report bugs")}
                    onPress={() => smoothNavigate("/settings/feedback")}
                  />
                  <SettingRow
                    icon="ribbon-outline"
                    title={tr("Rate BunkMates")}
                    subtitle={tr("Show us some love on the store")}
                    onPress={handleRateApp}
                  />
                  <SettingRow
                    icon="document-text-outline"
                    iconFamily="ionicons"
                    title={tr("Third-Party Licenses")}
                    subtitle={tr("Open source software & dependencies")}
                    onPress={() => smoothNavigate("/settings/licenses")}
                  />
                  <SettingRow
                    icon="person-add-outline"
                    title={tr("invite_friend", "Invite a Friend")}
                    subtitle={tr("Share BunkMates with travel companions")}
                    onPress={() => smoothNavigate("/inviteFriend")}
                  />
                  {isDeveloper && (
                    <SettingRow
                      icon="code-slash-outline"
                      iconBg="rgba(0, 230, 176, 0.15)"
                      iconColor="#00e6b0"
                      title={tr("Developer Tools & Sandbox")}
                      subtitle={tr("Access internal tools, sandboxes, and developer routes")}
                      badge="DEV"
                      onPress={() => smoothNavigate("/settings/developers")}
                    />
                  )}
                  <SettingRow
                    icon="information-circle-outline"
                    title={tr("about_app", "About BunkMates")}
                    subtitle={tr("App version, team credits & legal")}
                    isLast
                    onPress={() => smoothNavigate("/settings/about")}
                  />
                </View>

                {/* BunkMates App Version Footer with Developer Tap Easter Egg */}
                <Pressable
                  onPress={handleBuildTap}
                  hitSlop={12}
                  style={{ alignItems: "center", paddingVertical: 18, marginBottom: 12 }}
                >
                  <Text style={{ fontSize: 12, color: isDark ? "#F1F1F1" : colors.textSecondary, fontWeight: "500" }}>
                    BunkMates v3.4.1 (Build 4108)
                  </Text>
                  {isDeveloper && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 5 }}>
                      <Ionicons name="code-slash" size={12} color="#00e6b0" />
                      <Text style={{ fontSize: 11, color: "#00e6b0", fontWeight: "700" }}>
                        Developer Mode Active
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}
          </Animated.View>
        </Animated.ScrollView>
      </SettingsRowContext.Provider>

      {/* ── BOTTOM DISSOLVE GRADIENT MASK (Exact match of SettingsHeaderGradientMask) ── */}
      <SettingsHeaderGradientMask
        position="bottom"
        backgroundColor={colors.bg + 20}
        height={searchBottomOffset + 200}
        zIndex={20}
      />

      {/* ── COMPACT FLOATING BOTTOM SEARCH BUTTON / ACTIVE SEARCH INPUT ── */}
      <Animated.View
        style={[
          styles.modernBottomSearchWrapper,
          {
            bottom: searchBottomOffset,
            transform: [{ translateY: keyboardLift }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.modernBottomSearchPill,
            {
              width: animatedSearchPillWidth,
              maxWidth: EXPANDED_PILL_WIDTH,
              backgroundColor: isDark ? "rgba(14, 14, 14, 1)" : "rgba(234, 234, 234, 1)",
              boxShadow: isDark ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)" : "inset 0 1px 1px rgba(255, 255, 255, 0.86), inset 0 -1px 3px rgba(0, 0, 0, 0.08)"
            },
          ]}
        >
          {isSearchActive ? (
            <View style={styles.modernSearchActiveInputRow}>
              <Ionicons
                name="search-outline"
                size={18}
                color="#A1A1AA"
                style={{ marginRight: 8, marginLeft: 2 }}
              />
              <TextInput
                ref={searchInputRef}
                style={[styles.modernSearchActiveInput, { color: "#FFFFFF" }]}
                placeholder={tr("Search settings...")}
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                  style={styles.modernSearchClearBtn}
                  accessibilityRole="button"
                  accessibilityLabel={tr("Clear")}
                >
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.modernBottomSearchPressable,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleOpenSearch}
              accessibilityRole="button"
              accessibilityLabel={tr("Search Settings")}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color="#A1A1AA"
                style={{ marginRight: 10 }}
              />
              <Text
                style={[
                  styles.modernBottomSearchPlaceholderText,
                  { color: "#8E8E93" },
                ]}
              >
                {tr("Search settings...")}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>

      {showDevDialog && renderDeveloperPasskeyModal()}
    </View>
  );
}

// ============================================================
// LICENSE COMPONENT
// ============================================================

function LicenseItem({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <View
      style={styles.libraryItem}
    >
      <Text
        style={styles.libraryName}
      >
        {name}
      </Text>

      <Text
        style={
          styles.libraryDescription
        }
      >
        {description}
      </Text>
    </View>
  );
}

// ============================================================
// DEVELOPER TOOL SANDBOX COMPONENT
// ============================================================

function DevToolSandboxView({
  toolId,
  onBack,
}: {
  toolId: string;
  onBack: () => void;
}) {
  let isDark = true;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      isDark =
        themeContext.mode === "dark" ||
        (themeContext.mode === "system" && Appearance.getColorScheme() === "dark");
    }
  } catch (e) { }

  const colors = useMemo(
    () => ({
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: "transparent",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#F1F1F1" : "#7E8590",
    }),
    [isDark]
  );

  // Weather state
  const [selectedCity, setSelectedCity] = useState("Goa 🏖️");
  const weatherCities = ["Goa 🏖️", "Manali 🏔️", "Rishikesh 🌊", "Leh 🗻", "Bali 🌴"];

  // Social feed state
  const [likes, setLikes] = useState(42);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<string[]>([
    "Awesome sunset spot! 🌅",
    "Count me in for tomorrow's trip!",
  ]);
  const [commentInput, setCommentInput] = useState("");

  // OTP Login state
  const [phoneInput, setPhoneInput] = useState("9876543210");
  const [countryCode, setCountryCode] = useState("+91 🇮🇳");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(["4", "8", "1", "9", "0", "2"]);

  // Dev Notes state
  const [notes, setNotes] = useState<
    { id: string; title: string; desc: string; done: boolean; tagColor: string }[]
  >([
    {
      id: "1",
      title: "Groq AI Latency Check",
      desc: "Ensure responses complete under 250ms on 4G networks.",
      done: true,
      tagColor: "#00e6b0",
    },
    {
      id: "2",
      title: "Offline Sync Persistence",
      desc: "Validate AsyncStorage fallback on cold startup.",
      done: false,
      tagColor: "#fbbf24",
    },
  ]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteDesc, setNewNoteDesc] = useState("");

  // Firestore Playground state
  const [selectedCol, setSelectedCol] = useState("users");
  const [queryDocs, setQueryDocs] = useState<any[]>([]);
  const [fetchingCol, setFetchingCol] = useState(false);

  // Notification Toast state
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Error simulation state
  const [simulatedError, setSimulatedError] = useState(false);

  // Trigger Toast Helper
  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 3000);
  };

  // Handle Add Note
  const handleAddNote = () => {
    if (!newNoteTitle.trim()) {
      triggerToast("Please enter a note title.");
      return;
    }
    const item = {
      id: Date.now().toString(),
      title: newNoteTitle.trim(),
      desc: newNoteDesc.trim() || "No description provided.",
      done: false,
      tagColor: ["#00e6b0", "#3b83f6", "#a848ec", "#f97316"][
        Math.floor(Math.random() * 4)
      ],
    };
    setNotes((prev) => [item, ...prev]);
    setNewNoteTitle("");
    setNewNoteDesc("");
  };

  // Handle Firestore Query
  const handleFetchCollection = async () => {
    try {
      setFetchingCol(true);
      const snap = await getDocs(collection(db, selectedCol));
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setQueryDocs(list.slice(0, 5));
    } catch (e: any) {
      console.log("Firestore query error:", e);
      triggerToast(e.message || "Failed to query Firestore");
    } finally {
      setFetchingCol(false);
    }
  };

  const getToolTitle = () => {
    switch (toolId) {
      case "weather-forecast":
        return "Hourly Weather Forecast";
      case "social-feed":
        return "BunkMates Social Sandbox";
      case "otp-login":
        return "Phone OTP Authenticator";
      case "user-maps":
        return "User Heatmap & Analytics";
      case "dev-notes":
        return "Developer Notes Manager";
      case "firestore-playground":
        return "Firestore Data Playground";
      case "notifications-preview":
        return "Notifications & Alerts Preview";
      case "ui-showcase":
        return "UI Components Showcase";
      case "error-test":
        return "Error Boundary Simulator";
      default:
        return "Developer Tool";
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.developerScroll}
    >
      {/* **@** Unified Header matching Settings page back arrow */}
      <View style={styles.modernHeader}>
        <View style={styles.modernHeaderLeft}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.modernHeaderBtn,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            hitSlop={6}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>{getToolTitle()}</Text>
        </View>
      </View>

      {/* ACTIVE TOAST NOTIFICATION */}
      {activeToast ? (
        <View style={styles.devToastBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#00e6b0" />
          <Text style={styles.devToastText}>{activeToast}</Text>
        </View>
      ) : null}

      {/* 1. HOURLY WEATHER FORECAST */}
      {toolId === "weather-forecast" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Select Destination City</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {weatherCities.map((city) => (
              <Pressable
                key={city}
                onPress={() => setSelectedCity(city)}
                style={[
                  styles.cityChip,
                  selectedCity === city && styles.cityChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    selectedCity === city && styles.cityChipTextActive,
                  ]}
                >
                  {city}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.weatherMainHero}>
            <Text style={styles.weatherMainTemp}>28°C</Text>
            <Text style={styles.weatherMainCondition}>Partly Sunny • {selectedCity}</Text>
          </View>

          <Text style={styles.sandboxSectionTitle}>24-Hour Forecast Timeline</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { time: "09:00", temp: "26°", icon: "sunny-outline" },
              { time: "12:00", temp: "30°", icon: "partly-sunny-outline" },
              { time: "15:00", temp: "31°", icon: "cloud-outline" },
              { time: "18:00", temp: "27°", icon: "rainy-outline" },
              { time: "21:00", temp: "24°", icon: "moon-outline" },
              { time: "00:00", temp: "22°", icon: "moon-outline" },
            ].map((slot, idx) => (
              <View key={idx} style={styles.weatherHourCard}>
                <Text style={styles.weatherHourTime}>{slot.time}</Text>
                <Ionicons name={slot.icon as any} size={22} color="#00e6b0" style={{ marginVertical: 6 }} />
                <Text style={styles.weatherHourTemp}>{slot.temp}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.weatherMetricsRow}>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Precipitation</Text>
              <Text style={styles.weatherMetricVal}>15%</Text>
            </View>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Humidity</Text>
              <Text style={styles.weatherMetricVal}>68%</Text>
            </View>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Wind Speed</Text>
              <Text style={styles.weatherMetricVal}>14 km/h</Text>
            </View>
          </View>
        </View>
      )}

      {/* 2. SOCIAL FEED SANDBOX */}
      {toolId === "social-feed" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Traveler Stories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {["Mohit", "Aarav", "Ananya", "Vikram", "Sneha"].map((name) => (
              <View key={name} style={{ alignItems: "center", marginRight: 14 }}>
                <View style={styles.socialStoryRing}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
                <Text style={styles.socialStoryName}>{name}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.socialPostCard}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={styles.socialAvatar}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>M</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Mohit Sharma</Text>
                <Text style={{ color: "#888", fontSize: 10 }}>Manali Valley • 2 hours ago</Text>
              </View>
            </View>

            <Text style={{ color: "#ddd", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              Sunset sessions with the bunkmates! 🏔️✨ Planning the next trek to Solang tomorrow. Who is joining?
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  setHasLiked(!hasLiked);
                  setLikes((l) => (hasLiked ? l - 1 : l + 1));
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name={hasLiked ? "heart" : "heart-outline"} size={20} color={hasLiked ? "#ff4757" : "#aaa"} />
                <Text style={{ color: hasLiked ? "#ff4757" : "#aaa", fontSize: 12, fontWeight: "700" }}>{likes}</Text>
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="chatbubble-outline" size={18} color="#aaa" />
                <Text style={{ color: "#aaa", fontSize: 12 }}>{comments.length}</Text>
              </View>
            </View>

            {comments.map((c, i) => (
              <View key={i} style={styles.commentItem}>
                <Text style={{ color: "#22d3ee", fontWeight: "700", fontSize: 11 }}>BunkMate Traveler:</Text>
                <Text style={{ color: "#ccc", fontSize: 11, marginTop: 2 }}>{c}</Text>
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#666"
                style={styles.commentInput}
              />
              <Pressable
                onPress={() => {
                  if (commentInput.trim()) {
                    setComments((prev) => [...prev, commentInput.trim()]);
                    setCommentInput("");
                  }
                }}
                style={styles.commentSendBtn}
              >
                <Ionicons name="send" size={14} color="#000" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 3. OTP LOGIN SANDBOX */}
      {toolId === "otp-login" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Simulated Phone OTP Verification</Text>

          <Text style={{ color: "#aaa", fontSize: 12, marginBottom: 12 }}>
            Enter a phone number to trigger the simulated 6-digit verification flow:
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Pressable
              onPress={() => {
                const codes = ["+91 🇮🇳", "+1 🇺🇸", "+44 🇬🇧", "+61 🇦🇺"];
                const nextIdx = (codes.indexOf(countryCode) + 1) % codes.length;
                setCountryCode(codes[nextIdx]);
              }}
              style={styles.countryCodePicker}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{countryCode}</Text>
            </Pressable>

            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              placeholder="Mobile Number"
              placeholderTextColor="#666"
              style={[styles.sandboxInput, { flex: 1 }]}
            />
          </View>

          <Pressable
            onPress={() => {
              setOtpSent(true);
              triggerToast("6-Digit OTP Sent to " + countryCode + " " + phoneInput);
            }}
            style={styles.sandboxPrimaryBtn}
          >
            <Text style={styles.sandboxPrimaryBtnText}>Send OTP Code</Text>
          </Pressable>

          {otpSent ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: "#00e6b0", fontSize: 12, fontWeight: "700", marginBottom: 10, textAlign: "center" }}>
                Enter Verification Passcode
              </Text>

              <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {otpCode.map((digit, i) => (
                  <View key={i} style={styles.otpDigitBox}>
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{digit}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  triggerToast("✅ Successfully authenticated via Phone OTP!");
                }}
                style={[styles.sandboxPrimaryBtn, { backgroundColor: "#00e6b0" }]}
              >
                <Text style={[styles.sandboxPrimaryBtnText, { color: "#000" }]}>Verify OTP</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {/* 4. USER HEATMAP & ANALYTICS */}
      {toolId === "user-maps" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Active Traveler Heatmap Analytics</Text>

          <View style={styles.mapHeroBox}>
            <Ionicons name="map-outline" size={32} color="#00e6b0" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18, marginTop: 8 }}>5,190 Active BunkMates</Text>
            <Text style={{ color: "#aaa", fontSize: 11 }}>Real-time location distribution nodes</Text>
          </View>

          {[
            { region: "West & Goa Beaches 🏖️", active: "2,150 BunkMates", density: "HIGH DENSITY" },
            { region: "North India (Manali/Leh) 🏔️", active: "1,420 BunkMates", density: "HIGH DENSITY" },
            { region: "South & Western Ghats 🌲", active: "980 BunkMates", density: "MEDIUM DENSITY" },
            { region: "Southeast Asia Destinations 🌴", active: "640 BunkMates", density: "MODERATE" },
          ].map((r, i) => (
            <View key={i} style={styles.regionRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{r.region}</Text>
                <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>{r.active}</Text>
              </View>
              <View style={styles.densityBadge}>
                <Text style={{ color: "#00e6b0", fontSize: 9, fontWeight: "800" }}>{r.density}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 5. DEVELOPER NOTES MANAGER */}
      {toolId === "dev-notes" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Developer Quick Notes</Text>

          <TextInput
            value={newNoteTitle}
            onChangeText={setNewNoteTitle}
            placeholder="Note Title..."
            placeholderTextColor="#666"
            style={styles.sandboxInput}
          />
          <TextInput
            value={newNoteDesc}
            onChangeText={setNewNoteDesc}
            placeholder="Description / Implementation Details..."
            placeholderTextColor="#666"
            style={[styles.sandboxInput, { marginTop: 8, height: 60 }]}
            multiline
          />
          <Pressable onPress={handleAddNote} style={[styles.sandboxPrimaryBtn, { marginTop: 10 }]}>
            <Text style={styles.sandboxPrimaryBtnText}>+ Add Note</Text>
          </Pressable>

          <View style={{ marginTop: 16 }}>
            {notes.map((n) => (
              <View key={n.id} style={styles.noteCard}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{n.title}</Text>
                  <Text style={{ color: "#aaa", fontSize: 11, marginTop: 3 }}>{n.desc}</Text>
                </View>
                <Pressable
                  onPress={() => setNotes((prev) => prev.filter((item) => item.id !== n.id))}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ff4757" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 6. FIRESTORE PLAYGROUND */}
      {toolId === "firestore-playground" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Live Firestore Collection Viewer</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {["users", "trips", "notifications", "feedback"].map((col) => (
              <Pressable
                key={col}
                onPress={() => setSelectedCol(col)}
                style={[
                  styles.cityChip,
                  selectedCol === col && styles.cityChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    selectedCol === col && styles.cityChipTextActive,
                  ]}
                >
                  collection: {col}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable onPress={handleFetchCollection} disabled={fetchingCol} style={styles.sandboxPrimaryBtn}>
            {fetchingCol ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.sandboxPrimaryBtnText}>Run Realtime Query</Text>
            )}
          </Pressable>

          <View style={{ marginTop: 16 }}>
            {queryDocs.map((docItem) => (
              <View key={docItem.id} style={styles.jsonCard}>
                <Text style={{ color: "#00e6b0", fontWeight: "700", fontSize: 11, marginBottom: 4 }}>
                  ID: {docItem.id}
                </Text>
                <Text style={{ color: "#aaa", fontSize: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
                  {JSON.stringify(docItem, null, 2)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 7. NOTIFICATIONS PREVIEW */}
      {toolId === "notifications-preview" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Notification Toast Previewer</Text>

          {[
            { label: "Trigger Trip Joined Alert", msg: "✈️ Aarav joined your Goa Trip!" },
            { label: "Trigger Payment Alert", msg: "💳 Expense payment received ₹1,200" },
            { label: "Trigger Group Chat Mention", msg: "💬 @Mohit mentioned you in Group Chat" },
            { label: "Trigger System Maintenance Notice", msg: "⚡ Scheduled maintenance at 02:00 AM" },
          ].map((t, i) => (
            <Pressable
              key={i}
              onPress={() => triggerToast(t.msg)}
              style={[styles.sandboxSecondaryBtn, { marginBottom: 10 }]}
            >
              <Text style={styles.sandboxSecondaryBtnText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 8. UI SHOWCASE */}
      {toolId === "ui-showcase" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Design System Tokens & Components</Text>

          <Text style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Color Swatches:</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {["#22d3ee", "#3b83f6", "#a848ec", "#ff8d1a", "#00e6b0"].map((c) => (
              <View key={c} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c }} />
            ))}
          </View>

          <Text style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>Pills & Badges:</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <View style={styles.densityBadge}><Text style={{ color: "#00e6b0", fontSize: 10, fontWeight: "700" }}>ACTIVE BETA</Text></View>
            <View style={[styles.densityBadge, { backgroundColor: "rgba(34,211,238,0.15)" }]}><Text style={{ color: "#22d3ee", fontSize: 10, fontWeight: "700" }}>VERIFIED</Text></View>
          </View>
        </View>
      )}

      {/* 9. ERROR TEST */}
      {toolId === "error-test" && (
        <View style={styles.sandboxCard}>
          <Text style={styles.sandboxSectionTitle}>Runtime Error Boundary Simulator</Text>

          {simulatedError ? (
            <View style={{ padding: 14, backgroundColor: "rgba(255,71,87,0.12)", borderRadius: 12, borderWidth: 0 }}>
              <Text style={{ color: "#ff4757", fontWeight: "800", fontSize: 14, marginBottom: 6 }}>
                Runtime Error Caught by Boundary
              </Text>
              <Text style={{ color: "#ccc", fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
                TypeError: Cannot read properties of undefined (reading &apos;userState&apos;) at DevToolSandboxView.tsx:142
              </Text>
              <Pressable onPress={() => setSimulatedError(false)} style={[styles.sandboxPrimaryBtn, { backgroundColor: "#ff4757" }]}>
                <Text style={[styles.sandboxPrimaryBtnText, { color: "#fff" }]}>Reset & Recover State</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setSimulatedError(true)} style={[styles.sandboxSecondaryBtn, { borderWidth: 0, backgroundColor: "rgba(255, 71, 87, 0.12)" }]}>
              <Text style={[styles.sandboxSecondaryBtnText, { color: "#ff4757" }]}>💥 Trigger Simulated Exception</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  simplePage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },

  // ==========================================================
  // HERO
  // ==========================================================

  heroWrapper: {
    height: verticalScale(390),
    width: "100%",
    overflow: "hidden",
  },

  hero: {
    height: "100%",
    width: "100%",
    justifyContent: "flex-end",
  },

  heroImage: {
    resizeMode: "cover",
  },

  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },

  topSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },

  backButton: {
    marginLeft: rs(18),
    marginTop: rs(8),

    width: rs(42),
    height: rs(42),

    borderRadius: rs(22),

    backgroundColor:
      "rgba(30,30,30,0.75)",

    justifyContent: "center",
    alignItems: "center",
  },

  profileHeader: {
    alignItems: "center",

    paddingBottom: 13,
    paddingHorizontal: 20,
  },

  profileName: {
    color: "#ffffff",
    fontSize: rs(20),
    fontWeight: "800",

    textShadowColor:
      "rgba(0,0,0,0.8)",

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 5,
  },

  username: {
    color: "#c4c4c4",
    fontSize: rs(12),
    marginTop: rs(3),
  },

  // ==========================================================
  // CONTENT
  // ==========================================================

  content: {
    flex: 1,
    backgroundColor: "#000000",
  },

  contentContainer: {
    paddingBottom: verticalScale(45),
  },

  // ==========================================================
  // ACTION BUTTONS
  // ==========================================================

  actionRow: {
    flexDirection: "row",
    gap: rs(9),
    marginHorizontal: rs(22),
    marginTop: rs(-2),
    marginBottom: rs(28),
  },

  actionCard: {
    flex: 1,
    height: verticalScale(70),
    borderRadius: rs(16),

    backgroundColor: "#101315",

    justifyContent: "center",
    alignItems: "center",
  },

  qrCard: {
    backgroundColor: "#171300",
  },

  tripNumber: {
    color: "#ffffff",
    fontSize: rs(24),
    fontWeight: "800",
    lineHeight: rs(26),
  },

  actionLabel: {
    color: "#c4c4c4",
    fontSize: rs(11),
    fontWeight: "500",
    marginTop: rs(4),
  },

  // ==========================================================
  // SETTINGS
  // ==========================================================

  settingsList: {
    width: "100%",
    paddingHorizontal: rs(22),
  },

  settingItem: {
    minHeight: verticalScale(68),
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(10),
  },

  settingIcon: {
    width: rs(42),
    alignItems: "center",
    justifyContent: "center",
    marginRight: rs(5),
  },

  settingContent: {
    flex: 1,
  },

  settingTitle: {
    color: "#ffffff",
    fontSize: rs(14),
    fontWeight: "700",
  },

  settingSubtitle: {
    color: "#a5a5a5",
    fontSize: rs(11),
    marginTop: rs(4),
  },

  settingPressed: {
    opacity: 0.55,
  },

  pressed: {
    opacity: 0.65,
  },

  // ==========================================================
  // QR CODE PAGE
  // ==========================================================

  qrPage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  qrPageScroll: {
    paddingHorizontal: rs(18),
    paddingTop: rs(18),
    paddingBottom: verticalScale(40),
  },

  qrPageContent: {
    flex: 1,
    paddingHorizontal: rs(18),
    paddingTop: rs(18),
  },

  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: rs(20),
  },

  qrBackButton: {
    width: rs(30),
    height: rs(30),
    borderRadius: rs(16),
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    marginRight: rs(10),
  },

  qrPageTitle: {
    color: "#ffffff",
    fontSize: rs(16),
    fontWeight: "800",
  },

  qrTabs: {
    width: "100%",
    height: verticalScale(34),
    borderRadius: rs(18),
    backgroundColor: "#101010",
    flexDirection: "row",
    padding: 2,
    marginBottom: verticalScale(24),
  },

  qrTab: {
    flex: 1,
    borderRadius: rs(17),
    alignItems: "center",
    justifyContent: "center",
  },

  qrTabActive: {
    backgroundColor: "#4a4a4a",
  },

  qrTabText: {
    color: "#777777",
    fontSize: rs(10),
    fontWeight: "600",
  },

  qrTabTextActive: {
    color: "#ffffff",
  },

  myQrArea: {
    alignItems: "center",
    paddingTop: verticalScale(22),
  },

  qrProfileAvatarWrap: {
    position: "absolute",
    top: 0,
    zIndex: 3,
    width: rs(50),
    height: rs(50),
    borderRadius: rs(25),
    overflow: "hidden",
    borderWidth: 0,
    backgroundColor: "#111111",
  },

  qrProfileAvatar: {
    width: "100%",
    height: "100%",
  },

  qrProfileAvatarImage: {
    resizeMode: "cover",
  },

  myQrCard: {
    width: "100%",
    maxWidth: 330,
    minHeight: verticalScale(296),
    marginTop: verticalScale(8),
    borderRadius: rs(15),
    backgroundColor: "#111111",
    alignItems: "center",
    paddingTop: verticalScale(36),
    paddingHorizontal: rs(14),
    paddingBottom: verticalScale(18),
  },

  myQrName: {
    color: "#ffffff",
    fontSize: rs(16),
    fontWeight: "800",
  },

  myQrUsername: {
    color: "#999999",
    fontSize: rs(8),
    marginTop: rs(2),
    marginBottom: verticalScale(17),
  },

  myQrCodeWrap: {
    padding: rs(8),
    backgroundColor: "#ffffff",
    borderRadius: rs(8),
  },

  myQrPrivacy: {
    color: "#c1c1c1",
    fontSize: rs(9),
    lineHeight: rs(13),
    textAlign: "center",
    marginTop: verticalScale(18),
  },

  scanArea: {
    alignItems: "center",
    paddingTop: verticalScale(78),
  },

  scannerFrame: {
    width: Math.min(SCREEN_WIDTH - rs(105), rs(155)),
    height: Math.min(SCREEN_WIDTH - rs(105), rs(155)),
    borderRadius: rs(16),
    overflow: "hidden",
    borderWidth: 0,
    backgroundColor: "#050505",
    position: "relative",
  },

  cameraPreview: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },

  cameraPermissionFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(12),
  },

  permissionText: {
    color: "#777777",
    fontSize: rs(8),
    textAlign: "center",
    marginTop: rs(6),
  },

  corner: {
    position: "absolute",
    width: rs(22),
    height: rs(22),
    borderColor: "#ffffff",
    zIndex: 5,
  },

  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderTopLeftRadius: rs(15),
  },

  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderTopRightRadius: rs(15),
  },

  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderBottomLeftRadius: rs(15),
  },

  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderBottomRightRadius: rs(15),
  },

  scanText: {
    color: "#ffffff",
    fontSize: rs(10),
    fontWeight: "700",
    marginTop: rs(9),
  },

  // ==========================================================
  // ABOUT
  // ==========================================================

  aboutScroll: {
    paddingHorizontal: 21,
    paddingTop: 22,
    paddingBottom: 40,
  },

  aboutBackButton: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "center",

    gap: 5,

    paddingHorizontal: 9,
    paddingVertical: 7,

    borderRadius: 18,

    backgroundColor: "#111111",

    marginBottom: 18,
  },

  aboutBackText: {
    color: "#aaa",

    fontSize: 10,
    fontWeight: "500",
  },

  betaCard: {
    height: 141,

    borderRadius: 16,

    backgroundColor: "#111514",

    overflow: "hidden",

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 20,

    borderWidth: 0,
  },

  betaGlowOne: {
    position: "absolute",

    width: 80,
    height: 80,

    borderRadius: 50,

    backgroundColor:
      "rgba(255,45,0,0.32)",

    top: -28,
    left: 5,
  },

  betaGlowTwo: {
    position: "absolute",

    width: 100,
    height: 100,

    borderRadius: 50,

    backgroundColor:
      "rgba(120,35,0,0.20)",

    bottom: -55,
    left: 20,
  },

  betaText: {
    color: "#c8bebe",

    fontSize: 38,
    fontWeight: "300",

    letterSpacing: -1,
  },

  betaBrand: {
    position: "absolute",

    bottom: 9,

    color: "#777",

    fontSize: 9,
  },

  aboutTitle: {
    color: "#ffffff",

    fontSize: 23,
    fontWeight: "800",

    marginBottom: 4,
  },

  aboutSubtitle: {
    color: "#999",

    fontSize: 10,

    marginBottom: 20,
  },

  aboutAppInfoButton: {
    minHeight: 38,

    borderRadius: 10,

    backgroundColor: "#111111",

    borderWidth: 0,

    paddingHorizontal: 12,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 17,
  },

  aboutRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  aboutAppInfoText: {
    color: "#eee",

    fontSize: 11,
    fontWeight: "600",
  },

  aboutDescription: {
    color: "#c1c1c1",

    fontSize: 10.5,
    lineHeight: 18,

    marginBottom: 12,
  },

  aboutBuilt: {
    color: "#c1c1c1",

    fontSize: 10.5,

    marginBottom: 25,
  },

  aboutSectionTitle: {
    color: "#f3f3f3",

    fontSize: 15,
    fontWeight: "700",

    marginBottom: 10,
  },

  legalButton: {
    height: 31,

    borderRadius: 8,

    backgroundColor: "#160d00",

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 8,
  },

  legalButtonText: {
    color: "#eee",

    fontSize: 10,
    fontWeight: "600",
  },

  socialRow: {
    flexDirection: "row",
    gap: 12,
  },

  socialButton: {
    width: 36,
    height: 36,

    borderRadius: 20,

    backgroundColor: "#160d00",

    alignItems: "center",
    justifyContent: "center",
  },

  openSourceCard: {
    marginTop: 28,

    backgroundColor: "#080808",

    borderRadius: 15,

    borderWidth: 0,

    padding: 16,
  },

  openSourceTitle: {
    color: "#f2f2f2",

    fontSize: 15,
    fontWeight: "700",

    marginBottom: 8,
  },

  openSourceDescription: {
    color: "#a6a6a6",

    fontSize: 10,
    lineHeight: 16,

    marginBottom: 12,
  },

  comingSoonButton: {
    height: 25,

    borderRadius: 7,

    borderWidth: 0,

    alignItems: "center",
    justifyContent: "center",
  },

  comingSoonText: {
    color: "#d8d8d8",

    fontSize: 9,
    fontWeight: "600",
  },

  // ==========================================================
  // APP INFO
  // ==========================================================

  appInfoScroll: {
    paddingHorizontal: 19,
    paddingTop: 30,
    paddingBottom: 40,
  },

  appInfoHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 60,
  },

  appInfoBack: {
    width: 30,
    height: 30,

    borderRadius: 20,

    backgroundColor: "#111",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 11,
  },

  appInfoHeaderTitle: {
    color: "#f3f3f3",

    fontSize: 16,
    fontWeight: "700",
  },

  appLogoSection: {
    alignItems: "center",

    marginBottom: 42,
  },

  bmLogo: {
    height: 45,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    marginBottom: 20,
  },

  bmLogoB: {
    color: "#eee",

    fontSize: 35,
    fontWeight: "300",

    transform: [
      {
        scaleX: -1,
      },
    ],
  },

  bmLogoM: {
    color: "#fff",

    fontSize: 35,
    fontWeight: "800",

    marginLeft: -2,
  },

  appName: {
    color: "#f5f5f5",

    fontSize: 16,
    fontWeight: "800",

    marginBottom: 5,
  },

  appTagline: {
    color: "#999",

    fontSize: 9,
  },

  infoCard: {
    backgroundColor: "#0d0d0d",

    borderRadius: 12,

    paddingHorizontal: 13,
    paddingVertical: 17,

    marginBottom: 15,
  },

  infoItem: {
    marginBottom: 15,
  },

  infoLabel: {
    color: "#999",

    fontSize: 10,

    marginBottom: 3,
  },

  infoValue: {
    color: "#fff",

    fontSize: 10,
    fontWeight: "700",
  },

  licenseButton: {
    minHeight: 38,

    backgroundColor: "#0d0d0d",

    borderRadius: 9,

    paddingHorizontal: 11,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  licenseLeft: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",

    gap: 10,
  },

  licenseText: {
    color: "#ddd",

    fontSize: 10,
    fontWeight: "500",
  },

  // ==========================================================
  // LICENSES
  // ==========================================================

  licenseScroll: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },

  licenseBack: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "center",

    gap: 6,

    backgroundColor: "#111",

    paddingHorizontal: 11,
    paddingVertical: 7,

    borderRadius: 18,

    marginBottom: 25,
  },

  licenseBackText: {
    color: "#aaa",
    fontSize: 11,
  },

  licensePageTitle: {
    color: "#fff",

    fontSize: 22,
    fontWeight: "800",

    marginBottom: 14,
  },

  licenseIntro: {
    color: "#999",

    fontSize: 11,
    lineHeight: 18,

    marginBottom: 28,
  },

  // **@** Added missing licenseNotice & licenseSectionHeading styles
  licenseNotice: {
    color: "#999",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 20,
  },

  licenseSectionHeading: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 14,
    marginTop: 10,
  },

  libraryItem: {
    marginBottom: 17,
  },

  libraryName: {
    color: "#fff",

    fontSize: 12,
    fontWeight: "700",

    marginBottom: 4,
  },

  libraryDescription: {
    color: "#999",

    fontSize: 10,
    lineHeight: 16,
  },

  // ==========================================================
  // DEVELOPER TOOLS
  // ==========================================================

  infoItemPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.985 }],
  },

  developerMiniBadge: {
    alignSelf: "flex-start",
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(0,255,200,0.10)",
    borderWidth: 0,
  },

  developerMiniBadgeText: {
    color: "#00e6b0",
    fontSize: 9,
    fontWeight: "700",
  },

  developerOptionButton: {
    minHeight: 58,
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  developerPage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  developerScroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 45,
  },

  developerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  developerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    borderWidth: 0,
  },

  developerHeaderTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },

  developerBadge: {
    alignSelf: "center",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(0,255,200,0.10)",
    borderWidth: 0,
    marginBottom: 17,
  },

  developerBadgeText: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "700",
  },

  developerIntro: {
    color: "#999999",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 22,
    paddingHorizontal: 6,
  },

  developerFeatureCard: {
    borderRadius: 28,
    backgroundColor: "#0d0d0d",
    padding: 13,
    marginBottom: 24,
    borderWidth: 0,
  },

  developerSectionTitle: {
    color: "#00e6b0",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 9,
    paddingHorizontal: 4,
  },

  developerFeatureItem: {
    minHeight: 66,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  developerFeaturePressed: {
    backgroundColor: "rgba(0,255,200,0.06)",
    transform: [{ scale: 0.99 }],
  },

  developerFeatureText: {
    flex: 1,
    paddingRight: 12,
  },

  developerFeatureTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },

  developerFeatureDescription: {
    color: "#8e8e8e",
    fontSize: 10.5,
    lineHeight: 15,
  },

  developerFooter: {
    color: "#555555",
    fontSize: 10,
    textAlign: "center",
    marginTop: 20,
  },

  // ==========================================================
  // DEVELOPER PASSPHRASE MODAL
  // ==========================================================

  devModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  devModalCard: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#161618",
    borderWidth: 0,
  },

  devModalTitle: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  devModalSubtitle: {
    color: "#8f8f8f",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 10,
  },

  devModalInput: {
    height: 50,
    borderWidth: 0,
    borderRadius: 20,
    backgroundColor: "#090909",
    color: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 18,
  },

  devModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  devCancelButton: {
    minWidth: 90,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  devCancelText: {
    color: "#999999",
    fontSize: 13,
    fontWeight: "500",
  },

  devVerifyButton: {
    minWidth: 100,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00c99a",
  },

  devVerifyText: {
    color: "#00140f",
    fontSize: 13,
    fontWeight: "700",
  },

  // ==========================================================
  // DEV TOOL SANDBOX STYLES
  // ==========================================================

  devToastBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,230,176,0.12)",
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },

  devToastText: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  sandboxCard: {
    backgroundColor: "#0d0d0d",
    borderRadius: 28,
    padding: 16,
    borderWidth: 0,
    marginBottom: 20,
  },

  sandboxSectionTitle: {
    color: "#00e6b0",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },

  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#161616",
    marginRight: 8,
    borderWidth: 0,
  },

  cityChipActive: {
    backgroundColor: "rgba(0,230,176,0.15)",
  },

  cityChipText: {
    color: "#888",
    fontSize: 12,
  },

  cityChipTextActive: {
    color: "#00e6b0",
    fontWeight: "700",
  },

  weatherMainHero: {
    alignItems: "center",
    paddingVertical: 18,
    backgroundColor: "#121214",
    borderRadius: 14,
    marginBottom: 16,
  },

  weatherMainTemp: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "800",
  },

  weatherMainCondition: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },

  weatherHourCard: {
    alignItems: "center",
    backgroundColor: "#141416",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 60,
  },

  weatherHourTime: {
    color: "#777",
    fontSize: 10,
  },

  weatherHourTemp: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  weatherMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0,
  },

  weatherMetricItem: {
    alignItems: "center",
  },

  weatherMetricLabel: {
    color: "#777",
    fontSize: 10,
  },

  weatherMetricVal: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  socialStoryRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161616",
  },

  socialStoryName: {
    color: "#aaa",
    fontSize: 10,
    marginTop: 4,
  },

  socialPostCard: {
    backgroundColor: "#121214",
    borderRadius: 28,
    padding: 14,
    borderWidth: 0,
  },

  socialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3b83f6",
    alignItems: "center",
    justifyContent: "center",
  },

  commentItem: {
    backgroundColor: "#1a1a1e",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },

  commentInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#18181c",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 12,
  },

  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },

  countryCodePicker: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#161616",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },

  sandboxInput: {
    height: 46,
    backgroundColor: "#161616",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 13,
    borderWidth: 0,
  },

  sandboxPrimaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },

  sandboxPrimaryBtnText: {
    color: "#00140f",
    fontSize: 13,
    fontWeight: "700",
  },

  sandboxSecondaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#141416",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  sandboxSecondaryBtnText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },

  otpDigitBox: {
    width: 40,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#161616",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },

  mapHeroBox: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#121214",
    borderRadius: 14,
    marginBottom: 16,
  },

  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0,
  },

  densityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,230,176,0.12)",
  },

  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141416",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 0,
  },

  jsonCard: {
    backgroundColor: "#121214",
    padding: 12,
    borderRadius: 28,
    marginBottom: 8,
    borderWidth: 0,
  },

  // ==========================================================
  // **@** MODERN SCREENSHOT-MATCHING SETTINGS STYLES
  // ==========================================================

  modernHeader: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // **@** Equal 20px edge spacing as requested
    zIndex: 20,
    backgroundColor: "transparent", // **@** App bar container is completely invisible
  },

  // **@** Left container holding the back arrow and Settings title
  modernHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },

  // **@** Settings title positioned to the right of the arrow with clean visual hierarchy
  modernHeaderTitle: {
    fontSize: 22,
    fontWeight: "700", // **@** Industry-standard bold weight for modern UI/UX visual balance
    letterSpacing: -0.4,
    marginLeft: 12, // **@** Clear breathing space between arrow and title
  },

  modernHeaderIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modernHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  // **@** Header mask gradient pinned to top edge BEHIND floating header that dissolves content on scroll
  modernHeaderGradientMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  modernTripBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  modernTripBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  modernScroll: {
    flex: 1,
  },

  modernScrollContent: {
    paddingTop: Platform.OS === "android" ? 74 : 66,
    paddingBottom: 40,
  },

  modernProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 28,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 0,
  },

  modernProfileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E2E8F0",
  },

  modernProfileDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },

  modernProfileName: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  modernProfileEmail: {
    fontSize: 13,
    marginTop: 3,
  },

  modernProfileEditBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  modernSectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 22,
  },

  modernCardGroup: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 0,
  },

  modernRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingVertical: 16,
    minHeight: 0,
  },

  modernDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  modernIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  modernRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    paddingVertical: 0,
  },

  modernRowTextGroup: {
    flex: 1,
    justifyContent: "center",
  },

  modernRowTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  modernRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  modernHotBadge: {
    backgroundColor: "rgba(255, 149, 0, 0.12)",
    borderWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 9,
    marginLeft: 7,
  },

  modernHotBadgeText: {
    color: "#FF9500",
    fontSize: 10,
    fontWeight: "700",
  },

  modernRowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 16,
  },

  modernRowRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },

  modernRowRightText: {
    fontSize: 13.5,
    marginRight: 6,
    fontWeight: "500",
  },

  // **@** In-Settings Search Styles
  modernSearchHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20, // **@** Exact 20px padding from screen edge
    gap: 12,
    zIndex: 30,
  },

  modernSearchInputWrapper: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  modernSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: "100%",
  },

  modernBottomSearchWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 30,
  },

  modernBottomSearchPill: {
    height: 48,
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: "#1C1C1E",
    boxShadow:
      "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
  },

  modernBottomSearchPressable: {
    flex: 1,
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  modernBottomSearchPlaceholderText: {
    fontSize: 14.5,
    fontWeight: "500",
  },

  modernSearchClearBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  modernCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },

  modernCategoryBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  modernSearchResultsContainer: {
    paddingTop: 0,
    marginTop: -6,
  },

  modernSuggestedHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 22,
  },

  modernSearchTip: {
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 18,
    marginHorizontal: 30,
    lineHeight: 18,
  },

  modernEmptySearchWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 68,
    paddingBottom: 36,
    paddingHorizontal: 28,
  },

  modernEmptySearchTitle: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },

  modernEmptySearchSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── IN-PLACE SEARCH STYLES ──
  searchViewContainer: {
    flex: 1,
  },
  searchChipsContainer: {
    paddingBottom: 8,
  },
  searchChipsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  searchChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  searchChipText: {
    fontSize: 12.5,
  },
  searchScrollArea: {
    flex: 1,
  },
  searchScrollContent: {
    paddingTop: 4,
  },
  searchSectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: 22,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  searchResultIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  searchResultContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchResultTextGroup: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center",
  },
  searchResultTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchResultTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  searchCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  searchCategoryBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  devBadge: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 6,
  },
  devBadgeText: {
    color: "#00E6B0",
    fontSize: 9.5,
    fontWeight: "700",
  },
  searchResultSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 16,
  },
  searchResultRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  searchResultRightText: {
    fontSize: 13,
    marginRight: 6,
    fontWeight: "500",
  },
  searchResultDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  searchEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 28,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptySearchTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySearchSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyClearBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyClearBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  modernSearchActiveInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: "100%",
  },
  modernSearchActiveInput: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 0,
    height: "100%",
    fontWeight: "500",
  },
});