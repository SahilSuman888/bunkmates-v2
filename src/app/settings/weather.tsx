// **@** Weather & Environmental Alerts Settings
// High-performance, industry-level implementation reflecting only real app features (zero phantom options like UV)
// Fully reactive with AppSettingsContext, AsyncStorage, and Firestore persistence

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
    Modal,
  StatusBar,
  Animated,
} from "react-native";
import { BunkmatesAnimatedSwitch } from "./_components/BunkmatesAnimatedSwitch";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsHeaderGradientMask } from "./_components/SettingsHeaderGradientMask";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../lib/firebase";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { SwipeableDrawer } from "./_components/SwipeableDrawer";

type TempUnit = "°C" | "°F";
type ForecastHorizon = "3 Days" | "5 Days" | "7 Days";
type WidgetLayout = "Detailed Card" | "Compact Tile";
type RefreshInterval = "Every 30 mins" | "Every 1 Hour" | "Every 3 Hours";

interface TempOption {
  id: TempUnit;
  label: string;
  badge: string;
  desc: string;
}

const TEMP_OPTIONS: TempOption[] = [
  {
    id: "°C",
    label: "Celsius (°C)",
    badge: "Metric",
    desc: "Standard metric scale used globally. Wind speed formatted in km/h.",
  },
  {
    id: "°F",
    label: "Fahrenheit (°F)",
    badge: "Imperial",
    desc: "Imperial scale used in the USA. Wind speed formatted in mph.",
  },
];

const FORECAST_HORIZONS: ForecastHorizon[] = ["3 Days", "5 Days", "7 Days"];
const REFRESH_INTERVALS: RefreshInterval[] = [
  "Every 30 mins",
  "Every 1 Hour",
  "Every 3 Hours",
];

export default function WeatherSettings() {
  const router = useRouter();
  const { t } = useLanguage();
  const { themeColors, accentColor, onAccentTextColor, isDark } = useThemeToggle();
  const {
    tempUnit: globalTempUnit,
    forecastHorizon: globalForecastHorizon,
    severeAlerts: globalSevereAlerts,
    rainNotifications: globalRainNotifications,
    widgetLayout: globalWidgetLayout,
    showFeelsLike: globalShowFeelsLike,
    showWindSpeed: globalShowWindSpeed,
    refreshInterval: globalRefreshInterval,
    highPollutionAlerts: globalHighPollutionAlerts,
    updateWeatherPreferences,
  } = useAppSettings();

  // Auth & user state
  const [user, setUser] = useState<any>(null);

  // States synchronized with real active app features
  const [tempUnit, setTempUnit] = useState<TempUnit>(
    (globalTempUnit as TempUnit) === "°F" ? "°F" : "°C"
  );
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(
    (globalForecastHorizon as ForecastHorizon) || "7 Days"
  );
  const [severeAlerts, setSevereAlerts] = useState<boolean>(globalSevereAlerts ?? true);
  const [rainNotifications, setRainNotifications] = useState<boolean>(
    globalRainNotifications ?? true
  );
  const [highPollutionAlerts, setHighPollutionAlerts] = useState<boolean>(
    globalHighPollutionAlerts ?? true
  );

  // Widget settings
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayout>(
    (globalWidgetLayout as WidgetLayout) || "Detailed Card"
  );
  const [showFeelsLike, setShowFeelsLike] = useState<boolean>(
    globalShowFeelsLike ?? true
  );
  const [showWindSpeed, setShowWindSpeed] = useState<boolean>(
    globalShowWindSpeed ?? true
  );
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(
    (globalRefreshInterval as RefreshInterval) || "Every 1 Hour"
  );

  // Modals state
  const [tempModalVisible, setTempModalVisible] = useState(false);
  const [widgetModalVisible, setWidgetModalVisible] = useState(false);

  // Floating save/action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);

  const triggerToast = useCallback(
    (msg: string) => {
      setToastMessage(msg);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity]
  );

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
  };

  // Keep state updated when global settings change
  useEffect(() => {
    if (globalTempUnit) {
      setTempUnit((globalTempUnit as TempUnit) === "°F" ? "°F" : "°C");
    }
    if (globalForecastHorizon) {
      setForecastHorizon((globalForecastHorizon as ForecastHorizon) || "7 Days");
    }
    if (globalSevereAlerts !== undefined) setSevereAlerts(globalSevereAlerts);
    if (globalRainNotifications !== undefined) setRainNotifications(globalRainNotifications);
    if (globalHighPollutionAlerts !== undefined) setHighPollutionAlerts(globalHighPollutionAlerts);
    if (globalWidgetLayout) setWidgetLayout((globalWidgetLayout as WidgetLayout) || "Detailed Card");
    if (globalShowFeelsLike !== undefined) setShowFeelsLike(globalShowFeelsLike);
    if (globalShowWindSpeed !== undefined) setShowWindSpeed(globalShowWindSpeed);
    if (globalRefreshInterval) setRefreshInterval((globalRefreshInterval as RefreshInterval) || "Every 1 Hour");
  }, [
    globalTempUnit,
    globalForecastHorizon,
    globalSevereAlerts,
    globalRainNotifications,
    globalHighPollutionAlerts,
    globalWidgetLayout,
    globalShowFeelsLike,
    globalShowWindSpeed,
    globalRefreshInterval,
  ]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Theme-aware color palette
  const colors = useMemo(() => {
    const activeAccent = accentColor || "#FF5A5F";
    const isWhiteAccent =
      activeAccent === "#FFFFFF" ||
      activeAccent === "#ffffff" ||
      activeAccent?.toLowerCase() === "#ffffff";
    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = isWhiteAccent
      ? (isDark ? "#FFFFFF" : "#111827")
      : activeAccent;

    return {
      bg: themeColors?.background ?? (isDark ? "#000000" : "#F4F5F7"),
      card: themeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardBorder: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
      textPrimary: themeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      greyishWhite,
      accent: activeAccent,
      onAccent: onAccentTextColor || "#FFFFFF",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "#202024" : "#E8EAEE",
      segmentActiveBg: isDark ? "#2C2C32" : "#FFFFFF",
      switchActive: activeAccent,
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      activeText: activeText,
      insetBg: isDark ? "#1F1F24" : "#F8FAFC",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.14)" : "rgba(16, 185, 129, 0.1)",
      badgeText: "#10B981",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, accentColor, onAccentTextColor, themeColors]);

  // Synchronize preferences across AppSettingsContext, AsyncStorage, and Firestore
  const syncPreference = useCallback(
    (field: string, value: any) => {
      // 1. Immediately update reactive context across the application
      updateWeatherPreferences({ [field]: value });

      // 2. Persist locally to AsyncStorage
      AsyncStorage.getItem("@bunkmates_weather_preferences")
        .then((current) => {
          const currentObj = current ? JSON.parse(current) : {};
          currentObj[field] = value;
          AsyncStorage.setItem(
            "@bunkmates_weather_preferences",
            JSON.stringify(currentObj)
          ).catch(() => {});
        })
        .catch(() => {});

      // 3. Persist to Firestore user profile in background
      if (user?.uid) {
        updateDoc(doc(db, "users", user.uid), {
          [`weatherPreferences.${field}`]: value,
          updatedAt: new Date(),
        }).catch((e) => {
          console.log(`Failed to update weatherPreferences.${field}:`, e);
        });
      }
    },
    [user, updateWeatherPreferences]
  );

  const handleSelectTempUnit = (unit: TempUnit) => {
    triggerHaptic();
    setTempUnit(unit);
    syncPreference("tempUnit", unit);
    setTempModalVisible(false);
    triggerToast(
      unit === "°C"
        ? "Celsius (°C) & km/h active"
        : "Fahrenheit (°F) & mph active"
    );
  };

  const handleSelectForecastHorizon = (horizon: ForecastHorizon) => {
    triggerHaptic();
    setForecastHorizon(horizon);
    syncPreference("forecastHorizon", horizon);
    triggerToast(`Forecast horizon set to ${horizon}`);
  };

  const handleToggleSevereAlerts = (val: boolean) => {
    triggerHaptic();
    setSevereAlerts(val);
    syncPreference("severeAlerts", val);
    triggerToast(val ? "Severe weather warnings active" : "Severe weather warnings muted");
  };

  const handleToggleRainNotifications = (val: boolean) => {
    triggerHaptic();
    setRainNotifications(val);
    syncPreference("rainNotifications", val);
    triggerToast(val ? "Precipitation alerts enabled" : "Precipitation alerts muted");
  };

  const handleToggleHighPollutionAlerts = (val: boolean) => {
    triggerHaptic();
    setHighPollutionAlerts(val);
    syncPreference("highPollutionAlerts", val);
    triggerToast(val ? "AQI pollution warnings enabled" : "AQI warnings muted");
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      {/* ── Top Header matching Settings page ── */}
      {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask */}
      <SettingsHeaderGradientMask
        backgroundColor={colors.bg}
        zIndex={15}
      />

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
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {t("Weather & Alerts", "Weather & Alerts")}
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. WEATHER UNITS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("WEATHER UNITS", "WEATHER UNITS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Temperature & Wind Unit Row */}
          <Pressable
            style={({ pressed }) => [styles.row, ]}
            onPress={() => setTempModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Temperature and wind units"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="thermometer-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Temperature Unit", "Temperature Unit")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {tempUnit === "°C" ? "Celsius (°C) • Wind in km/h" : "Fahrenheit (°F) • Wind in mph"}
              </Text>
            </View>
            <Text style={[styles.rowValueText, { color: colors.activeText }]}>
              {tempUnit}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Forecast Horizon Length */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>
              {t("Forecast Horizon", "Forecast Horizon")}
            </Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
              {FORECAST_HORIZONS.map((h) => {
                const isSelected = forecastHorizon === h;
                return (
                  <Pressable
                    key={h}
                    style={[
                      styles.segmentItem,
                      isSelected && [
                        styles.segmentItemActive,
                        { backgroundColor: colors.segmentActiveBg },
                      ],
                    ]}
                    onPress={() => handleSelectForecastHorizon(h)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {t(h)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 2. ACTIVE WEATHER & ENVIRONMENTAL ALERTS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("WEATHER & ENVIRONMENTAL ALERTS", "WEATHER & ENVIRONMENTAL ALERTS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Severe Weather Alerts */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => handleToggleSevereAlerts(!severeAlerts)}
            accessibilityRole="switch"
            accessibilityState={{ checked: severeAlerts }}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="thunderstorm-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Severe Weather Advisories", "Severe Weather Advisories")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t(
                  "Alerts & banners for storms, squalls, tornado warnings & severe wind",
                  "Alerts & banners for storms, squalls, tornado warnings & severe wind"
                )}
              </Text>
            </View>
            <BunkmatesAnimatedSwitch
              value={severeAlerts}
              onValueChange={handleToggleSevereAlerts}
              pointerEvents="none"
              accessibilityLabel="Toggle Severe Weather Advisories"
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Rain Notifications */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => handleToggleRainNotifications(!rainNotifications)}
            accessibilityRole="switch"
            accessibilityState={{ checked: rainNotifications }}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="rainy-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Precipitation & Rain Alerts", "Precipitation & Rain Alerts")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t(
                  "15-minute advance notice before active rainfall begins",
                  "15-minute advance notice before active rainfall begins"
                )}
              </Text>
            </View>
            <BunkmatesAnimatedSwitch
              value={rainNotifications}
              onValueChange={handleToggleRainNotifications}
              pointerEvents="none"
              accessibilityLabel="Toggle Precipitation Alerts"
            />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* High Pollution Alerts */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => handleToggleHighPollutionAlerts(!highPollutionAlerts)}
            accessibilityRole="switch"
            accessibilityState={{ checked: highPollutionAlerts }}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("High Pollution Warnings", "High Pollution Warnings")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t(
                  "Health notifications when AQI exceeds Moderate threshold (>100)",
                  "Health notifications when AQI exceeds Moderate threshold (>100)"
                )}
              </Text>
            </View>
            <BunkmatesAnimatedSwitch
              value={highPollutionAlerts}
              onValueChange={handleToggleHighPollutionAlerts}
              pointerEvents="none"
              accessibilityLabel="Toggle High Pollution Warnings"
            />
          </Pressable>
        </View>

        {/* ── 3. HOME WEATHER WIDGET & AUTO-REFRESH ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("HOME WEATHER WIDGET", "HOME WEATHER WIDGET")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Widget Layout & Data Chips Configuration */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setWidgetModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Widget Preferences"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="apps-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t("Widget Preferences", "Widget Preferences")}
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {`${widgetLayout} • ${showFeelsLike ? "Feels Like" : ""} ${
                  showWindSpeed ? "• Wind" : ""
                }`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Auto Refresh Interval */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>
              {t("Auto-Refresh Interval", "Auto-Refresh Interval")}
            </Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
              {REFRESH_INTERVALS.map((intv) => {
                const isSelected = refreshInterval === intv;
                return (
                  <Pressable
                    key={intv}
                    style={[
                      styles.segmentItem,
                      isSelected && [
                        styles.segmentItemActive,
                        { backgroundColor: colors.segmentActiveBg },
                      ],
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setRefreshInterval(intv);
                      syncPreference("refreshInterval", intv);
                      triggerToast(`Weather refresh: ${intv}`);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isSelected
                          ? [styles.segmentTextActive, { color: colors.activeText }]
                          : { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {intv.replace("Every ", "")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 4. AIR QUALITY & MONITORING ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("AIR QUALITY & STATIONS", "AIR QUALITY & STATIONS")}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/aqi" as any)}
            accessibilityRole="button"
            accessibilityLabel="Live Air Quality Station"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="speedometer-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <View style={styles.badgeRow}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Air Quality Index (AQI)", "Air Quality Index (AQI)")}
                </Text>
                <View style={[styles.aqiBadge, { backgroundColor: colors.badgeBg }]}>
                  <Text style={[styles.aqiBadgeText, { color: colors.badgeText }]}>
                    {t("Active Monitoring", "Active Monitoring")}
                  </Text>
                </View>
              </View>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {t(
                  "EPA standard PM2.5, PM10, Ozone & live regional monitoring",
                  "EPA standard PM2.5, PM10, Ozone & live regional monitoring"
                )}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Floating Confirmation Toast ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.toastText, { color: colors.toastText }]}>
            {toastMessage}
          </Text>
        </Animated.View>
      )}

      {/* ── 1. Temperature Units Modal ── */}
      <SwipeableDrawer
        visible={tempModalVisible}
        onClose={() => setTempModalVisible(false)}
        sheetStyle={[styles.drawerSheet, { backgroundColor: colors.card }]}
        handleColor={isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.2)"}
      >
        <View style={styles.drawerInner}>
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
              <Ionicons
                name="thermometer-outline"
                size={22}
                color={colors.greyishWhite}
              />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t("Temperature Units", "Temperature Units")}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t(
                "Choose the unit standard used for temperatures and wind speed across the entire app.",
                "Choose the unit standard used for temperatures and wind speed across the entire app."
              )}
            </Text>

            <View style={styles.modalListColumn}>
              {TEMP_OPTIONS.map((opt) => {
                const isSelected = tempUnit === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.modalOptionItem,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(0, 0, 0, 0.06)"
                          : colors.insetBg,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectTempUnit(opt.id)}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          style={[
                            styles.modalOptionText,
                            {
                              color: isSelected
                                ? colors.activeText
                                : colors.textPrimary,
                              fontWeight: isSelected ? "700" : "600",
                            },
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: colors.iconBoxBg,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "600",
                              color: colors.textSecondary,
                            }}
                          >
                            {opt.badge}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.modalOptionSub,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t(opt.desc)}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.activeText}
                      />
                    ) : (
                      <Ionicons
                        name="ellipse-outline"
                        size={22}
                        color={colors.chevron}
                      />
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
              onPress={() => setTempModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>
                {t("Close", "Close")}
              </Text>
            </Pressable>
        </View>
      </SwipeableDrawer>

      {/* ── 2. Widget Preferences Swipeable Drawer ── */}
      <SwipeableDrawer
        visible={widgetModalVisible}
        onClose={() => setWidgetModalVisible(false)}
        sheetStyle={[styles.drawerSheet, { backgroundColor: colors.card }]}
        handleColor={isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.2)"}
      >
        <View style={styles.drawerInner}>
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
              <Ionicons name="apps-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t("Home Widget Preferences", "Home Widget Preferences")}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {t(
                "Customize the home screen weather card appearance and data chips.",
                "Customize the home screen weather card appearance and data chips."
              )}
            </Text>

            {/* Layout switch */}
            <View style={styles.widgetControlGroup}>
              <Text style={[styles.widgetGroupLabel, { color: colors.textPrimary }]}>
                {t("Card Layout", "Card Layout")}
              </Text>
              <View style={styles.modalListColumn}>
                {(["Detailed Card", "Compact Tile"] as WidgetLayout[]).map((layout) => {
                  const isSelected = widgetLayout === layout;
                  return (
                    <Pressable
                      key={layout}
                      style={({ pressed }) => [
                        styles.modalOptionItem,
                        {
                          backgroundColor: isSelected ? colors.insetBg : colors.iconBoxBg,
                          borderColor: isSelected ? colors.activeText : "transparent",
                          borderWidth: 1,
                        },
                        pressed && styles.pressed,
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setWidgetLayout(layout);
                        syncPreference("widgetLayout", layout);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          {
                            color: isSelected ? colors.activeText : colors.textPrimary,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {t(layout)}
                      </Text>
                      {isSelected && (
                        <Feather name="check" size={18} color={colors.activeText} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Data Chip Toggles */}
              <Pressable
                style={({ pressed }) => [styles.widgetToggleRow, pressed && styles.pressed]}
                onPress={() => {
                  const v = !showFeelsLike;
                  triggerHaptic();
                  setShowFeelsLike(v);
                  syncPreference("showFeelsLike", v);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: showFeelsLike }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.widgetToggleLabel, { color: colors.textPrimary }]}>
                    {t("Feels-Like Temperature", "Feels-Like Temperature")}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 1 }}>
                    Show apparent temperature metric chip
                  </Text>
                </View>
                <BunkmatesAnimatedSwitch
                  value={showFeelsLike}
                  onValueChange={(v) => {
                    triggerHaptic();
                    setShowFeelsLike(v);
                    syncPreference("showFeelsLike", v);
                  }}
                  pointerEvents="none"
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.widgetToggleRow, pressed && styles.pressed]}
                onPress={() => {
                  const v = !showWindSpeed;
                  triggerHaptic();
                  setShowWindSpeed(v);
                  syncPreference("showWindSpeed", v);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: showWindSpeed }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.widgetToggleLabel, { color: colors.textPrimary }]}>
                    {t("Live Wind Speed", "Live Wind Speed")}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginTop: 1 }}>
                    Show wind speed in {tempUnit === "°C" ? "km/h" : "mph"}
                  </Text>
                </View>
                <BunkmatesAnimatedSwitch
                  value={showWindSpeed}
                  onValueChange={(v) => {
                    triggerHaptic();
                    setShowWindSpeed(v);
                    syncPreference("showWindSpeed", v);
                  }}
                  pointerEvents="none"
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setWidgetModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>
                {t("Done", "Done")}
              </Text>
            </Pressable>
        </View>
      </SwipeableDrawer>
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
    borderRadius: 28,
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
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // AQI Badge
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aqiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aqiBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
  widgetControlGroup: {
    width: "100%",
    marginBottom: 16,
  },
  widgetGroupLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    marginBottom: 8,
  },
  widgetToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  widgetToggleLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalCloseBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  drawerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  drawerInner: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 8,
  },
});
