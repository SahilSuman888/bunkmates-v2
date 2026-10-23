// **@** Trip Preferences — Features Auto / Manual selection, dynamic subpage routing to Set Your Trip Preferences, Public/Private default trip style toggle, and AI Suggestions switch
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
  StatusBar,
  Appearance,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../lib/firebase";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { ACCENT_COLORS } from "../../theme/theme";

type PreferenceMode = "auto" | "manual";
type DefaultTripStyle = "public" | "private";

export default function TripPreferences() {
  const router = useRouter();
  const { updateTripPreferences } = useAppSettings();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States
  const [mode, setMode] = useState<PreferenceMode>("auto");
  const [defaultTripStyle, setDefaultTripStyle] = useState<DefaultTripStyle>("public");
  const [aiSuggestions, setAiSuggestions] = useState<boolean>(true);

  // Feedback banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  // Theme resolution
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
    }
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(() => {
    const isWhiteAccent = dynamicAccent?.toLowerCase() === "#ffffff" || dynamicAccent === "white";
    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = (isWhiteAccent && !isDark) ? "#111827" : dynamicAccent;
    const switchActive = dynamicAccent;
    const switchInactive = isDark ? "#2A2D36" : "#E5E7EB";

    return {
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardBorder: "transparent",
      divider: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      greyishWhite,
      accent: dynamicAccent,
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "#202024" : "#E8EAEE",
      segmentActiveBg: isDark ? "#2C2C32" : "#FFFFFF",
      segmentActiveText: activeText,
      switchActive,
      switchInactive,
      activeRowBg: isDark ? "#202024" : "#F4F5F7",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      activePillBg: isDark ? "#2C2C32" : "#FFFFFF",
    };
  }, [isDark, dynamicAccent, dynamicThemeColors]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Restore local cache & real-time Firestore sync
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_trip_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.mode) setMode(parsed.mode);
          if (parsed.defaultVisibility) setDefaultTripStyle(parsed.defaultVisibility);
          if (parsed.aiSuggestions !== undefined) setAiSuggestions(parsed.aiSuggestions);
        }
      } catch (e) {
        console.log("AsyncStorage read error:", e);
      }
    })();

    if (authLoading || !user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const p = uData.tripPreferences || {};

          if (p.mode) setMode(p.mode);
          if (p.defaultVisibility) setDefaultTripStyle(p.defaultVisibility);
          if (p.aiSuggestions !== undefined) setAiSuggestions(p.aiSuggestions);
        }
      },
      (err) => {
        console.log("Trip preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  const syncPreference = (field: string, value: any) => {
    updateTripPreferences({ [field]: value });
    AsyncStorage.getItem("@bunkmates_trip_preferences").then((current) => {
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      AsyncStorage.setItem("@bunkmates_trip_preferences", JSON.stringify(currentObj)).catch(() => {});
    }).catch(() => {});

    if (!user) return;
    updateDoc(doc(db, "users", user.uid), {
      [`tripPreferences.${field}`]: value,
      updatedAt: new Date(),
    }).catch((e) => {
      console.log(`Failed to update tripPreferences.${field}:`, e);
    });
  };

  const handleSelectMode = (newMode: PreferenceMode) => {
    Haptics.selectionAsync().catch(() => {});
    setMode(newMode);
    syncPreference("mode", newMode);
    triggerToast(
      newMode === "auto"
        ? "AI Auto Trip Preferences active"
        : "Manual Trip Preferences enabled"
    );
  };

  const handleSelectTripStyle = (style: DefaultTripStyle) => {
    Haptics.selectionAsync().catch(() => {});
    setDefaultTripStyle(style);
    syncPreference("defaultVisibility", style);
    triggerToast(
      style === "public"
        ? "Default trip style set to Public"
        : "Default trip style set to Private"
    );
  };

  const handleToggleAiSuggestions = (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setAiSuggestions(val);
    syncPreference("aiSuggestions", val);
    triggerToast(val ? "AI Suggestions enabled" : "AI Suggestions disabled");
  };

  const handleOpenCustomPreferences = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/settings/custom-trip-preference" as any);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t("Trip Preferences")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. PREFERENCE MODE: AUTO & MANUAL ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("PREFERENCE MODE")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Choose whether BunkMates dynamically adapts to your trip style or uses your custom settings:")}
          </Text>

          {/* 2-Way Segmented Control: Auto vs Manual */}
          <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
            <Pressable
              style={[
                styles.segmentItem,
                mode === "auto" && [
                  styles.segmentItemActive,
                  { backgroundColor: colors.segmentActiveBg },
                ],
              ]}
              onPress={() => handleSelectMode("auto")}
            >
              <View style={styles.segmentLabelRow}>
                <Ionicons
                  name="flash"
                  size={15}
                  color={mode === "auto" ? colors.segmentActiveText : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    mode === "auto"
                      ? [styles.segmentTextActive, { color: colors.segmentActiveText }]
                      : { color: colors.textSecondary },
                  ]}
                >
                  {t("Auto")}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.segmentItem,
                mode === "manual" && [
                  styles.segmentItemActive,
                  { backgroundColor: colors.segmentActiveBg },
                ],
              ]}
              onPress={() => handleSelectMode("manual")}
            >
              <View style={styles.segmentLabelRow}>
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={mode === "manual" ? colors.segmentActiveText : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.segmentText,
                    mode === "manual"
                      ? [styles.segmentTextActive, { color: colors.segmentActiveText }]
                      : { color: colors.textSecondary },
                  ]}
                >
                  {t("Manual")}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Dynamic mode explanation */}
          <Text style={[styles.modeNote, { color: colors.textSecondary }]}>
            {mode === "auto"
              ? t("⚡ Auto mode uses BunkMates AI to automatically learn your travel pace, budget, and ideal stays as you explore.")
              : t("⚙️ Manual mode lets you precisely configure your default duration, stay types, diet, and activities.")}
          </Text>
        </View>

        {/* ── CONDITIONAL MANUAL CONFIGURATION BUTTON ── */}
        {mode === "manual" && (
          <>
            <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
              {t("CUSTOM PREFERENCES")}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={handleOpenCustomPreferences}
                accessibilityRole="button"
                accessibilityLabel="Set your trip preferences"
              >
                <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                  <Ionicons name="construct-outline" size={20} color={colors.greyishWhite} />
                </View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {t("Set Your Trip Preferences")}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                    {t("Default trip settings, diet & lifestyles, activities & interests")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
              </Pressable>
            </View>
          </>
        )}

        {/* ── 2. DEFAULT TRIP STYLE: PUBLIC / PRIVATE TOGGLE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("DEFAULT TRIP STYLE")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons
                name={defaultTripStyle === "public" ? "globe-outline" : "lock-closed-outline"}
                size={20}
                color={colors.greyishWhite}
              />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Default Trip Style")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {defaultTripStyle === "public"
                  ? t("Public: Anyone can discover and request to join your trips")
                  : t("Private: Invitation-only; hidden from public discovery")}
              </Text>
            </View>

            {/* Segmented Toggle Buttons: Public / Private */}
            <View
              style={[
                styles.toggleContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <Pressable
                onPress={() => handleSelectTripStyle("public")}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  defaultTripStyle === "public" && [
                    styles.toggleBtnActive,
                    {
                      backgroundColor: colors.activePillBg,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDark ? 0.35 : 0.12,
                      shadowRadius: 2,
                      elevation: 2,
                    },
                  ],
                  pressed && { opacity: 0.8 },
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Set trip style to Public"
              >
                <Ionicons
                  name="globe-outline"
                  size={13}
                  color={
                    defaultTripStyle === "public"
                      ? colors.segmentActiveText
                      : colors.textSecondary
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color:
                        defaultTripStyle === "public"
                          ? colors.segmentActiveText
                          : colors.textSecondary,
                      fontWeight: defaultTripStyle === "public" ? "700" : "500",
                    },
                  ]}
                >
                  {t("Public")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelectTripStyle("private")}
                style={({ pressed }) => [
                  styles.toggleBtn,
                  defaultTripStyle === "private" && [
                    styles.toggleBtnActive,
                    {
                      backgroundColor: colors.activePillBg,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isDark ? 0.35 : 0.12,
                      shadowRadius: 2,
                      elevation: 2,
                    },
                  ],
                  pressed && { opacity: 0.8 },
                ]}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Set trip style to Private"
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={12}
                  color={
                    defaultTripStyle === "private"
                      ? colors.segmentActiveText
                      : colors.textSecondary
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color:
                        defaultTripStyle === "private"
                          ? colors.segmentActiveText
                          : colors.textSecondary,
                      fontWeight: defaultTripStyle === "private" ? "700" : "500",
                    },
                  ]}
                >
                  {t("Private")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── 3. AI SUGGESTIONS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("SMART RECOMMENDATIONS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="sparkles" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("AI Suggestions")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Receive smart recommendations for spots, routes, and bunkmates while planning trips")}
              </Text>
            </View>
            <Switch
              value={aiSuggestions}
              onValueChange={handleToggleAiSuggestions}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Save Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header matching Bunkmates Settings design
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },

  // Section Headings & Cards
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: 0,
    overflow: "hidden",
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  modeNote: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 12,
  },

  // Segmented Control
  segmentContainer: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  segmentItemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },

  // Rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowMid: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  // Toggle Buttons Container
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleBtnActive: {},
  toggleBtnText: {
    fontSize: 12,
  },

  // Toast
  toastBox: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  toastText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
});
