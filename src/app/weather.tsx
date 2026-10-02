// **@** Weather & AQI Settings — Pixel-perfect UI matching Settings design system with greyish-white accents, circular back button, dynamic theme adaptability (zero red), and real Firestore persistence
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
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { ACCENT_COLORS } from "../theme/theme";

type TempUnit = "°F" | "°C" | "K";
type ForecastHorizon = "3 Days" | "5 Days" | "7 Days" | "10 Days";
type WidgetLayout = "Compact Tile" | "Detailed Card";
type RefreshInterval = "Every 30 mins" | "Every 1 Hour" | "Every 3 Hours";

interface TempOption {
  id: TempUnit;
  label: string;
  desc: string;
}

const TEMP_OPTIONS: TempOption[] = [
  { id: "°F", label: "Fahrenheit (°F)", desc: "Imperial temperature standard used in USA" },
  { id: "°C", label: "Celsius (°C)", desc: "Metric standard adopted across Europe and Asia" },
  { id: "K", label: "Kelvin (K)", desc: "Scientific absolute temperature scale" },
];

const FORECAST_HORIZONS: ForecastHorizon[] = ["3 Days", "5 Days", "7 Days", "10 Days"];

export default function WeatherSettings() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States matching reference image defaults
  const [tempUnit, setTempUnit] = useState<TempUnit>("°F");
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>("7 Days");
  const [severeAlerts, setSevereAlerts] = useState<boolean>(true);
  const [rainNotifications, setRainNotifications] = useState<boolean>(true);
  const [uvAlerts, setUvAlerts] = useState<boolean>(false);

  // Display Widget states
  const [widgetLayout, setWidgetLayout] = useState<WidgetLayout>("Detailed Card");
  const [showFeelsLike, setShowFeelsLike] = useState<boolean>(true);
  const [showWindSpeed, setShowWindSpeed] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>("Every 1 Hour");

  // Included existing app features: AQI & Air Quality Monitoring
  const [highPollutionAlerts, setHighPollutionAlerts] = useState<boolean>(true);

  // Modals state
  const [tempModalVisible, setTempModalVisible] = useState(false);
  const [widgetModalVisible, setWidgetModalVisible] = useState(false);

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
      insetBg: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.08)",
      badgeBorder: isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.30)",
      badgeText: "#10B981",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, userAccent]);

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
        const cached = await AsyncStorage.getItem("@bunkmates_weather_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.tempUnit) setTempUnit(parsed.tempUnit);
          if (parsed.forecastHorizon) setForecastHorizon(parsed.forecastHorizon);
          if (parsed.severeAlerts !== undefined) setSevereAlerts(parsed.severeAlerts);
          if (parsed.rainNotifications !== undefined) setRainNotifications(parsed.rainNotifications);
          if (parsed.uvAlerts !== undefined) setUvAlerts(parsed.uvAlerts);
          if (parsed.widgetLayout) setWidgetLayout(parsed.widgetLayout);
          if (parsed.showFeelsLike !== undefined) setShowFeelsLike(parsed.showFeelsLike);
          if (parsed.showWindSpeed !== undefined) setShowWindSpeed(parsed.showWindSpeed);
          if (parsed.refreshInterval) setRefreshInterval(parsed.refreshInterval);
          if (parsed.highPollutionAlerts !== undefined) setHighPollutionAlerts(parsed.highPollutionAlerts);
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
          const p = uData.weatherPreferences || {};
          if (p.tempUnit) setTempUnit(p.tempUnit);
          if (p.forecastHorizon) setForecastHorizon(p.forecastHorizon);
          if (p.severeAlerts !== undefined) setSevereAlerts(p.severeAlerts);
          if (p.rainNotifications !== undefined) setRainNotifications(p.rainNotifications);
          if (p.uvAlerts !== undefined) setUvAlerts(p.uvAlerts);
          if (p.widgetLayout) setWidgetLayout(p.widgetLayout);
          if (p.showFeelsLike !== undefined) setShowFeelsLike(p.showFeelsLike);
          if (p.showWindSpeed !== undefined) setShowWindSpeed(p.showWindSpeed);
          if (p.refreshInterval) setRefreshInterval(p.refreshInterval);
          if (p.highPollutionAlerts !== undefined) setHighPollutionAlerts(p.highPollutionAlerts);
        }
      },
      (err) => {
        console.log("Weather preferences onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync preference helper saving to both AsyncStorage and Firestore
  const syncPreference = async (field: string, value: any) => {
    try {
      const current = await AsyncStorage.getItem("@bunkmates_weather_preferences");
      const currentObj = current ? JSON.parse(current) : {};
      currentObj[field] = value;
      await AsyncStorage.setItem(
        "@bunkmates_weather_preferences",
        JSON.stringify(currentObj)
      );
    } catch (e) {
      console.log("Failed to cache weather preferences:", e);
    }

    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`weatherPreferences.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update weatherPreferences.${field}:`, e);
    }
  };

  const handleSelectTempUnit = (unit: TempUnit) => {
    setTempUnit(unit);
    syncPreference("tempUnit", unit);
    setTempModalVisible(false);
    triggerToast(`Temperature unit: ${unit}`);
  };

  const handleSelectForecastHorizon = (horizon: ForecastHorizon) => {
    setForecastHorizon(horizon);
    syncPreference("forecastHorizon", horizon);
    triggerToast(`Forecast horizon: ${horizon}`);
  };

  const handleToggleSevereAlerts = (val: boolean) => {
    setSevereAlerts(val);
    syncPreference("severeAlerts", val);
    triggerToast(val ? "Severe weather alerts enabled" : "Severe weather alerts muted");
  };

  const handleToggleRainNotifications = (val: boolean) => {
    setRainNotifications(val);
    syncPreference("rainNotifications", val);
    triggerToast(val ? "15-min rain alerts active" : "Rain alerts disabled");
  };

  const handleToggleUvAlerts = (val: boolean) => {
    setUvAlerts(val);
    syncPreference("uvAlerts", val);
    triggerToast(val ? "UV index >6 alerts active" : "UV index alerts disabled");
  };

  const handleToggleHighPollutionAlerts = (val: boolean) => {
    setHighPollutionAlerts(val);
    syncPreference("highPollutionAlerts", val);
    triggerToast(val ? "AQI pollution warnings enabled" : "AQI warnings muted");
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
          Weather
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. PREFERENCES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Temperature Units */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setTempModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Temperature Units"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="thermometer-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Temperature Units</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Select Celsius or Fahrenheit
              </Text>
            </View>
            <Text style={[styles.rowValueText, { color: colors.textSecondary }]}>{tempUnit}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Forecast Horizon Length */}
          <View style={styles.segmentBlock}>
            <Text style={[styles.blockLabel, { color: colors.textPrimary }]}>Forecast Horizon Length</Text>
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
                      {h}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Severe Weather Alerts */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="thunderstorm-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Severe Weather Alerts</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Get notified of storms and critical updates
              </Text>
            </View>
            <Switch
              value={severeAlerts}
              onValueChange={handleToggleSevereAlerts}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Severe Weather Alerts"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Rain Notifications */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="rainy-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Rain Notifications</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Receive alerts 15m before rain starts
              </Text>
            </View>
            <Switch
              value={rainNotifications}
              onValueChange={handleToggleRainNotifications}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle Rain Notifications"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* UV Index Alerts */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="sunny-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>UV Index Alerts</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Warnings when UV index exceeds 6
              </Text>
            </View>
            <Switch
              value={uvAlerts}
              onValueChange={handleToggleUvAlerts}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle UV Index Alerts"
            />
          </View>
        </View>

        {/* ── 2. DISPLAY WIDGET ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DISPLAY WIDGET</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Widget Preferences</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Customize the home screen weather tile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── 3. AIR QUALITY & AQI (ALREADY AVAILABLE IN THE APP) ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>AIR QUALITY & POLLUTION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Link to existing AQI Detail Screen */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push("/(tabs)/aqi" as any)}
            accessibilityRole="button"
            accessibilityLabel="Air Quality Index"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="speedometer-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <View style={styles.badgeRow}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Air Quality Index (AQI)</Text>
                <View
                  style={[
                    styles.aqiBadge,
                    { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                  ]}
                >
                  <Text style={[styles.aqiBadgeText, { color: colors.badgeText }]}>AQI 70 • Moderate</Text>
                </View>
              </View>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Live station monitoring, PM2.5, PM10 & Ozone
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* High Pollution Alerts */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>High Pollution Warnings</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Notify when AQI exceeds Moderate threshold (&gt;100)
              </Text>
            </View>
            <Switch
              value={highPollutionAlerts}
              onValueChange={handleToggleHighPollutionAlerts}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Toggle High Pollution Warnings"
            />
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

      {/* ── 1. Temperature Units Modal ── */}
      <Modal
        visible={tempModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTempModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="thermometer-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Temperature Units</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Choose whether temperature values across the app are displayed in Fahrenheit or Celsius.
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
                        backgroundColor: isSelected ? colors.insetBg : "transparent",
                        borderColor: isSelected ? colors.activeBorder : colors.cardBorder,
                      },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectTempUnit(opt.id)}
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
                        {opt.label}
                      </Text>
                      <Text style={[styles.modalOptionSub, { color: colors.textSecondary }]}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.activeBorder} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setTempModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── 2. Widget Preferences Modal ── */}
      <Modal
        visible={widgetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWidgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="apps-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Home Widget Preferences</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Adjust layout and data points shown on the home screen weather tile.
            </Text>

            {/* Layout switch */}
            <View style={styles.widgetControlGroup}>
              <Text style={[styles.widgetGroupLabel, { color: colors.textPrimary }]}>Card Layout</Text>
              <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg, marginBottom: 14 }]}>
                {(["Compact Tile", "Detailed Card"] as WidgetLayout[]).map((layout) => {
                  const isSelected = widgetLayout === layout;
                  return (
                    <Pressable
                      key={layout}
                      style={[
                        styles.segmentItem,
                        isSelected && [
                          styles.segmentItemActive,
                          { backgroundColor: colors.segmentActiveBg },
                        ],
                      ]}
                      onPress={() => {
                        setWidgetLayout(layout);
                        syncPreference("widgetLayout", layout);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected
                            ? [styles.segmentTextActive, { color: colors.activeText }]
                            : { color: colors.textSecondary },
                        ]}
                      >
                        {layout}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Toggles */}
              <View style={[styles.widgetToggleRow, { borderColor: colors.divider }]}>
                <Text style={[styles.widgetToggleLabel, { color: colors.textPrimary }]}>
                  Show Feels-Like Temp & Humidity
                </Text>
                <Switch
                  value={showFeelsLike}
                  onValueChange={(v) => {
                    setShowFeelsLike(v);
                    syncPreference("showFeelsLike", v);
                  }}
                  trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.widgetToggleRow, { borderColor: colors.divider }]}>
                <Text style={[styles.widgetToggleLabel, { color: colors.textPrimary }]}>
                  Show Wind Speed & Direction
                </Text>
                <Switch
                  value={showWindSpeed}
                  onValueChange={(v) => {
                    setShowWindSpeed(v);
                    syncPreference("showWindSpeed", v);
                  }}
                  trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.insetBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setWidgetModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>Done</Text>
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
    fontWeight: "600",
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
    borderWidth: 1,
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
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
  modalListColumn: {
    width: "100%",
    gap: 8,
    marginBottom: 18,
  },
  modalOptionItem: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  widgetToggleLabel: {
    fontSize: 13,
    flex: 1,
    paddingRight: 10,
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
