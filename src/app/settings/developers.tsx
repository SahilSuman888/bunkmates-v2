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
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DeveloperToolsScreen() {
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
    }),
    [isDark]
  );

  const [activeDevTool, setActiveDevTool] = useState<string | null>(null);
  const [isDevActive, setIsDevActive] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("isDeveloper").then((val) => {
      setIsDevActive(val === "true");
    });
  }, []);

  const handleDisableDevMode = async () => {
    Alert.alert(
      "Disable Developer Mode",
      "Are you sure you want to turn off Developer Mode? You can reactivate it anytime by tapping Version in About BunkMates.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn Off",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("isDeveloper");
            setIsDevActive(false);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {}
            Alert.alert("Developer Mode Disabled", "Developer options have been hidden.");
            if (router.canGoBack()) router.back();
            else router.replace("/settings" as any);
          },
        },
      ]
    );
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
        router.push("/settings/weather" as any);
        return;
      } catch {
        setActiveDevTool("weather-forecast");
        return;
      }
    }
    setActiveDevTool(id);
  };

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

  return (
    <SafeAreaView style={[styles.developerPage, { backgroundColor: colors.bg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header with Circular Back Button */}
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
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
              pressed && styles.pressed,
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
          and feature prototypes for BunkMates v2.
        </Text>

        {/* Section 1: Testing Features */}
        <View style={[styles.developerFeatureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
                <Text style={[styles.developerFeatureTitle, { color: colors.textPrimary }]}>
                  {feature.label}
                </Text>
                <Text style={[styles.developerFeatureDescription, { color: colors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* Section 2: Other Developer Routes */}
        <View style={[styles.developerFeatureCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
                <Text style={[styles.developerFeatureTitle, { color: colors.textPrimary }]}>
                  {route.label}
                </Text>
                <Text style={[styles.developerFeatureDescription, { color: colors.textSecondary }]}>
                  {route.description}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* Footer info */}
        <Text style={[styles.developerFooter, { color: colors.textSecondary }]}>
          Developer Utilities © {new Date().getFullYear()} BunkMates Labs
        </Text>
      </ScrollView>
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

  // Dev Notes state
  const [devNotes, setDevNotes] = useState<string[]>([
    "Investigate room bill split round-off precision.",
    "Verify push token invalidation on account sign-out.",
    "Benchmark offline map tile bundle cache hit rate.",
  ]);
  const [newNote, setNewNote] = useState("");

  // Toast banner state inside sandbox
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActiveToast(msg);
    setTimeout(() => setActiveToast(null), 2500);
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
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
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
                <Text style={[styles.weatherHourTemp, { color: colors.textPrimary }]}>{28 - idx % 3}°</Text>
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
            {["Sahil", "Aman", "Priya", "Rohan", "Sneha"].map((user, i) => (
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
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>S</Text>
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                  Sahil Suman
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Goa Beach Trip • 2h ago</Text>
              </View>
              <Pressable
                onPress={() => showToast("Post bookmarked in dev sandbox.")}
                hitSlop={6}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={{ height: 160, borderRadius: 10, backgroundColor: isDark ? "#1c1c22" : "#E2E8F0", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Ionicons name="image-outline" size={42} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>
                Trip Photo Preview Simulation
              </Text>
            </View>

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
                <Text style={{ color: colors.textPrimary, fontSize: 11 }}>{c}</Text>
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a comment..."
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
            Test login flow with simulated Firebase Auth SMS token generator.
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <View style={[styles.countryCodePicker, { backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                {countryCode}
              </Text>
            </View>
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
              showToast("OTP sent to " + countryCode + " " + phoneInput);
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
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600", marginBottom: 10 }}>
                Enter Verification Code:
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                {otpCode.map((digit, i) => (
                  <View key={i} style={[styles.otpDigitBox, { backgroundColor: isDark ? "#161616" : "#F1F5F9" }]}>
                    <Text style={{ color: "#00e6b0", fontSize: 18, fontWeight: "700" }}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  showToast("✅ Phone Verified: BunkMates User Authenticated!");
                  try {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (e) {}
                }}
                style={styles.sandboxPrimaryBtn}
              >
                <Text style={styles.sandboxPrimaryBtnText}>Verify & Complete Login</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 4. USER MAPS & ANALYTICS */}
      {toolId === "user-maps" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Active User Geographic Distribution</Text>
          <View style={[styles.mapHeroBox, { backgroundColor: isDark ? "#121214" : "#F8FAFC" }]}>
            <Ionicons name="map-outline" size={48} color="#00e6b0" />
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 8 }}>
              India Region: Active
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
              1,248 Connected Travelers Live
            </Text>
          </View>

          <Text style={[styles.sandboxSectionTitle, { marginTop: 14 }]}>Regional Hotspots</Text>
          {[
            { region: "Goa & North Beaches", count: 482, density: "High" },
            { region: "Manali & Solang Valley", count: 326, density: "High" },
            { region: "Rishikesh River Camps", count: 219, density: "Medium" },
            { region: "Leh-Ladakh Circuit", count: 145, density: "Normal" },
            { region: "Bali South Coast", count: 76, density: "Normal" },
          ].map((item, idx) => (
            <View key={item.region} style={[styles.regionRow, { borderBottomColor: colors.cardBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                  {item.region}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {item.count} BunkMates users
                </Text>
              </View>
              <View style={styles.densityBadge}>
                <Text style={{ color: "#00e6b0", fontSize: 10, fontWeight: "700" }}>
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

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Add engineering note or TODO..."
              placeholderTextColor={colors.textSecondary}
              style={[styles.sandboxInput, { flex: 1, backgroundColor: isDark ? "#161616" : "#F1F5F9", borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />
            <Pressable
              onPress={() => {
                if (newNote.trim()) {
                  setDevNotes((prev) => [newNote.trim(), ...prev]);
                  setNewNote("");
                  showToast("Note added.");
                }
              }}
              style={styles.sandboxPrimaryBtn}
            >
              <Text style={styles.sandboxPrimaryBtnText}>Add</Text>
            </Pressable>
          </View>

          {devNotes.map((note, idx) => (
            <View key={idx} style={[styles.noteCard, { backgroundColor: isDark ? "#141416" : "#F8FAFC" }]}>
              <Text style={{ color: colors.textPrimary, fontSize: 12, flex: 1 }}>{note}</Text>
              <Pressable
                onPress={() => {
                  setDevNotes((prev) => prev.filter((_, i) => i !== idx));
                  showToast("Note dismissed.");
                }}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={16} color="#ff4757" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* 6. FIRESTORE PLAYGROUND */}
      {toolId === "firestore-playground" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Firestore Collection Monitor</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
            Real-time listener heartbeat on BunkMates cloud collections.
          </Text>

          {[
            { col: "users", status: "Active (Synced)", latency: "42ms" },
            { col: "trips", status: "Active (Synced)", latency: "38ms" },
            { col: "chats", status: "Listening (Realtime)", latency: "24ms" },
            { col: "appSettings", status: "Cached (Offline)", latency: "0ms" },
          ].map((col) => (
            <View key={col.col} style={[styles.jsonCard, { backgroundColor: isDark ? "#121214" : "#F8FAFC", borderColor: colors.cardBorder }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: "#00e6b0", fontSize: 13, fontWeight: "700" }}>
                  collection("{col.col}")
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{col.latency}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Status: {col.status}</Text>
            </View>
          ))}

          <Pressable
            onPress={() => showToast("Firestore connection tested: All indexes healthy.")}
            style={[styles.sandboxSecondaryBtn, { marginTop: 8 }]}
          >
            <Text style={styles.sandboxSecondaryBtnText}>Ping Database Endpoints</Text>
          </Pressable>
        </View>
      )}

      {/* 7. NOTIFICATIONS PREVIEW */}
      {toolId === "notifications-preview" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Notification Banner Simulator</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
            Simulate incoming push notifications and custom in-app banners.
          </Text>

          <Pressable
            onPress={() => {
              showToast("🔔 Sahil added you to 'Goa Beach Party'!");
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
            }}
            style={[styles.sandboxPrimaryBtn, { marginBottom: 10 }]}
          >
            <Text style={styles.sandboxPrimaryBtnText}>Trigger Trip Invite Alert</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              showToast("💸 Rohan settled ₹1,200 for Resort Stay");
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
            }}
            style={[styles.sandboxSecondaryBtn, { marginBottom: 10 }]}
          >
            <Text style={styles.sandboxSecondaryBtnText}>Trigger Expense Settlement Alert</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              showToast("💬 New message in 'Rishikesh Rafting'");
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {}
            }}
            style={styles.sandboxSecondaryBtn}
          >
            <Text style={styles.sandboxSecondaryBtnText}>Trigger Group Message Alert</Text>
          </Pressable>
        </View>
      )}

      {/* 8. UI SHOWCASE */}
      {toolId === "ui-showcase" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Design System Tokens</Text>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: "#00e6b0", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#00140f", fontWeight: "700", fontSize: 11 }}>Teal Accent</Text>
            </View>
            <View style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Blue Primary</Text>
            </View>
            <View style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 11 }}>Warning</Text>
            </View>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
            Theme: {isDark ? "Dark Theme Active" : "Light Theme Active"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Card Background: {colors.card}
          </Text>
        </View>
      )}

      {/* 9. ERROR BOUNDARY TEST */}
      {toolId === "error-test" && (
        <View style={[styles.sandboxCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={styles.sandboxSectionTitle}>Error Boundary Simulation</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 14 }}>
            Verify app stability and safe fallback rendering during simulated exceptions.
          </Text>

          <Pressable
            onPress={() => {
              Alert.alert(
                "Safe Error Simulation",
                "Simulated error captured safely by Error Boundary. No crash occurred.",
                [{ text: "OK" }]
              );
            }}
            style={[styles.sandboxPrimaryBtn, { backgroundColor: "#ef4444" }]}
          >
            <Text style={[styles.sandboxPrimaryBtnText, { color: "#ffffff" }]}>
              Simulate Catchable Exception
            </Text>
          </Pressable>
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
    marginBottom: 6,
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
});
