// **@** QR Login Approval Drawer — Bottom Sheet for Approving Desktop Web Logins
// Polished MUI-inspired design adapted to React Native, with real-time countdown,
// explicit consent actions, unverified browser-details disclaimer, and security checks.

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SwipeableDrawer } from "../../app/settings/_components/SwipeableDrawer";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { QRLoginSession, isSessionExpired, normalizeTimestamp } from "../../lib/qrLoginService";

interface QRLoginApprovalDrawerProps {
  visible: boolean;
  session: QRLoginSession | null;
  currentUser?: any;
  currentUserData?: any;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
  isApproving: boolean;
  isRejecting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}

export const QRLoginApprovalDrawer: React.FC<QRLoginApprovalDrawerProps> = ({
  visible,
  session,
  currentUser,
  currentUserData,
  onApprove,
  onReject,
  onClose,
  isApproving,
  isRejecting = false,
  errorMessage,
  successMessage,
}) => {
  const { t } = useLanguage();

  // Dynamic Theme Integration
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

  const colors = useMemo(
    () => ({
      bg: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardElevated: isDark ? "#202024" : "#F8FAFC",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
      divider: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
      textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      coral: dynamicAccent,
      coralBg: isWhiteAccent
        ? (isDark ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.08)")
        : hexToRgba(dynamicAccent, isDark ? 0.16 : 0.1),
      onAccent: onAccentTextColor,
      accentBorder: isWhiteAccent && !isDark ? "rgba(0, 0, 0, 0.20)" : "transparent",
      dangerBg: isDark ? "rgba(239, 68, 68, 0.14)" : "#FEE2E2",
      dangerText: "#EF4444",
      successBg: isDark ? "rgba(34, 197, 94, 0.16)" : "#DCFCE7",
      successText: "#16A34A",
      warningBg: isDark ? "rgba(245, 158, 11, 0.16)" : "#FEF3C7",
      warningText: "#D97706",
    }),
    [isDark, dynamicAccent, dynamicThemeColors, isWhiteAccent, onAccentTextColor]
  );

  const getDeviceIcon = (os?: string, type?: string) => {
    const lowerOs = (os || "").toLowerCase();
    if (lowerOs.includes("mac") || lowerOs.includes("ios") || lowerOs.includes("apple")) {
      return <MaterialCommunityIcons name="apple" size={32} color={colors.coral} />;
    }
    if (lowerOs.includes("win")) {
      return <MaterialCommunityIcons name="microsoft-windows" size={32} color={colors.coral} />;
    }
    if (lowerOs.includes("linux") || lowerOs.includes("ubuntu")) {
      return <MaterialCommunityIcons name="linux" size={32} color={colors.coral} />;
    }
    if (type === "tablet") {
      return <MaterialCommunityIcons name="tablet" size={32} color={colors.coral} />;
    }
    return <MaterialCommunityIcons name="laptop" size={32} color={colors.coral} />;
  };

  const formatRequestTime = (ts?: any) => {
    const millis = normalizeTimestamp(ts);
    if (!millis) return "Just now";
    const diffSec = Math.floor((Date.now() - millis) / 1000);
    if (diffSec < 45 && diffSec >= -30) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin > 0 && diffMin < 60) return `${diffMin}m ago`;
    const date = new Date(millis);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isExpired = isSessionExpired(session);
  const isAlreadyApproved = session?.status === "approved" || session?.status === "consumed";
  const isRejected = session?.status === "rejected";

  const userName =
    currentUser?.displayName ||
    currentUserData?.displayName ||
    currentUserData?.name ||
    currentUserData?.username ||
    "BunkMates User";

  const userEmail =
    currentUser?.email ||
    currentUserData?.email ||
    (currentUser?.uid ? `ID: ${currentUser.uid.substring(0, 10)}...` : "");

  const userAvatar =
    currentUser?.photoURL ||
    currentUserData?.photoURL ||
    currentUserData?.profileImage ||
    currentUserData?.avatar;

  return (
    <SwipeableDrawer
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { backgroundColor: colors.bg }]}
    >
      <View style={styles.container}>
        {/* SUCCESS CONFIRMATION STATE */}
        {successMessage ? (
          <View style={styles.stateContainer}>
            <View style={[styles.largeIconCircle, { backgroundColor: colors.successBg }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.successText} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
              {t("Desktop Login Approved")}
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary, fontSize: scaleFont(14) }]}>
              {successMessage}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.coral,
                  borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                  borderColor: colors.accentBorder,
                },
                pressed && { opacity: 0.88 },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                {t("Done")}
              </Text>
            </Pressable>
          </View>
        ) : isRejected ? (
          /* REJECTED STATE */
          <View style={styles.stateContainer}>
            <View style={[styles.largeIconCircle, { backgroundColor: colors.dangerBg }]}>
              <Ionicons name="close-circle" size={48} color={colors.dangerText} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
              {t("Login Request Declined")}
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary, fontSize: scaleFont(14) }]}>
              {t("This desktop login attempt was rejected. No session was authorized.")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.cardElevated },
                pressed && { opacity: 0.88 },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                {t("Dismiss")}
              </Text>
            </Pressable>
          </View>
        ) : isExpired ? (
          /* EXPIRED STATE */
          <View style={styles.stateContainer}>
            <View style={[styles.largeIconCircle, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="time" size={48} color={colors.warningText} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
              {t("QR Code Expired")}
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary, fontSize: scaleFont(14) }]}>
              {t("This QR login request has expired. Please refresh the QR code on your desktop screen and scan again.")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.cardElevated },
                pressed && { opacity: 0.88 },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                {t("Close")}
              </Text>
            </Pressable>
          </View>
        ) : isAlreadyApproved ? (
          /* ALREADY CONSUMED/APPROVED STATE */
          <View style={styles.stateContainer}>
            <View style={[styles.largeIconCircle, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="checkmark-done" size={48} color={colors.warningText} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
              {t("Already Approved")}
            </Text>
            <Text style={[styles.stateSubtitle, { color: colors.textSecondary, fontSize: scaleFont(14) }]}>
              {t("This login request has already been authorized or consumed.")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.cardElevated },
                pressed && { opacity: 0.88 },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                {t("Close")}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* ACTIVE APPROVAL INTERFACE */
          <View>
            {/* Top Icon Badge */}
            <View style={[styles.headerIconWrap, { backgroundColor: colors.coralBg }]}>
              {getDeviceIcon(session?.requesterMetadata?.os, session?.requesterMetadata?.deviceType)}
            </View>

            {/* Heading & Supporting Text */}
            <Text style={[styles.mainHeading, { color: colors.textPrimary, fontSize: scaleFont(20) }]}>
              {t("Approve desktop login")}
            </Text>
            <Text style={[styles.supportingText, { color: colors.textSecondary, fontSize: scaleFont(13.5) }]}>
              {t("Someone is requesting to log in to your BunkMates account.")}
            </Text>

            {/* Account Being Linked — Explicit Phone User Identity Banner */}
            <View style={[styles.accountCard, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
              <View style={styles.accountAvatarWrap}>
                {userAvatar ? (
                  <Image source={{ uri: userAvatar }} style={styles.accountAvatar} />
                ) : (
                  <View style={[styles.accountAvatarFallback, { backgroundColor: colors.coralBg }]}>
                    <Text style={[styles.accountAvatarInitial, { color: colors.coral }]}>
                      {userName.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
                <View style={styles.accountStatusDot} />
              </View>

              <View style={styles.accountInfoCol}>
                <View style={styles.accountHeaderRow}>
                  <Text style={[styles.accountName, { color: colors.textPrimary, fontSize: scaleFont(14.5) }]} numberOfLines={1}>
                    {userName}
                  </Text>
                  <View style={[styles.phoneBadge, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" }]}>
                    <Ionicons name="phone-portrait" size={11} color="#22C55E" />
                    <Text style={[styles.phoneBadgeText, { fontSize: scaleFont(11) }]}>
                      {t("This Phone's Account")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.accountEmail, { color: colors.textSecondary, fontSize: scaleFont(12.5) }]} numberOfLines={1}>
                  {userEmail}
                </Text>
              </View>
            </View>

            {/* Error banner if validation/approval failed */}
            {errorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: colors.dangerBg }]}>
                <Ionicons name="alert-circle" size={18} color={colors.dangerText} style={{ marginTop: 1 }} />
                <Text style={[styles.errorBannerText, { color: colors.dangerText, fontSize: scaleFont(12.5) }]}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Requesting Desktop Device Details Card */}
            <View style={[styles.deviceCard, { backgroundColor: colors.cardElevated, borderColor: colors.cardBorder }]}>
              {/* Row 1: Platform & OS */}
              <View style={styles.detailRow}>
                <View style={styles.labelCol}>
                  <Feather name="cpu" size={15} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                    {t("Platform")}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.textPrimary, fontSize: scaleFont(13.5) }]}>
                  {session?.requesterMetadata?.os || "Desktop Operating System"}
                </Text>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

              {/* Row 2: Browser / Client */}
              <View style={styles.detailRow}>
                <View style={styles.labelCol}>
                  <Feather name="globe" size={15} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                    {t("Browser")}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.textPrimary, fontSize: scaleFont(13.5) }]}>
                  {session?.requesterMetadata?.browser || "Web Browser"}
                </Text>
              </View>

              <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

              {/* Row 3: Request Time */}
              <View style={styles.detailRow}>
                <View style={styles.labelCol}>
                  <Feather name="clock" size={15} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                    {t("Request time")}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.textPrimary, fontSize: scaleFont(13.5) }]}>
                  {formatRequestTime(session?.createdAt)}
                </Text>
              </View>

              {/* Row 4: Optional Location (Presented accurately with unverified disclaimer) */}
              {session?.requesterMetadata?.location ? (
                <>
                  <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.detailRow}>
                    <View style={styles.labelCol}>
                      <Feather name="map-pin" size={15} color={colors.textSecondary} />
                      <Text style={[styles.detailLabel, { color: colors.textSecondary, fontSize: scaleFont(13) }]}>
                        {t("Location")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.detailValue, { color: colors.textPrimary, fontSize: scaleFont(13.5) }]}>
                        {session.requesterMetadata.location}
                      </Text>
                      <Text style={[styles.unverifiedNote, { color: colors.textSecondary, fontSize: scaleFont(11) }]}>
                        ({t("Self-reported by browser, not verified")})
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>

            {/* Security Notice */}
            <View style={styles.securityNoticeRow}>
              <Ionicons name="shield-checkmark" size={15} color={colors.textSecondary} style={{ marginTop: 1 }} />
              <Text style={[styles.securityNoticeText, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
                {t("Only approve this request if you scanned the QR code on your own computer screen.")}
              </Text>
            </View>

            {/* Action Buttons: Primary (Approve & Log In) and Secondary (Reject) */}
            <View style={styles.actionsContainer}>
              {/* Primary Action Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: colors.coral,
                    borderWidth: colors.accentBorder !== "transparent" ? 1 : 0,
                    borderColor: colors.accentBorder,
                    opacity: isApproving || isRejecting ? 0.7 : 1,
                  },
                  pressed && { opacity: 0.88 },
                ]}
                onPress={onApprove}
                disabled={isApproving || isRejecting}
              >
                {isApproving ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator size="small" color={colors.onAccent} />
                    <Text style={[styles.primaryBtnText, { color: colors.onAccent, fontSize: scaleFont(15), marginLeft: 8 }]}>
                      {t("Authorizing...")}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnLoadingRow}>
                    <Ionicons name="checkmark-sharp" size={18} color={colors.onAccent} style={{ marginRight: 6 }} />
                    <Text style={[styles.primaryBtnText, { color: colors.onAccent, fontSize: scaleFont(15) }]}>
                      {t("Approve & Log In")}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Secondary Action Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.cardElevated,
                    opacity: isApproving || isRejecting ? 0.5 : 1,
                  },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={onReject}
                disabled={isApproving || isRejecting}
              >
                {isRejecting ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary, fontSize: scaleFont(15) }]}>
                    {t("Reject")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SwipeableDrawer>
  );
};

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  container: {
    width: "100%",
  },
  headerIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  mainHeading: {
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 6,
  },
  supportingText: {
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontWeight: "500",
    lineHeight: 17,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 12,
  },
  accountAvatarWrap: {
    position: "relative",
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  accountAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarInitial: {
    fontSize: 18,
    fontWeight: "700",
  },
  accountStatusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#161618",
  },
  accountInfoCol: {
    flex: 1,
    justifyContent: "center",
  },
  accountHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    gap: 8,
  },
  accountName: {
    fontWeight: "700",
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  phoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  phoneBadgeText: {
    color: "#22C55E",
    fontWeight: "600",
  },
  accountEmail: {
    fontWeight: "500",
  },
  deviceCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  labelCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontWeight: "500",
  },
  detailValue: {
    fontWeight: "600",
  },
  unverifiedNote: {
    marginTop: 2,
    fontStyle: "italic",
  },
  rowDivider: {
    height: 1,
    width: "100%",
  },
  securityNoticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  securityNoticeText: {
    flex: 1,
    lineHeight: 16,
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  btnLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontWeight: "600",
  },
  stateContainer: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  largeIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stateTitle: {
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  stateSubtitle: {
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
});
