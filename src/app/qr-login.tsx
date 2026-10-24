// **@** QR Login Approval Flow Screen — BunkMates Expo Application
// Handles deep links (https://bunkmates.xyz/qr-login?session=... & bunkmates://qr-login),
// in-app camera scanning, authentication preservation, and explicit desktop login approval.

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import {
  parseQRLoginPayload,
  getQRLoginSession,
  markQRLoginScanned,
  approveQRLoginRequest,
  rejectQRLoginRequest,
  subscribeToQRLoginSession,
  storePendingQRLogin,
  getPendingQRLogin,
  clearPendingQRLogin,
  QRLoginSession,
} from "../lib/qrLoginService";
import { QRLoginApprovalDrawer } from "../components/auth/QRLoginApprovalDrawer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_FRAME_SIZE = Math.min(SCREEN_WIDTH * 0.72, 280);

export default function QRLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userData, loading: authLoading } = useUser();
  const { t } = useLanguage();

  const localParams = useLocalSearchParams<Record<string, string>>();
  const globalParams = useGlobalSearchParams<Record<string, string>>();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // QR Session states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<QRLoginSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Synchronous scan locking guard to stop multiple scans & freeze when drawer opens
  const [scanned, setScanned] = useState(false);
  const hasScannedRef = useRef(false);

  // Duplicate submission guard ref
  const isSubmittingRef = useRef(false);

  // Theme configuration
  let isDark = true;
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  let scaleFont = (size: number) => size;
  let onAccentTextColor = "#FFFFFF";

  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      isDark = themeContext.isDark ?? true;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
      scaleFont = themeContext.scaleFont || ((s: number) => s);
      onAccentTextColor = themeContext.onAccentTextColor || "#FFFFFF";
    }
  } catch {}

  const isWhiteAccent =
    dynamicAccent === "white" ||
    dynamicAccent === "navWhite" ||
    dynamicAccent === "#FFFFFF" ||
    dynamicAccent?.toLowerCase() === "#ffffff";

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const colors = {
    bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
    card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
    textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
    textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
    coral: dynamicAccent,
    coralBg: isWhiteAccent
      ? (isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.08)")
      : hexToRgba(dynamicAccent, isDark ? 0.16 : 0.1),
    onAccent: onAccentTextColor,
    accentBorder: isWhiteAccent && !isDark ? "rgba(0, 0, 0, 0.20)" : "transparent",
  };

  // Laser beam animation for camera
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

  // 1. Resolve Session ID from URL search params or AsyncStorage
  useEffect(() => {
    let resolvedId: string | null = null;

    const rawParam =
      localParams?.session ||
      localParams?.sessionId ||
      localParams?.id ||
      localParams?.pairingId ||
      globalParams?.session ||
      globalParams?.sessionId ||
      globalParams?.id ||
      globalParams?.pairingId;

    if (rawParam && typeof rawParam === "string") {
      try {
        const parsed = parseQRLoginPayload(rawParam);
        resolvedId = parsed.sessionId;
      } catch {
        resolvedId = rawParam.trim();
      }
    }

    if (resolvedId) {
      hasScannedRef.current = true;
      setScanned(true);
      setSessionId(resolvedId);
      setIsCameraActive(false);
    } else {
      // Check stored pending session
      getPendingQRLogin().then((stored) => {
        if (stored) {
          hasScannedRef.current = true;
          setScanned(true);
          setSessionId(stored);
          setIsCameraActive(false);
        } else {
          // If no session passed, default to opening camera scanner
          hasScannedRef.current = false;
          setScanned(false);
          setIsCameraActive(true);
        }
      });
    }
  }, [localParams, globalParams]);

  // 2. Authentication Gate: If user is not authenticated, preserve session and redirect to /login
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (sessionId) {
        storePendingQRLogin(sessionId);
        router.replace({
          pathname: "/login",
          params: { reason: "qr-login", session: sessionId },
        } as any);
      }
    }
  }, [user, authLoading, sessionId, router]);

  // 3. Load and subscribe to session when authenticated
  useEffect(() => {
    if (!user || !sessionId) return;

    let unsub: (() => void) | null = null;
    setIsLoadingSession(true);
    setErrorMessage(null);

    // Initial fetch & validation
    getQRLoginSession(sessionId)
      .then((sess) => {
        if (!sess) {
          setErrorMessage(t("Session not found in Firestore. Please refresh the QR code on your computer screen."));
          setIsLoadingSession(false);
          setDrawerVisible(true);
          return;
        }

        setSession(sess);
        setDrawerVisible(true);
        setIsLoadingSession(false);

        // Record scan state to notify requesting desktop
        if (sess.status === "pending") {
          markQRLoginScanned(sessionId, sess.collectionName);
        }

        // Real-time listener for lifecycle updates on the exact collection
        unsub = subscribeToQRLoginSession(
          sessionId,
          (updated) => {
            if (updated) {
              setSession(updated);
            }
          },
          sess.collectionName
        );
      })
      .catch((err) => {
        setErrorMessage(err?.message || t("Failed to load QR session."));
        setIsLoadingSession(false);
        setDrawerVisible(true);
      });

    return () => {
      if (unsub) unsub();
    };
  }, [user, sessionId, t]);

  // 4. Handle barcode scan from in-app camera (Strict single-scan lock)
  const handleBarcodeScanned = useCallback(
    async (rawData: string) => {
      // Immediately and synchronously block duplicate scans while drawer is open or processing
      if (
        hasScannedRef.current ||
        scanned ||
        drawerVisible ||
        isSubmittingRef.current ||
        isLoadingSession ||
        session !== null
      ) {
        return;
      }

      // Synchronous lock on frame 1 — stops camera immediately
      hasScannedRef.current = true;
      setScanned(true);
      setIsCameraActive(false);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const { sessionId: scannedId } = parseQRLoginPayload(rawData);
        setErrorMessage(null);
        setSessionId(scannedId);
      } catch (err: any) {
        setErrorMessage(err?.message || t("Invalid QR code format."));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // On invalid format, allow retry after 2.5s cooldown
        setTimeout(() => {
          hasScannedRef.current = false;
          setScanned(false);
          setIsCameraActive(true);
        }, 2500);
      }
    },
    [scanned, drawerVisible, isLoadingSession, session, t]
  );

  // 5. Explicit user approval handler
  const handleApprove = async () => {
    if (!session || !user || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsApproving(true);
    setErrorMessage(null);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await approveQRLoginRequest({
        sessionId: session.id,
        collectionName: session.collectionName,
        approverUid: user.uid,
        approverDisplayName: user.displayName || userData?.displayName,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await clearPendingQRLogin();
      setSuccessMessage(t("Desktop session authorized successfully. You can now use BunkMates on your computer."));
    } catch (err: any) {
      console.warn("[QRLoginScreen] Approval failed:", err);
      setErrorMessage(err?.message || t("Failed to approve login. Please check connection."));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsApproving(false);
      isSubmittingRef.current = false;
    }
  };

  // 6. Explicit user rejection handler
  const handleReject = async () => {
    if (!session || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsRejecting(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await rejectQRLoginRequest(session.id, "Declined by user");
      await clearPendingQRLogin();
      setDrawerVisible(false);
      router.back();
    } catch (err) {
      console.warn("[QRLoginScreen] Rejection error:", err);
    } finally {
      setIsRejecting(false);
      isSubmittingRef.current = false;
    }
  };

  // Close drawer handler
  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    clearPendingQRLogin();
    setSession(null);
    setSessionId(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Stop scanning while drawer is closing, and add cooldown before re-enabling camera
    setTimeout(() => {
      hasScannedRef.current = false;
      setScanned(false);
      setIsCameraActive(true);
    }, 800);
  };

  // If unauthenticated or loading auth
  if (authLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.coral} />
      </View>
    );
  }

  // Camera permissions screen
  if (isCameraActive && !permission?.granted) {
    return (
      <View style={[styles.root, { backgroundColor: "#000000" }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView style={styles.permissionContainer}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
              style={styles.headerBackBtn}
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.headerTitle, { fontSize: scaleFont(18) }]}>
              {t("Scan QR to Log In")}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.permissionContent}>
            <View style={[styles.permIconCircle, { backgroundColor: colors.coralBg }]}>
              <Feather name="camera" size={44} color={isWhiteAccent ? "#FFFFFF" : colors.coral} />
            </View>
            <Text style={[styles.permTitle, { fontSize: scaleFont(20) }]}>
              {t("Camera Access Required")}
            </Text>
            <Text style={[styles.permDesc, { fontSize: scaleFont(14) }]}>
              {t("BunkMates needs camera permission to scan desktop QR login codes.")}
            </Text>

            <Pressable
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: colors.coral,
                  borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                  borderColor: colors.accentBorder,
                },
              ]}
              onPress={requestPermission}
            >
              <Text style={[styles.primaryActionBtnText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                {t("Enable Camera")}
              </Text>
            </Pressable>

            {permission?.canAskAgain === false && (
              <Pressable
                style={styles.settingsLinkBtn}
                onPress={() => Linking.openSettings()}
              >
                <Text style={[styles.settingsLinkText, { color: colors.coral, fontSize: scaleFont(14) }]}>
                  {t("Open Device Settings →")}
                </Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isCameraActive ? "#000000" : colors.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* CAMERA SCANNER VIEW (If in scan mode, drawer is closed, and not yet scanned) */}
      {isCameraActive && !drawerVisible && !scanned && (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={
              scanned || drawerVisible || session !== null || isLoadingSession
                ? undefined
                : { barcodeTypes: ["qr"] }
            }
            onBarcodeScanned={
              scanned || drawerVisible || session !== null || isLoadingSession
                ? undefined
                : ({ data }) => handleBarcodeScanned(data)
            }
          />

          {/* Mask & Viewfinder */}
          <View style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />
            <View style={{ flexDirection: "row", height: SCAN_FRAME_SIZE }}>
              <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />

              <View style={{ width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE, position: "relative" }}>
                {/* 4 Corner Brackets */}
                <View
                  style={[
                    styles.cornerBracket,
                    { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.coral },
                  ]}
                />
                <View
                  style={[
                    styles.cornerBracket,
                    { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.coral },
                  ]}
                />
                <View
                  style={[
                    styles.cornerBracket,
                    { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.coral },
                  ]}
                />
                <View
                  style={[
                    styles.cornerBracket,
                    { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.coral },
                  ]}
                />

                {/* Animated Scanning Laser */}
                <Animated.View
                  style={[
                    styles.laserLine,
                    { backgroundColor: colors.coral, shadowColor: colors.coral },
                    animatedLaserStyle,
                  ]}
                />
              </View>

              <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />
            </View>
            <View style={{ flex: 1.2, backgroundColor: "rgba(0, 0, 0, 0.65)" }} />
          </View>
        </>
      )}

      {/* FOREGROUND CONTROLS */}
      <SafeAreaView style={styles.overlayContainer}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
            style={styles.headerBackBtn}
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={[styles.headerTitle, { fontSize: scaleFont(18) }]}>
            {t("Scan QR to Log In")}
          </Text>

          {isCameraActive ? (
            <Pressable
              onPress={() => setTorch(!torch)}
              style={[styles.torchBtn, torch && { backgroundColor: "rgba(255, 255, 255, 0.3)" }]}
              accessibilityLabel="Toggle Torch"
            >
              <Ionicons name={torch ? "flash" : "flash-off"} size={20} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Loading Spinner Indicator */}
        {isLoadingSession && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.coral} />
            <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: scaleFont(14) }]}>
              {t("Validating login request...")}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Helper bottom card if scanning */}
        {isCameraActive && (
          <View style={styles.bottomCardWrap}>
            <Text style={[styles.bottomHelperText, { fontSize: scaleFont(13.5) }]}>
              {t("Point your camera at the QR code displayed on web.bunkmates.xyz or desktop app.")}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── APPROVAL CONFIRMATION DRAWER (Native Bottom Sheet) ── */}
      <QRLoginApprovalDrawer
        visible={drawerVisible}
        session={session}
        currentUser={user}
        currentUserData={userData}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={handleCloseDrawer}
        isApproving={isApproving}
        isRejecting={isRejecting}
        errorMessage={errorMessage}
        successMessage={successMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
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
    zIndex: 20,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  permissionContent: {
    alignItems: "center",
    paddingHorizontal: 28,
    marginBottom: 40,
  },
  permIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: "center",
  },
  permDesc: {
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryActionBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  primaryActionBtnText: {
    fontWeight: "700",
  },
  settingsLinkBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  settingsLinkText: {
    fontWeight: "600",
  },
  overlayContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  cornerBracket: {
    position: "absolute",
    width: 28,
    height: 28,
  },
  laserLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 1.25,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontWeight: "500",
  },
  bottomCardWrap: {
    marginHorizontal: 24,
    marginBottom: 28,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  bottomHelperText: {
    color: "#E2E8F0",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },
});
