// **@** Notifications Settings — Pixel-perfect reference UI matching Settings design system with greyish-white icons, circular back button, dynamic theme toggle colors, and real Firestore persistence
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
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";

const TIME_OPTIONS = [
  "08:00 PM",
  "09:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
  "01:00 AM",
  "05:00 AM",
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
];

export default function NotificationSettings() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Notification settings states matching reference UI defaults
  const [allPushEnabled, setAllPushEnabled] = useState<boolean>(true);
  const [tripUpdates, setTripUpdates] = useState<boolean>(true);
  const [chatMessages, setChatMessages] = useState<boolean>(true);
  const [reminders, setReminders] = useState<boolean>(true);
  const [recommendations, setRecommendations] = useState<boolean>(false);
  const [promotions, setPromotions] = useState<boolean>(false);

  // Quiet Hours states
  const [doNotDisturb, setDoNotDisturb] = useState<boolean>(true);
  const [silenceFrom, setSilenceFrom] = useState<string>("10:00 PM");
  const [silenceUntil, setSilenceUntil] = useState<string>("07:00 AM");

  // Time picker modal state
  const [showTimeModal, setShowTimeModal] = useState<"from" | "until" | null>(null);

  // Helper for dynamic alpha tints
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Dynamic Theme matching Settings page & ThemeContext
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
    }
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(() => {
    const accent = dynamicAccent;
    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      accent: accent,
      accentBg: isDark ? hexToRgba(accent, 0.12) : hexToRgba(accent, 0.07),
      accentBorder: isDark ? hexToRgba(accent, 0.35) : hexToRgba(accent, 0.25),
      switchActive: accent,
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      // Greyish-white icon color matching Settings page
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      // Subtle neutral circular icon box matching Settings page modernIconBox
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      timeBoxBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F4F7",
    };
  }, [isDark, dynamicAccent]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Restore local cache & live Firestore sync
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_notification_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.allPushEnabled !== undefined) setAllPushEnabled(parsed.allPushEnabled);
          if (parsed.tripUpdates !== undefined) setTripUpdates(parsed.tripUpdates);
          if (parsed.chatMessages !== undefined) setChatMessages(parsed.chatMessages);
          if (parsed.reminders !== undefined) setReminders(parsed.reminders);
          if (parsed.recommendations !== undefined) setRecommendations(parsed.recommendations);
          if (parsed.promotions !== undefined) setPromotions(parsed.promotions);
          if (parsed.doNotDisturb !== undefined) setDoNotDisturb(parsed.doNotDisturb);
          if (parsed.silenceFrom) setSilenceFrom(parsed.silenceFrom);
          if (parsed.silenceUntil) setSilenceUntil(parsed.silenceUntil);
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
          const n = uData.notifications || {};

          if (n.allPushEnabled !== undefined) setAllPushEnabled(!!n.allPushEnabled);
          if (n.tripUpdates !== undefined) setTripUpdates(!!n.tripUpdates);
          if (n.chatMessages !== undefined) setChatMessages(!!n.chatMessages);
          if (n.reminders !== undefined) setReminders(!!n.reminders);
          if (n.recommendations !== undefined) setRecommendations(!!n.recommendations);
          if (n.promotions !== undefined) setPromotions(!!n.promotions);
          if (n.doNotDisturb !== undefined) setDoNotDisturb(!!n.doNotDisturb);
          if (n.silenceFrom) setSilenceFrom(n.silenceFrom);
          if (n.silenceUntil) setSilenceUntil(n.silenceUntil);
        }
      },
      (err) => {
        console.log("Notification settings onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync setting helper
  const syncNotificationSetting = async (field: string, value: any) => {
    // Cache locally
    try {
      const current = await AsyncStorage.getItem("@bunkmates_notification_preferences");
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      await AsyncStorage.setItem("@bunkmates_notification_preferences", JSON.stringify(currentObj));
    } catch (e) {}

    // Sync to Firestore
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`notifications.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update notifications.${field}:`, e);
    }
  };

  // Toggle handlers
  const handleToggleAllPush = (val: boolean) => {
    setAllPushEnabled(val);
    syncNotificationSetting("allPushEnabled", val);
  };

  const handleToggleTripUpdates = (val: boolean) => {
    setTripUpdates(val);
    syncNotificationSetting("tripUpdates", val);
  };

  const handleToggleChatMessages = (val: boolean) => {
    setChatMessages(val);
    syncNotificationSetting("chatMessages", val);
  };

  const handleToggleReminders = (val: boolean) => {
    setReminders(val);
    syncNotificationSetting("reminders", val);
  };

  const handleToggleRecommendations = (val: boolean) => {
    setRecommendations(val);
    syncNotificationSetting("recommendations", val);
  };

  const handleTogglePromotions = (val: boolean) => {
    setPromotions(val);
    syncNotificationSetting("promotions", val);
  };

  const handleToggleDoNotDisturb = (val: boolean) => {
    setDoNotDisturb(val);
    syncNotificationSetting("doNotDisturb", val);
  };

  const handleSelectTime = (time: string) => {
    if (showTimeModal === "from") {
      setSilenceFrom(time);
      syncNotificationSetting("silenceFrom", time);
    } else if (showTimeModal === "until") {
      setSilenceUntil(time);
      syncNotificationSetting("silenceUntil", time);
    }
    setShowTimeModal(null);
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
          hitSlop={6}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Notifications
        </Text>
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
              backgroundColor: colors.accentBg,
              borderColor: colors.accentBorder,
            },
          ]}
        >
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.accent }]}>All Push Notifications</Text>
            <Text style={[styles.heroSub, { color: isDark ? "#D1D5DB" : "#6B7280" }]}>
              Quickly silence or enable all mobile alerts
            </Text>
          </View>
          <Switch
            value={allPushEnabled}
            onValueChange={handleToggleAllPush}
            trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
            thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
          />
        </View>

        {/* ── 1. NOTIFICATION CATEGORIES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>NOTIFICATION CATEGORIES</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Trip Updates</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Flight delays, gate changes, booking syncs
              </Text>
            </View>
            <Switch
              value={tripUpdates && allPushEnabled}
              onValueChange={handleToggleTripUpdates}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Messages & Chat */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Messages & Chat</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Instant pings from your travel group chat
              </Text>
            </View>
            <Switch
              value={chatMessages && allPushEnabled}
              onValueChange={handleToggleChatMessages}
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Reminders</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Pack list alerts, check-in prompts
              </Text>
            </View>
            <Switch
              value={reminders && allPushEnabled}
              onValueChange={handleToggleReminders}
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Recommendations</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Curated cafes & local events nearby
              </Text>
            </View>
            <Switch
              value={recommendations && allPushEnabled}
              onValueChange={handleToggleRecommendations}
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Promotions & Deals</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Discounts on hostels, budget flights & events
              </Text>
            </View>
            <Switch
              value={promotions && allPushEnabled}
              onValueChange={handleTogglePromotions}
              disabled={!allPushEnabled}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>
        </View>

        {/* ── 2. QUIET HOURS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>QUIET HOURS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          {/* Do Not Disturb Toggle */}
          <View style={styles.dndRow}>
            <View style={styles.dndTextWrap}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Do Not Disturb</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Auto-silence non-critical trip pings
              </Text>
            </View>
            <Switch
              value={doNotDisturb}
              onValueChange={handleToggleDoNotDisturb}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          {/* Time Range Selector */}
          <View style={[styles.timeRow, !doNotDisturb && { opacity: 0.45 }]} pointerEvents={doNotDisturb ? "auto" : "none"}>
            {/* Silence From */}
            <Pressable
              style={({ pressed }) => [
                styles.timeBox,
                { backgroundColor: colors.timeBoxBg, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal("from")}
            >
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>SILENCE FROM</Text>
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{silenceFrom}</Text>
            </Pressable>

            <Text style={[styles.toLabel, { color: colors.textSecondary }]}>to</Text>

            {/* Silence Until */}
            <Pressable
              style={({ pressed }) => [
                styles.timeBox,
                { backgroundColor: colors.timeBoxBg, borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal("until")}
            >
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>SILENCE UNTIL</Text>
              <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{silenceUntil}</Text>
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
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="time-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showTimeModal === "from" ? "Silence From" : "Silence Until"}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Select the time to automatically start or stop quiet hours.
            </Text>

            <ScrollView style={styles.timeListScroll} contentContainerStyle={styles.timeListGrid}>
              {TIME_OPTIONS.map((timeOption) => {
                const isSelected =
                  showTimeModal === "from" ? silenceFrom === timeOption : silenceUntil === timeOption;
                return (
                  <Pressable
                    key={timeOption}
                    style={({ pressed }) => [
                      styles.timeOptionPill,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.timeBoxBg,
                        borderColor: isSelected ? colors.accent : colors.cardBorder,
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
                { borderColor: colors.cardBorder },
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTimeModal(null)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textSecondary }]}>Close</Text>
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

  // Hero Card: All Push Notifications
  heroCard: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 12,
    borderWidth: 1,
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
