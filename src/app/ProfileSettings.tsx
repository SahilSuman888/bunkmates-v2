import {
  Ionicons,
  MaterialCommunityIcons,
  Feather, // **@** Added Feather for profile edit pen icon
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Image, // **@** Added Image for modern avatar
  InteractionManager, // **@** Defer heavy work until after nav animation
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
  Modal,
  TextInput,
  Keyboard, // **@** Added Keyboard for in-settings search dismissal
  Platform, // **@** Added Platform import
  Appearance, // **@** Added Appearance for theme detection
  Animated, // **@** Added Animated for header mask gradient reveal on scroll
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext"; // **@** Added dynamic theme hook
import { auth, db } from "../lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// **@** SettingRow extracted outside component and memoized to prevent
// re-creation on every parent render — major perf win for long lists.
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

const SettingRowMemo = React.memo(function SettingRow({
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
  isDark = true,
  colors,
}: SettingRowProps) {
  const dividerColor = colors?.divider ?? (isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7");
  const textPrimary = colors?.textPrimary ?? (isDark ? "#FFFFFF" : "#11141A");
  const textSecondary = colors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590");
  const chevronColor = colors?.chevron ?? (isDark ? "#555860" : "#B4B9C2");
  // **@** All icons are greyish-white by default, not red
  const defaultIconColor = colors?.greyishWhite ?? (isDark ? "#E2E8F0" : "#4B5563");
  const finalIconColor = iconColor ?? defaultIconColor;
  const resolvedIconBg = iconBg ?? (colors?.iconBoxBg ?? (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"));

  return (
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
          <MaterialCommunityIcons name={icon} size={20} color={finalIconColor} />
        ) : iconFamily === "feather" ? (
          <Feather name={icon} size={19} color={finalIconColor} />
        ) : (
          <Ionicons name={icon} size={20} color={finalIconColor} />
        )}
      </View>

      <View
        style={[
          styles.modernRowContent,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: dividerColor,
          },
        ]}
      >
        <View style={styles.modernRowTextGroup}>
          <View style={styles.modernRowTitleWrap}>
            <Text
              style={[
                styles.modernRowTitle,
                { color: textPrimary },
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
                    { color: textSecondary },
                  ]}
                >
                  {category}
                </Text>
              </View>
            ) : null}
            {badge ? (
              <View style={styles.modernHotBadge}>
                <Text style={styles.modernHotBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text
              style={[
                styles.modernRowSubtitle,
                { color: textSecondary },
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
                { color: textSecondary },
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
  );
});

export default function ProfileSettings() {
  const router = useRouter();

  // **@** Ultra-smooth navigation helper to eliminate touch freezes & jitter
  const isNavigatingRef = useRef(false);
  const smoothNavigate = useCallback(
    (route: string) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 550);

      requestAnimationFrame(() => {
        router.push(route as any);
      });
    },
    [router]
  );

  const { user, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] =
    useState<SettingsPage>("main");

  const [qrTab, setQrTab] = useState<"my" | "scan">("my");
  const [scanned, setScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Developer mode — six taps on Build ID opens the developer area.
  const [tapCount, setTapCount] = useState(0);
  const [showDevDialog, setShowDevDialog] = useState(false);
  const [enteredKey, setEnteredKey] = useState("");
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [activeDevTool, setActiveDevTool] = useState<string | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tripCount, setTripCount] = useState(4);

  // **@** In-Settings Search states for searching setting features/options
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  const [profile, setProfile] =
    useState<ProfileData>({
      name: "",
      username: "",
      email: "",
      mobile: "",
      bio: "",
      photoURL: "",
      type: "",
    });

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
  let toggleThemeFn: () => void = () => {};
  let dynamicAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
      toggleThemeFn = themeContext.toggleTheme;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
    }
  } catch (e) {
    // safe fallback
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // **@** Memoized — only rebuilds when theme or accent changes, not on every render
  const colors = useMemo(() => ({
    bg: isDark ? "#0A0A0C" : "#F4F6F9",
    card: isDark ? "#141418" : "#FFFFFF",
    cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
    divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#8E95A2" : "#7E8590",
    sectionHeader: isDark ? "#8E95A2" : "#7E8590",
    coral: dynamicAccent,
    coralAccent: dynamicAccent,
    coralBg: isDark ? hexToRgba(dynamicAccent, 0.16) : hexToRgba(dynamicAccent, 0.09),
    greyishWhite: isDark ? "#E2E8F0" : "#4B5563", // **@** Greyish-white icon color as requested
    iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)", // **@** Subtle neutral icon box
    chevron: isDark ? "#555860" : "#B4B9C2",
    logoutBorder: isDark ? "rgba(255, 90, 95, 0.45)" : "rgba(255, 90, 95, 0.4)",
    logoutBg: isDark ? "rgba(255, 90, 95, 0.08)" : "rgba(255, 90, 95, 0.04)",
  }), [isDark, dynamicAccent]);

  // **@** Track scroll position for header mask gradient reveal on slide/scroll
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerMaskOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 15, 45],
        outputRange: [0, 0.7, 1],
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
    if (authLoading) return;

    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    // **@** Defer all Firestore work until after the navigation
    // animation finishes so the transition feels instant.
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        let profileData: ProfileData = {
          name:
            user.displayName ||
            "Explorer",

          username: "",

          email:
            user.email ||
            "",

          mobile: "",

          bio: "",

          photoURL:
            user.photoURL ||
            "",

          type: "Dev Beta",
        };

        const userRef = doc(
          db,
          "users",
          user.uid
        );

        const userSnap =
          await getDoc(userRef);

        if (userSnap.exists()) {
          const data =
            userSnap.data();

          profileData = {
            name:
              data.name ||
              user.displayName ||
              "Explorer",

            username:
              data.username ||
              data.userName ||
              "",

            email:
              data.email ||
              user.email ||
              "",

            mobile:
              data.mobile ||
              data.phone ||
              "",

            bio:
              data.bio ||
              "",

            photoURL:
              data.photoURL ||
              user.photoURL ||
              "",

            type:
              data.type ||
              data.userType ||
              "Dev Beta",
          };
        }

        setProfile(profileData);
      } catch (error) {
        console.log(
          "Profile fetch error:",
          error
        );
      } finally {
        setLoading(false);
      }
    });

    return () => task.cancel();
  }, [authLoading, user]);

  // **@** Trip count is fetched in a SEPARATE effect, further deferred,
  // so it never blocks the main settings render or initial navigation.
  useEffect(() => {
    if (authLoading || !user) return;

    // Small delay to ensure settings page has fully rendered first.
    const timer = setTimeout(() => {
      const task = InteractionManager.runAfterInteractions(async () => {
        try {
          const tripsSnap =
            await getDocs(
              collection(db, "trips")
            );

          let count = 0;

          tripsSnap.forEach(
            (tripDoc) => {
              const trip =
                tripDoc.data();

              const belongsToUser =
                trip.uid === user.uid ||
                trip.userId === user.uid ||
                trip.ownerId === user.uid ||
                trip.createdBy === user.uid;

              if (belongsToUser) {
                count++;
              }
            }
          );

          if (count > 0) {
            setTripCount(count);
          }
        } catch (tripError) {
          console.log(
            "Trip count unavailable:",
            tripError
          );
        }
      });

      return () => task.cancel();
    }, 500);

    return () => clearTimeout(timer);
  }, [authLoading, user]);

  // Restore developer mode on this device, matching the web version's
  // localStorage-based developer-mode behavior.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem("isDeveloper").then((value) => {
      if (mounted && value === "true") setIsDeveloper(true);
    });
    return () => {
      mounted = false;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const [verifyingKey, setVerifyingKey] = useState(false);

  const handleBuildTap = () => {
    if (isDeveloper) {
      setCurrentPage("developers");
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
      Alert.alert("Required", "Please enter the developer key.");
      return;
    }

    try {
      setVerifyingKey(true);
      const keyDoc = await getDoc(doc(db, "secret", "devkey"));
      const validKey = keyDoc.exists() ? keyDoc.data().key : null;

      if (enteredKey.trim() === validKey) {
        setIsDeveloper(true);
        await AsyncStorage.setItem("isDeveloper", "true");
        setShowDevDialog(false);
        setEnteredKey("");
        setCurrentPage("developers");
        Alert.alert("Developer Mode", "🧑‍💻 Developer Mode Unlocked!");
      } else {
        Alert.alert("Invalid Developer Key", "The developer key is incorrect.");
      }
    } catch (error) {
      console.error("Error verifying developer key:", error);
      Alert.alert("Error", "Could not verify the developer key. Try again later.");
    } finally {
      setVerifyingKey(false);
    }
  };

  const openDeveloperPage = () => {
    setCurrentPage("developers");
  };

  // Start the camera automatically whenever the QR scanner is active.
  // This hook is kept at component level so navigation between tabs/pages
  // never changes the order of React hooks.
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (currentPage !== "qr" || qrTab !== "scan") return;
      if (!cameraPermission) return;

      try {
        if (!cameraPermission.granted) {
          const permission = await requestCameraPermission();

          if (cancelled) return;

          if (!permission.granted) {
            Alert.alert(
              "Camera Permission Required",
              permission.canAskAgain
                ? "Allow camera access to scan a BunkMates QR code."
                : "Camera access is disabled. Please enable Camera permission for Expo Go in Android Settings."
            );
          }
        }
      } catch (error) {
        console.log("Camera permission error:", error);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
    };
  }, [currentPage, qrTab, cameraPermission, requestCameraPermission]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await auth.signOut();

      router.replace(
        "/(auth)/login" as any
      );
    } catch (error) {
      console.log(
        "Logout error:",
        error
      );
    }
  };

  // =========================================================
  // INTERNAL BACK
  // =========================================================

  const handleInternalBack = () => {
    if (activeDevTool) {
      setActiveDevTool(null);
      return;
    }

    if (currentPage === "developers") {
      setCurrentPage("appInfo");
      return;
    }

    if (currentPage === "licenses") {
      setCurrentPage("appInfo");
      return;
    }

    if (currentPage === "appInfo") {
      setCurrentPage("about");
      return;
    }

    if (currentPage === "about") {
      setCurrentPage("main");
      return;
    }

    // **@** Navigate back, or fallback to home/tabs if history stack is empty
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)" as any);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  // **@** Show skeleton/loading only while auth is resolving.
  // Profile data now loads via InteractionManager so we show
  // the settings layout ASAP with fallback values, rather than
  // blocking the entire screen behind a spinner.
  if (authLoading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="small"
          color="#ffffff"
        />
      </View>
    );
  }

  // =========================================================
  // VALUES
  // =========================================================

  const displayName =
    profile.name ||
    "Mohit Sharma";

  const username =
    profile.username ||
    displayName
      .toLowerCase()
      .replace(/\s+/g, "_");

  const backgroundImage =
    profile.photoURL ||
    "https://i.pravatar.cc/800?img=12";

  // =========================================================
  // SETTING ROW (MODERN IOS / SCREENSHOT STYLE)
  // =========================================================

  // **@** SettingRow is now defined outside the component as SettingRowMemo.
  // This shim passes down the current theme colors so the externally-defined
  // component renders correctly without needing context access.
  const SettingRow = useCallback(
    (props: Omit<SettingRowProps, "isDark" | "colors">) => (
      <SettingRowMemo
        {...props}
        isDark={isDark}
        colors={colors}
      />
    ),
    [isDark, colors]
  );

  // **@** Comprehensive list of all searchable settings & features inside Settings
  type SearchableSetting = {
    id: string;
    category: string;
    title: string;
    subtitle: string;
    keywords: string[];
    icon: any;
    iconFamily?: "ionicons" | "material" | "feather";
    iconColor?: string;
    iconBg?: string;
    badge?: string;
    rightText?: string;
    onPress: () => void;
  };

  // **@** Memoized so the massive array is only rebuilt when dependencies change
  const searchableSettings: SearchableSetting[] = useMemo(() => [
    // ACCOUNT
    {
      id: "edit-profile",
      category: "ACCOUNT",
      title: "Edit Profile",
      subtitle: "Personal details, travel bio & contact",
      keywords: ["edit profile", "profile", "bio", "name", "email", "phone", "avatar", "photo", "username"],
      icon: "edit-3",
      iconFamily: "feather" as const,
      iconColor: colors.greyishWhite,
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/ProfileEdit");
      },
    },
    {
      id: "account-security",
      category: "ACCOUNT",
      title: "Account & Security",
      subtitle: "Password, Two-factor auth, session logs",
      keywords: ["account", "security", "password", "two factor", "2fa", "session", "login", "auth"],
      icon: "shield-checkmark-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/accounts");
      },
    },
    {
      id: "privacy-data",
      category: "ACCOUNT",
      title: "Privacy & Data",
      subtitle: "Profile visibility, location logs",
      keywords: ["privacy", "data", "visibility", "tracking", "location", "logs"],
      icon: "lock-closed-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/privacy");
      },
    },
    {
      id: "connected-accounts",
      category: "ACCOUNT",
      title: "Connected Accounts",
      subtitle: "Google, Apple, social integrations",
      keywords: ["connected accounts", "google", "apple", "social", "integration", "link", "oauth"],
      icon: "link-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Connected Accounts", "Google authentication is active.");
      },
    },
    {
      id: "qr-code",
      category: "ACCOUNT",
      title: "My QR Code",
      subtitle: "Share profile & quick connect scanner",
      keywords: ["qr", "code", "scan", "scanner", "share", "barcode"],
      icon: "qr-code-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/qr-code");
      },
    },

    // TRIP EXPERIENCE
    {
      id: "notifications",
      category: "TRIP EXPERIENCE",
      title: "Notifications",
      subtitle: "Trip updates, chat pings, alerts",
      keywords: ["notifications", "alerts", "ping", "updates", "trip notification", "messages"],
      icon: "notifications-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/notifications");
      },
    },
    {
      id: "trip-preferences",
      category: "TRIP EXPERIENCE",
      title: "Trip Preferences",
      subtitle: "Dietary rules, accommodation styles, travel pace",
      keywords: ["preferences", "diet", "food", "accommodation", "hotel", "travel pace", "style"],
      badge: "Hot",
      icon: "compass-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Trip Preferences", "Configure your travel preferences and accommodation styles.");
      },
    },
    {
      id: "currency-expenses",
      category: "TRIP EXPERIENCE",
      title: "Currency & Expenses",
      subtitle: "Default Split bills, home currency USD",
      keywords: ["currency", "expenses", "split", "bills", "money", "budget", "cost", "dollar", "usd"],
      icon: "cash-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/budget");
      },
    },
    {
      id: "offline-downloads",
      category: "TRIP EXPERIENCE",
      title: "Offline & Downloads",
      subtitle: "Storage management, offline maps",
      keywords: ["offline", "downloads", "storage", "cache", "offline maps", "data saving"],
      icon: "cloud-download-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Offline & Downloads", "Offline maps cache and local assets storage management.");
      },
    },
    {
      id: "maps-navigation",
      category: "TRIP EXPERIENCE",
      title: "Maps & Navigation",
      subtitle: "Offline cache, route preferences",
      keywords: ["maps", "navigation", "routes", "directions", "gps", "travel route"],
      icon: "location-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Maps & Navigation", "Navigation route preferences and scenic route toggles.");
      },
    },
    {
      id: "weather-alerts",
      category: "TRIP EXPERIENCE",
      title: "Weather Alerts & AQI",
      subtitle: "Local weather forecasts & rain warnings",
      keywords: ["weather", "alerts", "aqi", "air quality", "rain", "temperature", "forecast"],
      icon: "partly-sunny-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/(tabs)/aqi");
      },
    },
    {
      id: "my-trips",
      category: "TRIP EXPERIENCE",
      title: "My Trips & Itineraries",
      subtitle: "Explore, manage, and plan adventures",
      keywords: ["trips", "my trips", "itinerary", "journey", "vacation", "planner"],
      icon: "airplane-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/trips");
      },
    },

    // APP SETTINGS
    {
      id: "appearance",
      category: "APP SETTINGS",
      title: "Appearance",
      subtitle: "Theme color, dark mode & light mode",
      keywords: ["appearance", "theme", "dark mode", "light mode", "color", "display"],
      rightText:
        themeMode === "system"
          ? "System (Auto)"
          : themeMode === "dark"
          ? "Dark Mode"
          : "Light Mode",
      icon: "color-filter-outline",
      onPress: () => {
        toggleThemeFn();
      },
    },
    {
      id: "language-region",
      category: "APP SETTINGS",
      title: "Language & Region",
      subtitle: "English (US), locale settings",
      keywords: ["language", "region", "country", "english", "locale", "timezone"],
      rightText: "English (US)",
      icon: "globe-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Language & Region", "Language is currently set to English (US).");
      },
    },
    {
      id: "accessibility",
      category: "APP SETTINGS",
      title: "Accessibility",
      subtitle: "Font scale, high contrast features",
      keywords: ["accessibility", "font", "contrast", "size", "zoom", "reader"],
      icon: "accessibility-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Accessibility", "Dynamic font scaling and high contrast features active.");
      },
    },
    {
      id: "chats",
      category: "APP SETTINGS",
      title: "Chats",
      subtitle: "Theme, Wallpapers, and Chat Settings",
      keywords: ["chats", "chat", "messages", "wallpaper", "chat theme", "bubbles"],
      icon: "chatbubble-ellipses-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/chat-settings");
      },
    },
    {
      id: "general-settings",
      category: "APP SETTINGS",
      title: "General Settings",
      subtitle: "App Theme, Language, and Location",
      keywords: ["general", "settings", "default", "preferences"],
      icon: "settings-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/general-settings");
      },
    },
    {
      id: "ai-features",
      category: "APP SETTINGS",
      title: "AI Features",
      subtitle: "Configure Groq API Key & AI settings",
      keywords: ["ai", "groq", "artificial intelligence", "api key", "bot", "assistant", "model", "smart"],
      icon: "sparkles",
      iconColor: colors.greyishWhite,
      iconBg: colors.iconBoxBg,
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/ai-settings");
      },
    },

    // SUPPORT
    {
      id: "help-support",
      category: "SUPPORT",
      title: "Help & Support",
      subtitle: "Guides, FAQs, 24/7 BunkMates bot",
      keywords: ["help", "support", "faq", "customer service", "guide", "problem", "ticket"],
      icon: "chatbubble-question-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/help");
      },
    },
    {
      id: "feedback",
      category: "SUPPORT",
      title: "Send Feedback",
      subtitle: "Feature requests, report bugs",
      keywords: ["feedback", "bug", "issue", "suggestion", "report", "feature request"],
      icon: "megaphone-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/feedback");
      },
    },
    {
      id: "rate-app",
      category: "SUPPORT",
      title: "Rate BunkMates",
      subtitle: "Show us some love on the store",
      keywords: ["rate", "review", "stars", "app store", "play store"],
      icon: "ribbon-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Rate BunkMates", "Thank you for rating BunkMates 5 stars! ⭐⭐⭐⭐⭐");
      },
    },
    {
      id: "about-app",
      category: "SUPPORT",
      title: "About BunkMates",
      subtitle: "Version 3.4.1 (Stable)",
      keywords: ["about", "version", "build", "info", "release"],
      icon: "information-circle-outline",
      onPress: () => {
        setIsSearching(false);
        handleBuildTap();
        setCurrentPage("about");
      },
    },
    {
      id: "licenses",
      category: "SUPPORT",
      title: "Third-Party Licenses",
      subtitle: "Open source software & dependencies",
      keywords: ["license", "licenses", "open source", "attribution", "third party", "libraries"],
      icon: "license",
      iconFamily: "material" as const,
      onPress: () => {
        setIsSearching(false);
        setCurrentPage("licenses");
      },
    },
    {
      id: "invite-friend",
      category: "SUPPORT",
      title: "Invite a Friend",
      subtitle: "Share BunkMates with travel companions",
      keywords: ["invite", "friend", "referral", "share", "refer"],
      icon: "person-add-outline",
      onPress: () => {
        setIsSearching(false);
        smoothNavigate("/inviteFriend");
      },
    },
    ...(isDeveloper
      ? [
          {
            id: "developer-tools",
            category: "DEVELOPER",
            title: "Developer Tools & Sandbox",
            subtitle: "Access internal tools, sandboxes, and developer routes",
            keywords: ["developer", "dev", "tools", "sandbox", "debug"],
            icon: "code-slash-outline",
            onPress: () => {
              setIsSearching(false);
              setCurrentPage("developers");
            },
          } as SearchableSetting,
        ]
      : []),
    {
      id: "logout",
      category: "ACCOUNT",
      title: "Log Out",
      subtitle: "Sign out of your current session",
      keywords: ["logout", "log out", "sign out", "exit"],
      icon: "log-out-outline",
      onPress: () => {
        setIsSearching(false);
        Alert.alert("Log Out", "Are you sure you want to log out of BunkMates?", [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: handleLogout },
        ]);
      },
    },
  ], [isDark, isDeveloper, themeMode, toggleThemeFn]);

  // **@** Memoized filter — only recalculates when query or settings list changes
  const filteredSettings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableSettings.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(q);
      const categoryMatch = item.category.toLowerCase().includes(q);
      const keywordMatch = item.keywords.some((k) => k.toLowerCase().includes(q));
      return titleMatch || subtitleMatch || categoryMatch || keywordMatch;
    });
  }, [searchQuery, searchableSettings]);

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    iconColor = "#d0d0d0",
    showChevron = false,
  }: {
    icon: any;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    iconColor?: string;
    showChevron?: boolean;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingItem,
          pressed &&
          styles.settingPressed,
        ]}
      >
        <View
          style={styles.settingIcon}
        >
          <MaterialCommunityIcons
            name={icon}
            size={rs(23)}
            color={iconColor}
          />
        </View>

        <View
          style={styles.settingContent}
        >
          <Text
            style={styles.settingTitle}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text
              style={
                styles.settingSubtitle
              }
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showChevron && (
          <Ionicons
            name="chevron-forward"
            size={19}
            color="#888888"
            style={{ marginLeft: 8 }}
          />
        )}
      </Pressable>
    );
  };

  // =========================================================
  // QR CODE PAGE
  // =========================================================

  if (currentPage === "qr") {
    const handleScanTab = () => {
      setScanned(false);
      setQrTab("scan");
    };

    const handleBarcodeScanned = ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      Alert.alert(
        "QR Code Scanned",
        data,
        [
          {
            text: "OK",
            onPress: () => setScanned(false),
          },
        ]
      );
    };

    return (
      <SafeAreaView style={styles.qrPage}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
        />

        <View style={styles.qrPageContent}>
          {/* **@** Unified Header matching Settings page back arrow */}
          <View style={styles.modernHeader}>
            <View style={styles.modernHeaderLeft}>
              <Pressable
                onPress={handleInternalBack}
                style={({ pressed }) => [
                  styles.modernHeaderBtn,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Go back"
                hitSlop={6}
              >
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color={colors.textPrimary}
                />
              </Pressable>
              <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
                QR Code
              </Text>
            </View>
          </View>

          {/* TABS */}
          <View style={styles.qrTabs}>
            <Pressable
              onPress={() => {
                setQrTab("my");
                setScanned(false);
              }}
              style={[
                styles.qrTab,
                qrTab === "my" && styles.qrTabActive,
              ]}
            >
              <Text
                style={[
                  styles.qrTabText,
                  qrTab === "my" && styles.qrTabTextActive,
                ]}
              >
                My Code
              </Text>
            </Pressable>

            <Pressable
              onPress={handleScanTab}
              style={[
                styles.qrTab,
                qrTab === "scan" && styles.qrTabActive,
              ]}
            >
              <Text
                style={[
                  styles.qrTabText,
                  qrTab === "scan" && styles.qrTabTextActive,
                ]}
              >
                Scan Code
              </Text>
            </Pressable>
          </View>

          {qrTab === "my" ? (
            <View style={styles.myQrArea}>
              <View style={styles.qrProfileAvatarWrap}>
                <ImageBackground
                  source={{ uri: backgroundImage }}
                  style={styles.qrProfileAvatar}
                  imageStyle={styles.qrProfileAvatarImage}
                />
              </View>

              <View style={styles.myQrCard}>
                <Text style={styles.myQrName}>
                  {displayName}
                </Text>

                <Text style={styles.myQrUsername}>
                  @{username}
                </Text>

                <View style={styles.myQrCodeWrap}>
                  <QRCode
                    value={
                      JSON.stringify({
                        type: "bunkmates_profile",
                        uid: user?.uid || "",
                        username,
                        name: displayName,
                      })
                    }
                    size={Math.min(150 * SCALE, 190)}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>

                <Text style={styles.myQrPrivacy}>
                  Your QR code is private. If you share it, they
                  {"\n"}
                  can add you as a friend.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.scanArea}>
              <View style={styles.scannerFrame}>
                {cameraPermission?.granted ? (
                  <CameraView
                    key="bunkmates-qr-back-camera"
                    style={styles.cameraPreview}
                    facing="back"
                    active={currentPage === "qr" && qrTab === "scan"}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onMountError={(event) => {
                      console.log(
                        "QR camera mount error:",
                        event?.message
                      );

                      Alert.alert(
                        "Camera Error",
                        event?.message ||
                        "The back camera could not be started. Please close other apps using the camera and try again."
                      );
                    }}
                    onBarcodeScanned={
                      scanned ? undefined : handleBarcodeScanned
                    }
                  />
                ) : (
                  <View style={styles.cameraPermissionFallback}>
                    <Ionicons
                      name="camera-outline"
                      size={rs(28)}
                      color="#777"
                    />
                    <Text style={styles.permissionText}>
                      Camera permission required
                    </Text>
                  </View>
                )}

                {/* Scanner corners */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>

              <Text style={styles.scanText}>
                Scan your QR code
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================
  // ABOUT PAGE
  // =========================================================

  if (currentPage === "about") {
    return (
      <SafeAreaView
        style={styles.simplePage}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
        />

        {/* **@** Unified Header matching Settings page back arrow */}
        <View style={styles.modernHeader}>
          <View style={styles.modernHeaderLeft}>
            <Pressable
              onPress={handleInternalBack}
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Go back"
              hitSlop={6}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
              About BunkMates
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.aboutScroll
          }
        >

          <View
            style={styles.betaCard}
          >
            <View
              style={
                styles.betaGlowOne
              }
            />

            <View
              style={
                styles.betaGlowTwo
              }
            />

            <Text
              style={styles.betaText}
            >
              BETA V2
            </Text>

            <Text
              style={styles.betaBrand}
            >
              BunkMates
            </Text>
          </View>

          <Text
            style={styles.aboutTitle}
          >
            About BunkMates
          </Text>

          <Text
            style={styles.aboutSubtitle}
          >
            Version info, policies,
            and how to reach us 🌐
          </Text>

          <Pressable
            onPress={() =>
              setCurrentPage(
                "appInfo"
              )
            }
            style={
              styles.aboutAppInfoButton
            }
          >
            <View
              style={styles.aboutRow}
            >
              <MaterialCommunityIcons
                name="layers-outline"
                size={18}
                color="#bdbdbd"
              />

              <Text
                style={
                  styles.aboutAppInfoText
                }
              >
                App Info
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color="#aaa"
            />
          </Pressable>

          <Text
            style={
              styles.aboutDescription
            }
          >
            BunkMates is built to
            simplify your group travel
            — from planning and chatting
            to managing expenses, tasks,
            and exploring destinations
            together. Designed for smooth
            adventures and lasting
            memories. 🌄
          </Text>

          <Text
            style={styles.aboutBuilt}
          >
            Built with 💗 in India.
          </Text>

          <Text
            style={
              styles.aboutSectionTitle
            }
          >
            Legal & Policy
          </Text>

          <Pressable
            onPress={() =>
              Linking.openURL(
                "https://bunkmateshome.vercel.app/privacy-policy"
              )
            }
            style={styles.legalButton}
          >
            <Text
              style={
                styles.legalButtonText
              }
            >
              Privacy Policy
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              Linking.openURL(
                "https://bunkmateshome.vercel.app/terms"
              )
            }
            style={styles.legalButton}
          >
            <Text
              style={
                styles.legalButtonText
              }
            >
              Terms of Service
            </Text>
          </Pressable>

          <Text
            style={[
              styles.aboutSectionTitle,
              {
                marginTop: 29,
              },
            ]}
          >
            Connect With Us
          </Text>

          <View
            style={styles.socialRow}
          >
            <Pressable
              onPress={() =>
                Linking.openURL(
                  "mailto:team.bunkmates@gmail.com"
                )
              }
              style={
                styles.socialButton
              }
            >
              <Ionicons
                name="mail"
                size={17}
                color="#fff"
              />
            </Pressable>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  "https://www.instagram.com/bunkmates.app"
                )
              }
              style={
                styles.socialButton
              }
            >
              <Ionicons
                name="logo-instagram"
                size={17}
                color="#fff"
              />
            </Pressable>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  "https://www.youtube.com/@Team_BunkMates"
                )
              }
              style={
                styles.socialButton
              }
            >
              <Ionicons
                name="logo-youtube"
                size={17}
                color="#fff"
              />
            </Pressable>
          </View>

          <View
            style={styles.openSourceCard}
          >
            <Text
              style={
                styles.openSourceTitle
              }
            >
              Open Source
            </Text>

            <Text
              style={
                styles.openSourceDescription
              }
            >
              Our source code will be
              available soon on GitHub.
              Stay tuned for the launch!
            </Text>

            <View
              style={
                styles.comingSoonButton
              }
            >
              <Text
                style={
                  styles.comingSoonText
                }
              >
                COMING SOON...
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================
  // DEVELOPER PASSPHRASE MODAL RENDERER
  // =========================================================

  const renderDeveloperPasskeyModal = () => (
    <Modal
      visible={showDevDialog}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDevDialog(false)}
    >
      <View style={styles.devModalOverlay}>
        <View style={styles.devModalCard}>
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
      </View>
    </Modal>
  );

  // =========================================================
  // APP INFO
  // =========================================================

  if (currentPage === "appInfo") {
    return (
      <SafeAreaView
        style={styles.simplePage}
      >
        {renderDeveloperPasskeyModal()}
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
        />

        {/* **@** Unified Header matching Settings page back arrow */}
        <View style={styles.modernHeader}>
          <View style={styles.modernHeaderLeft}>
            <Pressable
              onPress={handleInternalBack}
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Go back"
              hitSlop={6}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
              App Information
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.appInfoScroll
          }
        >

          <View
            style={
              styles.appLogoSection
            }
          >
            <View
              style={styles.bmLogo}
            >
              <Text
                style={styles.bmLogoB}
              >
                B
              </Text>

              <Text
                style={styles.bmLogoM}
              >
                M
              </Text>
            </View>

            <Text
              style={styles.appName}
            >
              BunkMates
            </Text>

            <Text
              style={styles.appTagline}
            >
              Bunk The Chaos, Keep
              The Fun!
            </Text>
          </View>

          <View
            style={styles.infoCard}
          >
            <View
              style={styles.infoItem}
            >
              <Text
                style={styles.infoLabel}
              >
                App Version
              </Text>

              <Text
                style={styles.infoValue}
              >
                1.0.31
              </Text>
            </View>

            <Pressable
              onPress={handleBuildTap}
              style={({ pressed }) => [
                styles.infoItem,
                pressed && styles.infoItemPressed,
              ]}
            >
              <Text style={styles.infoLabel}>Build ID</Text>

              <Text style={styles.infoValue}>Beta_3.0.08.100</Text>

              {isDeveloper ? (
                <View style={styles.developerMiniBadge}>
                  <Text style={styles.developerMiniBadgeText}>
                    🧑‍💻 Developer Mode Active
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <View
              style={[
                styles.infoItem,
                {
                  marginBottom: 0,
                },
              ]}
            >
              <Text
                style={styles.infoLabel}
              >
                Developer
              </Text>

              <Text
                style={styles.infoValue}
              >
                Team BunkMates
              </Text>
            </View>
          </View>

          {isDeveloper ? (
            <Pressable
              onPress={openDeveloperPage}
              style={({ pressed }) => [
                styles.developerOptionButton,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.licenseLeft}>
                <MaterialCommunityIcons
                  name="tools"
                  size={18}
                  color="#aaa"
                />
                <Text style={styles.licenseText}>
                  Testing Features & Other Routes
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#aaa" />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() =>
              setCurrentPage(
                "licenses"
              )
            }
            style={
              styles.licenseButton
            }
          >
            <View
              style={styles.licenseLeft}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={17}
                color="#aaa"
              />

              <Text
                style={
                  styles.licenseText
                }
              >
                Third-Party Licenses &
                Attributions
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color="#aaa"
            />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================
  // =========================================================
  // DEVELOPER TOOLS — PORTED FROM THE WEB DEVELOPER PAGE
  // =========================================================

  if (currentPage === "developers") {
    if (activeDevTool) {
      return (
        <SafeAreaView style={styles.developerPage}>
          {renderDeveloperPasskeyModal()}
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <DevToolSandboxView
            toolId={activeDevTool}
            onBack={() => setActiveDevTool(null)}
          />
        </SafeAreaView>
      );
    }

    const developerFeatures = [
      {
        id: "weather-forecast",
        label: "Weather Forecast Hourly",
        description: "Displays hourly weather data for testing.",
        route: "/developer/waether-forecast",
      },
      {
        id: "weather-page",
        label: "Weather Page",
        description: "Standalone weather information page.",
        route: "/developer/weather",
      },
      {
        id: "new-groups",
        label: "New Groups",
        description: "This feature is just for testing the new group chats page.",
        route: "/grouplists",
      },
      {
        id: "social-feed",
        label: "For Fun...😜",
        description: "This feature is just for fun and won't go live for public and BETA Testers.",
        route: "/developer/bunkmates/social",
      },
      {
        id: "otp-login",
        label: "OTP Login",
        description: "This feature is just for testing OTP login functionality.",
        route: "/developer/OtpLogin",
      },
      {
        id: "user-maps",
        label: "User Maps",
        description: "View user distribution heatmaps and analytics.",
        route: "/developer/maps",
      },
      {
        id: "budget-manager",
        label: "Budget Manager",
        description: "Manage and track your budget allocations.",
        route: "/developer/BudgetMngr",
      },
      {
        id: "dev-notes",
        label: "Notes",
        description: "A simple note-taking feature for testing purposes.",
        route: "/developer/notes",
      },
    ];

    const otherDeveloperRoutes = [
      {
        id: "firestore-playground",
        label: "Firestore Playground",
        description: "Live Firestore document viewer & query tester.",
        route: "/developer/firestore-playground",
      },
      {
        id: "notifications-preview",
        label: "Notifications Preview",
        description: "Preview app notification styles, toasts, and alerts.",
        route: "/developer/notifications",
      },
      {
        id: "ui-showcase",
        label: "UI Components Showcase",
        description: "Showcase of custom design tokens, buttons, & glass cards.",
        route: "/developer/ui-demo",
      },
      {
        id: "error-test",
        label: "Error Boundary Test",
        description: "Trigger runtime errors to test recovery screens.",
        route: "/developer/error-test",
      },
    ];

    const handleDeveloperFeature = (id: string, route: string) => {
      if (id === "budget-manager") {
        try {
          router.push("/budget" as any);
          return;
        } catch {
          setActiveDevTool(id);
          return;
        }
      }
      if (id === "new-groups") {
        try {
          router.push("/(tabs)" as any);
          return;
        } catch {
          setActiveDevTool(id);
          return;
        }
      }
      if (id === "weather-page") {
        try {
          router.push("/(tabs)/Weather" as any);
          return;
        } catch {
          setActiveDevTool("weather-forecast");
          return;
        }
      }
      setActiveDevTool(id);
    };

    return (
      <SafeAreaView style={styles.developerPage}>
        {renderDeveloperPasskeyModal()}
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* **@** Unified Header matching Settings page back arrow */}
        <View style={styles.modernHeader}>
          <View style={styles.modernHeaderLeft}>
            <Pressable
              onPress={handleInternalBack}
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Go back"
              hitSlop={6}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
              Developer Tools
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.developerScroll}
        >

          <View style={styles.developerBadge}>
            <Text style={styles.developerBadgeText}>🧑‍💻 Developer Mode Active</Text>
          </View>

          <Text style={styles.developerIntro}>
            🧑‍💻 Welcome to Developer Mode — explore experimental and internal tools
            for testing, debugging, and feature previews.
          </Text>

          <View style={styles.developerFeatureCard}>
            <Text style={styles.developerSectionTitle}>Testing Features</Text>

            {developerFeatures.map((feature) => (
              <Pressable
                key={feature.id}
                onPress={() => handleDeveloperFeature(feature.id, feature.route)}
                style={({ pressed }) => [
                  styles.developerFeatureItem,
                  pressed && styles.developerFeaturePressed,
                ]}
              >
                <View style={styles.developerFeatureText}>
                  <Text style={styles.developerFeatureTitle}>{feature.label}</Text>
                  <Text style={styles.developerFeatureDescription}>
                    {feature.description}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#8d8d8d"
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.developerFeatureCard}>
            <Text style={styles.developerSectionTitle}>Other Developer Routes</Text>

            {otherDeveloperRoutes.map((route) => (
              <Pressable
                key={route.id}
                onPress={() => handleDeveloperFeature(route.id, route.route)}
                style={({ pressed }) => [
                  styles.developerFeatureItem,
                  pressed && styles.developerFeaturePressed,
                ]}
              >
                <View style={styles.developerFeatureText}>
                  <Text style={styles.developerFeatureTitle}>{route.label}</Text>
                  <Text style={styles.developerFeatureDescription}>
                    {route.description}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#8d8d8d"
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.developerFooter}>
            Developer Utilities © {new Date().getFullYear()} BunkMates Labs
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================
  // LICENSE PAGE
  // =========================================================

  if (currentPage === "licenses") {
    return (
      <SafeAreaView
        style={styles.simplePage}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
        />

        {/* **@** Unified Header matching Settings page back arrow */}
        <View style={styles.modernHeader}>
          <View style={styles.modernHeaderLeft}>
            <Pressable
              onPress={handleInternalBack}
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Go back"
              hitSlop={6}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
              Open Source Licenses
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.licenseScroll
          }
        >

          <Text
            style={
              styles.licensePageTitle
            }
          >
            Third-Party Licenses &
            {"\n"}Attributions
          </Text>

          <Text
            style={
              styles.licenseNotice
            }
          >
            BunkMates is built with
            the help of open-source
            software and open APIs. We
            gratefully acknowledge the
            contributions of these
            projects.
          </Text>

          <Text
            style={
              styles.licenseSectionHeading
            }
          >
            DEPENDENCIES & LIBRARIES
          </Text>

          <LicenseItem
            name="React & React Native"
            description="Core UI Framework — MIT License"
          />

          <LicenseItem
            name="Expo & Expo Router"
            description="App Framework & File Routing — MIT License"
          />

          <LicenseItem
            name="Firebase (Auth & Firestore)"
            description="Backend Services — Apache 2.0"
          />

          <LicenseItem
            name="@expo/vector-icons"
            description="Interface icons — ISC License"
          />

          <LicenseItem
            name="react-native-qrcode-svg"
            description="QR code generation — MIT License"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================
  // MAIN UI — EXACT STYLE FROM YOUR IMAGE
  // =========================================================

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      {renderDeveloperPasskeyModal()}
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* **@** Top Header: Standard mode with back button, left-aligned title, and action buttons */}
      {!isSearching ? (
        <View style={styles.modernHeader}>
          {/* **@** Left side: Back navigation button + Settings Title (UI/UX aligned) */}
          <View style={styles.modernHeaderLeft}>
            <Pressable
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={handleInternalBack}
              accessibilityLabel="Go back"
              hitSlop={6}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>

            <Text
              style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              Settings
            </Text>
          </View>

          {/* **@** Action buttons (QR Code & Search) on the right */}
          <View style={styles.modernHeaderIcons}>
            {/* QR Code Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={() => smoothNavigate("/qr-code")}
              accessibilityLabel="QR Code"
            >
              <Ionicons
                name="qr-code-outline"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>

            {/* **@** Search Settings Action Button (Opens in-settings search) */}
            <Pressable
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={() => setIsSearching(true)}
              accessibilityLabel="Search settings"
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.modernSearchHeader}>
          <View
            style={[
              styles.modernSearchInputWrapper,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              ref={searchInputRef}
              style={[styles.modernSearchInput, { color: colors.textPrimary }]}
              placeholder="Search settings & features..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                style={styles.modernSearchClearBtn}
                accessibilityLabel="Clear search"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.modernSearchCancelBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => {
              setIsSearching(false);
              setSearchQuery("");
              Keyboard.dismiss();
            }}
            accessibilityLabel="Cancel search"
          >
            <Text style={[styles.modernSearchCancelText, { color: colors.coral }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}

      {/* **@** Header Mask Gradient that appears when sliding/scrolling the settings list */}
      <Animated.View
        style={[
          styles.modernHeaderGradientMask,
          { opacity: headerMaskOpacity },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[
            colors.bg,
            isDark ? "rgba(10, 10, 12, 0.85)" : "rgba(244, 246, 249, 0.85)",
            "transparent",
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.ScrollView
        style={styles.modernScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.modernScrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {isSearching ? (
          <View style={styles.modernSearchResultsContainer}>
            {searchQuery.trim().length === 0 ? (
              <View>
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader },
                  ]}
                >
                  SUGGESTED SETTINGS
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  {searchableSettings.slice(0, 6).map((item, idx) => (
                    <SettingRow
                      key={item.id}
                      icon={item.icon}
                      iconFamily={item.iconFamily}
                      iconColor={item.iconColor}
                      iconBg={item.iconBg}
                      title={item.title}
                      subtitle={item.subtitle}
                      category={item.category}
                      badge={item.badge}
                      rightText={item.rightText}
                      isLast={idx === 5}
                      onPress={item.onPress}
                    />
                  ))}
                </View>
                <Text style={[styles.modernSearchTip, { color: colors.textSecondary }]}>
                  Type any setting name, feature, or keyword to find it instantly.
                </Text>
              </View>
            ) : filteredSettings.length > 0 ? (
              <View>
                <Text
                  style={[
                    styles.modernSectionHeading,
                    { color: colors.sectionHeader },
                  ]}
                >
                  MATCHING SETTINGS ({filteredSettings.length})
                </Text>
                <View
                  style={[
                    styles.modernCardGroup,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  {filteredSettings.map((item, idx) => (
                    <SettingRow
                      key={item.id}
                      icon={item.icon}
                      iconFamily={item.iconFamily}
                      iconColor={item.iconColor}
                      iconBg={item.iconBg}
                      title={item.title}
                      subtitle={item.subtitle}
                      category={item.category}
                      badge={item.badge}
                      rightText={item.rightText}
                      isLast={idx === filteredSettings.length - 1}
                      onPress={item.onPress}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.modernEmptySearchWrap}>
                <View
                  style={[
                    styles.modernEmptySearchIconBox,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <Ionicons
                    name="search-outline"
                    size={30}
                    color={colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.modernEmptySearchTitle,
                    { color: colors.textPrimary },
                  ]}
                >
                  No settings found
                </Text>
                <Text
                  style={[
                    styles.modernEmptySearchSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  We couldn't find any settings matching "{searchQuery}". Try searching for theme, security, currency, or notifications.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.modernEmptyClearBtn,
                    { backgroundColor: colors.coralBg, borderColor: colors.coral },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setSearchQuery("")}
                >
                  <Text style={[styles.modernEmptyClearBtnText, { color: colors.coral }]}>
                    Clear Query
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
            source={{ uri: profile.photoURL || backgroundImage }}
            style={styles.modernProfileAvatar}
          />
          <View style={styles.modernProfileDetails}>
            <Text
              style={[
                styles.modernProfileName,
                { color: colors.textPrimary },
              ]}
              numberOfLines={1}
            >
              {profile.name || user?.displayName || "Sasha Miller"}
            </Text>
            <Text
              style={[
                styles.modernProfileEmail,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {profile.email ||
                user?.email ||
                (profile.username
                  ? `${profile.username.toLowerCase()}@bunkmates.com`
                  : "sasha.explorer@bunkmates.com")}
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
            { color: colors.sectionHeader },
          ]}
        >
          ACCOUNT
        </Text>
        <View
          style={[
            styles.modernCardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* **@** Edit Profile option removed from ACCOUNT as requested (accessible via the pen icon above) */}
          <SettingRow
            icon="shield-checkmark-outline"
            title="Account & Security"
            subtitle="Password, Two-factor auth, session logs"
            onPress={() => smoothNavigate("/accounts")}
          />
          <SettingRow
            icon="lock-closed-outline"
            title="Privacy & Data"
            subtitle="Profile visibility, location logs"
            onPress={() => smoothNavigate("/privacy")}
          />
          <SettingRow
            icon="link-outline"
            title="Connected Accounts"
            subtitle="Google, Apple, social integrations"
            isLast
            onPress={() =>
              Alert.alert(
                "Connected Accounts",
                "Google authentication is active."
              )
            }
          />
        </View>

        {/* =====================================================
            2. TRIP EXPERIENCE
        ====================================================== */}
        <Text
          style={[
            styles.modernSectionHeading,
            { color: colors.sectionHeader },
          ]}
        >
          TRIP EXPERIENCE
        </Text>
        <View
          style={[
            styles.modernCardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <SettingRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Trip updates, chat pings, alerts"
            onPress={() => smoothNavigate("/notifications")}
          />
          <SettingRow
            icon="compass-outline"
            title="Trip Preferences"
            badge="Hot"
            subtitle="Dietary rules, accommodation styles, travel pace"
            onPress={() =>
              Alert.alert(
                "Trip Preferences",
                "Configure your travel preferences and accommodation styles."
              )
            }
          />
          <SettingRow
            icon="cash-outline"
            title="Currency & Expenses"
            subtitle="Default Split bills, home currency USD"
            onPress={() => smoothNavigate("/budget")}
          />
          <SettingRow
            icon="cloud-download-outline"
            title="Offline & Downloads"
            subtitle="Storage management, offline maps"
            onPress={() =>
              Alert.alert(
                "Offline & Downloads",
                "Offline maps cache and local assets storage management."
              )
            }
          />
          <SettingRow
            icon="location-outline"
            title="Maps & Navigation"
            subtitle="Offline cache, route preferences"
            onPress={() =>
              Alert.alert(
                "Maps & Navigation",
                "Navigation route preferences and scenic route toggles."
              )
            }
          />
          <SettingRow
            icon="partly-sunny-outline"
            title="Weather Alerts"
            subtitle="Local weather forecasts & rain warnings"
            isLast
            onPress={() => smoothNavigate("/(tabs)/aqi")}
          />
        </View>

        {/* =====================================================
            3. APP SETTINGS (Includes photo items + existing v2 items)
        ====================================================== */}
        <Text
          style={[
            styles.modernSectionHeading,
            { color: colors.sectionHeader },
          ]}
        >
          APP SETTINGS
        </Text>
        <View
          style={[
            styles.modernCardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <SettingRow
            icon="color-filter-outline"
            title="Appearance"
            rightText={
              themeMode === "system"
                ? "System (Auto)"
                : themeMode === "dark"
                ? "Dark Mode"
                : "Light Mode"
            }
            onPress={toggleThemeFn}
          />
          <SettingRow
            icon="globe-outline"
            title="Language & Region"
            rightText="English (US)"
            onPress={() =>
              Alert.alert(
                "Language & Region",
                "Language is currently set to English (US)."
              )
            }
          />
          <SettingRow
            icon="accessibility-outline"
            title="Accessibility"
            subtitle="Font scale, high contrast features"
            onPress={() =>
              Alert.alert(
                "Accessibility",
                "Dynamic font scaling and high contrast features active."
              )
            }
          />
          {/* Preserved v2 feature: Chats */}
          <SettingRow
            icon="chatbubble-ellipses-outline"
            title="Chats"
            subtitle="Theme, Wallpapers, and Chat Settings"
            onPress={() => smoothNavigate("/chat-settings")}
          />
          {/* Preserved v2 feature: General Settings */}
          <SettingRow
            icon="settings-outline"
            title="General Settings"
            subtitle="App Theme, Language, and Location"
            onPress={() => smoothNavigate("/general-settings")}
          />
          {/* Preserved v2 feature: AI Features with greyish-white icon */}
          <SettingRow
            icon="sparkles"
            title="AI Features"
            subtitle="Configure Groq API Key & AI settings"
            isLast
            onPress={() => smoothNavigate("/ai-settings")}
          />
        </View>

        {/* =====================================================
            4. SUPPORT (Includes photo items + existing v2 items)
        ====================================================== */}
        <Text
          style={[
            styles.modernSectionHeading,
            { color: colors.sectionHeader },
          ]}
        >
          SUPPORT
        </Text>
        <View
          style={[
            styles.modernCardGroup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <SettingRow
            icon="chatbubble-question-outline"
            title="Help & Support"
            subtitle="Guides, FAQs, 24/7 BunkMates bot"
            onPress={() => smoothNavigate("/help")}
          />
          <SettingRow
            icon="megaphone-outline"
            title="Send Feedback"
            subtitle="Feature requests, report bugs"
            onPress={() => smoothNavigate("/feedback")}
          />
          <SettingRow
            icon="ribbon-outline"
            title="Rate BunkMates"
            subtitle="Show us some love on the store"
            onPress={() =>
              Alert.alert(
                "Rate BunkMates",
                "Thank you for rating BunkMates 5 stars! ⭐⭐⭐⭐⭐"
              )
            }
          />
          <SettingRow
            icon="information-circle-outline"
            title="About BunkMates"
            subtitle="Version 3.4.1 (Stable)"
            onPress={() => {
              handleBuildTap();
              setCurrentPage("about");
            }}
          />
          {/* Preserved v2 feature: Licenses */}
          <SettingRow
            icon="license"
            iconFamily="material"
            title="Third-Party Licenses"
            subtitle="Open source software & dependencies"
            onPress={() => setCurrentPage("licenses")}
          />
          {/* Preserved v2 feature: Invite Friend */}
          <SettingRow
            icon="person-add-outline"
            title="Invite a Friend"
            subtitle="Share BunkMates with travel companions"
            isLast={!isDeveloper}
            onPress={() => smoothNavigate("/inviteFriend")}
          />
          {/* Preserved v2 feature: Developer tools if unlocked */}
          {isDeveloper && (
            <SettingRow
              icon="code-slash-outline"
              title="Developer Tools & Sandbox"
              subtitle="Access internal tools, sandboxes, and developer routes"
              isLast
              onPress={() => setCurrentPage("developers")}
            />
          )}
        </View>

        {/* =====================================================
            5. LOG OUT BUTTON
        ====================================================== */}
        <Pressable
          style={({ pressed }) => [
            styles.modernLogoutBtn,
            {
              borderColor: colors.logoutBorder,
              backgroundColor: colors.logoutBg,
            },
            pressed && { opacity: 0.75 },
          ]}
          onPress={() => {
            Alert.alert(
              "Log Out",
              "Are you sure you want to log out of BunkMates?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Log Out",
                  style: "destructive",
                  onPress: handleLogout,
                },
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.greyishWhite} />
          <Text style={styles.modernLogoutText}>Log Out</Text>
        </Pressable>
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
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

  // Handle Add Note
  const handleAddNote = () => {
    if (!newNoteTitle.trim()) {
      Alert.alert("Required", "Please enter a note title.");
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
      Alert.alert("Query Error", e.message || "Failed to query Firestore");
    } finally {
      setFetchingCol(false);
    }
  };

  // Trigger Toast Helper
  const triggerToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 3000);
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
                  Alert.alert("OTP Verified", "✅ Successfully authenticated via Phone OTP!");
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
            <View style={{ padding: 14, backgroundColor: "rgba(255,71,87,0.12)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,71,87,0.3)" }}>
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
            <Pressable onPress={() => setSimulatedError(true)} style={[styles.sandboxSecondaryBtn, { borderColor: "#ff4757" }]}>
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
    borderWidth: 1,
    borderColor: "#111111",
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
    borderWidth: 1.5,
    borderColor: "#d7d7d7",
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
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: rs(15),
  },

  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: rs(15),
  },

  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: rs(15),
  },

  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 2,
    borderRightWidth: 2,
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

    borderWidth: 1,
    borderColor: "#171717",
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

    borderWidth: 1,
    borderColor: "#252525",

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

    borderWidth: 1,
    borderColor: "#111",

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

    borderWidth: 1,
    borderColor: "#555",

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
    borderWidth: 1,
    borderColor: "rgba(0,255,200,0.18)",
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
    borderWidth: 1,
    borderColor: "#1d1d1d",
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
    borderWidth: 1,
    borderColor: "rgba(0,255,200,0.16)",
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
    borderRadius: 16,
    backgroundColor: "#0d0d0d",
    padding: 13,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#171717",
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
    maxWidth: 400,
    borderRadius: 20,
    padding: 22,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#252525",
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
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
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
    borderWidth: 1,
    borderColor: "rgba(0,230,176,0.3)",
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1a1a1a",
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
    borderWidth: 1,
    borderColor: "#252525",
  },

  cityChipActive: {
    backgroundColor: "rgba(0,230,176,0.15)",
    borderColor: "#00e6b0",
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
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
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
    borderWidth: 2,
    borderColor: "#00e6b0",
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
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e1e1e",
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
    borderWidth: 1,
    borderColor: "#252525",
  },

  sandboxInput: {
    height: 46,
    backgroundColor: "#161616",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#252525",
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
    borderWidth: 1,
    borderColor: "#2a2a2a",
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
    borderWidth: 1,
    borderColor: "#00e6b0",
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
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
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
    borderLeftWidth: 3,
    borderLeftColor: "#00e6b0",
  },

  jsonCard: {
    backgroundColor: "#121214",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e1e1e",
  },

  // ==========================================================
  // **@** MODERN SCREENSHOT-MATCHING SETTINGS STYLES
  // ==========================================================

  modernHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, // **@** Equal 20px edge spacing as requested
    paddingTop: Platform.OS === "android" ? 14 : 8,
    paddingBottom: 8,
    minHeight: 56,
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
    fontWeight: "600", // **@** Refined semi-bold weight for modern UI/UX visual balance
    letterSpacing: -0.3,
    marginLeft: 14, // **@** Clear breathing space between arrow and title
  },

  modernHeaderIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // **@** Header mask gradient pinned under header edge that reveals on scroll/slide
  modernHeaderGradientMask: {
    position: "absolute",
    top: Platform.OS === "android" ? 64 : 58,
    left: 0,
    right: 0,
    height: 28,
    zIndex: 10,
  },

  modernTripBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#FF5A5F",
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
    paddingBottom: 40,
  },

  modernProfileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
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
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },

  modernRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    minHeight: 64,
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
    paddingVertical: 14,
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
    borderWidth: 1,
    borderColor: "rgba(255, 149, 0, 0.45)",
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

  modernLogoutBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 44,
  },

  modernLogoutText: {
    color: "#FF5A5F",
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 8,
  },

  // **@** In-Settings Search Styles
  modernSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20, // **@** Exact 20px padding from screen edge
    paddingTop: Platform.OS === "android" ? 14 : 8,
    paddingBottom: 8,
    gap: 12,
  },

  modernSearchInputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
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

  modernSearchClearBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  modernSearchCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: "center",
  },

  modernSearchCancelText: {
    fontSize: 15,
    fontWeight: "600",
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
    paddingTop: 6,
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
    paddingVertical: 56,
    paddingHorizontal: 28,
  },

  modernEmptySearchIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  modernEmptySearchTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
  },

  modernEmptySearchSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  modernEmptyClearBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },

  modernEmptyClearBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
});