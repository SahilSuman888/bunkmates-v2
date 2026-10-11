// **@** Notifications Settings — Pixel-perfect reference UI matching Settings design system with greyish-white icons, circular back button, dynamic theme toggle colors, centralized AppSettingsContext persistence, live Quiet Hours status, and interactive in-app test dispatchers
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Modal,
  StatusBar,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { registerForPushNotifications, disablePushNotifications } from "../lib/pushNotifications";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import {
  NotificationCategory,
  NotificationPreferences,
  sendTestNotification,
} from "../lib/NotificationService";

const TIME_OPTIONS = [
  "08:00 PM",
  "09:00 PM",
  "09:30 PM",
  "10:00 PM",
  "10:30 PM",
  "11:00 PM",
  "11:30 PM",
  "12:00 AM",
  "01:00 AM",
  "06:00 AM",
  "06:30 AM",
  "07:00 AM",
  "07:30 AM",
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "10:00 AM",
];

export default function NotificationSettings() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    notificationPreferences,
    updateNotificationPreferences,
    isQuietHoursActive,
    triggerHaptic,
  } = useAppSettings();

  // Auth & user state
  const [user, setUser] = useState<any>(null);

  // Time picker modal state
  const [showTimeModal, setShowTimeModal] = useState<"from" | "until" | null>(null);
  const [testingCategory, setTestingCategory] = useState<NotificationCategory | null>(null);

  // Active preferences from centralized context
  const {
    allPushEnabled,
    tripUpdates,
    chatMessages,
    reminders,
    recommendations,
    promotions,
    doNotDisturb,
    silenceFrom,
    silenceUntil,
  } = notificationPreferences;

  const quietHoursNow = isQuietHoursActive();

  // Helper for dynamic alpha tints
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex =
      cleanHex.length === 3
        ? cleanHex
            .split("")
            .map((c) => c + c)
            .join("")
        : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Dynamic Theme matching Settings page & ThemeContext
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
    const accent = dynamicAccent;
    return {
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardBorder: "transparent",
      divider: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary:
        dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader:
        dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      accent: accent,
      accentBg: isDark ? hexToRgba(accent, 0.12) : hexToRgba(accent, 0.07),
      accentBorder: "transparent",
      switchActive: accent,
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      chevron: isDark ? "#555860" : "#B4B9C2",
      timeBoxBg: isDark ? "#202024" : "#F2F4F7",
      successGreen: "#10B981",
      warningAmber: "#F59E0B",
    };
  }, [isDark, dynamicAccent, dynamicThemeColors]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Central toggle dispatcher
  const handleTogglePreference = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    triggerHaptic("selection");
    await updateNotificationPreferences({ [key]: value });

    if (key === "allPushEnabled" && user) {
      if (value) {
        registerForPushNotifications(user.uid).catch(() => {});
      } else {
        disablePushNotifications(user.uid).catch(() => {});
      }
    }
  };

  const handleSelectTime = async (time: string) => {
    triggerHaptic("selection");
    if (showTimeModal === "from") {
      await updateNotificationPreferences({ silenceFrom: time });
    } else if (showTimeModal === "until") {
      await updateNotificationPreferences({ silenceUntil: time });
    }
    setShowTimeModal(null);
  };

  // Test Notification handler with feedback
  const handleTriggerTest = async (category: NotificationCategory) => {
    triggerHaptic("medium");
    setTestingCategory(category);
    try {
      const res = await sendTestNotification(category, notificationPreferences);
      if (res.delivered) {
        // Notification banner will slide in automatically at root level!
      } else {
        // Suppressed by gatekeeper: explain reason to user
        Alert.alert(
          "Alert Suppressed by Rules",
          res.reason ||
            "This notification was not delivered because your notification rules or quiet hours filtered it out.",
          [{ text: "OK" }]
        );
      }
    } catch (e: any) {
      Alert.alert("Test Notification Error", e?.message || "Failed to trigger test.");
    } finally {
      setTimeout(() => setTestingCategory(null), 500);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.bg}
      />

      {/* ── Top Header: Exact circular button matching Settings page ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          hitSlop={6}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {t("Notifications")}
        </Text>

        <Pressable
          onPress={() => router.push("/(tabs)/notifications" as any)}
          style={({ pressed }) => [
            styles.inboxBtn,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
          hitSlop={6}
          accessibilityLabel="View inbox"
        >
          <Ionicons name="mail-outline" size={19} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP HERO CARD: All Push Notifications ── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.greyishWhite }]}>
              {t("All Push Notifications")}
            </Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              {t("Quickly silence or enable all mobile alerts")}
            </Text>
          </View>
          <Switch
            value={allPushEnabled}
            onValueChange={(val) => handleTogglePreference("allPushEnabled", val)}
            trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
            thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
          />
        </View>

        {/* ── 1. NOTIFICATION CATEGORIES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("NOTIFICATION CATEGORIES")}
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            !allPushEnabled && { opacity: 0.6 },
          ]}
          pointerEvents={allPushEnabled ? "auto" : "none"}
        >
          {/* Trip Updates */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="airplane-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Trip Updates")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Flight delays, gate changes, booking syncs")}
              </Text>
            </View>
            <Switch
              value={tripUpdates && allPushEnabled}
              onValueChange={(val) => handleTogglePreference("tripUpdates", val)}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Messages & Chat */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color={colors.greyishWhite}
              />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Messages & Chat")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Instant pings from your travel group chat")}
              </Text>
            </View>
            <Switch
              value={chatMessages && allPushEnabled}
              onValueChange={(val) => handleTogglePreference("chatMessages", val)}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Reminders */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="time-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Reminders")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Pack list alerts, check-in prompts")}
              </Text>
            </View>
            <Switch
              value={reminders && allPushEnabled}
              onValueChange={(val) => handleTogglePreference("reminders", val)}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Recommendations */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="sparkles-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Recommendations")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Curated cafes & local events nearby")}
              </Text>
            </View>
            <Switch
              value={recommendations && allPushEnabled}
              onValueChange={(val) => handleTogglePreference("recommendations", val)}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Promotions & Deals */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="pricetag-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Promotions & Deals")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Discounts on hostels, budget flights & events")}
              </Text>
            </View>
            <Switch
              value={promotions && allPushEnabled}
              onValueChange={(val) => handleTogglePreference("promotions", val)}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>
        </View>

        {/* ── 2. QUIET HOURS ── */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader, flex: 1 }]}>
            {t("QUIET HOURS (DND)")}
          </Text>
          {doNotDisturb && (
            <View
              style={[
                styles.dndStatusBadge,
                {
                  backgroundColor: quietHoursNow
                    ? hexToRgba(colors.accent, 0.15)
                    : isDark
                    ? "#202024"
                    : "#E5E7EB",
                },
              ]}
            >
              <Ionicons
                name={quietHoursNow ? "moon" : "sunny-outline"}
                size={11}
                color={quietHoursNow ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.dndStatusText,
                  {
                    color: quietHoursNow ? colors.accent : colors.textSecondary,
                  },
                ]}
              >
                {quietHoursNow ? "Active Now" : "Inactive"}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, padding: 16 }]}>
          {/* Do Not Disturb Toggle */}
          <View style={styles.dndRow}>
            <View style={styles.dndTextWrap}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Do Not Disturb")}
              </Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {t("Auto-silence non-critical trip pings during sleep")}
              </Text>
            </View>
            <Switch
              value={doNotDisturb}
              onValueChange={(val) => handleTogglePreference("doNotDisturb", val)}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          {/* Time Range Selector */}
          <View
            style={[styles.timeRow, !doNotDisturb && { opacity: 0.45 }]}
            pointerEvents={doNotDisturb ? "auto" : "none"}
          >
            {/* Silence From */}
            <Pressable
              style={({ pressed }) => [
                styles.timeBox,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal("from")}
            >
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                SILENCE FROM
              </Text>
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>
                {silenceFrom}
              </Text>
            </Pressable>

            <Text style={[styles.toLabel, { color: colors.textSecondary }]}>to</Text>

            {/* Silence Until */}
            <Pressable
              style={({ pressed }) => [
                styles.timeBox,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal("until")}
            >
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                SILENCE UNTIL
              </Text>
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>
                {silenceUntil}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── 3. TEST NOTIFICATION DISPATCHER (LIVE SIMULATOR) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          TEST NOTIFICATIONS (LIVE SIMULATOR)
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, padding: 14 }]}>
          <Text style={[styles.testIntroText, { color: colors.textSecondary }]}>
            Tap any category below to simulate real-time notification dispatching. Rules,
            DND hours, and category filters are evaluated live.
          </Text>

          <View style={styles.testGrid}>
            <Pressable
              onPress={() => handleTriggerTest("tripUpdates")}
              disabled={testingCategory !== null}
              style={({ pressed }) => [
                styles.testPill,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="airplane-outline" size={16} color={colors.accent} />
              <Text style={[styles.testPillText, { color: colors.textPrimary }]}>
                Flight Alert
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTriggerTest("chatMessages")}
              disabled={testingCategory !== null}
              style={({ pressed }) => [
                styles.testPill,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={colors.accent}
              />
              <Text style={[styles.testPillText, { color: colors.textPrimary }]}>
                Chat Message
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTriggerTest("reminders")}
              disabled={testingCategory !== null}
              style={({ pressed }) => [
                styles.testPill,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={[styles.testPillText, { color: colors.textPrimary }]}>
                Packing List
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTriggerTest("recommendations")}
              disabled={testingCategory !== null}
              style={({ pressed }) => [
                styles.testPill,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={[styles.testPillText, { color: colors.textPrimary }]}>
                Local Cafe
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTriggerTest("promotions")}
              disabled={testingCategory !== null}
              style={({ pressed }) => [
                styles.testPill,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="pricetag-outline" size={16} color={colors.accent} />
              <Text style={[styles.testPillText, { color: colors.textPrimary }]}>
                Hostel Deal
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ── TIME SELECTOR MODAL ── */}
      <Modal
        visible={showTimeModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: colors.iconBoxBg,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  marginBottom: 10,
                  marginRight: 0,
                },
              ]}
            >
              <Ionicons name="time-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showTimeModal === "from" ? "Silence From" : "Silence Until"}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Select the time to automatically start or stop quiet hours.
            </Text>

            <ScrollView
              style={styles.timeListScroll}
              contentContainerStyle={styles.timeListGrid}
            >
              {TIME_OPTIONS.map((timeOption) => {
                const isSelected =
                  showTimeModal === "from"
                    ? silenceFrom === timeOption
                    : silenceUntil === timeOption;
                return (
                  <Pressable
                    key={timeOption}
                    style={({ pressed }) => [
                      styles.timeOptionPill,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.timeBoxBg,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectTime(timeOption)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        { color: isSelected ? "#FFFFFF" : colors.textPrimary },
                      ]}
                    >
                      {timeOption}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { backgroundColor: colors.timeBoxBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal(null)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textSecondary }]}>
                Close
              </Text>
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
  inboxBtn: {
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

  // Hero Card: All Push Notifications
  heroCard: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 28,
    borderWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 0,
  },
  heroTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  heroSub: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },

  // Section Heading matching Settings
  sectionHeadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 22,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },
  dndStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 14,
  },
  dndStatusText: {
    fontSize: 11,
    fontWeight: "600",
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
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Quiet Hours Styles
  dndRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dndTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 0,
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: -0.2,
  },
  toLabel: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: "500",
  },

  // Test Simulator Styles
  testIntroText: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 12,
  },
  testGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  testPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
  },
  testPillText: {
    fontSize: 12.5,
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
    borderRadius: 28,
    borderWidth: 0,
    padding: 24,
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
  timeListScroll: {
    maxHeight: 220,
    width: "100%",
    marginBottom: 18,
  },
  timeListGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  timeOptionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 0,
    minWidth: "46%",
    alignItems: "center",
  },
  timeOptionText: {
    fontSize: 13.5,
    fontWeight: "600",
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
