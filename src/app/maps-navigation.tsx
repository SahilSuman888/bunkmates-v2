// **@** Maps & Navigation — Pixel-perfect UI matching Settings design system with greyish-white accents, circular back button, dynamic theme adaptability (zero red), and real Firestore persistence
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
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
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

type MapProvider = "Apple Maps" | "Google Maps" | "Waze";
type StyleProfile = "Standard" | "Satellite" | "Terrain";
type DistanceUnit = "mi" | "km" | "nm";

interface DistanceOption {
  id: DistanceUnit;
  label: string;
  desc: string;
}

const DISTANCE_OPTIONS: DistanceOption[] = [
  { id: "mi", label: "Miles (mi)", desc: "Standard imperial distance units" },
  { id: "km", label: "Kilometers (km)", desc: "Metric system used across most global regions" },
  { id: "nm", label: "Nautical Miles (nm)", desc: "Specialized maritime and aerial navigation" },
];

export default function MapsNavigation() {
  const router = useRouter();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States matching reference image defaults
  const [mapProvider, setMapProvider] = useState<MapProvider>("Google Maps");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("mi");
  const [autoReroute, setAutoReroute] = useState<boolean>(true);
  const [avoidTolls, setAvoidTolls] = useState<boolean>(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfile>("Standard");
  const [showPOI, setShowPOI] = useState<boolean>(true);

  // Modals state
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);

  // Floating save/action toast state
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
  let dynamicThemeColors: any = null;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accent) userAccent = themeContext.accent;
      dynamicThemeColors = themeContext.themeColors;
    }
  } catch (e) {
    // fallback safe
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic solid colors
  const colors = useMemo(() => {
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

    return {
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"), // Solid dynamic surface
      cardBorder: "transparent",
      divider: "transparent",
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      greyishWhite: greyishWhite,
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "#202024" : "#E8EAEE",
      segmentActiveBg: isDark ? "#2C2C32" : "#FFFFFF",
      switchActive: isDark ? "#34C759" : "#10B981",
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      activeText: activeText,
      activeBorder: "transparent",
      insetBg: isDark ? "#202024" : "#F8FAFC",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, userAccent, dynamicThemeColors]);

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
        const cached = await AsyncStorage.getItem("@bunkmates_maps_navigation_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.mapProvider) setMapProvider(parsed.mapProvider);
          if (parsed.distanceUnit) setDistanceUnit(parsed.distanceUnit);
          if (parsed.autoReroute !== undefined) setAutoReroute(parsed.autoReroute);
          if (parsed.avoidTolls !== undefined) setAvoidTolls(parsed.avoidTolls);
          if (parsed.styleProfile) setStyleProfile(parsed.styleProfile);
          if (parsed.showPOI !== undefined) setShowPOI(parsed.showPOI);
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
          const p = uData.mapsPreferences || {};
          if (p.mapProvider) setMapProvider(p.mapProvider);
          if (p.distanceUnit) setDistanceUnit(p.distanceUnit);
          if (p.autoReroute !== undefined) setAutoReroute(p.autoReroute);
          if (p.avoidTolls !== undefined) setAvoidTolls(p.avoidTolls);
          if (p.styleProfile) setStyleProfile(p.styleProfile);
          if (p.showPOI !== undefined) setShowPOI(p.showPOI);
        }
      },
      (err) => {
        console.log("Maps preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync preference helper saving to both AsyncStorage and Firestore in background
  const syncPreference = (field: string, value: any) => {
    AsyncStorage.getItem("@bunkmates_maps_navigation_preferences").then((current) => {
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      AsyncStorage.setItem(
        "@bunkmates_maps_navigation_preferences",
        JSON.stringify(currentObj)
      ).catch(() => {});
    }).catch(() => {});

    if (!user) return;
    updateDoc(doc(db, "users", user.uid), {
      [`mapsPreferences.${field}`]: value,
      updatedAt: new Date(),
    }).catch((e) => {
      console.log(`Failed to update mapsPreferences.${field}:`, e);
    });
  };

  const handleSelectMapProvider = (provider: MapProvider) => {
    setMapProvider(provider);
    syncPreference("mapProvider", provider);
    triggerToast(`Default provider: ${provider}`);
  };

  const handleSelectDistanceUnit = (unit: DistanceUnit) => {
    setDistanceUnit(unit);
    syncPreference("distanceUnit", unit);
    setDistanceModalVisible(false);
    triggerToast(`Distance units: ${unit}`);
  };

  const handleToggleAutoReroute = (val: boolean) => {
    setAutoReroute(val);
    syncPreference("autoReroute", val);
    triggerToast(val ? "Auto-reroute enabled" : "Auto-reroute disabled");
  };

  const handleToggleAvoidTolls = (val: boolean) => {
    setAvoidTolls(val);
    syncPreference("avoidTolls", val);
    triggerToast(val ? "Avoid tolls active" : "Allow toll routes");
  };

  const handleSelectStyleProfile = (style: StyleProfile) => {
    setStyleProfile(style);
    syncPreference("styleProfile", style);
    triggerToast(`Map style set to ${style}`);
  };

  const handleToggleShowPOI = (val: boolean) => {
    setShowPOI(val);
    syncPreference("showPOI", val);
    triggerToast(val ? "Points of interest visible" : "Points of interest hidden");
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Circular button matching Settings page (modernHeaderBtn) ── */}
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
          {t("Maps & Navigation")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. NAVIGATION PREFERENCES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("NAVIGATION PROVIDER", "NAVIGATION PREFERENCES")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Default Map Provider */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>{t("Preferred Map App", "Default Map Provider")}</Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
              {(["Apple Maps", "Google Maps", "Waze"] as MapProvider[]).map((p) => {
                const isSelected = mapProvider === p;
                return (
                  <Pressable
                    key={p}
                    style={[
                      styles.segmentItem,
                      isSelected && [
                        styles.segmentItemActive,
                        { backgroundColor: colors.segmentActiveBg },
                      ],
                    ]}
                    onPress={() => handleSelectMapProvider(p)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Distance Units */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setDistanceModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("Distance Units")}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="arrow-forward-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Distance Units")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Choose display units for distances", "Choose display units for distances")}
              </Text>
            </View>
            <Text style={[styles.rowValueText, { color: colors.textSecondary }]}>{t(distanceUnit)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Auto-Reroute */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="sync-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Auto-Reroute")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Automatically find faster routes when traffic changes", "Reroute instantly if a faster path is found")}
              </Text>
            </View>
            <Switch
              value={autoReroute}
              onValueChange={handleToggleAutoReroute}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Auto-Reroute"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Avoid Tolls */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="git-branch-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Avoid Tolls")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Prefer free routes without toll booths", "Calculate routes to avoid toll roads")}
              </Text>
            </View>
            <Switch
              value={avoidTolls}
              onValueChange={handleToggleAvoidTolls}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Avoid Tolls"
            />
          </View>
        </View>

        {/* ── 2. MAP STYLE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("MAP DISPLAY & UNITS", "MAP STYLE")}</Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Style Profile */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>{t("Map Style", "Style Profile")}</Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
              {(["Standard", "Satellite", "Terrain"] as StyleProfile[]).map((s) => {
                const isSelected = styleProfile === s;
                return (
                  <Pressable
                    key={s}
                    style={[
                      styles.segmentItem,
                      isSelected && [
                        styles.segmentItemActive,
                        { backgroundColor: colors.segmentActiveBg },
                      ],
                    ]}
                    onPress={() => handleSelectStyleProfile(s)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {t(s)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Show Points of Interest */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="location-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Show Points of Interest")}</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t("Display cafes, fuel stations, and landmarks", "Display cafes, fuel stations, and landmarks")}
              </Text>
            </View>
            <Switch
              value={showPOI}
              onValueChange={handleToggleShowPOI}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Show Points of Interest"
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Floating Save Toast Indicator ── */}
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

      {/* ── Distance Units Selection Modal ── */}
      <Modal
        visible={distanceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDistanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="arrow-forward-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Distance Units")}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t("Select your preferred measurement units for route guidance and trail navigation.", "Select your preferred measurement units for route guidance and trail navigation.")}
            </Text>

            <View style={styles.modalListColumn}>
              {DISTANCE_OPTIONS.map((opt) => {
                const isSelected = distanceUnit === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected ? colors.insetBg : "transparent",
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectDistanceUnit(opt.id)}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={[
                          styles.modalOptionText,
                          {
                            color: isSelected ? colors.activeText : colors.textPrimary,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {t(opt.label)}
                      </Text>
                      <Text style={[styles.modalOptionSub, { color: colors.textSecondary }]}>
                        {t(opt.desc)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.greyishWhite} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setDistanceModalVisible(false)}
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

  // Section Heading matching Settings
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },

  // Card matching modernCardGroup in Settings (28px radius, zero border)
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 0,
  },

  // Segment Block inside Card
  segmentBlock: {
    padding: 16,
  },
  blockLabel: {
    fontSize: 14.5,
    fontWeight: "600",
    marginBottom: 12,
  },
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
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
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },

  // Rows inside cards
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
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
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  rowValueText: {
    fontSize: 13.5,
    fontWeight: "500",
    marginRight: 6,
  },
  divider: {
    height: 0,
    marginHorizontal: 16,
  },

  // Toast Container
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
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    borderWidth: 0,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 0,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 14,
  },
  modalOptionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    width: "100%",
    height: 44,
    borderRadius: 24,
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
