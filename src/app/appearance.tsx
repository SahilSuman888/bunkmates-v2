// **@** Appearance Settings — Complete unified UI combining all image features (Theme Select, Accent Colors, Typography & Motion) and all General Settings features (Background Canvas & Atmosphere, Location Mode)
// Solid dynamic surfaces (zero glassmorphism in settings), dynamic theme colors, real-time typography scaling, accent propagation, and live canvas preview.
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
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
import {
  useThemeToggle,
  BackgroundMode,
  LocationMode,
  FontSize,
} from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { AtmospherePreviewBox } from "../components/ui/AppAtmosphereBackground";

const SWATCH_PALETTE = [
  { key: "coral", color: "#FF5A5F", label: "Sunset Coral" },
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
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Hook into ThemeContext (Theme, Accent, Background, Location, Typography, Motion)
  const {
    mode,
    setMode,
    accent,
    setAccent,
    accentColor,
    background,
    setBackground,
    locationMode,
    setLocationMode,
    fontSize,
    setFontSize,
    fontScale,
    scaleFont,
    reduceAnimations,
    setReduceAnimations,
    themeColors,
    isDark,
  } = useThemeToggle();

  // Toast feedback state (debounced with native driver, zero animation queue backlog)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = (msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastOpacity.setValue(1);
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 1200);
  };

  // Solid dynamic colors derived from ThemeContext (ZERO GLASS, SOLID SURFACES)
  const colors = useMemo(() => {
    return {
      bg: themeColors.background, // #000000 (Dark) / #F1F1F1 (Light)
      card: themeColors.card, // #161618 (Dark) / #FFFFFF (Light) — pure solid!
      cardInner: isDark ? "#202024" : "#F4F5F7",
      textPrimary: themeColors.text,
      textSecondary: themeColors.textSecondary,
      sectionHeader: themeColors.textSecondary,
      iconBoxBg: isDark ? "#222226" : "#E8EAEE",
      segmentBg: isDark ? "#202024" : "#E8EAEE",
      segmentActiveBg: isDark ? "#2C2C32" : "#FFFFFF",
      switchActive: accentColor,
      switchInactive: isDark ? "#2A2D36" : "#E2E8F0",
      activeText: accentColor,
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [themeColors, isDark, accentColor]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSelectTheme = (newMode: "light" | "dark" | "system") => {
    setMode(newMode);
  };

  const handleSelectAccent = (key: string) => {
    setAccent(key);
  };

  const handleSelectFontSize = (size: FontSize) => {
    setFontSize(size);
  };

  const handleToggleReduceAnimations = (val: boolean) => {
    setReduceAnimations(val);
  };

  const handleSelectBgMode = (modeVal: BackgroundMode) => {
    setBackground({ ...background, mode: modeVal });
  };

  const handlePickBgColor = (cat: "neutral" | "cool" | "warm" | "vibrant", colorHex: string) => {
    setBackground({ mode: background.mode, color: colorHex, category: cat });
  };

  const handleSelectLocationMode = (loc: LocationMode) => {
    setLocationMode(loc);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Circular button matching Settings page ── */}
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
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}
          numberOfLines={1}
        >
          {t("Appearance")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. THEME SELECT (Solid dynamic surfaces) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
          {t("THEME SELECT")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          <View style={styles.themeSelectRow}>
            {/* Light Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: mode === "light"
                    ? (isDark ? "#2C2C32" : "#FFFFFF")
                    : colors.cardInner,
                  borderWidth: 0,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => handleSelectTheme("light")}
            >
              {/* Mini Preview Mockup */}
              <View style={[styles.themePreviewBox, { backgroundColor: "#FFFFFF" }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: "#E2E8F0" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: "#CBD5E1" }]} />
              </View>
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color: mode === "light" ? colors.activeText : colors.textSecondary,
                    fontSize: scaleFont(13),
                  },
                ]}
              >
                {t("Light")}
              </Text>
            </Pressable>

            {/* Dark Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: mode === "dark"
                    ? (isDark ? "#2C2C32" : "#FFFFFF")
                    : colors.cardInner,
                  borderWidth: 0,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => handleSelectTheme("dark")}
            >
              {/* Mini Preview Mockup */}
              <View style={[styles.themePreviewBox, { backgroundColor: "#121216" }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: "#2A2D36" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: "#3F424E" }]} />
              </View>
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color: mode === "dark" ? colors.activeText : colors.textSecondary,
                    fontSize: scaleFont(13),
                  },
                ]}
              >
                {t("Dark")}
              </Text>
            </Pressable>

            {/* System Option */}
            <Pressable
              style={({ pressed }) => [
                styles.themeOptionCard,
                {
                  backgroundColor: mode === "system"
                    ? (isDark ? "#2C2C32" : "#FFFFFF")
                    : colors.cardInner,
                  borderWidth: 0,
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
                  },
                ]}
              >
                <View style={[styles.themePreviewBar, { backgroundColor: isDark ? "#2A2D36" : "#E2E8F0" }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: isDark ? "#3F424E" : "#CBD5E1" }]} />
              </View>
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color: mode === "system" ? colors.activeText : colors.textSecondary,
                    fontSize: scaleFont(13),
                  },
                ]}
              >
                {t("System")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── 2. ACCENT COLOR (9 Vibrant Hues with Live Action Preview) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
          {t("ACCENT COLOR")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 18 }]}>
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
                    isSelected && [
                      styles.swatchSelectedRing,
                      { borderColor: isDark ? "#FFFFFF" : "#000000" },
                    ],
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelectAccent(s.key)}
                  accessibilityLabel={s.label}
                >
                  {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Live Accent Preview Box */}
          <View style={[styles.accentPreviewBox, { backgroundColor: colors.cardInner }]}>
            <View style={[styles.accentPill, { backgroundColor: accentColor }]}>
              <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              <Text style={[styles.accentPillText, { fontSize: scaleFont(12) }]}>
                {SWATCH_PALETTE.find((s) => s.key === accent)?.label || "Active Accent"}
              </Text>
            </View>
            <Text style={[styles.accentPreviewLabel, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
              Applies to CTAs, active tabs, switches & badges app-wide
            </Text>
          </View>
        </View>

        {/* ── 3. TYPOGRAPHY & MOTION (With Live Typography Resizing Preview) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
          {t("TYPOGRAPHY & MOTION")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Font Size Segment */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary, fontSize: scaleFont(14.5) }]}>
              {t("Font Size")}
            </Text>
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
                        { fontSize: scaleFont(13) },
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {t(f)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* LIVE TYPOGRAPHY PREVIEW CARD */}
            <View style={[styles.liveTypeBox, { backgroundColor: colors.cardInner }]}>
              <View style={styles.liveTypeHeader}>
                <View style={[styles.typeBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.typeBadgeText}>Aa</Text>
                </View>
                <Text style={[styles.liveTypeScaleText, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                  Scale: {Math.round(fontScale * 100)}% ({fontSize})
                </Text>
              </View>
              <Text
                style={[
                  styles.liveTypeHeadline,
                  { color: colors.textPrimary, fontSize: scaleFont(16) },
                ]}
              >
                The quick brown fox jumps over the lazy dog
              </Text>
              <Text
                style={[
                  styles.liveTypeBody,
                  { color: colors.textSecondary, fontSize: scaleFont(12.5) },
                ]}
              >
                BunkMates itineraries, budgets, and messages scale in real-time.
              </Text>
            </View>
          </View>

          {/* Reduce Animations */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="pulse-outline" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                {t("Reduce Animations")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                {reduceAnimations ? "Instant non-animated transitions" : "Fluid transitional animations enabled"}
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

        {/* ── 4. BACKGROUND CANVAS & ATMOSPHERE (With Live Mini Canvas Preview) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
          {t("BACKGROUND CANVAS & ATMOSPHERE")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          {/* Live Canvas Atmosphere Preview Box */}
          <View style={styles.atmospherePreviewContainer}>
            <AtmospherePreviewBox
              mode={background.mode}
              color={background.color}
              isDark={isDark}
              style={styles.atmospherePreviewBox}
            />
            <View style={styles.atmospherePreviewMeta}>
              <View style={[styles.atmosphereStatusPill, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
                <Ionicons name="color-palette-outline" size={13} color="#FFFFFF" />
                <Text style={[styles.atmospherePillText, { fontSize: scaleFont(11.5) }]}>
                  {background.mode.toUpperCase()} CANVAS
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.blockLabel, { color: colors.textPrimary, fontSize: scaleFont(14.5), marginTop: 14 }]}>
            Canvas Style
          </Text>
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
                      { fontSize: scaleFont(13) },
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

          <Text style={[styles.blockLabel, { color: colors.textPrimary, fontSize: scaleFont(14.5), marginBottom: 10 }]}>
            Atmosphere Palette Hue
          </Text>
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
                      isSelected && [
                        styles.bgSwatchSelectedRing,
                        { borderColor: isDark ? "#FFFFFF" : "#000000" },
                      ],
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

        {/* ── 5. LOCATION PRIVACY MODE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
          {t("LOCATION PRIVACY MODE")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, marginBottom: 40 }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                {t("Location Mode")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                {t("Auto-detect or manual travel region")}
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
                        { fontSize: scaleFont(12) },
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
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },

  // Section Heading matching Settings
  sectionHeading: {
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },

  // Card matching modernCardGroup in Settings (28px radius, zero border, solid surface)
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: 0,
    overflow: "hidden",
  },

  // Theme Select Row
  themeSelectRow: {
    flexDirection: "row",
    gap: 12,
  },
  themeOptionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  themePreviewBox: {
    width: "82%",
    height: 38,
    borderRadius: 10,
    borderWidth: 0,
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
  },
  swatchSelectedRing: {
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
  },
  accentPreviewBox: {
    marginTop: 14,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  accentPillText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  accentPreviewLabel: {
    flex: 1,
    lineHeight: 16,
  },

  // Live Typography Preview
  segmentBlock: {
    padding: 16,
  },
  blockLabel: {
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
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },
  liveTypeBox: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
  },
  liveTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
  },
  liveTypeScaleText: {
    fontWeight: "600",
  },
  liveTypeHeadline: {
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  liveTypeBody: {
    lineHeight: 17,
  },

  // Atmosphere Preview
  atmospherePreviewContainer: {
    height: 100,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 6,
    position: "relative",
  },
  atmospherePreviewBox: {
    width: "100%",
    height: "100%",
  },
  atmospherePreviewMeta: {
    position: "absolute",
    bottom: 8,
    left: 8,
  },
  atmosphereStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  atmospherePillText: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // Background Atmosphere Swatches
  bgSwatchesRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  bgSwatchCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  bgSwatchSelectedRing: {
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
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
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    marginTop: 2,
    lineHeight: 17,
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
  miniSegmentText: {},

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
