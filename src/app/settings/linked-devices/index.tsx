// **@** Linked Devices Main Hub — WhatsApp-style multi-device session management
// 0ms offline hydration via AsyncStorage, live Firestore snapshot sync,
// two-tap pairing selection (QR scan or Pairing Code), and real-time revocation.
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsHeaderGradientMask } from "../_components/SettingsHeaderGradientMask";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useUser } from "../../../contexts/UserContext";
import { useThemeToggle } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  LinkedDevice,
  getCachedLinkedDevices,
  subscribeToLinkedDevices,
  revokeLinkedDevice,
} from "../../../lib/devicePairing";
import {
  getPersistentDeviceId,
  getDeviceHardwareInfo,
  recordDeviceSessionInFirestore,
} from "../../../utils/sessionTracker";
import { SwipeableDrawer } from "../_components/SwipeableDrawer";

export default function LinkedDevicesIndexScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { t } = useLanguage();

  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [currentHardware, setCurrentHardware] = useState<{ name: string; type: string; os: string }>({
    name: "This Phone",
    type: "phone",
    os: Platform.OS === "ios" ? "iOS" : "Android",
  });

  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drawers
  const [showPairMethodDrawer, setShowPairMethodDrawer] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<LinkedDevice | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  let scaleFont = (size: number) => size;
  let onAccentTextColor = "#FFFFFF";
  let accentTextColor = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
      scaleFont = themeContext.scaleFont || ((s: number) => s);
      onAccentTextColor = themeContext.onAccentTextColor || "#FFFFFF";
      accentTextColor = themeContext.accentTextColor || dynamicAccent;
    }
  } catch {}

  const isDark = themeMode !== "light";

  const isWhiteAccent =
    dynamicAccent === "white" ||
    dynamicAccent === "navWhite" ||
    dynamicAccent === "#FFFFFF" ||
    dynamicAccent === "#ffffff" ||
    dynamicAccent?.toLowerCase() === "#ffffff";

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const colors = useMemo(
    () => ({
      bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardElevated: dynamicThemeColors?.cardElevated ?? (isDark ? "#1C1C20" : "#F9FAFB"),
      cardBorder: isDark ? "#242428" : "#E2E8F0",
      divider: dynamicThemeColors?.divider ?? (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"),
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      coral: dynamicAccent,
      coralBg: dynamicThemeColors?.accentBg ?? (isWhiteAccent ? (isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.08)") : hexToRgba(dynamicAccent, isDark ? 0.16 : 0.09)),
      accentText: dynamicThemeColors?.accentText ?? (isWhiteAccent ? (isDark ? "#FFFFFF" : "#11141A") : dynamicAccent),
      onAccent: onAccentTextColor,
      accentBorder: isWhiteAccent && !isDark ? "rgba(0, 0, 0, 0.20)" : "transparent",
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      activeGreen: "#22C55E",
      activeGreenBg: isDark ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.10)",
    }),
    [isDark, dynamicAccent, dynamicThemeColors, isWhiteAccent, onAccentTextColor, accentTextColor]
  );

  // 1. Initialize persistent device ID & 0ms Offline Hydration
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const devId = await getPersistentDeviceId();
      if (!isMounted) return;
      setCurrentDeviceId(devId);

      const hw = getDeviceHardwareInfo(user?.displayName || undefined);
      setCurrentHardware(hw);

      // Hydrate from cache immediately for 0ms screen render
      if (user?.uid) {
        const cached = await getCachedLinkedDevices(user.uid);
        if (isMounted && cached.length > 0) {
          setDevices(cached);
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // 2. Real-time Firestore snapshot listener
  useEffect(() => {
    if (authLoading || !user?.uid || !currentDeviceId) return;

    recordDeviceSessionInFirestore(user).catch(() => {});

    const unsubscribe = subscribeToLinkedDevices(user.uid, currentDeviceId, (updatedDevices) => {
      setDevices(updatedDevices);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading, user, currentDeviceId]);

  // Refresh active sessions
  const handleManualRefresh = async () => {
    if (!user || isRefreshing) return;
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recordDeviceSessionInFirestore(user);
    } catch (e) {
      console.log("Error refreshing sessions:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Revoke selected device
  const handleConfirmRevoke = async () => {
    if (!selectedDevice || !user?.uid) return;
    const target = selectedDevice;
    setIsRevoking(true);
    setRevokeError(null);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1. Optimistic UI update: Immediately remove from local list
      setDevices((prev) =>
        prev.filter((d) => {
          if (d.id === target.id) return false;
          if (d.id.startsWith(target.id) || target.id.startsWith(d.id)) return false;
          return true;
        })
      );

      // 2. Dismiss drawer immediately for 0ms lag feedback
      setSelectedDevice(null);

      // 3. Perform atomic backend revocation
      await revokeLinkedDevice(
        user.uid,
        target.id,
        (target as any).sessionId || (target as any).pairingId
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.warn("[LinkedDevices] Revoke error:", err);
      setRevokeError(err?.message || t("Could not log out device. Please check connection."));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      handleManualRefresh();
    } finally {
      setIsRevoking(false);
    }
  };

  const getDeviceIcon = (type?: string, size: number = 22, color: string = colors.greyishWhite) => {
    switch (type) {
      case "tablet":
        return <MaterialCommunityIcons name="tablet" size={size} color={color} />;
      case "desktop":
      case "web":
        return <MaterialCommunityIcons name="laptop" size={size} color={color} />;
      default:
        return <MaterialCommunityIcons name="cellphone" size={size} color={color} />;
    }
  };

  const formatLastActive = (ts?: number, label?: string) => {
    if (!ts) return label || t("Recently");
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 2) return t("Active now");
    if (diffMin < 60) return `${diffMin}m ${t("ago")}`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ${t("ago")}`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ${t("ago")}`;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={styles.safeArea}>
        {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask */}
        <SettingsHeaderGradientMask
          backgroundColor={colors.bg}
          zIndex={15}
        />

        {/* Navigation Header */}
        <View style={[styles.header, { zIndex: 20 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
              },
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Back to Settings"
          >
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: scaleFont(18) }]}>
            {t("Linked Devices")}
          </Text>

          <Pressable
            onPress={handleManualRefresh}
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
              },
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Refresh sessions"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.coral} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={colors.textPrimary} />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── HERO BANNER: Use BunkMates on Other Devices ── */}
          <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: colors.coralBg }]}>
              <MaterialCommunityIcons name="devices" size={34} color={colors.coral} />
            </View>

            <Text style={[styles.heroTitle, { color: colors.textPrimary, fontSize: scaleFont(19) }]}>
              {t("Use BunkMates on other devices")}
            </Text>

            <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
              {t("Link web browsers, desktop computers, or tablets. Your trips, bunks & chats stay synchronized with zero data loss.")}
            </Text>

            {/* "Link a Device" Primary Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.linkDeviceCta,
                {
                  backgroundColor: colors.coral,
                  borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                  borderColor: colors.accentBorder,
                },
                pressed && { opacity: 0.88 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPairMethodDrawer(true);
              }}
            >
              <Ionicons name="add-circle" size={19} color={colors.onAccent} style={{ marginRight: 6 }} />
              <Text style={[styles.linkDeviceCtaText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                {t("Link a Device")}
              </Text>
            </Pressable>
          </View>

          {/* ── SECTION: CURRENT THIS DEVICE ── */}
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12) }]}>
            {t("THIS DEVICE")}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.deviceRow}>
              <View style={[styles.deviceIconCircle, { backgroundColor: colors.activeGreenBg }]}>
                {getDeviceIcon(currentHardware.type, 22, colors.activeGreen)}
              </View>
              <View style={styles.deviceMid}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.deviceTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                    {currentHardware.name}
                  </Text>
                  <View style={[styles.thisDevicePill, { backgroundColor: colors.activeGreenBg }]}>
                    <View style={[styles.onlineDot, { backgroundColor: colors.activeGreen }]} />
                    <Text style={[styles.thisDevicePillText, { color: colors.activeGreen }]}>
                      {t("This phone")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.deviceSub, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                  {currentHardware.os} • {t("Primary Active Session")}
                </Text>
              </View>
            </View>
          </View>

          {/* ── SECTION: LINKED SECONDARY SESSIONS ── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.sectionHeader, fontSize: scaleFont(12), marginTop: 0 }]}>
              {t("LINKED DEVICES & ACTIVE SESSIONS")}
            </Text>
            <Text style={[styles.sectionCountText, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
              {devices.filter((d) => !d.isCurrentDevice).length} {t("Linked")}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.coral} />
                <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                  {t("Syncing linked devices...")}
                </Text>
              </View>
            ) : devices.filter((d) => !d.isCurrentDevice).length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="laptop-off" size={40} color={colors.textSecondary} style={{ opacity: 0.6 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                  {t("No secondary devices linked")}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]}>
                  {t("Tap \"Link a Device\" above to connect your web browser, tablet, or desktop.")}
                </Text>
              </View>
            ) : (
              devices
                .filter((d) => !d.isCurrentDevice)
                .map((device, index, arr) => {
                  const isOnline = Date.now() - (device.lastActiveTimestamp || 0) < 5 * 60 * 1000;
                  return (
                    <React.Fragment key={device.id}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.deviceRow,
                          pressed && { backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)" },
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedDevice(device);
                        }}
                      >
                        <View style={[styles.deviceIconCircle, { backgroundColor: colors.iconBoxBg }]}>
                          {getDeviceIcon(device.deviceType, 22, colors.textPrimary)}
                        </View>

                        <View style={styles.deviceMid}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text
                              style={[styles.deviceTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}
                              numberOfLines={1}
                            >
                              {device.deviceName}
                            </Text>
                            {device.pairingMethod && (
                              <Text style={[styles.methodBadge, { color: colors.textSecondary }]}>
                                {device.pairingMethod === "qr" ? "QR" : "Code"}
                              </Text>
                            )}
                          </View>

                          <View style={styles.statusMetaRow}>
                            <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.activeGreen : colors.textSecondary }]} />
                            <Text style={[styles.deviceSub, { color: isOnline ? colors.activeGreen : colors.textSecondary, fontSize: scaleFont(12) }]}>
                              {formatLastActive(device.lastActiveTimestamp, device.lastActive)}
                            </Text>
                            <Text style={[styles.dotSep, { color: colors.textSecondary }]}>•</Text>
                            <Text style={[styles.deviceSub, { color: colors.textSecondary, fontSize: scaleFont(12) }]} numberOfLines={1}>
                              {device.location || device.os}
                            </Text>
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ opacity: 0.6 }} />
                      </Pressable>

                      {index < arr.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                      )}
                    </React.Fragment>
                  );
                })
            )}
          </View>
        </ScrollView>

        {/* ── DRAWER: PAIRING METHOD SELECTION ── */}
        <SwipeableDrawer
          visible={showPairMethodDrawer}
          onClose={() => setShowPairMethodDrawer(false)}
          sheetStyle={[styles.drawerSheet, { backgroundColor: colors.card }]}
        >
          <View style={styles.drawerInner}>
            <Text style={[styles.drawerTitle, { color: colors.textPrimary, fontSize: scaleFont(19) }]}>
              {t("Link a New Device")}
            </Text>
            <Text style={[styles.drawerSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
              {t("Choose how you want to pair your secondary client:")}
            </Text>

            {/* Option A: Scan QR Code */}
            <Pressable
              style={({ pressed }) => [
                styles.pairOptionCard,
                { backgroundColor: colors.cardElevated },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setShowPairMethodDrawer(false);
                router.push("/qr-login" as any);
              }}
            >
              <View style={[styles.pairOptionIcon, { backgroundColor: colors.coralBg }]}>
                <Ionicons name="qr-code-outline" size={26} color={colors.accentText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pairOptionTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                  {t("Scan QR to Log In")}
                </Text>
                <Text style={[styles.pairOptionSub, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]}>
                  {t("Point your camera at the QR code displayed on web or desktop")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>

            {/* Option B: Enter Pairing Code */}
            <Pressable
              style={({ pressed }) => [
                styles.pairOptionCard,
                { backgroundColor: colors.cardElevated },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setShowPairMethodDrawer(false);
                router.push("/settings/linked-devices/enter-code" as any);
              }}
            >
              <View style={[styles.pairOptionIcon, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
                <Ionicons name="keypad-outline" size={26} color={colors.activeGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pairOptionTitle, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                  {t("Link with Pairing Code")}
                </Text>
                <Text style={[styles.pairOptionSub, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]}>
                  {t("Enter the 8-character pairing code shown on your other device")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </SwipeableDrawer>

        {/* ── DRAWER: DEVICE DETAILS & LOGOUT / REVOCATION ── */}
        <SwipeableDrawer
          visible={selectedDevice !== null}
          onClose={() => {
            setSelectedDevice(null);
            setRevokeError(null);
          }}
          sheetStyle={[styles.drawerSheet, { backgroundColor: colors.card }]}
        >
          {selectedDevice && (
            <View style={styles.drawerInner}>
              <View style={[styles.deviceDetailIconCircle, { backgroundColor: colors.coralBg }]}>
                {getDeviceIcon(selectedDevice.deviceType, 32, colors.accentText)}
              </View>

              <Text style={[styles.drawerTitle, { color: colors.textPrimary, fontSize: scaleFont(19) }]}>
                {selectedDevice.deviceName}
              </Text>

              <Text style={[styles.drawerSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                {selectedDevice.os} • {selectedDevice.browser || selectedDevice.deviceType}
              </Text>

              {/* Metadata Card */}
              <View style={[styles.detailMetaCard, { backgroundColor: colors.cardElevated }]}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t("Last Active")}
                  </Text>
                  <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                    {formatLastActive(selectedDevice.lastActiveTimestamp, selectedDevice.lastActive)}
                  </Text>
                </View>
                <View style={[styles.metaDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t("Location / IP")}
                  </Text>
                  <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                    {selectedDevice.location}
                  </Text>
                </View>
                <View style={[styles.metaDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t("Pairing Method")}
                  </Text>
                  <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                    {selectedDevice.pairingMethod === "code" ? t("8-Character Code") : t("QR Code Scan")}
                  </Text>
                </View>
              </View>

              {revokeError && (
                <View style={[styles.errorPill, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.08)" }]}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={[styles.errorPillText, { color: "#EF4444" }]}>
                    {revokeError}
                  </Text>
                </View>
              )}

              {/* Log Out CTA */}
              <Pressable
                style={({ pressed }) => [
                  styles.logoutBtn,
                  {
                    backgroundColor: colors.coral,
                    borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                    borderColor: colors.accentBorder,
                  },
                  pressed && { opacity: 0.88 },
                ]}
                onPress={handleConfirmRevoke}
                disabled={isRevoking}
              >
                {isRevoking ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="log-out-outline" size={19} color={colors.onAccent} style={{ marginRight: 6 }} />
                    <Text style={[styles.logoutBtnText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                      {t("Log Out This Device")}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </SwipeableDrawer>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    height: 52,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.75,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 48,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 8,
    textAlign: "center",
  },
  heroSubtitle: {
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  linkDeviceCta: {
    height: 48,
    width: "100%",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  linkDeviceCtaText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionHeading: {
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCountText: {
    fontWeight: "600",
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  deviceMid: {
    flex: 1,
  },
  deviceTitle: {
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  deviceSub: {
    marginTop: 2,
  },
  thisDevicePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  thisDevicePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dotSep: {
    marginHorizontal: 5,
    fontSize: 10,
  },
  methodBadge: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontWeight: "500",
  },
  emptyWrap: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontWeight: "700",
    marginTop: 4,
  },
  emptySub: {
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  drawerSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  drawerInner: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  drawerTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 6,
    textAlign: "center",
  },
  drawerSubtitle: {
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  pairOptionCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    marginBottom: 12,
  },
  pairOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  pairOptionTitle: {
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  pairOptionSub: {
    lineHeight: 17,
  },
  deviceDetailIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  detailMetaCard: {
    width: "100%",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaVal: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    marginBottom: 14,
    width: "100%",
  },
  errorPillText: {
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  logoutBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
