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
  Switch,
  Modal,
  StatusBar,
  Appearance,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  COLOR_BLIND_OPTIONS,
  ColorBlindOption,
  ColorBlindType,
  getAccessibleHitSlop,
} from "../theme/accessibility";

export default function AccessibilityScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    screenReaderCompat,
    highContrastMode,
    largeTouchTargets,
    colorBlindMode,
    reduceMotion,
    hapticFeedback,
    triggerHaptic,
    announceAccessibility,
    updateAccessibilityPreferences,
  } = useAppSettings();

  // Color blind filter modal
  const [colorBlindModalVisible, setColorBlindModalVisible] = useState(false);

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
        }, 1500);
        return;
      }
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
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity, reduceMotion]
  );

  // Theme resolution matching Bunkmates settings design system
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicThemeColors: any = null;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      dynamicThemeColors = themeContext.themeColors;
    }
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Bunkmates Settings design system (zero harsh red, greyish-white accents)
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

    // Native green active tint matching iOS/Android system switches and Settings pages
    const switchActive = isDark ? "#34C759" : "#10B981";
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
      divider: isDark ? "#202024" : "#F0F2F5",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      activeRowBg: isDark ? "#202024" : "#F4F5F7",
      chipBg: isDark ? "#202024" : "#EEF2F6",
    };
  }, [isDark, highContrastMode, dynamicThemeColors]);

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

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

      {/* Header with Circular Back Button matching Settings page (modernHeaderBtn) */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
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
              pressed && styles.pressed,
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
              <Switch
                value={screenReaderCompat}
                onValueChange={handleToggleScreenReader}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={hitSlop}
              />
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
              <Switch
                value={highContrastMode}
                onValueChange={handleToggleHighContrast}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={hitSlop}
              />
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
              <Switch
                value={largeTouchTargets}
                onValueChange={handleToggleLargeTouchTargets}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={hitSlop}
              />
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
        </View>

        {/* ========================================================
            2. MOTION & FEEDBACK SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginTop: 24 }]}>
          {t("MOTION & FEEDBACK", "MOTION & FEEDBACK")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* 5. Reduce Motion */}
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
              <Switch
                value={reduceMotion}
                onValueChange={handleToggleReduceMotion}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={hitSlop}
              />
            </View>
          </Pressable>

          <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

          {/* 6. Haptic Feedback */}
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
              <Switch
                value={hapticFeedback}
                onValueChange={handleToggleHapticFeedback}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
                hitSlop={hitSlop}
              />
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL: COLOR BLIND MODE PICKER (CVD)
      ========================================================= */}
      <Modal
        visible={colorBlindModalVisible}
        transparent
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() => setColorBlindModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setColorBlindModalVisible(false)}
            accessible={true}
            accessibilityLabel="Dismiss modal"
            accessibilityRole="button"
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
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
    marginLeft: 68,
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
