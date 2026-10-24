// **@** SettingsActionModal — Ultra-smooth single-modal Swipeable Drawer for actions, confirmations, and alerts
// Eliminates native window deadlocks by maintaining a single SwipeableDrawer instance without premature unmounting.
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Appearance,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeToggle } from "../../../contexts/ThemeContext";
import { useAppSettings } from "../../../contexts/AppSettingsContext";
import { SwipeableDrawer } from "./SwipeableDrawer";

export interface SettingsActionModalProps {
  visible: boolean;
  onClose: () => void;
  initialStep?: "confirm" | "success";
  iconType?: "warning" | "danger" | "success" | "logout" | "key" | "trash" | "device";
  customIcon?: React.ReactNode;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  successTitle?: string;
  successMessage?: string;
  successButtonLabel?: string;
  onDone?: () => void;
  showSuccessStep?: boolean;
  errorMessage?: string | null;
  errorTitle?: string;
  onErrorDismiss?: () => void;
}

export function SettingsActionModal({
  visible,
  onClose,
  initialStep = "confirm",
  iconType = "warning",
  customIcon,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "#EF4444",
  onConfirm,
  successTitle,
  successMessage,
  successButtonLabel = "Done",
  onDone,
  showSuccessStep = true,
  errorMessage,
  errorTitle,
  onErrorDismiss,
}: SettingsActionModalProps) {
  const [step, setStep] = useState<"confirm" | "success">(initialStep);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Clean, consistent bottom spacing; SwipeableDrawer provides the safe area padding
  const bottomSafePadding = 8;

  // Reset step whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setLoading(false);
      setActionError(null);
    }
  }, [visible, initialStep]);

  // Dynamic Theme
  const themeContext = useThemeToggle();
  const themeMode = themeContext?.mode ?? "system";
  const themeColorsSuccess = themeContext?.themeColors?.success ?? "#22C55E";
  const themeColorsError = themeContext?.themeColors?.error ?? "#EF4444";

  // App Accessibility Context
  let appHighContrast = false;
  let appLargeTouch = true;
  let appTriggerHaptic = (t?: any) => {};
  try {
    const appSettings = useAppSettings();
    if (appSettings) {
      appHighContrast = appSettings.highContrastMode;
      appLargeTouch = appSettings.largeTouchTargets;
      appTriggerHaptic = appSettings.triggerHaptic;
    }
  } catch {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = {
    cardBg: isDark ? "#17171A" : "#FFFFFF",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#9CA3AF" : "#52525B",
    cancelBtnBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#F3F4F6",
    cancelBtnBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    cancelBtnText: isDark ? "#E4E4E7" : "#374151",
    primaryCoral: confirmColor === "#FF5A4F" ? themeColorsError : confirmColor,
    warningIconCircle: isDark ? "rgba(239, 68, 68, 0.18)" : "#FEE2E2",
    warningIconAura: isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.06)",
    warningIconBorder: isDark ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.20)",
    warningIconColor: "#EF4444",
    successIconCircle: isDark ? "rgba(34, 197, 94, 0.18)" : "#DCFCE7",
    successIconAura: isDark ? "rgba(34, 197, 94, 0.08)" : "rgba(34, 197, 94, 0.06)",
    successIconBorder: isDark ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.20)",
    successIconColor: themeColorsSuccess,
    cardBorder: appHighContrast ? (isDark ? "#38383E" : "#D1D5DB") : (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"),
  };

  const isBrightPrimary =
    colors.primaryCoral === "#FFFFFF" ||
    colors.primaryCoral?.toLowerCase() === "#ffffff" ||
    colors.primaryCoral === "#ffd700";
  const primaryTextColor = isBrightPrimary ? "#000000" : "#FFFFFF";

  const handleConfirmPress = async () => {
    if (!onConfirm) {
      if (showSuccessStep && successTitle) {
        setStep("success");
      } else {
        onClose();
      }
      return;
    }

    setLoading(true);
    setActionError(null);
    appTriggerHaptic("medium");
    try {
      const res = await onConfirm();
      if (res === false) {
        setLoading(false);
        return;
      }

      if (showSuccessStep && (successTitle || successMessage)) {
        appTriggerHaptic("success");
        setStep("success");
      } else {
        onClose();
        if (onDone) onDone();
      }
    } catch (e: any) {
      console.log("Action error:", e);
      const msg = e?.message || "An unexpected error occurred. Please try again.";
      setActionError(msg);
      appTriggerHaptic("error" as any);
    } finally {
      setLoading(false);
    }
  };

  const handleDonePress = () => {
    appTriggerHaptic("selection");
    onClose();
    if (onDone) {
      onDone();
    }
  };

  const renderBadgeIcon = () => {
    if (customIcon) return customIcon;

    switch (iconType) {
      case "logout":
        return <Ionicons name="log-out-outline" size={28} color="#EF4444" style={{ marginLeft: 2 }} />;
      case "key":
        return <Ionicons name="key-outline" size={26} color={colors.warningIconColor} />;
      case "trash":
        return <Ionicons name="trash-outline" size={26} color="#EF4444" />;
      case "device":
        return <Ionicons name="phone-portrait-outline" size={26} color={colors.warningIconColor} />;
      case "danger":
      case "warning":
      default:
        return <Feather name="alert-triangle" size={26} color={colors.warningIconColor} />;
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const activeError = errorMessage || actionError;

  return (
    <SwipeableDrawer
      visible={visible}
      onClose={activeError ? () => { setActionError(null); if (onErrorDismiss) onErrorDismiss(); else onClose(); } : (step === "success" ? handleDonePress : handleClose)}
      handleColor={isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 0, 0, 0.2)"}
      sheetStyle={[
        styles.card,
        {
          backgroundColor: colors.cardBg,
          borderWidth: appHighContrast ? 1.5 : 1,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      {activeError ? (
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`${errorTitle || "Notice"}. ${activeError}`}
          style={[styles.sheetInner, { paddingBottom: bottomSafePadding }]}
        >
          {/* Luminous Red Warning Badge */}
          <View
            style={[
              styles.badgeGlowRing,
              {
                backgroundColor: colors.warningIconAura,
                borderColor: colors.warningIconBorder,
              },
            ]}
          >
            <View
              style={[
                styles.badgeCore,
                { backgroundColor: colors.warningIconCircle },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={30} color={colors.warningIconColor} />
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {errorTitle || "Notice"}
          </Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            {activeError}
          </Text>

          {/* Dismiss CTA */}
          <View style={styles.buttonStack}>
            <Pressable
              hitSlop={appLargeTouch ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Understood"
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  backgroundColor: colors.cancelBtnBg,
                  borderColor: colors.cancelBtnBorder,
                  borderWidth: 1,
                  minHeight: appLargeTouch ? 52 : 48,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setActionError(null);
                if (onErrorDismiss) {
                  onErrorDismiss();
                } else {
                  onClose();
                }
              }}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textPrimary, fontWeight: "700" }]}>
                Understood
              </Text>
            </Pressable>
          </View>
        </View>
      ) : step === "success" ? (
        <View style={[styles.sheetInner, { paddingBottom: bottomSafePadding }]}>
          {/* Luminous Green Checkmark Aura */}
          <View
            style={[
              styles.badgeGlowRing,
              {
                backgroundColor: colors.successIconAura,
                borderColor: colors.successIconBorder,
              },
            ]}
          >
            <View
              style={[
                styles.badgeCore,
                { backgroundColor: colors.successIconCircle },
              ]}
            >
              <Feather name="check" size={30} color={colors.successIconColor} />
            </View>
          </View>

          {/* Success Title */}
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {successTitle || "Action Completed"}
          </Text>

          {/* Success Description */}
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            {successMessage || "Your request has been successfully processed."}
          </Text>

          {/* Bottom Pinned Primary CTA Button */}
          <View style={styles.buttonStack}>
            <Pressable
              hitSlop={appLargeTouch ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={successButtonLabel}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primaryCoral,
                  minHeight: appLargeTouch ? 54 : 50,
                  borderWidth: appHighContrast || (!isDark && isBrightPrimary) ? 1.5 : 0,
                  borderColor: !isDark && isBrightPrimary ? "#111827" : (isDark ? "#FFFFFF" : "#000000"),
                },
                pressed && styles.pressed,
              ]}
              onPress={handleDonePress}
            >
              <Text style={[styles.primaryBtnText, { color: primaryTextColor }]}>{successButtonLabel}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          style={[styles.sheetInner, { paddingBottom: bottomSafePadding }]}
        >
          {/* Luminous Concentric Danger Aura */}
          <View
            style={[
              styles.badgeGlowRing,
              {
                backgroundColor: colors.warningIconAura,
                borderColor: colors.warningIconBorder,
              },
            ]}
          >
            <View
              style={[
                styles.badgeCore,
                { backgroundColor: colors.warningIconCircle },
              ]}
            >
              {renderBadgeIcon()}
            </View>
          </View>

          {/* Contextual Security Micro-Badge */}
          {iconType === "trash" ? (
            <View style={styles.contextPill}>
              <Ionicons name="warning-outline" size={13} color="#EF4444" style={{ marginRight: 5 }} />
              <Text style={styles.contextPillText}>PERMANENT & IRREVERSIBLE</Text>
            </View>
          ) : iconType === "logout" ? (
            <View style={[styles.contextPill, { backgroundColor: "rgba(239, 68, 68, 0.10)", borderColor: "rgba(239, 68, 68, 0.22)" }]}>
              <Ionicons name="shield-outline" size={13} color="#EF4444" style={{ marginRight: 5 }} />
              <Text style={styles.contextPillText}>SESSION SIGN-OUT</Text>
            </View>
          ) : null}

          {/* Title */}
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>{message}</Text>

          {/* Stacked Full-Width Buttons with Dedicated Bottom Space */}
          <View style={styles.buttonStack}>
            {/* Primary Action Button (Red) */}
            <Pressable
              hitSlop={appLargeTouch ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primaryCoral,
                  minHeight: appLargeTouch ? 54 : 50,
                  borderWidth: appHighContrast || (!isDark && isBrightPrimary) ? 1.5 : 0,
                  borderColor: !isDark && isBrightPrimary ? "#111827" : (isDark ? "#FFFFFF" : "#000000"),
                },
                pressed && styles.pressed,
              ]}
              onPress={handleConfirmPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={primaryTextColor} />
              ) : (
                <View style={styles.btnContentRow}>
                  {iconType === "trash" ? (
                    <Ionicons name="trash-outline" size={18} color={primaryTextColor} style={{ marginRight: 8 }} />
                  ) : iconType === "logout" ? (
                    <Ionicons name="log-out-outline" size={18} color={primaryTextColor} style={{ marginRight: 8 }} />
                  ) : null}
                  <Text style={[styles.primaryBtnText, { color: primaryTextColor }]}>{confirmLabel}</Text>
                </View>
              )}
            </Pressable>

            {/* Secondary Cancel Button */}
            <Pressable
              hitSlop={appLargeTouch ? { top: 10, bottom: 10, left: 10, right: 10 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  backgroundColor: colors.cancelBtnBg,
                  borderColor: colors.cancelBtnBorder,
                  borderWidth: 1,
                  minHeight: appLargeTouch ? 52 : 48,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                appTriggerHaptic("light");
                handleClose();
              }}
              disabled={loading}
            >
              <Text style={[styles.cancelBtnText, { color: colors.cancelBtnText }]}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SwipeableDrawer>
  );
}

export default SettingsActionModal;

const styles = StyleSheet.create({
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  sheetInner: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  badgeGlowRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 12,
  },
  badgeCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    marginBottom: 12,
  },
  contextPillText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#EF4444",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonStack: {
    width: "100%",
    gap: 11,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cancelBtn: {
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.88,
  },
});
