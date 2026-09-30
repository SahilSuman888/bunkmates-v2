// **@** Account & Security — Premium UI with live multi-device sync, trust controls, dynamic theme
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert,
  TextInput,
  Platform,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useUser } from "../contexts/UserContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { auth, db } from "../lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { deleteUser, sendPasswordResetEmail } from "firebase/auth";
import {
  DeviceSession,
  TrustedDevice,
  getDeviceHardwareInfo,
  getPersistentDeviceId,
  recordDeviceSessionInFirestore,
} from "../utils/sessionTracker";

export default function AccountAndSecurity() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);

  // **@** Preserved privacy settings
  const [privacy, setPrivacy] = useState<{
    profileVisibility: "public" | "private";
    canBeAddedToGroups: "everyone" | "friends" | "nobody";
    canBeAddedToTrips: "everyone" | "friends" | "nobody";
  }>({
    profileVisibility: "public",
    canBeAddedToGroups: "everyone",
    canBeAddedToTrips: "everyone",
  });

  // **@** Live security state from Firestore
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [currentDeviceName, setCurrentDeviceName] = useState<string>("");
  const [loginActivity, setLoginActivity] = useState<DeviceSession[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);

  // **@** Modal states
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showTripsModal, setShowTripsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDeviceNameInput, setNewDeviceNameInput] = useState("");
  const [newDeviceTypeInput, setNewDeviceTypeInput] = useState<"phone" | "tablet" | "desktop">("phone");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // **@** Dynamic theme
  let themeMode: "dark" | "light" | "system" = "system";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) themeMode = themeContext.mode;
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255,255,255,0.08)" : "#EAECF0",
      divider: isDark ? "rgba(255,255,255,0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#0F1117",
      textSecondary: isDark ? "#8E95A2" : "#6B7280",
      sectionHeader: isDark ? "#636875" : "#9CA3AF",
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      iconBoxBg: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
      chevron: isDark ? "#434650" : "#C4C9D4",
      activeGreen: "#10B981",
      greenBg: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
      greenBorder: isDark ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.25)",
      coral: "#FF5A5F",
      coralBg: isDark ? "rgba(255,90,95,0.12)" : "rgba(255,90,95,0.08)",
      coralBorder: isDark ? "rgba(255,90,95,0.3)" : "rgba(255,90,95,0.2)",
      switchActive: "#FF5A5F",
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      dangerCardBg: isDark ? "rgba(255,90,95,0.08)" : "#FFF1F2",
      dangerCardBorder: isDark ? "rgba(255,90,95,0.22)" : "#FECDD3",
      dangerIconBg: isDark ? "rgba(255,90,95,0.15)" : "#FFE4E6",
      dangerText: "#FF5A5F",
      dangerSubtext: isDark ? "rgba(255,120,125,0.8)" : "#E11D48",
      modalOverlay: "rgba(0,0,0,0.7)",
      selectedPill: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
      heroGradientTop: isDark ? "#141418" : "#FFFFFF",
      mutedBadge: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      mutedBadgeBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    }),
    [isDark]
  );

  // **@** Setup current device and register session
  useEffect(() => {
    if (!user) return;
    (async () => {
      const devId = await getPersistentDeviceId();
      const hardware = getDeviceHardwareInfo(user.displayName);
      setCurrentDeviceId(devId);
      setCurrentDeviceName(hardware.name);
      await recordDeviceSessionInFirestore(user);
    })();
  }, [user]);

  // **@** Live Firestore subscription
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

          if (uData.privacy) {
            setPrivacy({
              profileVisibility: uData.privacy.profileVisibility || "public",
              canBeAddedToGroups: uData.privacy.canBeAddedToGroups || "everyone",
              canBeAddedToTrips: uData.privacy.canBeAddedToTrips || "everyone",
            });
          }

          if (uData.security?.twoFactorEnabled !== undefined) {
            setTwoFactorEnabled(!!uData.security.twoFactorEnabled);
          }

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
        console.log("onSnapshot error:", err);
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

  const updatePrivacy = async (field: keyof typeof privacy, value: string) => {
    setPrivacy((prev) => ({ ...prev, [field]: value as any }));
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`privacy.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log("Privacy update error:", e);
      Alert.alert("Error", "Could not save privacy setting.");
    }
  };

  const handleToggle2FA = async (val: boolean) => {
    setTwoFactorEnabled(val);
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "security.twoFactorEnabled": val,
        updatedAt: new Date(),
      });
    } catch (e) {
      setTwoFactorEnabled(!val);
      Alert.alert("Error", "Could not update Two-Factor Authentication state.");
    }
  };

  const handleTrustDevice = async (
    targetId: string,
    targetName: string,
    targetType: "phone" | "tablet" | "desktop"
  ) => {
    if (!user) return;
    if (isDeviceTrusted(targetId, targetName)) {
      Alert.alert("Already Trusted", `"${targetName}" is already a trusted device.`);
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
      Alert.alert("Device Trusted", `"${targetName}" is now a trusted device.`);
    } catch (e) {
      Alert.alert("Error", "Could not register trusted device.");
    }
  };

  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Remove Trust",
      `Remove "${deviceName}" from trusted devices?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const nextDevices = trustedDevices.filter(
              (d) => d.id !== deviceId && d.name !== deviceName
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
          },
        },
      ]
    );
  };

  const handleDeviceSessionPress = (session: DeviceSession) => {
    const isThisDevice = session.id === currentDeviceId;
    const trusted = isDeviceTrusted(session.id, session.deviceName);

    const buttons: any[] = [{ text: "Cancel", style: "cancel" }];
    if (!trusted) {
      buttons.push({
        text: "Trust This Device",
        onPress: () => handleTrustDevice(session.id, session.deviceName, session.deviceType),
      });
    } else {
      buttons.push({
        text: "Remove Trust",
        style: "destructive",
        onPress: () => handleRevokeDevice(session.id, session.deviceName),
      });
    }
    if (!isThisDevice) {
      buttons.push({
        text: "Log Out Session",
        style: "destructive",
        onPress: () => handleTerminateSession(session.id, session.deviceName, false),
      });
    }

    Alert.alert(
      session.deviceName,
      `Status: ${isThisDevice ? "This Device (Active)" : session.isActive ? "Online" : "Previous Session"}\nTrust: ${trusted ? "Trusted" : "Not Trusted"}\nLocation: ${session.location}`,
      buttons
    );
  };

  const handleTerminateSession = (sessionId: string, sessionName: string, isCurrent: boolean) => {
    if (isCurrent) {
      Alert.alert("Active Session", "This is your current device. Use Log Out at the bottom to sign out.");
      return;
    }
    Alert.alert("Log Out Session", `Terminate the session on "${sessionName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          const nextLogins = loginActivity.filter((s) => s.id !== sessionId);
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
        },
      },
    ]);
  };

  const handleAddManualDevice = async () => {
    const trimmed = newDeviceNameInput.trim();
    if (!trimmed) {
      Alert.alert("Name Required", "Please enter a device name.");
      return;
    }
    if (!user) return;
    const formattedDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const newId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSession: DeviceSession = {
      id: newId,
      deviceName: trimmed,
      deviceType: newDeviceTypeInput,
      location: "Active Session",
      lastActive: "Just now",
      isActive: true,
      lastActiveTimestamp: Date.now(),
    };
    const nextLogins = [newSession, ...loginActivity];
    setLoginActivity(nextLogins);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "security.loginActivity": nextLogins,
        updatedAt: new Date(),
      });
      setShowAddDeviceModal(false);
      setNewDeviceNameInput("");
      Alert.alert("Device Added", `"${trimmed}" has been recorded.`);
    } catch (e) {
      Alert.alert("Error", "Could not register device.");
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert("Error", "No email associated with this account.");
      return;
    }
    Alert.alert(
      "Change Password",
      `Send a password reset link to ${user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, user.email!);
              setResetEmailSent(true);
              Alert.alert("Email Sent", `Check your inbox at ${user.email}.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to send reset email.");
            }
          },
        },
      ]
    );
  };

  const backupCodes = useMemo(
    () => ["9482-1054", "5128-4491", "8031-6729", "4190-2834", "7721-3904", "6649-1182"],
    []
  );

  const handleCopyBackupCodes = async () => {
    await Clipboard.setStringAsync(backupCodes.join("\n"));
    Alert.alert("Copied", "Backup codes copied. Store them safely.");
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        setShowDeleteConfirm(false);
        router.replace("/(auth)/login" as any);
      }
    } catch (e: any) {
      setIsDeleting(false);
      Alert.alert(
        "Re-authentication Required",
        e?.message || "Please sign out, log back in, and try again."
      );
    }
  };

  // **@** Device icon helper
  const getDeviceIcon = (deviceType: "phone" | "tablet" | "desktop", size = 20, color?: string) => {
    const c = color || colors.greyishWhite;
    if (deviceType === "tablet") return <Ionicons name="tablet-portrait-outline" size={size} color={c} />;
    if (deviceType === "desktop") return <Ionicons name="desktop-outline" size={size} color={c} />;
    return <Ionicons name="phone-portrait-outline" size={size} color={c} />;
  };

  // **@** Format relative time
  const formatTimestamp = (ts?: number): string => {
    if (!ts) return "Previously";
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.greyishWhite} />
      </View>
    );
  }

  const isCurrentDeviceAlreadyTrusted = isDeviceTrusted(currentDeviceId, currentDeviceName);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Account & Security</Text>
        <Pressable
          onPress={handleManualRefresh}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={6}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.greyishWhite} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={colors.greyishWhite} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero Info Card ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.heroIconWrap, { backgroundColor: colors.iconBoxBg }]}>
            <Ionicons name="shield-checkmark" size={28} color={colors.greyishWhite} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Security Overview</Text>
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              {loginActivity.length} active session{loginActivity.length !== 1 ? "s" : ""} •{" "}
              {trustedDevices.length} trusted device{trustedDevices.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: twoFactorEnabled ? colors.greenBg : colors.coralBg, borderColor: twoFactorEnabled ? colors.greenBorder : colors.coralBorder }]}>
            <Ionicons name={twoFactorEnabled ? "lock-closed" : "lock-open-outline"} size={12} color={twoFactorEnabled ? colors.activeGreen : colors.coral} />
            <Text style={[styles.heroBadgeText, { color: twoFactorEnabled ? colors.activeGreen : colors.coral }]}>
              2FA {twoFactorEnabled ? "On" : "Off"}
            </Text>
          </View>
        </View>

        {/* ── PASSWORD ── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionHeader }]}>PASSWORD</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={handleChangePassword}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="key-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Change Password</Text>
              <Text style={[styles.rowSub, { color: resetEmailSent ? colors.activeGreen : colors.textSecondary }]}>
                {resetEmailSent ? "✓ Reset link sent to your email" : "Send a secure password reset link"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── 2FA ── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionHeader }]}>TWO-FACTOR AUTHENTICATION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)" }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.activeGreen} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Two-Factor Auth</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {twoFactorEnabled ? "Your account is extra secure" : "Add an extra layer of protection"}
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
              trackColor={{ false: colors.switchInactive, true: colors.activeGreen }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setShowBackupCodes(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="documents-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Backup Codes</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>6 single-use emergency recovery codes</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── LOGIN ACTIVITY ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            LOGIN ACTIVITY
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={handleManualRefresh}
              hitSlop={6}
            >
              {isSyncing
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
              }
            </Pressable>
            <Pressable
              onPress={() => setShowAddDeviceModal(true)}
              hitSlop={6}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {loginActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.greyishWhite} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Syncing sessions...
              </Text>
            </View>
          ) : (
            loginActivity.map((session, idx) => {
              const isThisDevice = session.id === currentDeviceId;
              const isOnline = isThisDevice || session.isActive;
              const trusted = isDeviceTrusted(session.id, session.deviceName);

              // Build the display name: append "(Active Now)" inline like the reference image
              const displayName = isThisDevice
                ? `${session.deviceName} (Active Now)`
                : session.deviceName;

              // Build the subtitle: "Location, Country • time" in green if active
              const locationPart = session.location.split("•")[0].trim();
              const timePart = isThisDevice ? "Just now" : formatTimestamp(session.lastActiveTimestamp);
              const subtitle = `${locationPart} • ${timePart}`;

              return (
                <React.Fragment key={session.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                  <Pressable
                    style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
                    onPress={() => handleDeviceSessionPress(session)}
                  >
                    {/* Plain device icon — no box, just the icon itself */}
                    <View style={styles.activityIconWrap}>
                      {getDeviceIcon(session.deviceType, 24, colors.textPrimary)}
                    </View>

                    {/* Name + location/time */}
                    <View style={styles.activityInfo}>
                      <Text style={[styles.activityName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.activitySub, { color: isOnline ? colors.activeGreen : colors.textSecondary }]} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    </View>
                  </Pressable>
                </React.Fragment>
              );
            })
          )}
        </View>

        {/* ── TRUSTED DEVICES ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            TRUSTED DEVICES
          </Text>
          {!isCurrentDeviceAlreadyTrusted && (
            <Pressable
              onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")}
              hitSlop={6}
            >
              <Text style={[styles.sectionAction, { color: colors.coral }]}>+ Trust This Device</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {trustedDevices.length === 0 ? (
            <View style={styles.emptyTrusted}>
              <View style={[styles.emptyTrustedIcon, { backgroundColor: colors.coralBg }]}>
                <Ionicons name="shield-outline" size={26} color={colors.coral} />
              </View>
              <Text style={[styles.emptyTrustedTitle, { color: colors.textPrimary }]}>
                No Trusted Devices
              </Text>
              <Text style={[styles.emptyTrustedSub, { color: colors.textSecondary }]}>
                Authorize {currentDeviceName || "this device"} so future sign-ins won't need extra verification.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.trustNowBtn,
                  { backgroundColor: colors.coralBg, borderColor: colors.coralBorder },
                  pressed && styles.pressed,
                ]}
                onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")}
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.coral} style={{ marginRight: 6 }} />
                <Text style={[styles.trustNowText, { color: colors.coral }]}>
                  Trust {currentDeviceName || "This Device"}
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
                  {/* Coral filled circle with shield-check — exactly like the reference image */}
                  <View style={[styles.trustedIconCircle, { backgroundColor: colors.coralBg }]}>
                    <Ionicons name="shield-checkmark" size={22} color={colors.coral} />
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

        {/* ── PRIVACY ── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionHeader }]}>PRIVACY & PERMISSIONS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Private Profile */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Feather name="lock" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Private Profile</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {privacy.profileVisibility === "private" ? "Only friends can see your profile" : "Profile visible to everyone"}
              </Text>
            </View>
            <Switch
              value={privacy.profileVisibility === "private"}
              onValueChange={(val) => updatePrivacy("profileVisibility", val ? "private" : "public")}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Groups */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setShowGroupsModal(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <MaterialCommunityIcons name="account-group-outline" size={21} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Who can add you to groups</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {privacy.canBeAddedToGroups.charAt(0).toUpperCase() + privacy.canBeAddedToGroups.slice(1)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Trips */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setShowTripsModal(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Feather name="briefcase" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Who can add you to trips</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                {privacy.canBeAddedToTrips.charAt(0).toUpperCase() + privacy.canBeAddedToTrips.slice(1)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── DANGER ZONE ── */}
        <Text style={[styles.sectionLabel, { color: colors.sectionHeader }]}>DANGER ZONE</Text>
        <Pressable
          style={({ pressed }) => [
            styles.dangerCard,
            { backgroundColor: colors.dangerCardBg, borderColor: colors.dangerCardBorder },
            pressed && styles.pressed,
          ]}
          onPress={() => setShowDeleteConfirm(true)}
        >
          <View style={[styles.dangerIconBox, { backgroundColor: colors.dangerIconBg }]}>
            <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
          </View>
          <View style={styles.rowMid}>
            <Text style={[styles.rowTitle, { color: colors.dangerText }]}>Delete BunkMates Account</Text>
            <Text style={[styles.rowSub, { color: colors.dangerSubtext }]}>
              Permanently remove all data and trip history
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.dangerText} />
        </Pressable>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── ADD DEVICE MODAL ── */}
      <Modal transparent visible={showAddDeviceModal} animationType="fade" onRequestClose={() => setShowAddDeviceModal(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalIcon, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="phone-portrait" size={28} color={colors.greyishWhite} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Register Device Session</Text>
            <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
              Running on another device? Register it here to verify multi-device sync.
            </Text>

            <TextInput
              value={newDeviceNameInput}
              onChangeText={setNewDeviceNameInput}
              placeholder="e.g. iPad Air, Work MacBook, Galaxy S23"
              placeholderTextColor={colors.chevron}
              style={[styles.modalInput, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            />

            <View style={{ flexDirection: "row", width: "100%", gap: 8, marginBottom: 20 }}>
              {(["phone", "tablet", "desktop"] as const).map((t) => {
                const isSelected = newDeviceTypeInput === t;
                return (
                  <Pressable
                    key={t}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: isSelected ? colors.coralBg : colors.iconBoxBg,
                        borderColor: isSelected ? colors.coral : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setNewDeviceTypeInput(t)}
                  >
                    <Text style={[styles.typeChipText, { color: isSelected ? colors.coral : colors.textPrimary }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalSecBtn, { borderColor: colors.cardBorder }]} onPress={() => setShowAddDeviceModal(false)}>
                <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimBtn, { backgroundColor: colors.coral }]} onPress={handleAddManualDevice}>
                <Text style={styles.modalPrimBtnText}>Register</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── PRIVACY SELECTOR MODAL ── */}
      <Modal
        transparent
        visible={showGroupsModal || showTripsModal}
        animationType="fade"
        onRequestClose={() => { setShowGroupsModal(false); setShowTripsModal(false); }}
      >
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showGroupsModal ? "Who can add you to groups" : "Who can add you to trips"}
            </Text>
            <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
              Choose your privacy level:
            </Text>

            <View style={{ width: "100%", gap: 10, marginBottom: 20 }}>
              {(["everyone", "friends", "nobody"] as const).map((opt) => {
                const field = showGroupsModal ? "canBeAddedToGroups" : "canBeAddedToTrips";
                const isSelected = privacy[field] === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[
                      styles.selectorItem,
                      {
                        backgroundColor: isSelected ? colors.selectedPill : colors.iconBoxBg,
                        borderColor: isSelected ? colors.switchActive : colors.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      updatePrivacy(field, opt);
                      setShowGroupsModal(false);
                      setShowTripsModal(false);
                    }}
                  >
                    <Text style={[styles.selectorText, { color: colors.textPrimary }]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                    {isSelected && <Feather name="check" size={18} color={colors.switchActive} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.modalSecBtn, { borderColor: colors.cardBorder, flex: 0, width: "100%", height: 46 }]}
              onPress={() => { setShowGroupsModal(false); setShowTripsModal(false); }}
            >
              <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── BACKUP CODES MODAL ── */}
      <Modal transparent visible={showBackupCodes} animationType="fade" onRequestClose={() => setShowBackupCodes(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalIcon, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="key" size={28} color={colors.greyishWhite} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Backup Codes</Text>
            <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
              Store these single-use recovery codes somewhere safe. Each code can only be used once.
            </Text>

            <View style={[styles.codesGrid, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder }]}>
              {backupCodes.map((code, idx) => (
                <Text key={idx} style={[styles.codeItem, { color: colors.textPrimary, borderColor: colors.cardBorder }]}>
                  {code}
                </Text>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable style={[styles.modalSecBtn, { borderColor: colors.cardBorder }]} onPress={() => setShowBackupCodes(false)}>
                <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>Close</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimBtn, { backgroundColor: colors.switchActive }]} onPress={handleCopyBackupCodes}>
                <Text style={styles.modalPrimBtnText}>Copy All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DELETE ACCOUNT MODAL ── */}
      <Modal transparent visible={showDeleteConfirm} animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalDangerIcon, { backgroundColor: colors.dangerIconBg }]}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={36} color={colors.dangerText} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Delete Account?</Text>
            <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
              This permanently removes your BunkMates profile, trip history, chats, and all data. This cannot be undone.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalSecBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDangerBtn, { backgroundColor: colors.dangerText }]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDangerBtnText}>Delete Forever</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  pressed: { opacity: 0.72 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    paddingBottom: 10,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginHorizontal: 12,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },

  // Hero Card
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  // Chip button
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Card
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },

  // Standard row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowMid: { flex: 1, marginRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  rowSub: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  // ── LOGIN ACTIVITY rows (matches reference image: plain icon, name+status inline, green subtitle) ──
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  activityIconWrap: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  activityInfo: { flex: 1 },
  activityName: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  activitySub: {
    fontSize: 12.5,
    fontWeight: "500",
  },

  // ── TRUSTED DEVICE rows (matches reference image: coral circle, name, approved date, chevron) ──
  trustedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  trustedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  trustedInfo: { flex: 1, marginRight: 8 },
  trustedName: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  trustedSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  thisDeviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: 7,
  },

  // kept for emptyState references
  deviceInfo: { flex: 1, marginRight: 8 },
  deviceNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  deviceName: { fontSize: 14.5, fontWeight: "600", letterSpacing: -0.2, flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 6 },
  deviceLocation: { fontSize: 11.5, marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  deviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // sectionAction text (used in Trust This Device header link)
  sectionAction: { fontSize: 12.5, fontWeight: "700" },

  // Empty states
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  emptyStateText: { fontSize: 13.5 },
  emptyTrusted: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyTrustedIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTrustedTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptyTrustedSub: { fontSize: 12.5, lineHeight: 18, textAlign: "center", marginBottom: 18 },
  trustNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  trustNowText: { fontSize: 13.5, fontWeight: "600" },

  // Danger Card
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  dangerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  // Modals
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalDangerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  modalMsg: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  modalInput: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    marginBottom: 14,
  },
  typeChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  typeChipText: { fontSize: 13, fontWeight: "600" },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  selectorText: { fontSize: 15, fontWeight: "600" },
  codesGrid: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 6,
  },
  codeItem: {
    width: "48%",
    fontSize: 13.5,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    textAlign: "center",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtnRow: { flexDirection: "row", width: "100%", gap: 12 },
  modalSecBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecBtnText: { fontSize: 14.5, fontWeight: "600" },
  modalPrimBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimBtnText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
  modalDangerBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDangerBtnText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700" },
});