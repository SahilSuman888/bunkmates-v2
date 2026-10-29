// **@** QR Code Scanner for Device Pairing (Method A: WhatsApp-style camera scan)
// Built with expo-camera CameraView, animated corner brackets, scan line laser,
// dynamic theme integration, and instant approval confirmation drawer.
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useUser } from "../../../contexts/UserContext";
import { useThemeToggle } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import {
  parseQRPairingPayload,
  getPairingSession,
  approvePairingSession,
  DevicePairingSession,
} from "../../../lib/devicePairing";
import { getPersistentDeviceId, getDeviceHardwareInfo } from "../../../utils/sessionTracker";
import { SwipeableDrawer } from "../_components/SwipeableDrawer";
import { SettingsHeaderGradientMask } from "../_components/SettingsHeaderGradientMask";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

export default function ScanQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const hasScannedRef = React.useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pairing session detected
  const [pendingSession, setPendingSession] = useState<DevicePairingSession | null>(null);

  // Theme integration
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  let scaleFont = (size: number) => size;
  let onAccentTextColor = "#FFFFFF";
  let accentTextColor = "#FF5A5F";
  let isDark = true;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      isDark = themeContext.isDark ?? true;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
      scaleFont = themeContext.scaleFont || ((s: number) => s);
      onAccentTextColor = themeContext.onAccentTextColor || "#FFFFFF";
      accentTextColor = themeContext.accentTextColor || dynamicAccent;
    }
  } catch {}

  const isWhiteAccent =
    dynamicAccent === "white" ||
    dynamicAccent === "navWhite" ||
    dynamicAccent === "#FFFFFF" ||
    dynamicAccent === "#ffffff" ||
    dynamicAccent?.toLowerCase() === "#ffffff";

  const accentBtnBorder = isWhiteAccent && !isDark ? "rgba(0, 0, 0, 0.20)" : "transparent";

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Scanning laser beam animation
  const laserTranslateY = useSharedValue(0);

  useEffect(() => {
    laserTranslateY.value = withRepeat(
      withTiming(SCAN_FRAME_SIZE - 4, {
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, []);

  const animatedLaserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserTranslateY.value }],
  }));

  // Handle scanned barcode data
  const handleBarcodeScanned = async (data: string) => {
    if (hasScannedRef.current || scanned || isProcessing || pendingSession !== null) return;
    hasScannedRef.current = true;
    setScanned(true);
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { pairingId } = parseQRPairingPayload(data);
      router.replace({
        pathname: "/qr-login",
        params: { session: pairingId },
      } as any);
      return;
    } catch (err: any) {
      setErrorMessage(err?.message || "Invalid or unreadable QR code.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => {
        hasScannedRef.current = false;
        setScanned(false);
        setIsProcessing(false);
      }, 2500);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm and approve pairing
  const handleApprovePairing = async () => {
    if (!pendingSession || !user) return;
    setIsApproving(true);
    try {
      const primaryDeviceId = await getPersistentDeviceId();
      const hardware = getDeviceHardwareInfo(user.displayName || undefined);

      await approvePairingSession({
        pairingId: pendingSession.id,
        primaryUid: user.uid,
        primaryDeviceId,
        primaryDeviceName: hardware.name,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingSession(null);
      router.replace("/settings/linked-devices" as any);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to link device.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsApproving(false);
    }
  };

  const getDeviceIcon = (type?: string, size = 32, iconColor = accentTextColor) => {
    switch (type) {
      case "desktop":
      case "web":
        return <MaterialCommunityIcons name="laptop" size={size} color={iconColor} />;
      case "tablet":
        return <MaterialCommunityIcons name="tablet" size={size} color={iconColor} />;
      default:
        return <MaterialCommunityIcons name="cellphone" size={size} color={iconColor} />;
    }
  };

  // Render permission request screen
  if (!permission?.granted) {
    return (
      <View style={[styles.root, { backgroundColor: "#000000" }]}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
              styles.headerBackBtn,
              {
                backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
                boxShadow: isDark
                  ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                  : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
              pressed && { opacity: 0.7 },
            ]}
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.headerTitle, { fontSize: scaleFont(18) }]}>
              {t("Scan QR Code")}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.permissionContent}>
            <View style={[styles.permIconCircle, { backgroundColor: isWhiteAccent ? "rgba(255, 255, 255, 0.16)" : hexToRgba(dynamicAccent, 0.14) }]}>
              <Feather name="camera" size={44} color={isWhiteAccent ? "#FFFFFF" : dynamicAccent} />
            </View>
            <Text style={[styles.permTitle, { fontSize: scaleFont(20) }]}>
              {t("Camera Access Required")}
            </Text>
            <Text style={[styles.permDesc, { fontSize: scaleFont(14) }]}>
              {t("To link your computer, tablet, or secondary phone, allow BunkMates access to scan the pairing QR code.")}
            </Text>
            <Pressable
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: dynamicAccent,
                  borderWidth: accentBtnBorder !== "transparent" ? 1 : 0,
                  borderColor: accentBtnBorder,
                },
              ]}
              onPress={requestPermission}
            >
              <Text style={[styles.primaryActionBtnText, { color: onAccentTextColor, fontSize: scaleFont(15) }]}>
                {t("Continue")}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* FULL SCREEN CAMERA VIEW */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={scanned || pendingSession !== null ? undefined : { barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned || pendingSession !== null ? undefined : ({ data }) => handleBarcodeScanned(data)}
      />

      {/* DARK TRANSLUCENT OVERLAY MASK WITH TRANSPARENT SCANNER FRAME */}
      <View style={StyleSheet.absoluteFill}>
        {/* Top mask */}
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />

        {/* Center row with scan window */}
        <View style={{ flexDirection: "row", height: SCAN_FRAME_SIZE }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />

          {/* Transparent Center Frame with Corner Brackets */}
          <View style={{ width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE, position: "relative" }}>
            {/* Top-Left Corner */}
            <View
              style={[
                styles.cornerBracket,
                { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderColor: dynamicAccent },
              ]}
            />
            {/* Top-Right Corner */}
            <View
              style={[
                styles.cornerBracket,
                { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderColor: dynamicAccent },
              ]}
            />
            {/* Bottom-Left Corner */}
            <View
              style={[
                styles.cornerBracket,
                { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: dynamicAccent },
              ]}
            />
            {/* Bottom-Right Corner */}
            <View
              style={[
                styles.cornerBracket,
                { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderColor: dynamicAccent },
              ]}
            />

            {/* Red/Coral Animated Scanning Laser Line */}
            {!scanned && (
              <Animated.View
                style={[
                  styles.laserLine,
                  { backgroundColor: dynamicAccent, shadowColor: dynamicAccent },
                  animatedLaserStyle,
                ]}
              />
            )}

            {isProcessing && (
              <View style={styles.frameSpinnerWrap}>
                <ActivityIndicator size="large" color={dynamicAccent} />
              </View>
            )}
          </View>

          <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />
        </View>

        {/* Bottom mask */}
        <View style={{ flex: 1.2, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />
      </View>

      {/* FOREGROUND CONTROLS & HEADERS */}
      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Navigation */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerBackBtn}
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontSize: scaleFont(18) }]}>
            {t("Scan QR Code")}
          </Text>
          <Pressable
            onPress={() => setTorch(!torch)}
            style={[styles.torchBtn, torch && { backgroundColor: "rgba(255, 255, 255, 0.3)" }]}
            accessibilityLabel="Toggle Torch"
          >
            <Ionicons name={torch ? "flash" : "flash-off"} size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Error Notification Pill */}
        {errorMessage && (
          <View style={styles.errorBannerWrap}>
            <View style={[styles.errorPill, { backgroundColor: "rgba(239, 68, 68, 0.92)" }]}>
              <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
              <Text style={[styles.errorPillText, { fontSize: scaleFont(12.5) }]}>
                {errorMessage}
              </Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Bottom Helper Card */}
        <View style={styles.bottomCardWrap}>
          <Text style={[styles.bottomHelperText, { fontSize: scaleFont(13.5) }]}>
            {t("Point your camera at the QR code displayed on web.bunkmates.com or your other device.")}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.pairingCodeAltBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.push("/settings/linked-devices/enter-code" as any)}
          >
            <Text style={[styles.pairingCodeAltText, { color: isWhiteAccent ? "#FFFFFF" : dynamicAccent, fontSize: scaleFont(14) }]}>
              {t("Link with pairing code instead →")}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── APPROVAL CONFIRMATION DRAWER (Swipeable Drawer) ── */}
      <SwipeableDrawer
        visible={pendingSession !== null}
        onClose={() => {
          setPendingSession(null);
          setTimeout(() => {
            hasScannedRef.current = false;
            setScanned(false);
          }, 800);
        }}
        sheetStyle={styles.drawerSheet}
      >
        {pendingSession && (
          <View style={styles.drawerContent}>
            <View style={[styles.drawerIconBox, { backgroundColor: isWhiteAccent ? "rgba(255, 255, 255, 0.16)" : hexToRgba(dynamicAccent, 0.14) }]}>
              {getDeviceIcon(pendingSession.requesterMetadata?.deviceType, 32, isWhiteAccent ? "#FFFFFF" : dynamicAccent)}
            </View>

            <Text style={[styles.drawerTitle, { fontSize: scaleFont(20) }]}>
              {t("Link This Device?")}
            </Text>
            <Text style={[styles.drawerSubtitle, { fontSize: scaleFont(13) }]}>
              {t("This secondary client will have secure, synchronized access to your BunkMates messages, trips, and account.")}
            </Text>

            {/* Device Info Summary Card */}
            <View style={styles.deviceMetaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("Device")}</Text>
                <Text style={styles.metaValue}>
                  {pendingSession.requesterMetadata?.deviceName || "Personal Computer"}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("OS & Client")}</Text>
                <Text style={styles.metaValue}>
                  {pendingSession.requesterMetadata?.os || "Desktop Browser"}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t("Location")}</Text>
                <Text style={styles.metaValue}>
                  {pendingSession.requesterMetadata?.location || "Nearby"}
                </Text>
              </View>
            </View>

            {/* Buttons Row */}
            <View style={styles.drawerBtnRow}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setPendingSession(null);
                  setScanned(false);
                }}
                disabled={isApproving}
              >
                <Text style={[styles.cancelBtnText, { fontSize: scaleFont(14) }]}>
                  {t("Cancel")}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.approveBtn,
                  {
                    backgroundColor: dynamicAccent,
                    borderWidth: accentBtnBorder !== "transparent" ? 1 : 0,
                    borderColor: accentBtnBorder,
                  },
                ]}
                onPress={handleApprovePairing}
                disabled={isApproving}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color={onAccentTextColor} />
                ) : (
                  <Text style={[styles.approveBtnText, { color: onAccentTextColor, fontSize: scaleFont(15) }]}>
                    {t("Link Device")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </SwipeableDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    height: 52,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  torchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  permissionContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  permIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  permDesc: {
    color: "#A0A0A0",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryActionBtn: {
    height: 50,
    width: "100%",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cornerBracket: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  laserLine: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  frameSpinnerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  errorBannerWrap: {
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 20,
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 8,
  },
  errorPillText: {
    color: "#FFFFFF",
    fontWeight: "600",
    flexShrink: 1,
  },
  bottomCardWrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 24 : 32,
    alignItems: "center",
  },
  bottomHelperText: {
    color: "#E2E8F0",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  pairingCodeAltBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pairingCodeAltText: {
    fontWeight: "600",
  },
  drawerSheet: {
    backgroundColor: "#161618",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  drawerContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 8,
  },
  drawerIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  drawerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  drawerSubtitle: {
    color: "#A0A0A0",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  deviceMetaCard: {
    width: "100%",
    backgroundColor: "#1F1F23",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  metaLabel: {
    color: "#8E95A2",
    fontSize: 13,
    fontWeight: "500",
  },
  metaValue: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "600",
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2A2A2E",
  },
  drawerBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#242428",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  approveBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  approveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
