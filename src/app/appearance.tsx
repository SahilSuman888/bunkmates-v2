// **@** Appearance Settings — Complete unified UI combining all image features (Theme Select, Accent Colors, Typography & Motion) and all General Settings features (Background Canvas & Atmosphere, Location Mode), with zero red, greyish-white accents, circular back button, and dynamic theme adaptability
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
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle, BackgroundMode, LocationMode } from "../contexts/ThemeContext";
import { ACCENT_COLORS } from "../theme/theme";

type FontSize = "Small" | "Medium" | "Large";

const SWATCH_PALETTE = [
  { key: "coral", color: "#FF5A5F", label: "Coral" },
  { key: "orange", color: "#f9971f", label: "Sunset Orange" },
  { key: "green", color: "#43a047", label: "Emerald Green" },
  { key: "blue", color: "#1976d2", label: "Ocean Blue" },
  { key: "purple", color: "#7c3aed", label: "Royal Purple" },
  { key: "turquoise", color: "#00bcd6", label: "Turquoise" },
  { key: "skyblue", color: "#009de6", label: "Sky Blue" },
  { key: "yellow", color: "#fbc02d", label: "Warm Gold" },
  { key: "aqua", color: "#00897b", label: "Deep Aqua" },
];

const BACKGROUND_SWATCHES = {
  neutral: ["#0c0c0c", "#1c1c1e", "#2c2c2e", "#3a3a3c"],
  cool: ["#001f3f", "#003566", "#00557f", "#0077b6"],
  warm: ["#482314", "#6d3b20", "#8c4b2f", "#a55c3f"],
  vibrant: ["#d500f9", "#aa00ff", "#6200ea", "#304ffe"],
};

export default function AppearanceScreen() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Hook into ThemeContext (Theme, Accent, Background, Location)
  const {
    mode,
    setMode,
    accent,
    setAccent,
    background,
    setBackground,
    locationMode,
    setLocationMode,
  } = useThemeToggle();

  // Typography & Motion states
  const [fontSize, setFontSize] = useState<FontSize>("Medium");
  const [reduceAnimations, setReduceAnimations] = useState<boolean>(false);

  // Toast feedback state
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

  const isDark =
    mode === "dark" ||
    (mode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Settings page (zero red, greyish-white accents)
  const colors = useMemo(() => {
    const hasCustomNonRedAccent =
      accent &&
      accent !== "default" &&
      accent !== "coral" &&
      accent !== "red" &&
      (ACCENT_COLORS as any)[accent];

    const customAccent = hasCustomNonRedAccent
      ? (ACCENT_COLORS as any)[accent]
      : null;

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = customAccent || (isDark ? "#FFFFFF" : "#11141A");
    const activeBorder = customAccent || (isDark ? "#E2E8F0" : "#11141A");

    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      greyishWhite: greyishWhite,
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F4F7",
      segmentActiveBg: isDark ? "#24242A" : "#FFFFFF",
      switchActive: isDark ? "#34C759" : "#10B981",
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      activeText: activeText,
      activeBorder: activeBorder,
      themeCardBorderActive: activeBorder,
      themeCardBorderInactive: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
      insetBg: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, accent]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Restore local cache & real-time Firestore sync for typography & motion
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_appearance_typography");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.fontSize) setFontSize(parsed.fontSize);
          if (parsed.reduceAnimations !== undefined) setReduceAnimations(parsed.reduceAnimations);
        }
      } catch (e) {
        console.log("AsyncStorage appearance read error:", e);
      }
    })();

    if (authLoading || !user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const appPrefs = uData.appearancePreferences || {};
          if (appPrefs.fontSize) setFontSize(appPrefs.fontSize);
          if (appPrefs.reduceAnimations !== undefined) setReduceAnimations(appPrefs.reduceAnimations);
        }
      },
      (err) => {
        console.log("Appearance preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync preference helper
  const syncTypography = async (field: string, value: any) => {
    try {
      const current = await AsyncStorage.getItem("@bunkmates_appearance_typography");
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      await AsyncStorage.setItem(
        "@bunkmates_appearance_typography",
        JSON.stringify(currentObj)
      );
    } catch (e) {
      console.log("Failed to cache typography preferences:", e);
    }

    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`appearancePreferences.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update appearancePreferences.${field}:`, e);
    }
  };

  const handleSelectTheme = (newMode: "light" | "dark" | "system") => {
    setMode(newMode);
    triggerToast(`Theme set to ${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`);
  };

  const handleSelectAccent = (key: string) => {
    setAccent(key);
    triggerToast(`Accent updated`);
  };

  const handleSelectFontSize = (size: FontSize) => {
    setFontSize(size);
    syncTypography("fontSize", size);
    triggerToast(`Font size: ${size}`);
  };

  const handleToggleReduceAnimations = (val: boolean) => {
    setReduceAnimations(val);
    syncTypography("reduceAnimations", val);
    triggerToast(val ? "Transitional animations reduced" : "Smooth animations active");
  };

  const handleSelectBgMode = (modeVal: BackgroundMode) => {
    setBackground({ ...background, mode: modeVal });
    triggerToast(`Background canvas: ${modeVal}`);
  };

  const handlePickBgColor = (cat: "neutral" | "cool" | "warm" | "vibrant", colorHex: string) => {
    setBackground({ mode: background.mode, color: colorHex, category: cat });
    triggerToast(`Atmosphere hue updated`);
  };

  const handleSelectLocationMode = (loc: LocationMode) => {
    setLocationMode(loc);
    triggerToast(`Location mode: ${loc}`);
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
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Appearance
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. THEME SELECT (From Screenshot) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>THEME SELECT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <View style={styles.themeSelectRow}>
            {/* Light Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: "#F8FAFC",
                  borderColor: mode === "light" ? colors.themeCardBorderActive : colors.themeCardBorderInactive,
                  borderWidth: mode === "light" ? 2 : 1,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => handleSelectTheme("light")}
            >
              {/* Mini Preview Mockup */}
              <View style={[styles.themePreviewBox, { backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: "#E2E8F0" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: "#CBD5E1" }]} />
              </View>
              <Text style={[styles.themeOptionText, { color: mode === "light" ? colors.activeText : "#64748B" }]}>
                Light
              </Text>
            </Pressable>

            {/* Dark Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: "#16161C",
                  borderColor: mode === "dark" ? colors.themeCardBorderActive : colors.themeCardBorderInactive,
                  borderWidth: mode === "dark" ? 2 : 1,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => handleSelectTheme("dark")}
            >
              {/* Mini Preview Mockup */}
              <View style={[styles.themePreviewBox, { backgroundColor: "#121216", borderColor: "rgba(255,255,255,0.08)" }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: "#2A2D36" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: "#3F424E" }]} />
              </View>
              <Text style={[styles.themeOptionText, { color: mode === "dark" ? colors.activeText : "#94A3B8" }]}>
                Dark
              </Text>
            </Pressable>

            {/* System Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: isDark ? "#16161C" : "#F8FAFC",
                  borderColor: mode === "system" ? colors.themeCardBorderActive : colors.themeCardBorderInactive,
                  borderWidth: mode === "system" ? 2 : 1,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => handleSelectTheme("system")}
            >
              {/* Mini Preview Mockup */}
              <View
                style={[
                  styles.themePreviewBox,
                  {
                    backgroundColor: isDark ? "#121216" : "#FFFFFF",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
                  },
                ]}
              >
                <View style={[styles.themePreviewBar, { backgroundColor: isDark ? "#2A2D36" : "#E2E8F0" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: isDark ? "#3F424E" : "#CBD5E1" }]} />
              </View>
              <Text
                style={[
                  styles.themeOptionText,
                  { color: mode === "system" ? colors.activeText : colors.textSecondary },
                ]}
              >
                System
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── 2. ACCENT COLOR (From Screenshot) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>ACCENT COLOR</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 18 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchRow}
          >
            {SWATCH_PALETTE.map((s) => {
              const isSelected = accent === s.key;
              return (
                <Pressable
                  key={s.key}
                  style={({ pressed }) => [
                    styles.swatchCircle,
                    { backgroundColor: s.color },
                    isSelected && styles.swatchSelectedRing,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelectAccent(s.key)}
                  accessibilityLabel={s.label}
                >
                  {isSelected && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 3. TYPOGRAPHY & MOTION (From Screenshot) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>TYPOGRAPHY & MOTION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Font Size */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>Font Size</Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
              {(["Small", "Medium", "Large"] as FontSize[]).map((f) => {
                const isSelected = fontSize === f;
                return (
                  <Pressable
                    key={f}
                    style={[
                      styles.segmentItem,
                      isSelected && [
                        styles.segmentItemActive,
                        { backgroundColor: colors.segmentActiveBg },
                      ],
                    ]}
                    onPress={() => handleSelectFontSize(f)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Reduce Animations */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="pulse-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Reduce Animations</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Minimize transitional screen movements
              </Text>
            </View>
            <Switch
              value={reduceAnimations}
              onValueChange={handleToggleReduceAnimations}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Reduce Animations"
            />
          </View>
        </View>

        {/* ── 4. BACKGROUND & ATMOSPHERE (Integrated from General Settings) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>BACKGROUND & ATMOSPHERE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>Canvas Style</Text>
          <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg, marginBottom: 16 }]}>
            {(["solid", "gradient", "mesh"] as BackgroundMode[]).map((bm) => {
              const isSelected = background.mode === bm;
              return (
                <Pressable
                  key={bm}
                  style={[
                    styles.segmentItem,
                    isSelected && [
                      styles.segmentItemActive,
                      { backgroundColor: colors.segmentActiveBg },
                    ],
                  ]}
                  onPress={() => handleSelectBgMode(bm)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      isSelected
                        ? [styles.segmentTextActive, { color: colors.activeText }]
                        : { color: colors.textSecondary },
                    ]}
                  >
                    {bm.charAt(0).toUpperCase() + bm.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.blockLabel, { color: colors.textPrimary, marginBottom: 10 }]}>Palette Hue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgSwatchesRow}>
            {Object.entries(BACKGROUND_SWATCHES).flatMap(([cat, arr]) =>
              arr.map((cHex) => {
                const isSelected = background.color === cHex;
                return (
                  <Pressable
                    key={cHex}
                    style={({ pressed }) => [
                      styles.bgSwatchCircle,
                      { backgroundColor: cHex },
                      isSelected && styles.bgSwatchSelectedRing,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handlePickBgColor(cat as any, cHex)}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* ── 5. LOCATION TRACKING (Integrated from General Settings) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>LOCATION TRACKING</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Location Mode</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Auto-detect or manual travel region
              </Text>
            </View>
            <View style={[styles.miniSegment, { backgroundColor: colors.segmentBg }]}>
              {(["auto", "manual"] as LocationMode[]).map((l) => {
                const isSelected = locationMode === l;
                return (
                  <Pressable
                    key={l}
                    style={[
                      styles.miniSegmentItem,
                      isSelected && [styles.miniSegmentItemActive, { backgroundColor: colors.segmentActiveBg }],
                    ]}
                    onPress={() => handleSelectLocationMode(l)}
                  >
                    <Text
                      style={[
                        styles.miniSegmentText,
                        isSelected ? { color: colors.activeText, fontWeight: "700" } : { color: colors.textSecondary },
                      ]}
                    >
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

  // Theme Select Row
  themeSelectRow: {
    flexDirection: "row",
    gap: 12,
  },
  themeOptionCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  themePreviewBox: {
    width: "82%",
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    padding: 6,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  themePreviewBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
  },
  themePreviewLine: {
    width: "60%",
    height: 4,
    borderRadius: 2,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Accent Swatches
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  swatchCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  swatchSelectedRing: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.1 }],
  },

  // Background Atmosphere Swatches
  bgSwatchesRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  bgSwatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  bgSwatchSelectedRing: {
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },

  // Typography Segment
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

  // Row inside card
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Mini segment for Location
  miniSegment: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
  },
  miniSegmentItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  miniSegmentItemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  miniSegmentText: {
    fontSize: 12.5,
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
});
