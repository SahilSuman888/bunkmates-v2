// **@** Trip Preferences — Pixel-perfect UI matching Settings design system with greyish-white accents, circular back button, dynamic theme adaptability (zero red), and real Firestore persistence
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  StatusBar,
  Appearance,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

type TravelStyle = "Budget" | "Mid-Range" | "Luxury";

const DURATION_OPTIONS = [
  "1 - 3 Days",
  "4 - 7 Days",
  "1 - 2 Weeks",
  "2 - 4 Weeks",
  "1+ Month",
];

const GROUP_SIZE_OPTIONS = [
  "Solo (1 Traveler)",
  "Duo (2 Travelers)",
  "3 - 6 Bunkmates",
  "7 - 12 Bunkmates",
  "12+ Bunkmates",
];

const ACCOMMODATION_OPTIONS = [
  "Hostel",
  "Hotel",
  "Airbnb",
  "Camping",
  "Boutique Hotel",
  "Guesthouse",
];

const DIETARY_OPTIONS = [
  "No Restrictions",
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Halal",
  "Kosher",
];

const ACTIVITY_OPTIONS = [
  "Museums",
  "Hiking & Nature",
  "Nightlife",
  "Street Food",
  "Historical Landmarks",
  "Live Music",
];

export default function TripPreferences() {
  const router = useRouter();
  const { updateTripPreferences } = useAppSettings();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States matching reference defaults
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("Budget");
  const [accommodations, setAccommodations] = useState<string[]>([
    "Hostel",
    "Airbnb",
    "Boutique Hotel",
  ]);
  const [tripDuration, setTripDuration] = useState<string>("4 - 7 Days");
  const [groupSize, setGroupSize] = useState<string>("3 - 6 Bunkmates");
  const [dietary, setDietary] = useState<string[]>(["No Restrictions"]);
  const [activities, setActivities] = useState<string[]>([
    "Museums",
    "Hiking & Nature",
    "Nightlife",
    "Street Food",
  ]);

  // Modal pickers state
  const [activeModal, setActiveModal] = useState<"duration" | "groupSize" | null>(null);

  // Feedback banner state for showing real saving confirmation
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

  // Dynamic Theme matching Settings page & ThemeContext
  let themeMode: "dark" | "light" | "system" = "system";
  let userAccent = "default";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accent) userAccent = themeContext.accent;
    }
  } catch (e) {
    // fallback safe
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from the old settings page (zero red, greyish-white accents)
  const colors = useMemo(() => {
    // If user explicitly chose a custom accent from General Settings that is not red/coral, respect it
    const hasCustomNonRedAccent =
      userAccent &&
      userAccent !== "default" &&
      userAccent !== "coral" &&
      userAccent !== "red" &&
      (ACCENT_COLORS as any)[userAccent];

    const customAccent = hasCustomNonRedAccent
      ? (ACCENT_COLORS as any)[userAccent]
      : null;

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = customAccent || (isDark ? "#FFFFFF" : "#11141A");
    const activeBorder = customAccent || (isDark ? "#E2E8F0" : "#11141A");
    const activeChipBg = customAccent
      ? (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)")
      : (isDark ? "rgba(226, 232, 240, 0.14)" : "rgba(17, 20, 26, 0.08)");

    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      // Greyish-white icon color matching Settings page
      greyishWhite: greyishWhite,
      // Subtle neutral circular icon box matching Settings page modernIconBox
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F4F7",
      segmentActiveBg: isDark ? "#24242A" : "#FFFFFF",
      segmentActiveText: activeText,
      // Selected Chip Colors (greyish-white / dark contrast, zero red)
      chipSelectedBg: activeChipBg,
      chipSelectedBorder: activeBorder,
      chipSelectedText: activeText,
      // Unselected Chip Colors
      chipUnselectedBg: isDark ? "rgba(255, 255, 255, 0.03)" : "#FFFFFF",
      chipUnselectedBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "#EBECEF",
      chipUnselectedText: isDark ? "#94A3B8" : "#64748B",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, userAccent]);

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
          if (parsed.travelStyle) setTravelStyle(parsed.travelStyle);
          if (Array.isArray(parsed.accommodations)) setAccommodations(parsed.accommodations);
          if (parsed.tripDuration) setTripDuration(parsed.tripDuration);
          if (parsed.groupSize) setGroupSize(parsed.groupSize);
          if (Array.isArray(parsed.dietary)) setDietary(parsed.dietary);
          if (Array.isArray(parsed.activities)) setActivities(parsed.activities);
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

          if (p.travelStyle) setTravelStyle(p.travelStyle);
          if (Array.isArray(p.accommodations)) setAccommodations(p.accommodations);
          if (p.tripDuration) setTripDuration(p.tripDuration);
          if (p.groupSize) setGroupSize(p.groupSize);
          if (Array.isArray(p.dietary)) setDietary(p.dietary);
          if (Array.isArray(p.activities)) setActivities(p.activities);
        }
      },
      (err) => {
        console.log("Trip preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync preference helper saving to both AsyncStorage and Firestore
  const syncPreference = async (field: string, value: any) => {
    updateTripPreferences({ [field]: value });
    // 1. Cache locally in AsyncStorage
    try {
      const current = await AsyncStorage.getItem("@bunkmates_trip_preferences");
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      await AsyncStorage.setItem("@bunkmates_trip_preferences", JSON.stringify(currentObj));
    } catch (e) {
      console.log("Failed to cache preference in AsyncStorage:", e);
    }

    // 2. Sync to Firestore in real-time
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`tripPreferences.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update tripPreferences.${field}:`, e);
    }
  };

  // Toggle multi-select chips: Accommodations
  const toggleAccommodation = (item: string) => {
    const next = accommodations.includes(item)
      ? accommodations.filter((a) => a !== item)
      : [...accommodations, item];
    setAccommodations(next);
    syncPreference("accommodations", next);
    triggerToast(`Accommodations updated`);
  };

  // Toggle multi-select chips: Dietary Preferences
  const toggleDietary = (item: string) => {
    let next: string[];
    if (item === "No Restrictions") {
      next = ["No Restrictions"];
    } else {
      const filtered = dietary.filter((d) => d !== "No Restrictions");
      next = filtered.includes(item)
        ? filtered.filter((d) => d !== item)
        : [...filtered, item];
      if (next.length === 0) next = ["No Restrictions"];
    }
    setDietary(next);
    syncPreference("dietary", next);
    triggerToast(`Dietary preferences updated`);
  };

  // Toggle multi-select chips: Activity Interests
  const toggleActivity = (item: string) => {
    const next = activities.includes(item)
      ? activities.filter((a) => a !== item)
      : [...activities, item];
    setActivities(next);
    syncPreference("activities", next);
    triggerToast(`Interests updated`);
  };

  const handleSelectStyle = (style: TravelStyle) => {
    setTravelStyle(style);
    syncPreference("travelStyle", style);
    triggerToast(`Travel style set to ${style}`);
  };

  const handleSelectDuration = (duration: string) => {
    setTripDuration(duration);
    syncPreference("tripDuration", duration);
    setActiveModal(null);
    triggerToast(`Duration set to ${duration}`);
  };

  const handleSelectGroupSize = (size: string) => {
    setGroupSize(size);
    syncPreference("groupSize", size);
    setActiveModal(null);
    triggerToast(`Group size set to ${size}`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Exact circular button matching Settings page (modernHeaderBtn) ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
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
        {/* ── 1. PREFERRED TRAVEL STYLE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("TRAVEL STYLE", "PREFERRED TRAVEL STYLE")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("What's your typical budget and pace for exploring new spots?", "What's your typical budget and pace for exploring new spots?")}
          </Text>

          {/* 3-Way Segmented Control */}
          <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
            {(["Budget", "Mid-Range", "Luxury"] as TravelStyle[]).map((style) => {
              const isSelected = travelStyle === style;
              return (
                <Pressable
                  key={style}
                  style={[
                    styles.segmentItem,
                    isSelected && [
                      styles.segmentItemActive,
                      { backgroundColor: colors.segmentActiveBg },
                    ],
                  ]}
                  onPress={() => handleSelectStyle(style)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      isSelected
                        ? [styles.segmentTextActive, { color: colors.segmentActiveText }]
                        : { color: colors.textSecondary },
                    ]}
                  >
                    {t(style)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 2. PREFERRED ACCOMMODATIONS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("Accommodation Preference", "PREFERRED ACCOMMODATIONS")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Select your favorite types of stays (multi-select):", "Select your favorite types of stays (multi-select):")}
          </Text>

          <View style={styles.chipRow}>
            {ACCOMMODATION_OPTIONS.map((item) => {
              const isSelected = accommodations.includes(item);
              return (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.chipPill,
                    {
                      backgroundColor: isSelected ? colors.chipSelectedBg : colors.chipUnselectedBg,
                      borderColor: isSelected ? colors.chipSelectedBorder : colors.chipUnselectedBorder,
                    },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toggleAccommodation(item)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected ? colors.chipSelectedText : colors.chipUnselectedText,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {t(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 3. DEFAULT TRIP SETTINGS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("DEFAULT TRIP SETTINGS", "DEFAULT TRIP SETTINGS")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Default Trip Duration */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setActiveModal("duration")}
            accessibilityRole="button"
            accessibilityLabel="Default Trip Duration"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="time-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Typical Duration", "Default Trip Duration")}</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{t(tripDuration)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Ideal Group Size */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setActiveModal("groupSize")}
            accessibilityRole="button"
            accessibilityLabel="Ideal Group Size"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="people-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Preferred Group Size", "Ideal Group Size")}</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{t(groupSize)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── 4. DIETARY PREFERENCES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("DIET & LIFESTYLE", "DIETARY PREFERENCES")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            We'll filter group diners and recipe guides based on these:
          </Text>

          <View style={styles.chipRow}>
            {DIETARY_OPTIONS.map((item) => {
              const isSelected = dietary.includes(item);
              return (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.chipPill,
                    {
                      backgroundColor: isSelected ? colors.chipSelectedBg : colors.chipUnselectedBg,
                      borderColor: isSelected ? colors.chipSelectedBorder : colors.chipUnselectedBorder,
                    },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toggleDietary(item)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected ? colors.chipSelectedText : colors.chipUnselectedText,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {t(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 5. ACTIVITY INTERESTS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("ACTIVITY INTERESTS")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Help us match you with perfect sightseeing plans:", "Help us match you with perfect sightseeing plans:")}
          </Text>

          <View style={styles.chipRow}>
            {ACTIVITY_OPTIONS.map((item) => {
              const isSelected = activities.includes(item);
              return (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.chipPill,
                    {
                      backgroundColor: isSelected ? colors.chipSelectedBg : colors.chipUnselectedBg,
                      borderColor: isSelected ? colors.chipSelectedBorder : colors.chipUnselectedBorder,
                    },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toggleActivity(item)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected ? colors.chipSelectedText : colors.chipUnselectedText,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {t(item)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Floating Real-time Save Toast Indicator ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ── Interactive Selection Modal (Duration & Group Size) ── */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons
                name={activeModal === "duration" ? "time-outline" : "people-outline"}
                size={22}
                color={colors.greyishWhite}
              />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {activeModal === "duration" ? t("Default Trip Duration") : t("Ideal Group Size")}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {activeModal === "duration"
                ? t("Choose your standard preferred duration when creating or searching trips.", "Choose your standard preferred duration when creating or searching trips.")
                : t("Choose the target group size that best suits your travel style.", "Choose the target group size that best suits your travel style.")}
            </Text>

            <View style={styles.modalListColumn}>
              {(activeModal === "duration" ? DURATION_OPTIONS : GROUP_SIZE_OPTIONS).map((opt) => {
                const isSelected = activeModal === "duration" ? tripDuration === opt : groupSize === opt;
                return (
                  <Pressable
                    key={opt}
                    style={({ pressed }) => [
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected ? colors.chipSelectedBg : colors.segmentBg,
                        borderColor: isSelected ? colors.chipSelectedBorder : colors.cardBorder,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      activeModal === "duration" ? handleSelectDuration(opt) : handleSelectGroupSize(opt)
                    }
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        {
                          color: isSelected ? colors.chipSelectedText : colors.textPrimary,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {t(opt)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.chipSelectedBorder} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.segmentBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setActiveModal(null)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>{t("Close")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header matching Settings & ProfileEdit
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },

  // Section Heading matching Settings
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },

  // Card matching modernCardGroup in Settings
  card: {
    marginHorizontal: 20,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },

  // Description text
  descText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 14,
  },

  // 3-Option Segmented Control
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  segmentItemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },

  // Chips layout
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.2,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: {
    fontSize: 13.5,
  },

  // Rows inside cards
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowValue: {
    fontSize: 13.5,
    fontWeight: "500",
    marginRight: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Toast container
  toastContainer: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  modalListColumn: {
    width: "100%",
    gap: 8,
    marginBottom: 18,
  },
  modalOptionItem: {
    width: "100%",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 14,
  },
  modalCloseBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
