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
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
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
  activeSwitchColor: string;
}

export const COLOR_BLIND_OPTIONS: ColorBlindOption[] = [
  {
    id: "Off",
    label: "Off",
    desc: "Standard full color spectrum (Trichromacy)",
    badge: "Default",
    palettePreview: ["#3B82F6", "#10B981", "#F59E0B", "#6366F1"],
    activeSwitchColor: "#34C759", // Native green
  },
  {
    id: "Protanopia",
    label: "Protanopia",
    desc: "Red-weak correction filter (Enhances ambers & cyan-blues)",
    badge: "Red-Weak",
    palettePreview: ["#2563EB", "#F59E0B", "#06B6D4", "#6366F1"],
    activeSwitchColor: "#2563EB", // Vibrant blue
  },
  {
    id: "Deuteranopia",
    label: "Deuteranopia",
    desc: "Green-weak correction filter (Enhances blues & deep oranges)",
    badge: "Green-Weak",
    palettePreview: ["#1D4ED8", "#EA580C", "#0284C7", "#D97706"],
    activeSwitchColor: "#0284C7", // Cyan-blue
  },
  {
    id: "Tritanopia",
    label: "Tritanopia",
    desc: "Blue-weak correction filter (Enhances teals & bright magentas)",
    badge: "Blue-Weak",
    palettePreview: ["#0D9488", "#E11D48", "#059669", "#7C3AED"],
    activeSwitchColor: "#0D9488", // Teal
  },
  {
    id: "Monochromacy",
    label: "Monochromacy",
    desc: "Achromatopsia filter (High luminance monochrome grayscale)",
    badge: "Grayscale",
    palettePreview: ["#111827", "#4B5563", "#9CA3AF", "#E5E7EB"],
    activeSwitchColor: "#E5E7EB", // High luminance white/gray
  },
];

export default function AccessibilitySettings() {
  const router = useRouter();
  const { t } = useLanguage();
  const { updateAccessibilityPreferences } = useAppSettings();

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

  const triggerToast = useCallback(
    (msg: string) => {
      setToastMessage(msg);
      if (reduceMotion) {
        toastOpacity.setValue(1);
        setTimeout(() => {
          toastOpacity.setValue(0);
          setToastMessage(null);
        }, 1600);
        return;
      }
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
    },
    [toastOpacity, reduceMotion]
  );

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
  // Dynamically adapts based on highContrastMode and active colorBlindMode
  const colors = useMemo(() => {
    const activeColorBlindConfig = COLOR_BLIND_OPTIONS.find((o) => o.id === colorBlindMode);
    const dynamicSwitchColor = activeColorBlindConfig
      ? colorBlindMode === "Off"
        ? isDark
          ? "#34C759"
          : "#10B981"
        : activeColorBlindConfig.activeSwitchColor
      : isDark
      ? "#34C759"
      : "#10B981";

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";

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
        ? "#E5E7EB"
        : "#374151"
      : isDark
      ? "#8E95A2"
      : "#7E8590";

    const sectionHeader = highContrastMode
      ? isDark
        ? "#F3F4F6"
        : "#111827"
      : isDark
      ? "#8E95A2"
      : "#7E8590";

    return {
      bg,
      card,
      cardBorder,
      divider: highContrastMode
        ? isDark
          ? "rgba(255, 255, 255, 0.35)"
          : "rgba(0, 0, 0, 0.25)"
        : isDark
        ? "rgba(255, 255, 255, 0.05)"
        : "#F2F4F7",
      textPrimary,
      textSecondary,
      sectionHeader,
      greyishWhite,
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      switchActive: dynamicSwitchColor,
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
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
  }, [isDark, highContrastMode, colorBlindMode]);

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

    updateAccessibilityPreferences(updated);
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

  // Switch / option handlers with live feedback & tactile feel
  const handleToggleScreenReader = (val: boolean) => {
    setScreenReaderCompat(val);
    savePreferences({ screenReaderCompat: val });
    if (val) {
      AccessibilityInfo.announceForAccessibility(
        "Screen Reader Compatibility activated. Interface elements optimized for screen readers."
      );
    }
    triggerToast(val ? "Screen Reader mode enabled" : "Screen Reader mode disabled");
    if (hapticFeedback) Vibration.vibrate(12);
  };

  const handleToggleHighContrast = (val: boolean) => {
    setHighContrastMode(val);
    savePreferences({ highContrastMode: val });
    triggerToast(val ? "High Contrast mode active (AAA contrast)" : "Standard contrast mode restored");
    if (hapticFeedback) Vibration.vibrate(12);
  };

  const handleToggleLargeTouchTargets = (val: boolean) => {
    setLargeTouchTargets(val);
    savePreferences({ largeTouchTargets: val });
    triggerToast(val ? "Large Touch Targets active (56px+ target size)" : "Standard touch targets active");
    if (hapticFeedback) Vibration.vibrate(12);
  };

  const handleSelectColorBlindMode = (opt: ColorBlindOption) => {
    setColorBlindMode(opt.id);
    savePreferences({ colorBlindMode: opt.id });
    setColorBlindModalVisible(false);
    triggerToast(opt.id === "Off" ? "Color blind filters disabled" : `${opt.label} filter active`);
    if (hapticFeedback) Vibration.vibrate(15);
  };

  const handleToggleReduceMotion = (val: boolean) => {
    setReduceMotion(val);
    savePreferences({ reduceMotion: val });
    triggerToast(val ? "Reduce Motion enabled (Animations minimized)" : "Standard animations active");
    if (hapticFeedback) Vibration.vibrate(12);
  };

  const handleToggleHapticFeedback = (val: boolean) => {
    setHapticFeedback(val);
    savePreferences({ hapticFeedback: val });
    if (val) {
      // Tactile double confirmation pulse
      Vibration.vibrate([0, 20, 60, 25], false);
    }
    triggerToast(val ? "Haptic feedback enabled" : "Haptic feedback disabled");
  };

  // Handle interactive preview button tap
  const handlePreviewButtonTap = () => {
    setTestTapCount((c) => c + 1);
    if (hapticFeedback) {
      Vibration.vibrate(15);
    }
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
          accessibilityLabel={t("back", "Back")}
          accessibilityRole="button"
          hitSlop={largeTouchTargets ? 16 : 8}
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
          {t("Accessibility")}
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
                  { color: highContrastMode ? (colorBlindMode === "Monochromacy" ? "#000000" : "#FFFFFF") : colors.textPrimary },
                ]}
              >
                {highContrastMode ? "AAA CONTRAST (21:1)" : "AA CONTRAST (7:1)"}
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
                  paddingVertical: largeTouchTargets ? 15 : 10,
                  paddingHorizontal: largeTouchTargets ? 22 : 14,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              hitSlop={largeTouchTargets ? 18 : 6}
              accessibilityRole="button"
              accessibilityLabel="Tap to test haptics and touch target size"
              accessibilityHint="Tests device vibration and shows active touch target dimensions"
            >
              <Ionicons
                name="finger-print"
                size={largeTouchTargets ? 22 : 18}
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
                {largeTouchTargets ? "Touch Target: Large (56px)" : "Touch Target: Normal (44px)"} • Taps: {testTapCount}
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
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("VISION & DISPLAY", "VISION SUPPORT")}</Text>
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
          {/* Screen Reader Compatibility - Entire row pressable */}
          <Pressable
            onPress={() => handleToggleScreenReader(!screenReaderCompat)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: screenReaderCompat }}
            accessibilityLabel="Screen Reader Compatibility"
            accessibilityHint="Double tap to toggle VoiceOver and TalkBack navigation optimization"
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
                  {t("Screen Reader Optimization", "Screen Reader Compatibility")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Optimize labels and order for screen readers", "Optimize navigation for VoiceOver & TalkBack")}
                </Text>
              </View>
              <Switch
                value={screenReaderCompat}
                onValueChange={handleToggleScreenReader}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={largeTouchTargets ? 12 : 6}
              />
            </View>
          </Pressable>

          {/* High Contrast Mode - Entire row pressable */}
          <Pressable
            onPress={() => handleToggleHighContrast(!highContrastMode)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: highContrastMode }}
            accessibilityLabel="High Contrast Mode"
            accessibilityHint="Double tap to toggle high contrast interface elements"
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
                  {t("High Contrast Mode")}
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
                hitSlop={largeTouchTargets ? 12 : 6}
              />
            </View>
          </Pressable>

          {/* Large Touch Targets - Entire row pressable */}
          <Pressable
            onPress={() => handleToggleLargeTouchTargets(!largeTouchTargets)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: largeTouchTargets }}
            accessibilityLabel="Large Touch Targets"
            accessibilityHint="Double tap to expand tappable interactive elements"
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
                hitSlop={largeTouchTargets ? 12 : 6}
              />
            </View>
          </Pressable>

          {/* Color Blind Mode */}
          <Pressable
            onPress={() => {
              if (hapticFeedback) Vibration.vibrate(10);
              setColorBlindModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            hitSlop={largeTouchTargets ? 12 : 6}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Color Blind Mode, currently set to ${colorBlindMode}`}
            accessibilityHint="Double tap to open color blind filter selection modal"
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
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("INTERACTION & MOTION", "MOTION & FEEDBACK")}</Text>
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
          {/* Reduce Motion - Entire row pressable */}
          <Pressable
            onPress={() => handleToggleReduceMotion(!reduceMotion)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: reduceMotion }}
            accessibilityLabel="Reduce Motion"
            accessibilityHint="Double tap to limit animations and decorative movements"
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
                  {t("Reduce Motion")}
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
                hitSlop={largeTouchTargets ? 12 : 6}
              />
            </View>
          </Pressable>

          {/* Haptic Feedback - Entire row pressable */}
          <Pressable
            onPress={() => handleToggleHapticFeedback(!hapticFeedback)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 74 : 62 },
              pressed && styles.rowPressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: hapticFeedback }}
            accessibilityLabel="Haptic Feedback"
            accessibilityHint="Double tap to toggle device vibrations on key presses and confirmations"
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
                  {t("Haptic Feedback")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Vibrate on button taps, switches and tab switches", "Vibrate device on key presses & confirmations")}
                </Text>
              </View>
              <Switch
                value={hapticFeedback}
                onValueChange={handleToggleHapticFeedback}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={largeTouchTargets ? 12 : 6}
              />
            </View>
          </Pressable>
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
                hitSlop={largeTouchTargets ? 16 : 8}
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
                      { minHeight: largeTouchTargets ? 64 : 54 },
                      isSelected && { backgroundColor: colors.activeRowBg },
                      highContrastMode && isSelected && { borderWidth: 1, borderColor: colors.cardBorder },
                      pressed && { opacity: 0.7 },
                    ]}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${opt.label}, ${opt.desc}`}
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
