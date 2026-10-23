// **@** Custom Trip Preferences — Detailed custom trip preferences subpage (Travel Style, Duration, Group Size, Accommodations, Diet & Activities)
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

export default function CustomTripPreferences() {
  const router = useRouter();
  const { updateTripPreferences } = useAppSettings();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States
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
    const isWhiteAccent =
      dynamicAccent === "white" ||
      dynamicAccent === "navWhite" ||
      dynamicAccent === "#FFFFFF" ||
      dynamicAccent === "#ffffff" ||
      dynamicAccent?.toLowerCase() === "#ffffff";
    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = isWhiteAccent
      ? (isDark ? "#FFFFFF" : "#111827")
      : dynamicAccent;
    const activeChipBg = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)";

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
      chipSelectedBg: activeChipBg,
      chipSelectedText: activeText,
      chipUnselectedBg: isDark ? "#202024" : "#F3F4F6",
      chipUnselectedText: isDark ? "#94A3B8" : "#64748B",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, dynamicAccent, dynamicThemeColors]);

  // Auth listener
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

  const toggleAccommodation = (item: string) => {
    Haptics.selectionAsync().catch(() => {});
    const next = accommodations.includes(item)
      ? accommodations.filter((a) => a !== item)
      : [...accommodations, item];
    setAccommodations(next);
    syncPreference("accommodations", next);
    triggerToast(`Accommodations updated`);
  };

  const toggleDietary = (item: string) => {
    Haptics.selectionAsync().catch(() => {});
    let next: string[];
    if (item === "No Restrictions") {
      next = ["No Restrictions"];
    } else {
      const withoutNone = dietary.filter((d) => d !== "No Restrictions");
      if (withoutNone.includes(item)) {
        next = withoutNone.filter((d) => d !== item);
        if (next.length === 0) next = ["No Restrictions"];
      } else {
        next = [...withoutNone, item];
      }
    }
    setDietary(next);
    syncPreference("dietary", next);
    triggerToast(`Dietary preferences updated`);
  };

  const toggleActivity = (item: string) => {
    Haptics.selectionAsync().catch(() => {});
    const next = activities.includes(item)
      ? activities.filter((a) => a !== item)
      : [...activities, item];
    setActivities(next);
    syncPreference("activities", next);
    triggerToast(`Activities updated`);
  };

  const handleSelectStyle = (style: TravelStyle) => {
    Haptics.selectionAsync().catch(() => {});
    setTravelStyle(style);
    syncPreference("travelStyle", style);
    triggerToast(`Travel style set to ${style}`);
  };

  const handleSelectDuration = (duration: string) => {
    Haptics.selectionAsync().catch(() => {});
    setTripDuration(duration);
    syncPreference("tripDuration", duration);
    setActiveModal(null);
    triggerToast(`Duration set to ${duration}`);
  };

  const handleSelectGroupSize = (size: string) => {
    Haptics.selectionAsync().catch(() => {});
    setGroupSize(size);
    syncPreference("groupSize", size);
    setActiveModal(null);
    triggerToast(`Group size set to ${size}`);
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
          {t("Set Trip Preferences")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. PREFERRED TRAVEL STYLE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("PREFERRED TRAVEL STYLE")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("What is your typical budget and pace for exploring new spots?")}
          </Text>

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

        {/* ── 2. DEFAULT TRIP SETTINGS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("DEFAULT TRIP SETTINGS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Typical Duration")}</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t("Expected days per trip")}</Text>
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Ideal Group Size")}</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t("Preferred number of bunkmates")}</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{t(groupSize)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── Accommodations Card ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("PREFERRED ACCOMMODATIONS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Select your favorite types of stays (multi-select):")}
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

        {/* ── 3. DIET & LIFESTYLES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("DIET & LIFESTYLES")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Help group organizers cater meals and spots to your food preferences:")}
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

        {/* ── 4. ACTIVITIES & INTERESTS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("ACTIVITIES & INTERESTS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            {t("Choose what excites you most while traveling with bunkmates:")}
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

      {/* Duration Modal */}
      <Modal
        visible={activeModal === "duration"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Select Trip Duration")}</Text>
            {DURATION_OPTIONS.map((item, idx) => {
              const isSelected = tripDuration === item;
              return (
                <Pressable
                  key={item}
                  style={[
                    styles.modalItem,
                    idx < DURATION_OPTIONS.length - 1 && [styles.modalItemDivider, { borderBottomColor: colors.divider }],
                  ]}
                  onPress={() => handleSelectDuration(item)}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      { color: isSelected ? colors.segmentActiveText : colors.textPrimary },
                      isSelected && { fontWeight: "700" },
                    ]}
                  >
                    {t(item)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={colors.segmentActiveText} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Group Size Modal */}
      <Modal
        visible={activeModal === "groupSize"}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]} onPress={() => setActiveModal(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Select Group Size")}</Text>
            {GROUP_SIZE_OPTIONS.map((item, idx) => {
              const isSelected = groupSize === item;
              return (
                <Pressable
                  key={item}
                  style={[
                    styles.modalItem,
                    idx < GROUP_SIZE_OPTIONS.length - 1 && [styles.modalItemDivider, { borderBottomColor: colors.divider }],
                  ]}
                  onPress={() => handleSelectGroupSize(item)}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      { color: isSelected ? colors.segmentActiveText : colors.textPrimary },
                      isSelected && { fontWeight: "700" },
                    ]}
                  >
                    {t(item)}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={colors.segmentActiveText} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
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
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
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
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 13.5,
    marginRight: 6,
  },
  divider: {
    height: 1,
    marginLeft: 66,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalContent: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  modalItemDivider: {
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 15,
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
