// **@** Enter Pairing Code Screen (Method B: 8-character alphanumeric code pairing)
// WhatsApp-style 8-digit segmented input, active focus glow, auto-validation,
// real-time expiration timer, and instant device metadata approval card.
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  type TextInputInstance,
  ActivityIndicator,
  StatusBar,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
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
  findPairingByCode,
  approvePairingSession,
  DevicePairingSession,
} from "../../../lib/devicePairing";
import { getPersistentDeviceId, getDeviceHardwareInfo } from "../../../utils/sessionTracker";

export default function EnterPairingCodeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top > 0 ? insets.top : Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 44;
  const router = useRouter();
  const { user } = useUser();
  const { t } = useLanguage();
  const inputRef = useRef<TextInputInstance>(null);

  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<DevicePairingSession | null>(null);

  // Expiration countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Theme integration
  let isDark = true;
  let dynamicAccent = "#FF5A5F";
  let onAccentTextColor = "#FFFFFF";
  let isWhiteAccent = false;
  let dynamicThemeColors: any = null;
  let scaleFont = (size: number) => size;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      isDark = themeContext.mode !== "light";
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      if (themeContext.onAccentTextColor) onAccentTextColor = themeContext.onAccentTextColor;
      isWhiteAccent = themeContext.isWhiteAccent ?? (dynamicAccent.toLowerCase() === "#ffffff" || themeContext.accent === "white");
      dynamicThemeColors = themeContext.themeColors;
      scaleFont = themeContext.scaleFont || ((s: number) => s);
    }
  } catch {}

  const accentTextColor = dynamicThemeColors?.accentText ?? (isWhiteAccent ? (isDark ? "#FFFFFF" : "#11141A") : dynamicAccent);
  const accentBgTint = dynamicThemeColors?.accentBg ?? (isWhiteAccent ? (isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.06)") : (isDark ? "rgba(255, 90, 95, 0.15)" : "rgba(255, 90, 95, 0.10)"));

  const colors = {
    bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
    card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
    cardBorder: isDark ? "#242428" : "#E2E8F0",
    textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
    textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
    inputBoxBg: isDark ? "#1E1E22" : "#E9ECEF",
    activeBoxBorder: isWhiteAccent && !isDark ? "#11141A" : dynamicAccent,
    coral: dynamicAccent,
    onAccent: onAccentTextColor,
    accentText: accentTextColor,
    accentBg: accentBgTint,
    accentBorder: isWhiteAccent && !isDark ? "rgba(0, 0, 0, 0.20)" : "transparent",
    error: "#EF4444",
    errorBg: isDark ? "rgba(239, 68, 68, 0.14)" : "rgba(239, 68, 68, 0.08)",
  };

  // Focus input automatically on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  // Expiry timer
  useEffect(() => {
    if (!pendingSession) {
      setSecondsRemaining(null);
      return;
    }
    const updateCountdown = () => {
      const left = Math.max(0, Math.floor((pendingSession.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(left);
      if (left <= 0) {
        setErrorMessage(t("Pairing code has expired. Please refresh the code on your secondary device."));
        setPendingSession(null);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pendingSession]);

  // Handle code change & auto-validate on 8 characters
  const handleCodeChange = async (val: string) => {
    const sanitized = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setCode(sanitized);
    setErrorMessage(null);

    if (sanitized.length === 8) {
      Keyboard.dismiss();
      setIsValidating(true);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const session = await findPairingByCode(sanitized);

        if (!session) {
          throw new Error(t("Invalid pairing code or the session has expired."));
        }

        if (Date.now() > session.expiresAt) {
          throw new Error(t("Pairing code has expired. Please request a new code on your other device."));
        }

        setPendingSession(session);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        setErrorMessage(err?.message || t("Invalid pairing code."));
        setPendingSession(null);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsValidating(false);
      }
    } else {
      setPendingSession(null);
    }
  };

  // Confirm approval
  const handleApprove = async () => {
    if (!pendingSession || !user) return;
    setIsApproving(true);
    setErrorMessage(null);
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
      router.replace("/settings/linked-devices" as any);
    } catch (err: any) {
      setErrorMessage(err?.message || t("Failed to approve device pairing."));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsApproving(false);
    }
  };

  const getDeviceIcon = (type?: string) => {
    switch (type) {
      case "desktop":
      case "web":
        return <MaterialCommunityIcons name="laptop" size={30} color={colors.accentText} />;
      case "tablet":
        return <MaterialCommunityIcons name="tablet" size={30} color={colors.accentText} />;
      default:
        return <MaterialCommunityIcons name="cellphone" size={30} color={colors.accentText} />;
    }
  };

  const renderSegmentedBoxes = () => {
    const chars = code.split("");
    const boxes = [];

    for (let i = 0; i < 8; i++) {
      const char = chars[i] || "";
      const isCurrentFocus = i === code.length && code.length < 8;
      const isFilled = !!char;

      boxes.push(
        <View
          key={i}
          style={[
            styles.digitBox,
            { backgroundColor: colors.inputBoxBg },
            (isCurrentFocus || (isFilled && !pendingSession)) && {
              borderColor: colors.activeBoxBorder,
              borderWidth: 1.5,
            },
          ]}
        >
          <Text style={[styles.digitText, { color: colors.textPrimary, fontSize: scaleFont(22) }]}>
            {char}
          </Text>
        </View>
      );

      // Separator after 4 characters
      if (i === 3) {
        boxes.push(
          <View key="hyphen" style={styles.hyphenWrap}>
            <Text style={[styles.hyphenText, { color: colors.textSecondary }]}>—</Text>
          </View>
        );
      }
    }

    return boxes;
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
        />
        <SafeAreaView style={styles.safeArea}>
          {/* **@** Header Mask Gradient — Exact WhatsApp/Chat Style 6-Stop Dissolve Mask */}
          <SettingsHeaderGradientMask
        backgroundColor={colors.bg}
        zIndex={15}
      />

          {/* Header */}
          <View style={[styles.headerRow, { zIndex: 20 }]}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
              styles.backBtn,
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
              <Feather name="arrow-left" size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: scaleFont(18) }]}>
              {t("Link with Pairing Code")}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={[
              styles.body,
              { paddingBottom: Math.max(insets.bottom, 24) + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Information */}
            <View style={styles.heroSection}>
              <View style={[styles.iconBox, { backgroundColor: colors.accentBg }]}>
                <Ionicons name="keypad" size={28} color={colors.accentText} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
                {t("Enter 8-Character Code")}
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary, fontSize: scaleFont(13.5) }]}>
                {t("Type the pairing code displayed on your computer, tablet, or web browser to confirm linking.")}
              </Text>
            </View>

            {/* 8-Box Segmented Inputs Container */}
            <Pressable style={styles.inputsRow} onPress={() => inputRef.current?.focus()}>
              {renderSegmentedBoxes()}
            </Pressable>

            {/* Hidden Native Input */}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleCodeChange}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType={Platform.OS === "ios" ? "ascii-capable" : "visible-password"}
              style={styles.hiddenInput}
              caretHidden
            />

            {/* Validation Spinner */}
            {isValidating && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.accentText} />
                <Text style={[styles.statusText, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                  {t("Verifying pairing code...")}
                </Text>
              </View>
            )}

            {/* Error Badge */}
            {errorMessage && (
              <View style={[styles.errorCard, { backgroundColor: colors.errorBg }]}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error, fontSize: scaleFont(12.5) }]}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Pending Device Approval Preview Card */}
            {pendingSession && (
              <View style={[styles.devicePreviewCard, { backgroundColor: colors.card }]}>
                <View style={styles.previewHeaderRow}>
                  <View style={[styles.previewIconWrap, { backgroundColor: colors.accentBg }]}>
                    {getDeviceIcon(pendingSession.requesterMetadata?.deviceType)}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.previewName, { color: colors.textPrimary, fontSize: scaleFont(16) }]}>
                      {pendingSession.requesterMetadata?.deviceName || "Secondary Client"}
                    </Text>
                    <Text style={[styles.previewSub, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]}>
                      {pendingSession.requesterMetadata?.os} • {pendingSession.requesterMetadata?.browser || "Web App"}
                    </Text>
                  </View>
                  {secondsRemaining !== null && (
                    <View style={[styles.timerBadge, { backgroundColor: colors.accentBg }]}>
                      <Ionicons name="time-outline" size={12} color={colors.accentText} />
                      <Text style={[styles.timerBadgeText, { color: colors.accentText }]}>
                        {secondsRemaining}s
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.divider} />

                <View style={styles.previewMetaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                    {t("Estimated Location")}
                  </Text>
                  <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
                    {pendingSession.requesterMetadata?.location || "Nearby Local Network"}
                  </Text>
                </View>

                {/* Approve Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.approveCtaBtn,
                    {
                      backgroundColor: colors.coral,
                      borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                      borderColor: colors.accentBorder,
                    },
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={handleApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <View style={styles.btnInner}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.onAccent} style={{ marginRight: 6 }} />
                      <Text style={[styles.approveCtaBtnText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                        {t("Approve & Link Device")}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            )}

            <View style={{ flex: 1 }} />

            {/* Alternate Option: Scan QR Code */}
            <Pressable
              style={({ pressed }) => [
                styles.altLinkBtn,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => router.replace("/settings/linked-devices/scan-qr" as any)}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.accentText} style={{ marginRight: 6 }} />
              <Text style={[styles.altLinkBtnText, { color: colors.accentText, fontSize: scaleFont(14) }]}>
                {t("Scan QR code instead")}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    height: 52,
  },
  backBtn: {
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
  bodyScroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
  },
  inputsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 6,
  },
  digitBox: {
    width: 38,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  digitText: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  hyphenWrap: {
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hyphenText: {
    fontSize: 18,
    fontWeight: "700",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  statusText: {
    fontWeight: "500",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    gap: 10,
    marginTop: 14,
  },
  errorText: {
    fontWeight: "600",
    flexShrink: 1,
    lineHeight: 18,
  },
  devicePreviewCard: {
    borderRadius: 24,
    padding: 18,
    marginTop: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  previewName: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  previewSub: {
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(142, 149, 162, 0.15)",
    marginVertical: 14,
  },
  previewMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  metaVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  approveCtaBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  approveCtaBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  altLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  altLinkBtnText: {
    fontWeight: "600",
  },
});
