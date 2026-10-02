// **@** Accessibility Settings — Pixel-perfect UI matching design system with greyish-white icons, circular back button, dynamic theme adaptability (zero red), and real Firestore & AsyncStorage persistence
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Vibration,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

export type ColorBlindType =
  | "Off"
  | "Protanopia"
  | "Deuteranopia"
  | "Tritanopia"
  | "Monochromacy";

export interface ColorBlindOption {
  id: ColorBlindType;
  label: string;
  desc: string;
  badge: string;
  palettePreview: string[];
}

export const COLOR_BLIND_OPTIONS: ColorBlindOption[] = [
  {
    id: "Off",
    label: "Off",
    desc: "Standard full color spectrum (Trichromacy)",
    badge: "Default",
    palettePreview: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
  },
  {
    id: "Protanopia",
    label: "Protanopia",
    desc: "Red-weak correction filter (Enhances ambers & cyan-blues)",
    badge: "Red-Weak",
    palettePreview: ["#2563EB", "#F59E0B", "#06B6D4", "#6366F1"],
  },
  {
    id: "Deuteranopia",
    label: "Deuteranopia",
    desc: "Green-weak correction filter (Enhances blues & oranges)",
    badge: "Green-Weak",
    palettePreview: ["#1D4ED8", "#EA580C", "#0284C7", "#D97706"],
  },
  {
    id: "Tritanopia",
    label: "Tritanopia",
    desc: "Blue-weak correction filter (Enhances teals & deep reds)",
    badge: "Blue-Weak",
    palettePreview: ["#0D9488", "#DC2626", "#059669", "#E11D48"],
  },
  {
    id: "Monochromacy",
    label: "Monochromacy",
    desc: "Achromatopsia filter (High luminance monochrome grayscale)",
    badge: "Grayscale",
    palettePreview: ["#111827", "#4B5563", "#9CA3AF", "#F3F4F6"],
  },
];

export default function AccessibilitySettings() {
  const router = useRouter();
  const { t } = useLanguage();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States matching reference image defaults
  const [screenReaderCompat, setScreenReaderCompat] = useState<boolean>(false);
  const [highContrastMode, setHighContrastMode] = useState<boolean>(false);
  const [largeTouchTargets, setLargeTouchTargets] = useState<boolean>(true); // ON in screenshot
  const [colorBlindMode, setColorBlindMode] = useState<ColorBlindType>("Off");
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true); // ON in screenshot

  // Color Blind Modal state
  const [colorBlindModalVisible, setColorBlindModalVisible] = useState(false);

  // Interactive test button counter for preview
  const [testTapCount, setTestTapCount] = useState(0);

  // Floating save/action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

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

  // Dynamic colors derived from Settings page (zero red, greyish-white accents)
  // Adaptively shifts contrast if highContrastMode is active
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

    // Dynamic High Contrast adjustments
    const bg = highContrastMode
      ? isDark
        ? "#000000"
        : "#FFFFFF"
      : isDark
      ? "#0A0A0C"
      : "#F4F6F9";

    const card = highContrastMode
      ? isDark
        ? "#0D0D10"
        : "#FFFFFF"
      : isDark
      ? "#141418"
      : "#FFFFFF";

    const cardBorder = highContrastMode
      ? isDark
        ? "#FFFFFF"
        : "#111827"
      : isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "#EBECEF";

    const textPrimary = highContrastMode
      ? isDark
        ? "#FFFFFF"
        : "#000000"
      : isDark
      ? "#FFFFFF"
      : "#11141A";

    const textSecondary = highContrastMode
      ? isDark
        ? "#D1D5DB"
        : "#374151"
      : isDark
      ? "#8E95A2"
      : "#7E8590";

    return {
      bg,
      card,
      cardBorder,
      divider: highContrastMode
        ? isDark
          ? "rgba(255, 255, 255, 0.25)"
          : "rgba(0, 0, 0, 0.20)"
        : isDark
        ? "rgba(255, 255, 255, 0.05)"
        : "#F2F4F7",
      textPrimary,
      textSecondary,
      sectionHeader: highContrastMode
        ? isDark
          ? "#E5E7EB"
          : "#1F2937"
        : isDark
        ? "#8E95A2"
        : "#7E8590",
      greyishWhite,
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      switchActive: isDark ? "#34C759" : "#10B981", // Native vibrant green, never red
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      activeText,
      activeBorder,
      activeRowBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
      inputBg: isDark ? "rgba(255, 255, 255, 0.07)" : "#F2F4F7",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      previewBg: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
      previewBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#E5E7EB",
      chipBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#EEF2F6",
      btnPreviewBg: isDark ? "rgba(255, 255, 255, 0.12)" : "#E2E8F0",
    };
  }, [isDark, userAccent, highContrastMode]);

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
        const cached = await AsyncStorage.getItem("@bunkmates_accessibility_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.screenReaderCompat !== undefined) setScreenReaderCompat(parsed.screenReaderCompat);
          if (parsed.highContrastMode !== undefined) setHighContrastMode(parsed.highContrastMode);
          if (parsed.largeTouchTargets !== undefined) setLargeTouchTargets(parsed.largeTouchTargets);
          if (parsed.colorBlindMode) setColorBlindMode(parsed.colorBlindMode);
          if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
          if (parsed.hapticFeedback !== undefined) setHapticFeedback(parsed.hapticFeedback);
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
          const p = uData.accessibilityPreferences || {};
          if (p.screenReaderCompat !== undefined) setScreenReaderCompat(p.screenReaderCompat);
          if (p.highContrastMode !== undefined) setHighContrastMode(p.highContrastMode);
          if (p.largeTouchTargets !== undefined) setLargeTouchTargets(p.largeTouchTargets);
          if (p.colorBlindMode) setColorBlindMode(p.colorBlindMode);
          if (p.reduceMotion !== undefined) setReduceMotion(p.reduceMotion);
          if (p.hapticFeedback !== undefined) setHapticFeedback(p.hapticFeedback);
        }
      },
      (error) => {
        console.log("Firestore accessibility snapshot error:", error);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // Persistence handler
  const savePreferences = async (updated: Partial<{
    screenReaderCompat: boolean;
    highContrastMode: boolean;
    largeTouchTargets: boolean;
    colorBlindMode: ColorBlindType;
    reduceMotion: boolean;
    hapticFeedback: boolean;
  }>) => {
    const current = {
      screenReaderCompat,
      highContrastMode,
      largeTouchTargets,
      colorBlindMode,
      reduceMotion,
      hapticFeedback,
      ...updated,
    };

    try {
      await AsyncStorage.setItem("@bunkmates_accessibility_preferences", JSON.stringify(current));
    } catch (e) {
      console.log("AsyncStorage write error:", e);
    }

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          accessibilityPreferences: current,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log("Firestore write error:", e);
      }
    }
  };

  // Switch / option handlers with live feedback
  const handleToggleScreenReader = (val: boolean) => {
    setScreenReaderCompat(val);
    savePreferences({ screenReaderCompat: val });
    if (val) {
      AccessibilityInfo.announceForAccessibility("Screen Reader Compatibility activated.");
    }
    triggerToast(val ? "Screen Reader mode enabled" : "Screen Reader mode disabled");
    if (hapticFeedback) Vibration.vibrate(8);
  };

  const handleToggleHighContrast = (val: boolean) => {
    setHighContrastMode(val);
    savePreferences({ highContrastMode: val });
    triggerToast(val ? "High Contrast mode active" : "High Contrast mode turned off");
    if (hapticFeedback) Vibration.vibrate(8);
  };

  const handleToggleLargeTouchTargets = (val: boolean) => {
    setLargeTouchTargets(val);
    savePreferences({ largeTouchTargets: val });
    triggerToast(val ? "Large Touch Targets active (48px+ min target)" : "Standard touch targets active");
    if (hapticFeedback) Vibration.vibrate(8);
  };

  const handleSelectColorBlindMode = (opt: ColorBlindOption) => {
    setColorBlindMode(opt.id);
    savePreferences({ colorBlindMode: opt.id });
    setColorBlindModalVisible(false);
    triggerToast(opt.id === "Off" ? "Color blind filter disabled" : `${opt.label} filter applied`);
    if (hapticFeedback) Vibration.vibrate(10);
  };

  const handleToggleReduceMotion = (val: boolean) => {
    setReduceMotion(val);
    savePreferences({ reduceMotion: val });
    triggerToast(val ? "Reduce Motion enabled (Animations minimized)" : "Standard animations enabled");
    if (hapticFeedback) Vibration.vibrate(8);
  };

  const handleToggleHapticFeedback = (val: boolean) => {
    setHapticFeedback(val);
    savePreferences({ hapticFeedback: val });
    if (val) {
      Vibration.vibrate(25);
    }
    triggerToast(val ? "Haptic feedback enabled" : "Haptic feedback disabled");
  };

  // Handle interactive preview button tap
  const handlePreviewButtonTap = () => {
    setTestTapCount((c) => c + 1);
    if (hapticFeedback) Vibration.vibrate(15);
  };

  // Subtitle for Color Blind Mode row matching active selection
  const colorBlindSubtitle = useMemo(() => {
    switch (colorBlindMode) {
      case "Protanopia":
        return "Protanopia correction filters";
      case "Deuteranopia":
        return "Deuteranopia correction filters";
      case "Tritanopia":
        return "Tritanopia correction filters";
      case "Monochromacy":
        return "Grayscale monochrome filter";
      default:
        return "Protanopia correction filters";
    }
  }, [colorBlindMode]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Floating Save/Status Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            {
              backgroundColor: colors.toastBg,
              opacity: toastOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header with Circular Back Button */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={largeTouchTargets ? 12 : 6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.textPrimary, fontWeight: highContrastMode ? "900" : "700" },
          ]}
          numberOfLines={1}
        >
          Accessibility
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Live Accessibility Preview Card */}
        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: colors.previewBg,
              borderColor: colors.cardBorder,
              borderWidth: highContrastMode ? 2 : 1,
            },
          ]}
        >
          <View style={styles.previewTopRow}>
            <View style={styles.previewLabelRow}>
              <Ionicons name="sparkles" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                LIVE ACCESSIBILITY STATUS
              </Text>
            </View>
            <View
              style={[
                styles.previewChip,
                { backgroundColor: highContrastMode ? colors.switchActive : colors.chipBg },
              ]}
            >
              <Text
                style={[
                  styles.previewChipText,
                  { color: highContrastMode ? "#FFFFFF" : colors.textPrimary },
                ]}
              >
                {highContrastMode ? "HIGH CONTRAST" : "STANDARD"}
              </Text>
            </View>
          </View>

          {/* Interactive touch target & haptics test pill */}
          <View style={styles.testTargetWrap}>
            <Pressable
              onPress={handlePreviewButtonTap}
              style={({ pressed }) => [
                styles.testTargetBtn,
                {
                  backgroundColor: colors.btnPreviewBg,
                  borderColor: colors.cardBorder,
                  borderWidth: highContrastMode ? 2 : 1,
                  paddingVertical: largeTouchTargets ? 14 : 9,
                  paddingHorizontal: largeTouchTargets ? 20 : 14,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              hitSlop={largeTouchTargets ? 16 : 6}
              accessibilityRole="button"
              accessibilityLabel="Tap to test haptics and touch target size"
            >
              <Ionicons
                name="finger-print"
                size={largeTouchTargets ? 20 : 17}
                color={colors.textPrimary}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.testTargetText,
                  {
                    color: colors.textPrimary,
                    fontSize: largeTouchTargets ? 14 : 13,
                    fontWeight: highContrastMode ? "800" : "600",
                  },
                ]}
              >
                {largeTouchTargets ? "Touch Target: Large (56px)" : "Touch Target: Normal"} • Taps: {testTapCount}
              </Text>
            </Pressable>
          </View>

          {/* Palette Spectrum Preview for Active Color Blind Mode */}
          <View style={styles.spectrumRow}>
            <Text style={[styles.spectrumLabel, { color: colors.textSecondary }]}>
              Color Filter: {colorBlindMode}
            </Text>
            <View style={styles.swatchStrip}>
              {COLOR_BLIND_OPTIONS.find((o) => o.id === colorBlindMode)?.palettePreview.map(
                (c, i) => (
                  <View key={i} style={[styles.spectrumDot, { backgroundColor: c }]} />
                )
              )}
            </View>
          </View>
        </View>

        {/* ========================================================
            1. VISION SUPPORT SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>VISION SUPPORT</Text>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderWidth: highContrastMode ? 2 : 1,
            },
          ]}
        >
          {/* Screen Reader Compatibility */}
          <View
            style={[
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="volume-high-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  Screen Reader Compatibility
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Optimize navigation for VoiceOver & TalkBack
                </Text>
              </View>
              <Switch
                value={screenReaderCompat}
                onValueChange={handleToggleScreenReader}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle Screen Reader Compatibility"
              />
            </View>
          </View>

          {/* High Contrast Mode */}
          <View
            style={[
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="eye-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  High Contrast Mode
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Increase text and interface element contrast
                </Text>
              </View>
              <Switch
                value={highContrastMode}
                onValueChange={handleToggleHighContrast}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle High Contrast Mode"
              />
            </View>
          </View>

          {/* Large Touch Targets */}
          <View
            style={[
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="navigate-outline" size={19} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  Large Touch Targets
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Expand tappable interactive elements
                </Text>
              </View>
              <Switch
                value={largeTouchTargets}
                onValueChange={handleToggleLargeTouchTargets}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle Large Touch Targets"
              />
            </View>
          </View>

          {/* Color Blind Mode */}
          <Pressable
            onPress={() => setColorBlindModalVisible(true)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
              pressed && styles.rowPressed,
            ]}
            hitSlop={largeTouchTargets ? 8 : 4}
            accessibilityRole="button"
            accessibilityLabel={`Color Blind Mode currently ${colorBlindMode}`}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="eye-off-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  Color Blind Mode
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {colorBlindSubtitle}
                </Text>
              </View>
              <View style={styles.rightGroup}>
                <Text
                  style={[
                    styles.rightValueText,
                    { color: colors.textSecondary, fontWeight: highContrastMode ? "700" : "500" },
                  ]}
                >
                  {colorBlindMode}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            2. MOTION & FEEDBACK SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>MOTION & FEEDBACK</Text>
        <View
          style={[
            styles.cardGroup,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderWidth: highContrastMode ? 2 : 1,
            },
          ]}
        >
          {/* Reduce Motion */}
          <View
            style={[
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="flash-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  Reduce Motion
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Limit animations and decorative movements
                </Text>
              </View>
              <Switch
                value={reduceMotion}
                onValueChange={handleToggleReduceMotion}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle Reduce Motion"
              />
            </View>
          </View>

          {/* Haptic Feedback */}
          <View
            style={[
              styles.rowItem,
              { minHeight: largeTouchTargets ? 72 : 62 },
            ]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <View style={styles.labelGroup}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary, fontWeight: highContrastMode ? "800" : "600" },
                  ]}
                >
                  Haptic Feedback
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Vibrate device on key presses & confirmations
                </Text>
              </View>
              <Switch
                value={hapticFeedback}
                onValueChange={handleToggleHapticFeedback}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Toggle Haptic Feedback"
              />
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL: COLOR BLIND MODE PICKER
      ========================================================= */}
      <Modal
        visible={colorBlindModalVisible}
        transparent
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() => setColorBlindModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setColorBlindModalVisible(false)} />
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderTopWidth: highContrastMode ? 2 : 1,
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text
                style={[
                  styles.sheetTitle,
                  { color: colors.textPrimary, fontWeight: highContrastMode ? "900" : "700" },
                ]}
              >
                Color Blind Filter
              </Text>
              <Pressable
                onPress={() => setColorBlindModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {COLOR_BLIND_OPTIONS.map((opt) => {
                const isSelected = colorBlindMode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => handleSelectColorBlindMode(opt)}
                    style={({ pressed }) => [
                      styles.modalListItem,
                      isSelected && { backgroundColor: colors.activeRowBg },
                      highContrastMode && isSelected && { borderWidth: 1, borderColor: colors.cardBorder },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={styles.modalItemTextGroup}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          style={[
                            styles.modalItemTitle,
                            {
                              color: colors.textPrimary,
                              fontWeight: isSelected ? "700" : "500",
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <View style={[styles.badgePill, { backgroundColor: colors.chipBg }]}>
                          <Text style={[styles.badgePillText, { color: colors.textSecondary }]}>
                            {opt.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.modalItemSubtitle, { color: colors.textSecondary }]}>
                        {opt.desc}
                      </Text>
                      {/* Swatch strip preview for this filter */}
                      <View style={styles.modalSwatchStrip}>
                        {opt.palettePreview.map((hex, idx) => (
                          <View
                            key={idx}
                            style={[styles.modalSwatchDot, { backgroundColor: hex }]}
                          />
                        ))}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  previewCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 24,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  previewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  previewChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewChipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  testTargetWrap: {
    marginVertical: 4,
  },
  testTargetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  testTargetText: {
    letterSpacing: -0.1,
  },
  spectrumRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  spectrumLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  swatchStrip: {
    flexDirection: "row",
    gap: 6,
  },
  spectrumDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
    textTransform: "uppercase",
  },
  cardGroup: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  labelGroup: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
    lineHeight: 16,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightValueText: {
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  modalListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 3,
  },
  modalItemTextGroup: {
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 15,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  modalItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalSwatchStrip: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  modalSwatchDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  // Toast
  toastBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
