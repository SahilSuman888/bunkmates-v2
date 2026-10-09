import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface SettingsActionModalProps {
  visible: boolean;
  onClose: () => void;
  // Step control: start at confirm or success
  initialStep?: "confirm" | "success";
  
  // Icon configuration
  iconType?: "warning" | "danger" | "success" | "logout" | "key" | "trash" | "device";
  customIcon?: React.ReactNode;
  
  // Confirmation step details (Image 2 style)
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string; // defaults to #FF5A4F
  onConfirm?: () => Promise<boolean | void> | boolean | void;
  
  // Success step details (Image 1 style)
  successTitle?: string;
  successMessage?: string;
  successButtonLabel?: string;
  onDone?: () => void;
  
  // Option to skip success screen if false
  showSuccessStep?: boolean;
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
  confirmColor = "#FF5A4F",
  onConfirm,
  successTitle,
  successMessage,
  successButtonLabel = "Done",
  onDone,
  showSuccessStep = true,
}: SettingsActionModalProps) {
  const [step, setStep] = useState<"confirm" | "success">(initialStep);
  const [loading, setLoading] = useState(false);

  // Sync step when modal opens
  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setLoading(false);
    }
  }, [visible, initialStep]);

  // Dynamic Theme
  let themeMode: "dark" | "light" | "system" = "system";
  let themeColorsSuccess = "#22C55E";
  let themeColorsError = "#FF5A4F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext?.mode) themeMode = themeContext.mode;
    if (themeContext?.themeColors) {
      themeColorsSuccess = themeContext.themeColors.success;
      themeColorsError = themeContext.themeColors.error;
    }
  } catch {}

  // App Accessibility Context
  let appHighContrast = false;
  let appReduceMotion = false;
  let appLargeTouch = true;
  let appTriggerHaptic = (t?: any) => {};
  try {
    const appSettings = useAppSettings();
    if (appSettings) {
      appHighContrast = appSettings.highContrastMode;
      appReduceMotion = appSettings.reduceMotion;
      appLargeTouch = appSettings.largeTouchTargets;
      appTriggerHaptic = appSettings.triggerHaptic;
    }
  } catch {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = {
    modalOverlay: "rgba(0, 0, 0, 0.6)",
    cardBg: isDark ? "#18181B" : "#FFFFFF",
    screenBg: isDark ? "#000000" : "#FFFFFF",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#9E9E9E" : "#666666",
    cancelBtnBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#F5F5F7",
    cancelBtnText: isDark ? "#E2E8F0" : "#4B5563",
    primaryCoral: confirmColor === "#FF5A4F" ? themeColorsError : confirmColor,
    warningIconCircle: isDark ? "rgba(255, 90, 79, 0.16)" : "#FEECEC",
    warningIconColor: themeColorsError,
    successIconCircle: isDark ? "rgba(34, 197, 94, 0.15)" : "#E8F8EE",
    successIconColor: themeColorsSuccess,
    cardBorder: appHighContrast ? (isDark ? "#38383E" : "#D1D5DB") : "transparent",
  };

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
    appTriggerHaptic("medium");
    try {
      const res = await onConfirm();
      // If returned false explicitly, do not proceed to success
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
    } catch (e) {
      console.log("Action error:", e);
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
        return <Ionicons name="log-out-outline" size={32} color={colors.warningIconColor} />;
      case "key":
        return <Ionicons name="key-outline" size={30} color={colors.warningIconColor} />;
      case "trash":
        return <Ionicons name="trash-outline" size={30} color={colors.warningIconColor} />;
      case "device":
        return <Ionicons name="phone-portrait-outline" size={30} color={colors.warningIconColor} />;
      case "danger":
      case "warning":
      default:
        // Triangle warning outline matching Image 2 exactly
        return <Feather name="alert-triangle" size={30} color={colors.warningIconColor} />;
    }
  };

  if (!visible) return null;

  // ─────────────────────────────────────────────────────────────
  // 1. SUCCESS / AFTER-SCREEN (Image 1 Style)
  // ─────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <Modal
        visible={visible}
        animationType={appReduceMotion ? "none" : "fade"}
        transparent={false}
        onRequestClose={handleDonePress}
      >
        <SafeAreaView style={[styles.successContainer, { backgroundColor: colors.screenBg }]}>
          <View style={styles.successCenterContent}>
            {/* Soft Green Checkmark Badge */}
            <View style={[styles.successBadge, { backgroundColor: colors.successIconCircle }]}>
              <Feather name="check" size={38} color={colors.successIconColor} />
            </View>

            {/* Success Title */}
            <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
              {successTitle || "Action Completed"}
            </Text>

            {/* Success Description */}
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              {successMessage || "Your request has been successfully processed."}
            </Text>
          </View>

          {/* Bottom Pinned Primary CTA Button */}
          <View style={styles.bottomBar}>
            <Pressable
              hitSlop={appLargeTouch ? { top: 12, bottom: 12, left: 12, right: 12 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={successButtonLabel}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primaryCoral,
                  minHeight: appLargeTouch ? 56 : 50,
                  borderWidth: appHighContrast ? 1.5 : 0,
                  borderColor: isDark ? "#FFFFFF" : "#000000",
                },
                pressed && styles.pressed,
              ]}
              onPress={handleDonePress}
            >
              <Text style={styles.primaryBtnText}>{successButtonLabel}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CONFIRMATION POPUP (Image 2 Style)
  // ─────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType={appReduceMotion ? "none" : "fade"}
      transparent
      onRequestClose={loading ? undefined : onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message}`}
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderWidth: appHighContrast ? 1.5 : 0,
              borderColor: colors.cardBorder,
              // Shadow / elevation conforming to BUNKMATES_DESIGN_SYSTEM.md (NO BORDERS)
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.18,
                  shadowRadius: 24,
                },
                android: {
                  elevation: 10,
                },
                web: {
                  boxShadow: isDark
                    ? "0 10px 30px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.08)"
                    : "0 10px 30px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
                },
              }),
            },
          ]}
        >
          {/* Circular Badge with Soft Red/Coral Background & Warning Triangle */}
          <View style={[styles.warningBadge, { backgroundColor: colors.warningIconCircle }]}>
            {renderBadgeIcon()}
          </View>

          {/* Title */}
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>{message}</Text>

          {/* Stacked Full-Width Buttons */}
          <View style={styles.buttonStack}>
            {/* Primary Action Button (Coral Red) */}
            <Pressable
              hitSlop={appLargeTouch ? { top: 12, bottom: 12, left: 12, right: 12 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primaryCoral,
                  minHeight: appLargeTouch ? 56 : 50,
                  borderWidth: appHighContrast ? 1.5 : 0,
                  borderColor: isDark ? "#FFFFFF" : "#000000",
                },
                pressed && styles.pressed,
              ]}
              onPress={handleConfirmPress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>{confirmLabel}</Text>
              )}
            </Pressable>

            {/* Secondary Cancel Button (Soft Neutral Pill) */}
            <Pressable
              hitSlop={appLargeTouch ? { top: 12, bottom: 12, left: 12, right: 12 } : undefined}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  backgroundColor: colors.cancelBtnBg,
                  minHeight: appLargeTouch ? 56 : 50,
                  borderWidth: appHighContrast ? 1.5 : 0,
                  borderColor: isDark ? "#38383E" : "#D1D5DB",
                },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                appTriggerHaptic("light");
                onClose();
              }}
              disabled={loading}
            >
              <Text style={[styles.cancelBtnText, { color: colors.cancelBtnText }]}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default SettingsActionModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 30, // 30px radius as defined in BUNKMATES_DESIGN_SYSTEM.md
    borderWidth: 0, // NO BORDERS anywhere in the project UI
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
  },
  warningBadge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 4,
    marginBottom: 26,
  },
  buttonStack: {
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25, // 24-28px radius for standard buttons as defined in BunkMates design system
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cancelBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    borderWidth: 0, // NO BORDERS
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  // Success Screen Styles (Image 1 Style)
  successContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  successCenterContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  successBadge: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 26,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  bottomBar: {
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "android" ? 24 : 12,
  },
});
