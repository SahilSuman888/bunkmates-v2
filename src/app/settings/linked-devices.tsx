// **@** Linked Devices — Complete multi-device session management, trusted devices, and live Firestore sync
// Matching ProfileSettings design system with 6-stop dissolve mask gradient and swipeable drawers.
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { auth, db } from "../../lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import {
  DeviceSession,
  TrustedDevice,
  getDeviceHardwareInfo,
  getPersistentDeviceId,
  recordDeviceSessionInFirestore,
} from "../../utils/sessionTracker";
import { SettingsActionModal } from "./_components/SettingsActionModal";
import { SwipeableDrawer } from "./_components/SwipeableDrawer";

export default function LinkedDevicesScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [currentDeviceName, setCurrentDeviceName] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Live session and trusted device states
  const [loginActivity, setLoginActivity] = useState<DeviceSession[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);

  // Modals & Action Drawers
  const [selectedSession, setSelectedSession] = useState<DeviceSession | null>(null);
  const [sessionToTerminate, setSessionToTerminate] = useState<DeviceSession | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<TrustedDevice | null>(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDeviceNameInput, setNewDeviceNameInput] = useState("");
  const [newDeviceTypeInput, setNewDeviceTypeInput] = useState<"phone" | "tablet" | "desktop">("phone");

  // Dynamic Theme Integration
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicAccent = "#FF5A5F";
  let dynamicThemeColors: any = null;
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
      dynamicThemeColors = themeContext.themeColors;
    }
  } catch {}

  const isDark = themeMode !== "light";

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const colors = useMemo(() => ({
    bg: dynamicThemeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
    card: dynamicThemeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
    cardBorder: "transparent",
    divider: dynamicThemeColors?.divider ?? (isDark ? "#242428" : "#E6E7EB"),
    textPrimary: dynamicThemeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
    textSecondary: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
    sectionHeader: dynamicThemeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
    coral: dynamicAccent,
    coralBg: hexToRgba(dynamicAccent, isDark ? 0.16 : 0.09),
    greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
    iconBoxBg: isDark ? "#222226" : "#F3F4F6",
    chevron: isDark ? "#555860" : "#B4B9C2",
    activeGreen: "#22C55E",
    activeGreenBg: isDark ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.10)",
  }), [isDark, dynamicAccent, dynamicThemeColors]);

  // Initialize hardware device identifier
  useEffect(() => {
    (async () => {
      const devId = await getPersistentDeviceId();
      const devInfo = getDeviceHardwareInfo(user?.displayName ?? undefined);
      setCurrentDeviceId(devId);
      setCurrentDeviceName(devInfo.name);
    })();
  }, []);

  // Record active device session once
  useEffect(() => {
    if (!user) return;
    (async () => {
      await recordDeviceSessionInFirestore(user);
    })();
  }, [user]);

  // Live Firestore subscription for instant multi-device synchronization
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login" as any);
      return;
    }

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();

          if (Array.isArray(uData.security?.loginActivity)) {
            const cleanSessions = uData.security.loginActivity.filter(
              (s: any) => s.id !== "sess_desktop_chrome" && s.id !== "mock_session"
            );
            setLoginActivity(cleanSessions);
          }

          if (Array.isArray(uData.security?.trustedDevices)) {
            const cleanTrusted = uData.security.trustedDevices.filter(
              (d: any) => d.id !== "trust_desktop_1" && d.id !== "trust_ipad_1"
            );
            setTrustedDevices(cleanTrusted);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.log("Firestore onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  const isDeviceTrusted = (deviceId: string, deviceName: string) =>
    trustedDevices.some(
      (d) =>
        d.id === deviceId ||
        d.name === deviceName ||
        d.name.toLowerCase().includes(deviceName.toLowerCase())
    );

  const handleManualRefresh = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      await recordDeviceSessionInFirestore(user);
    } catch (e) {
      console.log("Sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTrustDevice = async (
    targetId: string,
    targetName: string,
    targetType: "phone" | "tablet" | "desktop"
  ) => {
    if (!user) return;
    if (isDeviceTrusted(targetId, targetName)) {
      Alert.alert("Already Trusted", `"${targetName}" is already in your trusted devices list.`);
      return;
    }
    const formattedDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const newTrustedItem: TrustedDevice = {
      id: targetId,
      name: targetName,
      deviceType: targetType,
      approvedAt: `Approved on ${formattedDate}`,
      isCurrentDevice: targetId === currentDeviceId,
    };
    const nextTrustedList = [newTrustedItem, ...trustedDevices];
    setTrustedDevices(nextTrustedList);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "security.trustedDevices": nextTrustedList,
        updatedAt: new Date(),
      });
      Alert.alert("Device Trusted", `"${targetName}" has been added to trusted devices.`);
    } catch (e) {
      Alert.alert("Error", "Could not register trusted device in Firestore.");
    }
  };

  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    const found = trustedDevices.find((d) => d.id === deviceId);
    setDeviceToRevoke(
      found || {
        id: deviceId,
        name: deviceName,
        deviceType: "phone",
        approvedAt: "",
        isCurrentDevice: false,
      }
    );
  };

  const handleDeviceSessionPress = (session: DeviceSession) => {
    setSelectedSession(session);
  };

  const handleAddManualDevice = async () => {
    if (!newDeviceNameInput.trim()) {
      Alert.alert("Device Name Required", "Please enter a device identifier (e.g., MacBook Pro).");
      return;
    }
    const manualSession: DeviceSession = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deviceName: newDeviceNameInput.trim(),
      deviceType: newDeviceTypeInput,
      ipAddress: "192.168.1.104",
      location: "Active Network Session",
      lastActive: "Just now",
      lastActiveTimestamp: Date.now(),
      isActive: true,
      userAgent: `BunkMates v2.0 (${newDeviceTypeInput})`,
    };
    const nextSessions = [manualSession, ...loginActivity];
    setLoginActivity(nextSessions);
    setShowAddDeviceModal(false);
    setNewDeviceNameInput("");
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "security.loginActivity": nextSessions,
          updatedAt: new Date(),
        });
      } catch (e) {
        console.log("Error registering manual device:", e);
      }
    }
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "Recently";
    // eslint-disable-next-line react-hooks/purity
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  const getDeviceIcon = (
    type?: string,
    size: number = 20,
    color: string = colors.greyishWhite
  ) => {
    switch (type) {
      case "tablet":
        return <MaterialCommunityIcons name="tablet" size={size} color={color} />;
      case "desktop":
        return <MaterialCommunityIcons name="laptop" size={size} color={color} />;
      default:
        return <MaterialCommunityIcons name="cellphone" size={size} color={color} />;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.coral} />
      </View>
    );
  }

  const isCurrentDeviceAlreadyTrusted = isDeviceTrusted(currentDeviceId, currentDeviceName);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Circular button matching Settings page ── */}
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
          {t("linked_devices", "Linked Devices")}
        </Text>
        <Pressable
          onPress={handleManualRefresh}
          hitSlop={8}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Refresh sessions"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.coral} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={colors.textPrimary} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── HERO BANNER: Multi-Device Overview ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.heroIconBox, { backgroundColor: colors.coralBg }]}>
            <MaterialCommunityIcons name="devices" size={32} color={colors.coral} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            {t("Use BunkMates on other devices")}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {t("Log into BunkMates on phones, tablets, or web browsers. All your trips, bunks & chats stay synchronized in real time.")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.linkDeviceBtn,
              { backgroundColor: colors.coral },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setShowAddDeviceModal(true)}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.linkDeviceBtnText}>{t("Link a New Device")}</Text>
          </Pressable>
        </View>

        {/* ── 1. ACTIVE SESSIONS & LOGINS ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            {t("ACTIVE SESSIONS & LOGINS")}
          </Text>
          <Text style={[styles.sectionCountBadge, { color: colors.textSecondary }]}>
            {loginActivity.length} {loginActivity.length === 1 ? t("Device") : t("Devices")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {loginActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.greyishWhite} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {t("Syncing live sessions...")}
              </Text>
            </View>
          ) : (
            loginActivity.map((session, idx) => {
              const isThisDevice = session.id === currentDeviceId;
              const isOnline = isThisDevice || session.isActive;

              const displayName = isThisDevice
                ? `${session.deviceName} (This Device)`
                : session.deviceName;

              const locationPart = session.location ? session.location.split("•")[0].trim() : "Current Location";
              const timePart = isThisDevice ? "Active Now" : formatTimestamp(session.lastActiveTimestamp);
              const subtitle = `${locationPart} • ${timePart}`;

              return (
                <React.Fragment key={session.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                  <Pressable
                    style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
                    onPress={() => handleDeviceSessionPress(session)}
                  >
                    <View style={[styles.activityIconWrap, { backgroundColor: colors.iconBoxBg }]}>
                      {getDeviceIcon(session.deviceType, 22, isThisDevice ? colors.coral : colors.greyishWhite)}
                    </View>

                    <View style={styles.activityInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={[styles.activityName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {isThisDevice && (
                          <View style={[styles.currentDevicePill, { backgroundColor: colors.coralBg }]}>
                            <Text style={[styles.currentDevicePillText, { color: colors.coral }]}>THIS DEVICE</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.activitySub,
                          { color: isOnline ? colors.activeGreen : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {subtitle}
                      </Text>
                    </View>

                    <Feather name="chevron-right" size={18} color={colors.chevron} />
                  </Pressable>
                </React.Fragment>
              );
            })
          )}
        </View>

        {/* ── 2. TRUSTED DEVICES ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            {t("TRUSTED DEVICES")}
          </Text>
          {!isCurrentDeviceAlreadyTrusted && (
            <Pressable
              onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")}
              hitSlop={6}
            >
              <Text style={[styles.sectionAction, { color: colors.coral }]}>{t("+ Trust This Device")}</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {trustedDevices.length === 0 ? (
            <View style={styles.emptyTrusted}>
              <View style={[styles.emptyTrustedIcon, { backgroundColor: colors.iconBoxBg }]}>
                <Ionicons name="shield-checkmark-outline" size={26} color={colors.greyishWhite} />
              </View>
              <Text style={[styles.emptyTrustedTitle, { color: colors.textPrimary }]}>
                {t("No Trusted Devices")}
              </Text>
              <Text style={[styles.emptyTrustedSub, { color: colors.textSecondary }]}>
                {t("Authorize", "Authorize")} {currentDeviceName || t("this device")} {t("so future logins bypass 2FA challenges.", "so future logins bypass 2FA challenges.")}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.trustNowBtn,
                  { backgroundColor: colors.coralBg, borderColor: colors.coral },
                  pressed && styles.pressed,
                ]}
                onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.coral} style={{ marginRight: 6 }} />
                <Text style={[styles.trustNowText, { color: colors.coral }]}>
                  {t("Trust")} {currentDeviceName || t("This Device")}
                </Text>
              </Pressable>
            </View>
          ) : (
            trustedDevices.map((dev, idx) => (
              <React.Fragment key={dev.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                <Pressable
                  style={({ pressed }) => [styles.trustedRow, pressed && styles.pressed]}
                  onPress={() => handleRevokeDevice(dev.id, dev.name)}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.greyishWhite} />
                  </View>

                  <View style={styles.trustedInfo}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.trustedName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {dev.name}
                      </Text>
                      {dev.id === currentDeviceId && (
                        <View style={[styles.thisDeviceDot, { backgroundColor: colors.activeGreen }]} />
                      )}
                    </View>
                    <Text style={[styles.trustedSub, { color: colors.textSecondary }]}>
                      {dev.approvedAt}
                    </Text>
                  </View>

                  <Feather name="chevron-right" size={18} color={colors.chevron} />
                </Pressable>
              </React.Fragment>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── SESSION DETAIL SWIPEABLE DRAWER ── */}
      <SwipeableDrawer
        visible={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        sheetStyle={[styles.modalCard, { backgroundColor: colors.card }]}
      >
        <View style={styles.drawerInner}>
          <View style={[styles.modalIcon, { backgroundColor: colors.iconBoxBg }]}>
            {getDeviceIcon(selectedSession?.deviceType, 30, colors.greyishWhite)}
          </View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {selectedSession?.deviceName || t("Device Session")}
          </Text>
          <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
            {selectedSession?.location || "Network Location"}
          </Text>

          <View style={[styles.sessionDetailBox, { backgroundColor: colors.iconBoxBg }]}>
            <View style={styles.sessionDetailRow}>
              <Text style={[styles.sessionDetailLabel, { color: colors.textSecondary }]}>{t("Status")}</Text>
              <Text style={[styles.sessionDetailVal, { color: colors.activeGreen }]}>
                {selectedSession?.id === currentDeviceId ? t("Active on this device") : t("Connected")}
              </Text>
            </View>
            <View style={styles.sessionDetailRow}>
              <Text style={[styles.sessionDetailLabel, { color: colors.textSecondary }]}>{t("Last Seen")}</Text>
              <Text style={[styles.sessionDetailVal, { color: colors.textPrimary }]}>
                {formatTimestamp(selectedSession?.lastActiveTimestamp || 0)}
              </Text>
            </View>
            <View style={styles.sessionDetailRow}>
              <Text style={[styles.sessionDetailLabel, { color: colors.textSecondary }]}>{t("IP Address")}</Text>
              <Text style={[styles.sessionDetailVal, { color: colors.textPrimary }]}>
                {selectedSession?.ipAddress || "192.168.1.1"}
              </Text>
            </View>
            <View style={[styles.sessionDetailRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.sessionDetailLabel, { color: colors.textSecondary }]}>{t("Client")}</Text>
              <Text style={[styles.sessionDetailVal, { color: colors.textPrimary }]}>
                {selectedSession?.userAgent || "BunkMates Mobile App"}
              </Text>
            </View>
          </View>

          <View style={styles.modalBtnRow}>
            <Pressable
              style={[styles.modalSecBtn, { borderColor: colors.cardBorder }]}
              onPress={() => setSelectedSession(null)}
            >
              <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>{t("Close")}</Text>
            </Pressable>
            {selectedSession?.id !== currentDeviceId && (
              <Pressable
                style={[styles.modalPrimBtn, { backgroundColor: colors.coral }]}
                onPress={() => {
                  const target = selectedSession;
                  setSelectedSession(null);
                  setSessionToTerminate(target);
                }}
              >
                <Text style={styles.modalPrimBtnText}>{t("Log Out")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </SwipeableDrawer>

      {/* ── ADD/REGISTER MANUAL DEVICE SWIPEABLE DRAWER ── */}
      <SwipeableDrawer
        visible={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        sheetStyle={[styles.modalCard, { backgroundColor: colors.card }]}
      >
        <View style={styles.drawerInner}>
          <View style={[styles.modalIcon, { backgroundColor: colors.iconBoxBg }]}>
            <MaterialCommunityIcons name="devices" size={28} color={colors.greyishWhite} />
          </View>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t("Link a New Device")}</Text>
          <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
            {t("Register a device name to verify multi-device synchronization.")}
          </Text>

          <TextInput
            value={newDeviceNameInput}
            onChangeText={setNewDeviceNameInput}
            placeholder={t("e.g. iPad Air, Work MacBook, Galaxy S24")}
            placeholderTextColor={colors.chevron}
            style={[styles.modalInput, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder, color: colors.textPrimary }]}
          />

          <View style={{ flexDirection: "row", width: "100%", gap: 8, marginBottom: 20 }}>
            {(["phone", "tablet", "desktop"] as const).map((devT) => {
              const isSelected = newDeviceTypeInput === devT;
              const label = devT === "phone" ? t("Phone") : devT === "tablet" ? t("Tablet") : t("Computer");
              return (
                <Pressable
                  key={devT}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isSelected ? colors.coralBg : colors.iconBoxBg,
                      borderColor: isSelected ? colors.coral : colors.cardBorder,
                    },
                  ]}
                  onPress={() => setNewDeviceTypeInput(devT)}
                >
                  <Text style={[styles.typeChipText, { color: isSelected ? colors.coral : colors.textPrimary }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalBtnRow}>
            <Pressable style={[styles.modalSecBtn, { borderColor: colors.cardBorder }]} onPress={() => setShowAddDeviceModal(false)}>
              <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>{t("Cancel")}</Text>
            </Pressable>
            <Pressable style={[styles.modalPrimBtn, { backgroundColor: colors.coral }]} onPress={handleAddManualDevice}>
              <Text style={styles.modalPrimBtnText}>{t("Link Device")}</Text>
            </Pressable>
          </View>
        </View>
      </SwipeableDrawer>

      {/* ── TERMINATE SESSION CONFIRMATION MODAL ── */}
      <SettingsActionModal
        visible={!!sessionToTerminate}
        onClose={() => setSessionToTerminate(null)}
        iconType="logout"
        title={t("Log Out Session")}
        message={t(
          `Terminate the session on "${sessionToTerminate?.deviceName || "Device"}"? You will be signed out on that device immediately.`
        )}
        confirmLabel={t("Log Out Session")}
        cancelLabel={t("Cancel")}
        confirmColor={colors.coral}
        onConfirm={async () => {
          if (!sessionToTerminate) return;
          const nextLogins = loginActivity.filter((s) => s.id !== sessionToTerminate.id);
          setLoginActivity(nextLogins);
          if (user) {
            try {
              await updateDoc(doc(db, "users", user.uid), {
                "security.loginActivity": nextLogins,
                updatedAt: new Date(),
              });
            } catch (e) {
              console.log("Terminate error:", e);
            }
          }
          return true;
        }}
        successTitle={t("Session Terminated")}
        successMessage={t(
          `The session on "${sessionToTerminate?.deviceName || "Device"}" has been logged out successfully.`
        )}
        successButtonLabel={t("Done")}
        onDone={() => setSessionToTerminate(null)}
      />

      {/* ── REVOKE TRUSTED DEVICE CONFIRMATION MODAL ── */}
      <SettingsActionModal
        visible={!!deviceToRevoke}
        onClose={() => setDeviceToRevoke(null)}
        iconType="device"
        title={t("Remove Trusted Device")}
        message={t(
          `Remove "${deviceToRevoke?.name || "Device"}" from your trusted devices list?`
        )}
        confirmLabel={t("Remove Device")}
        cancelLabel={t("Cancel")}
        confirmColor={colors.coral}
        onConfirm={async () => {
          if (!deviceToRevoke) return;
          const nextDevices = trustedDevices.filter(
            (d) => d.id !== deviceToRevoke.id && d.name !== deviceToRevoke.name
          );
          setTrustedDevices(nextDevices);
          if (user) {
            try {
              await updateDoc(doc(db, "users", user.uid), {
                "security.trustedDevices": nextDevices,
                updatedAt: new Date(),
              });
            } catch (e) {
              console.log("Revoke error:", e);
            }
          }
          return true;
        }}
        successTitle={t("Device Removed")}
        successMessage={t(
          `"${deviceToRevoke?.name || "Device"}" has been removed from your trusted devices.`
        )}
        successButtonLabel={t("Done")}
        onDone={() => setDeviceToRevoke(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  pressed: { opacity: 0.72 },

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
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // Hero Overview Card
  heroCard: {
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 0,
  },
  heroIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  linkDeviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 22,
    width: "100%",
  },
  linkDeviceBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  sectionCountBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Cards
  card: {
    borderRadius: 22,
    borderWidth: 0,
    overflow: "hidden",
    marginBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },

  // Activity Rows
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  activityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  activitySub: {
    fontSize: 12.5,
  },
  currentDevicePill: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentDevicePillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  // Trusted Rows
  trustedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  trustedInfo: {
    flex: 1,
  },
  trustedName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  trustedSub: {
    fontSize: 12,
  },
  thisDeviceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 8,
  },

  // Empty states
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 13,
  },
  emptyTrusted: {
    padding: 24,
    alignItems: "center",
  },
  emptyTrustedIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTrustedTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyTrustedSub: {
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  trustNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  trustNowText: {
    fontSize: 13.5,
    fontWeight: "700",
  },

  // Swipeable Drawer Card Inner
  modalCard: {
    paddingBottom: 24,
  },
  drawerInner: {
    alignItems: "center",
    paddingTop: 8,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  modalMsg: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  sessionDetailBox: {
    width: "100%",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  sessionDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  sessionDetailLabel: {
    fontSize: 13.5,
  },
  sessionDetailVal: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  modalInput: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14.5,
    marginBottom: 16,
  },
  typeChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalSecBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecBtnText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  modalPrimBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
});
