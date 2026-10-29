// src/app/accessibility.tsx
// Accessibility Settings — Pixel-perfect UI matching Bunkmates Settings design system
// Features: Circular back button, greyish-white icon boxes (zero harsh red), dynamic theme adaptability,
// native active green switches, and real AsyncStorage + Firestore sync.
// Dynamically applies to the entire application (VoiceOver/TalkBack, WCAG AAA High Contrast,
// Large Touch Targets, CVD Color Blind Filters, Reduce Motion, and Tactile Haptics).

import React, { useState, useMemo, useRef, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SettingsHeaderGradientMask } from "./_components/SettingsHeaderGradientMask";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import {
  COLOR_BLIND_OPTIONS,
  ColorBlindOption,
  ColorBlindType,
  getAccessibleHitSlop,
} from "../../theme/accessibility";
import { SwipeableDrawer } from "./_components/SwipeableDrawer";
import { BunkmatesAnimatedSwitch } from "./_components/BunkmatesAnimatedSwitch";

export default function AccessibilityScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top > 0 ? insets.top : Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 44;
  const router = useRouter();
  const { t } = useLanguage();
  const {
    screenReaderCompat,
    highContrastMode,
    largeTouchTargets,
    colorBlindMode,
    reduceMotion,
    hapticFeedback,
    boldText,
    reduceTransparency,
    audioCues,
    triggerHaptic,
    announceAccessibility,
    updateAccessibilityPreferences,
  } = useAppSettings();

  // Color blind filter modal
  const [colorBlindModalVisible, setColorBlindModalVisible] = useState(false);

  // Floating save/action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = useCallback(
    (msg: string) => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      toastOpacity.stopAnimation();
      setToastMessage(msg);

      if (reduceMotion) {
        toastOpacity.setValue(1);
        toastTimeoutRef.current = setTimeout(() => {
          toastOpacity.setValue(0);
          setToastMessage(null);
        }, 1500);
        return;
      }

      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start((result) => {
        if (result.finished) {
          setToastMessage(null);
        }
      });
    },
    [toastOpacity, reduceMotion]
  );

  // Theme resolution matching Bunkmates settings design system
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicThemeColors: any = null;
  let dynamicAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      dynamicThemeColors = themeContext.themeColors;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
    }
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Bunkmates Settings design system
  const colors = useMemo(() => {
    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";

    const bg = highContrastMode
      ? isDark
        ? "#000000"
        : "#FFFFFF"
      : dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1");

    const card = highContrastMode
      ? isDark
        ? "#121214"
        : "#FFFFFF"
      : dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF");

    const textPrimary = highContrastMode
      ? isDark
        ? "#FFFFFF"
        : "#000000"
      : dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A");

    const textSecondary = highContrastMode
      ? isDark
        ? "#E5E7EB"
        : "#1F2937"
      : dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590");

    const sectionHeader = highContrastMode
      ? isDark
        ? "#F3F4F6"
        : "#111827"
      : dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590");

    // Dynamic active switch tint matching app accent colors
    const switchActive = dynamicThemeColors?.accent || dynamicAccent;
    const switchInactive = isDark ? "#2A2D36" : "#E5E7EB";

    return {
      bg,
      card,
      textPrimary,
      textSecondary,
      sectionHeader,
      greyishWhite,
      iconBoxBg: isDark ? "#202024" : "#F4F5F7",
      chevron: isDark ? "#555860" : "#B4B9C2",
      switchActive,
      switchInactive,
      divider: dynamicThemeColors?.divider ?? (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"),
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      activeRowBg: isDark ? "#202024" : "#F4F5F7",
      chipBg: isDark ? "#202024" : "#EEF2F6",
    };
  }, [isDark, highContrastMode, dynamicThemeColors, dynamicAccent]);

  const hitSlop = useMemo(() => getAccessibleHitSlop(largeTouchTargets), [largeTouchTargets]);

  const activeColorBlindConfig = useMemo(() => {
    return COLOR_BLIND_OPTIONS.find((o) => o.id === colorBlindMode) || COLOR_BLIND_OPTIONS[0];
  }, [colorBlindMode]);

  const colorBlindSubtitle = useMemo(() => {
    if (colorBlindMode === "Off") return "Protanopia correction filters";
    return activeColorBlindConfig.desc;
  }, [colorBlindMode, activeColorBlindConfig]);

  // Handlers with tactile feedback, persistence, and announcements
  const handleToggleScreenReader = (val: boolean) => {
    updateAccessibilityPreferences({ screenReaderCompat: val });
    if (val) {
      announceAccessibility(
        "Screen Reader Compatibility activated. Interface elements optimized for VoiceOver and TalkBack."
      );
    }
    triggerToast(val ? "Screen Reader Optimization enabled" : "Screen Reader Optimization disabled");
    if (hapticFeedback) triggerHaptic("medium");
  };

  const handleToggleHighContrast = (val: boolean) => {
    updateAccessibilityPreferences({ highContrastMode: val });
    triggerToast(val ? "High Contrast mode active (AAA contrast)" : "Standard contrast restored");
    if (hapticFeedback) triggerHaptic("medium");
  };

  const handleToggleLargeTouchTargets = (val: boolean) => {
    updateAccessibilityPreferences({ largeTouchTargets: val });
    triggerToast(val ? "Large Touch Targets active (56px min)" : "Standard touch targets active");
    if (hapticFeedback) triggerHaptic("selection");
  };

  const handleToggleReduceMotion = (val: boolean) => {
    updateAccessibilityPreferences({ reduceMotion: val });
    triggerToast(val ? "Reduce Motion enabled (Animations minimized)" : "Standard animations active");
    if (hapticFeedback) triggerHaptic("selection");
  };

  const handleToggleHapticFeedback = (val: boolean) => {
    updateAccessibilityPreferences({ hapticFeedback: val });
    if (val) triggerHaptic("heavy");
    triggerToast(val ? "Haptic feedback enabled" : "Haptic feedback disabled");
  };

  const handleSelectColorBlind = (opt: ColorBlindOption) => {
    updateAccessibilityPreferences({ colorBlindMode: opt.id });
    setColorBlindModalVisible(false);
    triggerToast(opt.id === "Off" ? "Color blind filters disabled" : `${opt.label} filter active`);
    if (hapticFeedback) triggerHaptic("success");
  };

  const handleToggleBoldText = (val: boolean) => {
    updateAccessibilityPreferences({ boldText: val });
    triggerToast(val ? "Bold Text enabled" : "Standard text restored");
    if (hapticFeedback) triggerHaptic("selection");
  };



  const handleToggleAudioCues = (val: boolean) => {
    updateAccessibilityPreferences({ audioCues: val });
    triggerToast(val ? "Audio Cues enabled" : "Audio Cues disabled");
    if (hapticFeedback) triggerHaptic("selection");
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Floating Action/Save Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={toastMessage}
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask */}
      <SettingsHeaderGradientMask
        backgroundColor={colors.bg}
        zIndex={15}
      />

      {/* Header with Circular Back Button matching Settings page (modernHeaderBtn) */}
      <View style={[styles.header, { zIndex: 20 }]}>
        <Pressable
          onPress={() => router.back()}
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
          hitSlop={hitSlop}
          accessibilityLabel={t("back", "Back")}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t("Accessibility", "Accessibility")}
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            1. VISION SUPPORT SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("VISION SUPPORT", "VISION SUPPORT")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* 1. Screen Reader Compatibility */}
          <Pressable
            onPress={() => handleToggleScreenReader(!screenReaderCompat)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
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
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Screen Reader Compatibility")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Optimize navigation for VoiceOver & TalkBack")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={screenReaderCompat}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 2. High Contrast Mode */}
          <Pressable
            onPress={() => handleToggleHighContrast(!highContrastMode)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: highContrastMode }}
            accessibilityLabel="High Contrast Mode"
            accessibilityHint="Double tap to toggle increased text and interface element contrast"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="eye-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("High Contrast Mode")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Increase text and interface element contrast")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={highContrastMode}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 3. Large Touch Targets */}
          <Pressable
            onPress={() => handleToggleLargeTouchTargets(!largeTouchTargets)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: largeTouchTargets }}
            accessibilityLabel="Large Touch Targets"
            accessibilityHint="Double tap to toggle expanded tappable interactive elements"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="navigate-outline" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Large Touch Targets")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Expand tappable interactive elements")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={largeTouchTargets}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 4. Color Blind Mode */}
          <Pressable
            onPress={() => {
              if (hapticFeedback) triggerHaptic("selection");
              setColorBlindModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            hitSlop={hitSlop}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Color Blind Mode, currently ${colorBlindMode}`}
            accessibilityHint="Double tap to open color blind filter selection modal"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="eye-off-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Color Blind Mode")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {colorBlindSubtitle}
                </Text>
              </View>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>
                  {colorBlindMode === "Off" ? "Off" : activeColorBlindConfig.badge}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 5. Bold Text */}
          <Pressable
            onPress={() => handleToggleBoldText(!boldText)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: boldText }}
            accessibilityLabel="Bold Text"
            accessibilityHint="Double tap to toggle bold text styling for enhanced legibility"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="text-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Bold Text")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Increase text weight for enhanced legibility")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={boldText}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            2. MOTION & FEEDBACK SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginTop: 24 }]}>
          {t("MOTION & FEEDBACK", "MOTION & FEEDBACK")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* 7. Reduce Motion */}
          <Pressable
            onPress={() => handleToggleReduceMotion(!reduceMotion)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: reduceMotion }}
            accessibilityLabel="Reduce Motion"
            accessibilityHint="Double tap to toggle decorative movement and transition limits"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="flash-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Reduce Motion")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Limit animations and decorative movements")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={reduceMotion}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 8. Haptic Feedback */}
          <Pressable
            onPress={() => handleToggleHapticFeedback(!hapticFeedback)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: hapticFeedback }}
            accessibilityLabel="Haptic Feedback"
            accessibilityHint="Double tap to toggle vibrations on key presses, switches, and tabs"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Haptic Feedback")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Vibrate device on key presses & confirmations")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={hapticFeedback}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 9. Audio Cues */}
          <Pressable
            onPress={() => handleToggleAudioCues(!audioCues)}
            style={({ pressed }) => [
              styles.rowItem,
              { minHeight: largeTouchTargets ? 76 : 64 },
              pressed && styles.pressed,
            ]}
            accessible={true}
            accessibilityRole="switch"
            accessibilityState={{ checked: audioCues }}
            accessibilityLabel="Audio Cues"
            accessibilityHint="Double tap to toggle earcons and sound indicators on actions and events"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Audio Cues")}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Play tone notifications for actions and state changes")}
                </Text>
              </View>
              <View pointerEvents="none">
                <BunkmatesAnimatedSwitch
                  value={audioCues}
                  activeTrackColor={colors.switchActive}
                  inactiveTrackColor={colors.switchInactive}
                />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          DRAWER: COLOR BLIND MODE PICKER (CVD)
      ========================================================= */}
      <SwipeableDrawer
        visible={colorBlindModalVisible}
        onClose={() => setColorBlindModalVisible(false)}
        sheetStyle={[styles.bottomSheet, { backgroundColor: colors.card }]}
      >
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {t("Color Blind Mode")}
          </Text>
          <Pressable
            onPress={() => setColorBlindModalVisible(false)}
            hitSlop={hitSlop}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {COLOR_BLIND_OPTIONS.map((opt) => {
            const isSelected = colorBlindMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelectColorBlind(opt)}
                style={({ pressed }) => [
                  styles.modalOptionRow,
                  isSelected && { backgroundColor: colors.activeRowBg },
                  pressed && styles.pressed,
                ]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${opt.label}, ${opt.desc}`}
                hitSlop={hitSlop}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                      style={[
                        styles.modalOptionTitle,
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
                  <Text style={[styles.modalOptionDesc, { color: colors.textSecondary }]}>
                    {opt.desc}
                  </Text>
                  {/* Swatch Strip */}
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
      </SwipeableDrawer>
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
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
    textTransform: "uppercase",
  },
  cardGroup: {
    borderRadius: 24,
    overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: {
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
  },
  labelGroup: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
    lineHeight: 16,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightValueText: {
    fontSize: 14,
    fontWeight: "500",
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginVertical: 3,
  },
  modalOptionTitle: {
    fontSize: 15,
  },
  modalOptionDesc: {
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
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
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
