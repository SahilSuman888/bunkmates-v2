import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsHeaderGradientMask } from "./_components/SettingsHeaderGradientMask";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { db } from "../../lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { SettingsActionModal } from "./_components/SettingsActionModal";

export default function DeveloperToolsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top > 0 ? insets.top : Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 44;
  const router = useRouter();
  const { t: tr } = useLanguage();

  let themeMode: "dark" | "light" | "system" = "system";
  try {
    const themeContext = useThemeToggle();
    if (themeContext && themeContext.mode) {
      themeMode = themeContext.mode;
    }
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(
    () => ({
      bg: isDark ? "#000000" : "#F1F1F1",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "#222228" : "#E5E7EB",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      accent: "#00e6b0",
      accentBg: "rgba(0, 230, 176, 0.12)",
      headerBtnBg: isDark ? "#1E1E24" : "#E5E7EB",
      divider: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
    }),
    [isDark]
  );

  const [activeDevTool, setActiveDevTool] = useState<string | null>(null);
  const [isDevActive, setIsDevActive] = useState<boolean | null>(null);
  const [enteredPasskey, setEnteredPasskey] = useState("");
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem("isDeveloper").then((val) => {
      if (isMounted) setIsDevActive(val === "true");
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleVerifyPasskey = async () => {
    if (!enteredPasskey.trim()) {
      setPasskeyError("Please enter the developer passkey.");
      return;
    }

    try {
      setVerifyingPasskey(true);
      setPasskeyError(null);
      const keyDoc = await getDoc(doc(db, "secret", "devkey"));
      const validKey = keyDoc.exists() ? keyDoc.data().key : null;

      if (enteredPasskey.trim() === validKey) {
        await AsyncStorage.setItem("isDeveloper", "true");
        setIsDevActive(true);
        setEnteredPasskey("");
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      } else {
        setPasskeyError("The developer key is incorrect.");
      }
    } catch (error) {
      console.error("Error verifying developer key:", error);
      setPasskeyError("Could not verify the developer key. Try again later.");
    } finally {
      setVerifyingPasskey(false);
    }
  };

  const handleDisableDevMode = () => {
    setShowDisableConfirm(true);
  };

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
      label: "For Fun... 😜",
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
    try {
      Haptics.selectionAsync();
    } catch (e) {}

    if (id === "budget-manager") {
      try {
        router.push("/settings/currency-expenses" as any);
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
        router.push("/settings/weather" as any);
        return;
      } catch {
        setActiveDevTool("weather-forecast");
        return;
      }
    }
    setActiveDevTool(id);
  };

  // If loading storage state
  if (isDevActive === null) {
    return (
      <SafeAreaView style={[styles.developerPage, { backgroundColor: colors.bg }]} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#00e6b0" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // If developer mode is locked / not active on this device
  if (!isDevActive) {
    return (
      <SafeAreaView style={[styles.developerPage, { backgroundColor: colors.bg }]} edges={["top"]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        <View style={styles.modernHeader}>
          <View style={styles.modernHeaderLeft}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/settings" as any);
              }}
              style={({ pressed }) => [
                styles.modernHeaderBtn,
                {
                  backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
              hitSlop={6}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
              Developer Access
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" }}>
          <View
            style={[
              styles.lockedCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.lockIconBox}>
              <Ionicons name="lock-closed" size={32} color="#00e6b0" />
            </View>

            <Text style={[styles.devModalTitle, { color: colors.textPrimary }]}>
              Enter Developer Passkey
            </Text>
            <Text style={[styles.devModalSubtitle, { color: colors.textSecondary }]}>
              This access is restricted to authorized BunkMates developers and QA engineers.
            </Text>

            <TextInput
              autoFocus
              value={enteredPasskey}
              onChangeText={setEnteredPasskey}
              placeholder="Developer Key"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleVerifyPasskey}
              style={[
                styles.devModalInput,
                {
                  backgroundColor: isDark ? "#090909" : "#F1F5F9",
                  color: colors.textPrimary,
                  borderColor: passkeyError ? "#EF4444" : colors.cardBorder,
                },
              ]}
            />

            {passkeyError ? (
              <Text style={{ color: "#EF4444", fontSize: 13, textAlign: "center", marginBottom: 12, fontWeight: "500" }}>
                {passkeyError}
              </Text>
            ) : null}

            <Pressable
              onPress={handleVerifyPasskey}
              disabled={verifyingPasskey}
              style={[styles.devVerifyButton, { width: "100%", height: 48, borderRadius: 14 }]}
            >
              {verifyingPasskey ? (
                <ActivityIndicator color="#00140f" size="small" />
              ) : (
                <Text style={styles.devVerifyText}>Unlock Developer Tools</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Active Sandbox Tool View
  if (activeDevTool) {
    return (
      <SafeAreaView style={[styles.developerPage, { backgroundColor: colors.bg }]} edges={["top"]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <DevToolSandboxView
          toolId={activeDevTool}
          onBack={() => setActiveDevTool(null)}
          isDark={isDark}
          colors={colors}
        />
      </SafeAreaView>
    );
  }

  // Developer Tools Main Menu
  return (
    <SafeAreaView style={[styles.developerPage, { backgroundColor: colors.bg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header with Circular Back Button & Turn Off Action */}
      <View style={styles.modernHeader}>
        <View style={styles.modernHeaderLeft}>
          <Pressable
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch (e) {}
              if (router.canGoBack()) router.back();
              else router.replace("/settings" as any);
            }}
            style={({ pressed }) => [
                styles.modernHeaderBtn,
                {
                  backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            accessibilityLabel="Go back"
            hitSlop={6}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.modernHeaderTitle, { color: colors.textPrimary }]}>
            Developer Tools
          </Text>
        </View>

        <Pressable
          onPress={handleDisableDevMode}
          style={({ pressed }) => [
            styles.headerTurnOffBtn,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <Text style={styles.headerTurnOffText}>Turn Off</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.developerScroll}
      >
        <View style={styles.developerBadge}>
          <Text style={styles.developerBadgeText}>🧑‍💻 Developer Mode Active</Text>
        </View>

        <Text style={[styles.developerIntro, { color: colors.textSecondary }]}>
          🧑‍💻 Welcome to Developer Mode — explore experimental sandboxes, internal tools,
          and feature prototypes for BunkMates.
        </Text>

        {/* Section 1: Testing Features */}
        <View style={[styles.developerFeatureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.developerSectionTitle}>Testing Features</Text>

          {developerFeatures.map((feature, idx) => (
            <React.Fragment key={feature.id}>
              <Pressable
                onPress={() => handleDeveloperFeature(feature.id, feature.route)}
                style={({ pressed }) => [
                  styles.developerFeatureItem,
                  pressed && styles.developerFeaturePressed,
                ]}
              >
                <View style={styles.developerFeatureText}>
                  <Text style={[styles.developerFeatureTitle, { color: colors.textPrimary }]}>
                    {feature.label}
                  </Text>
                  <Text style={[styles.developerFeatureDescription, { color: colors.textSecondary }]}>
                    {feature.description}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
              {idx < developerFeatures.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Section 2: Other Developer Routes */}
        <View style={[styles.developerFeatureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.developerSectionTitle}>Other Developer Routes</Text>

          {otherDeveloperRoutes.map((route, idx) => (
            <React.Fragment key={route.id}>
              <Pressable
                onPress={() => handleDeveloperFeature(route.id, route.route)}
                style={({ pressed }) => [
                  styles.developerFeatureItem,
                  pressed && styles.developerFeaturePressed,
                ]}
              >
                <View style={styles.developerFeatureText}>
                  <Text style={[styles.developerFeatureTitle, { color: colors.textPrimary }]}>
                    {route.label}
                  </Text>
                  <Text style={[styles.developerFeatureDescription, { color: colors.textSecondary }]}>
                    {route.description}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
              {idx < otherDeveloperRoutes.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Footer info */}
        <Text style={[styles.developerFooter, { color: colors.textSecondary }]}>
          Developer Utilities © {new Date().getFullYear()} BunkMates Labs
        </Text>
      </ScrollView>

      {/* Disable Developer Mode Confirmation Drawer */}
      <SettingsActionModal
        visible={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        iconType="warning"
        title="Disable Developer Mode"
        message="Are you sure you want to turn off Developer Mode? You can reactivate it anytime by tapping Version in About BunkMates or Settings."
        confirmLabel="Turn Off"
        cancelLabel="Cancel"
        confirmColor="#EF4444"
        showSuccessStep={false}
        onConfirm={async () => {
          await AsyncStorage.removeItem("isDeveloper");
          setIsDevActive(false);
          setShowDisableConfirm(false);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
          if (router.canGoBack()) router.back();
          else router.replace("/settings" as any);
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================
// DEVELOPER TOOL SANDBOX COMPONENT
// ============================================================

function DevToolSandboxView({
  toolId,
  onBack,
  isDark,
  colors,
}: {
  toolId: string;
  onBack: () => void;
  isDark: boolean;
  colors: any;
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

  // Dev Notes state with rich tag colors
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

  // Error simulation state
  const [simulatedError, setSimulatedError] = useState(false);

  // Toast banner state inside sandbox
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 2500);
  };

  const handleAddNote = () => {
    if (!newNoteTitle.trim()) {
      showToast("Please enter a note title.");
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
    showToast("Note added.");
  };

  const handleFetchCollection = async () => {
    try {
      setFetchingCol(true);
      const snap = await getDocs(collection(db, selectedCol));
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setQueryDocs(list.slice(0, 5));
      showToast(`Fetched ${list.length} docs from "${selectedCol}"`);
    } catch (e: any) {
      console.log("Firestore query error:", e);
      showToast(e.message || "Failed to query Firestore");
    } finally {
      setFetchingCol(false);
    }
  };

  const getToolTitle = () => {
    switch (toolId) {
      case "weather-forecast":
        return "Weather Forecast Hourly";
      case "social-feed":
        return "Social Feed Sandbox";
      case "otp-login":
        return "OTP Login Simulator";
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
      <View style={styles.developerHeader}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.developerBackButton,
            {
              backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.developerHeaderTitle, { color: colors.textPrimary }]}>
          {getToolTitle()}
        </Text>
      </View>

      {/* Active Toast Notification */}
      {activeToast ? (
        <View style={styles.devToastBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#00e6b0" />
          <Text style={styles.devToastText}>{activeToast}</Text>
        </View>
      ) : null}

      {/* 1. WEATHER FORECAST SANDBOX */}
      {toolId === "weather-forecast" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Select Simulation City</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {weatherCities.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedCity(c)}
                style={[styles.cityChip, selectedCity === c && styles.cityChipActive]}
              >
                <Text
                  style={[
                    styles.cityChipText,
                    selectedCity === c && styles.cityChipTextActive,
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.weatherMainHero, { backgroundColor: isDark ? "#121214" : "#F8FAFC" }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Current Weather in</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginTop: 2 }}>
              {selectedCity}
            </Text>
            <Text style={styles.weatherMainTemp}>28°C</Text>
            <Text style={styles.weatherMainCondition}>☀️ Clear Sky • AQI 42 (Good)</Text>
          </View>

          <Text style={[styles.sandboxSectionTitle, { marginTop: 16 }]}>Hourly Forecast Simulator</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {["12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"].map((hour, idx) => (
              <View key={hour} style={[styles.weatherHourCard, { backgroundColor: isDark ? "#141416" : "#F1F5F9" }]}>
                <Text style={styles.weatherHourTime}>{hour}</Text>
                <Text style={{ fontSize: 18, marginVertical: 4 }}>
                  {idx === 3 ? "⛅" : idx === 5 ? "🌅" : "☀️"}
                </Text>
                <Text style={[styles.weatherHourTemp, { color: colors.textPrimary }]}>{28 - (idx % 3)}°</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.weatherMetricsRow, { borderTopColor: colors.cardBorder }]}>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Humidity</Text>
              <Text style={[styles.weatherMetricVal, { color: colors.textPrimary }]}>64%</Text>
            </View>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Wind</Text>
              <Text style={[styles.weatherMetricVal, { color: colors.textPrimary }]}>14 km/h</Text>
            </View>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>UV Index</Text>
              <Text style={[styles.weatherMetricVal, { color: colors.textPrimary }]}>5 (Moderate)</Text>
            </View>
            <View style={styles.weatherMetricItem}>
              <Text style={styles.weatherMetricLabel}>Visibility</Text>
              <Text style={[styles.weatherMetricVal, { color: colors.textPrimary }]}>10 km</Text>
            </View>
          </View>
        </View>
      )}

      {/* 2. SOCIAL FEED SANDBOX */}
      {toolId === "social-feed" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>BunkMates Social Story Loop</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {["Sahil", "Aman", "Priya", "Rohan", "Sneha"].map((user) => (
              <View key={user} style={{ alignItems: "center", marginRight: 12 }}>
                <View style={styles.socialStoryRing}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                    {user[0]}
                  </Text>
                </View>
                <Text style={[styles.socialStoryName, { color: colors.textSecondary }]}>{user}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.socialPostCard, { backgroundColor: isDark ? "#121214" : "#F8FAFC", borderColor: colors.cardBorder }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={styles.socialAvatar}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>M</Text>
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                  Mohit Sharma
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Manali Valley • 2 hours ago</Text>
              </View>
              <Pressable
                onPress={() => showToast("Post bookmarked in dev sandbox.")}
                hitSlop={6}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              Sunset sessions with the bunkmates! 🏔️✨ Planning the next trek to Solang tomorrow. Who is joining?
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  setHasLiked(!hasLiked);
                  setLikes((l) => (hasLiked ? l - 1 : l + 1));
                  try {
                    Haptics.selectionAsync();
                  } catch (e) {}
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Ionicons
                  name={hasLiked ? "heart" : "heart-outline"}
                  size={20}
                  color={hasLiked ? "#ff4757" : colors.textPrimary}
                />
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                  {likes}
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                  {comments.length}
                </Text>
              </View>
            </View>

            {comments.map((c, i) => (
              <View key={i} style={[styles.commentItem, { backgroundColor: isDark ? "#1a1a1e" : "#EEF2F6" }]}>
                <Text style={{ color: "#00e6b0", fontWeight: "700", fontSize: 11 }}>BunkMate Traveler:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 11, marginTop: 2 }}>{c}</Text>
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.commentInput, { backgroundColor: isDark ? "#18181c" : "#EEF2F6", color: colors.textPrimary }]}
              />
              <Pressable
                onPress={() => {
                  if (commentInput.trim()) {
                    setComments((prev) => [...prev, commentInput.trim()]);
                    setCommentInput("");
                    showToast("Comment posted!");
                  }
                }}
                style={styles.commentSendBtn}
              >
                <Ionicons name="send" size={14} color="#00140f" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* 3. OTP LOGIN SIMULATOR */}
      {toolId === "otp-login" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Phone Authentication Simulation</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 14 }}>
            Enter a phone number to trigger the simulated 6-digit verification flow:
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <Pressable
              onPress={() => {
                const codes = ["+91 🇮🇳", "+1 🇺🇸", "+44 🇬🇧", "+61 🇦🇺"];
                const nextIdx = (codes.indexOf(countryCode) + 1) % codes.length;
                setCountryCode(codes[nextIdx]);
              }}
              style={[styles.countryCodePicker, { backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                {countryCode}
              </Text>
            </Pressable>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              placeholder="Mobile Number"
              placeholderTextColor={colors.textSecondary}
              style={[styles.sandboxInput, { flex: 1, backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />
          </View>

          <Pressable
            onPress={() => {
              setOtpSent(true);
              showToast("6-Digit OTP Sent to " + countryCode + " " + phoneInput);
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
            }}
            style={styles.sandboxPrimaryBtn}
          >
            <Text style={styles.sandboxPrimaryBtnText}>
              {otpSent ? "Resend 6-Digit OTP" : "Send Test OTP"}
            </Text>
          </Pressable>

          {otpSent && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: "#00e6b0", fontSize: 12, fontWeight: "700", marginBottom: 10, textAlign: "center" }}>
                Enter Verification Passcode
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {otpCode.map((digit, i) => (
                  <View key={i} style={[styles.otpDigitBox, { backgroundColor: isDark ? "#161616" : "#F1F5F9" }]}>
                    <Text style={{ color: "#00e6b0", fontSize: 18, fontWeight: "800" }}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  showToast("✅ Successfully authenticated via Phone OTP!");
                  try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (e) {}
                }}
                style={styles.sandboxPrimaryBtn}
              >
                <Text style={styles.sandboxPrimaryBtnText}>Verify OTP</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 4. USER MAPS & ANALYTICS */}
      {toolId === "user-maps" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Active Traveler Heatmap Analytics</Text>
          <View style={[styles.mapHeroBox, { backgroundColor: isDark ? "#121214" : "#F8FAFC" }]}>
            <Ionicons name="map-outline" size={36} color="#00e6b0" />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 8 }}>
              5,190 Active BunkMates
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
              Real-time location distribution nodes
            </Text>
          </View>

          <Text style={[styles.sandboxSectionTitle, { marginTop: 14 }]}>Regional Density Breakdown</Text>
          {[
            { region: "West & Goa Beaches 🏖️", active: "2,150 BunkMates", density: "HIGH DENSITY" },
            { region: "North India (Manali/Leh) 🏔️", active: "1,420 BunkMates", density: "HIGH DENSITY" },
            { region: "South & Western Ghats 🌲", active: "980 BunkMates", density: "MEDIUM DENSITY" },
            { region: "Southeast Asia Destinations 🌴", active: "640 BunkMates", density: "MODERATE" },
          ].map((item) => (
            <View key={item.region} style={[styles.regionRow, { borderBottomColor: colors.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                  {item.region}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                  {item.active}
                </Text>
              </View>
              <View style={styles.densityBadge}>
                <Text style={{ color: "#00e6b0", fontSize: 9, fontWeight: "800" }}>
                  {item.density}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 5. DEVELOPER NOTES MANAGER */}
      {toolId === "dev-notes" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Developer Quick Notes</Text>

          <TextInput
            value={newNoteTitle}
            onChangeText={setNewNoteTitle}
            placeholder="Note Title..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.sandboxInput, { backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder, color: colors.textPrimary }]}
          />
          <TextInput
            value={newNoteDesc}
            onChangeText={setNewNoteDesc}
            placeholder="Description / Implementation Details..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.sandboxInput, { marginTop: 8, height: 60, backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder, color: colors.textPrimary }]}
            multiline
          />
          <Pressable onPress={handleAddNote} style={[styles.sandboxPrimaryBtn, { marginTop: 10 }]}>
            <Text style={styles.sandboxPrimaryBtnText}>+ Add Note</Text>
          </Pressable>

          <View style={{ marginTop: 16 }}>
            {notes.map((n) => (
              <View key={n.id} style={[styles.noteCard, { backgroundColor: isDark ? "#141416" : "#F8FAFC", borderLeftColor: n.tagColor || "#00e6b0" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>{n.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }}>{n.desc}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setNotes((prev) => prev.filter((item) => item.id !== n.id));
                    showToast("Note deleted.");
                  }}
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
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
              <ActivityIndicator color="#00140f" size="small" />
            ) : (
              <Text style={styles.sandboxPrimaryBtnText}>Run Realtime Query</Text>
            )}
          </Pressable>

          <View style={{ marginTop: 16 }}>
            {queryDocs.map((docItem) => (
              <View key={docItem.id} style={[styles.jsonCard, { backgroundColor: isDark ? "#121214" : "#F8FAFC", borderColor: colors.cardBorder }]}>
                <Text style={{ color: "#00e6b0", fontWeight: "700", fontSize: 11, marginBottom: 4 }}>
                  ID: {docItem.id}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
                  {JSON.stringify(docItem, null, 2)}
                </Text>
              </View>
            ))}
            {queryDocs.length === 0 && !fetchingCol && (
              <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: "center", paddingVertical: 10 }}>
                Tap "Run Realtime Query" to fetch documents from Firestore.
              </Text>
            )}
          </View>
        </View>
      )}

      {/* 7. NOTIFICATIONS PREVIEW */}
      {toolId === "notifications-preview" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Notification Toast Previewer</Text>

          {[
            { label: "Trigger Trip Joined Alert", msg: "✈️ Aarav joined your Goa Trip!" },
            { label: "Trigger Payment Alert", msg: "💳 Expense payment received ₹1,200" },
            { label: "Trigger Group Chat Mention", msg: "💬 @Mohit mentioned you in Group Chat" },
            { label: "Trigger System Maintenance Notice", msg: "⚡ Scheduled maintenance at 02:00 AM" },
          ].map((t, i) => (
            <Pressable
              key={i}
              onPress={() => {
                showToast(t.msg);
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (e) {}
              }}
              style={[styles.sandboxSecondaryBtn, { marginBottom: 10 }]}
            >
              <Text style={styles.sandboxSecondaryBtnText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 8. UI SHOWCASE */}
      {toolId === "ui-showcase" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Design System Tokens & Components</Text>

          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 10 }}>Color Swatches:</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {["#22d3ee", "#3b83f6", "#a848ec", "#ff8d1a", "#00e6b0"].map((c) => (
              <View key={c} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c }} />
            ))}
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 10 }}>Pills & Badges:</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <View style={styles.densityBadge}><Text style={{ color: "#00e6b0", fontSize: 10, fontWeight: "700" }}>ACTIVE BETA</Text></View>
            <View style={[styles.densityBadge, { backgroundColor: "rgba(34,211,238,0.15)" }]}><Text style={{ color: "#22d3ee", fontSize: 10, fontWeight: "700" }}>VERIFIED</Text></View>
          </View>
        </View>
      )}

      {/* 9. ERROR BOUNDARY TEST */}
      {toolId === "error-test" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Runtime Error Boundary Simulator</Text>

          {simulatedError ? (
            <View style={{ padding: 14, backgroundColor: "rgba(255,71,87,0.12)", borderRadius: 12 }}>
              <Text style={{ color: "#ff4757", fontWeight: "800", fontSize: 14, marginBottom: 6 }}>
                Runtime Error Caught by Boundary
              </Text>
              <Text style={{ color: "#ccc", fontSize: 11, lineHeight: 16, marginBottom: 12 }}>
                TypeError: Cannot read properties of undefined (reading &apos;userState&apos;) at DevToolSandboxView.tsx:142
              </Text>
              <Pressable
                onPress={() => setSimulatedError(false)}
                style={[styles.sandboxPrimaryBtn, { backgroundColor: "#ff4757" }]}
              >
                <Text style={[styles.sandboxPrimaryBtnText, { color: "#fff" }]}>Reset & Recover State</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setSimulatedError(true)}
              style={[styles.sandboxSecondaryBtn, { backgroundColor: "rgba(255, 71, 87, 0.12)" }]}
            >
              <Text style={[styles.sandboxSecondaryBtnText, { color: "#ff4757" }]}>💥 Trigger Simulated Exception</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable onPress={onBack} style={[styles.sandboxSecondaryBtn, { marginTop: 14 }]}>
        <Text style={styles.sandboxSecondaryBtnText}>← Back to Developer Tools</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  developerPage: {
    flex: 1,
  },
  modernHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
  },
  modernHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modernHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerTurnOffBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  headerTurnOffText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
  developerScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  developerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  developerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  developerHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  developerBadge: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,230,176,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,230,176,0.25)",
    marginBottom: 14,
  },
  developerBadgeText: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "700",
  },
  developerIntro: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  developerFeatureCard: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
  },
  developerSectionTitle: {
    color: "#00e6b0",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  developerFeatureItem: {
    minHeight: 56,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
  },
  developerFeaturePressed: {
    backgroundColor: "rgba(0,230,176,0.06)",
  },
  developerFeatureText: {
    flex: 1,
    paddingRight: 10,
  },
  developerFeatureTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  developerFeatureDescription: {
    fontSize: 11,
    lineHeight: 15,
  },
  developerFooter: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },
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
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
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
    backgroundColor: "rgba(255,255,255,0.06)",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "transparent",
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
    borderRadius: 14,
    marginBottom: 16,
  },
  weatherMainTemp: {
    color: "#00e6b0",
    fontSize: 42,
    fontWeight: "800",
    marginVertical: 4,
  },
  weatherMainCondition: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  weatherHourCard: {
    alignItems: "center",
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
    fontSize: 12,
    fontWeight: "700",
  },
  weatherMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  weatherMetricItem: {
    alignItems: "center",
  },
  weatherMetricLabel: {
    color: "#777",
    fontSize: 10,
  },
  weatherMetricVal: {
    fontSize: 12,
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
    fontSize: 10,
    marginTop: 4,
  },
  socialPostCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  socialAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },
  commentItem: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  commentInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sandboxInput: {
    height: 46,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 1,
  },
  sandboxPrimaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sandboxPrimaryBtnText: {
    color: "#00140f",
    fontSize: 13,
    fontWeight: "700",
  },
  sandboxSecondaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sandboxSecondaryBtnText: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "600",
  },
  otpDigitBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#00e6b0",
  },
  mapHeroBox: {
    alignItems: "center",
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
  },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
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
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#00e6b0",
  },
  jsonCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  lockedCard: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },
  lockIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0,230,176,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  devModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  devModalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  devModalInput: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  devVerifyButton: {
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
  },
  devVerifyText: {
    color: "#00140f",
    fontSize: 14,
    fontWeight: "700",
  },
});
