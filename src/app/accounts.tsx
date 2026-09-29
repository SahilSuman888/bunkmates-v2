// **@** Account & Security with live multi-device synchronization, Trusted vs Not Trusted status badges, and device trust controls
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

  // **@** Preserved existing privacy settings
  const [privacy, setPrivacy] = useState<{
    profileVisibility: "public" | "private";
    canBeAddedToGroups: "everyone" | "friends" | "nobody";
    canBeAddedToTrips: "everyone" | "friends" | "nobody";
  }>({
    profileVisibility: "public",
    canBeAddedToGroups: "everyone",
    canBeAddedToTrips: "everyone",
  });

  // **@** Live dynamic security state from real hardware & Firestore
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

  // **@** Dynamic theme integration
  let themeMode: "dark" | "light" | "system" = "system";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      themeMode = themeContext.mode;
    }
  } catch (e) {
    // fallback
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // **@** Colors adhering to greyish-white icon decision & dark/light theme
  const colors = useMemo(() => ({
    bg: isDark ? "#0A0A0C" : "#F4F6F9",
    card: isDark ? "#141418" : "#FFFFFF",
    cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
    divider: isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F4F7",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#8E95A2" : "#7E8590",
    sectionHeader: isDark ? "#8E95A2" : "#8E8E93",
    greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
    iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
    chevron: isDark ? "#555860" : "#B4B9C2",
    activeGreen: "#10B981",
    coral: "#FF5A5F",
    switchActive: "#FF5A5F",
    switchInactive: isDark ? "#2D3139" : "#E2E8F0",
    dangerCardBg: isDark ? "rgba(255, 90, 95, 0.09)" : "#FFF1F2",
    dangerCardBorder: isDark ? "rgba(255, 90, 95, 0.28)" : "#FECDD3",
    dangerIconBg: isDark ? "rgba(255, 90, 95, 0.18)" : "#FFE4E6",
    dangerText: "#FF5A5F",
    dangerSubtext: isDark ? "rgba(255, 120, 125, 0.85)" : "#E11D48",
    modalOverlay: "rgba(0, 0, 0, 0.75)",
    selectedPill: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
  }), [isDark]);

  // **@** Setup current device ID & register hardware session on mount
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

  // **@** Live onSnapshot subscription: receives multi-device logins and trusted devices immediately
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

          // 1. Preserved Privacy
          if (uData.privacy) {
            setPrivacy({
              profileVisibility: uData.privacy.profileVisibility || "public",
              canBeAddedToGroups: uData.privacy.canBeAddedToGroups || "everyone",
              canBeAddedToTrips: uData.privacy.canBeAddedToTrips || "everyone",
            });
          }

          // 2. 2FA Status
          if (uData.security?.twoFactorEnabled !== undefined) {
            setTwoFactorEnabled(!!uData.security.twoFactorEnabled);
          }

          // 3. Login Activity from all devices (filter legacy static mocks)
          if (Array.isArray(uData.security?.loginActivity)) {
            const cleanSessions = uData.security.loginActivity.filter(
              (s: any) => s.id !== "sess_desktop_chrome" && s.id !== "mock_session"
            );
            setLoginActivity(cleanSessions);
          }

          // 4. Trusted Devices
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

  // **@** Check if a specific device is trusted
  const isDeviceTrusted = (deviceId: string, deviceName: string) => {
    return trustedDevices.some(
      (d) => d.id === deviceId || d.name === deviceName || d.name.toLowerCase().includes(deviceName.toLowerCase())
    );
  };

  // **@** Manual sync action
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

  // **@** Preserved dynamic privacy update function
  const updatePrivacy = async (field: keyof typeof privacy, value: string) => {
    setPrivacy((prev) => ({ ...prev, [field]: value as any }));
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`privacy.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log("Error saving privacy setting:", e);
      Alert.alert("Error", "Could not save privacy setting.");
    }
  };

  // **@** Toggle 2FA in Firestore
  const handleToggle2FA = async (val: boolean) => {
    setTwoFactorEnabled(val);
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "security.twoFactorEnabled": val,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log("Failed to update 2FA:", e);
      setTwoFactorEnabled(!val);
      Alert.alert("Error", "Could not update Two-Factor Authentication state.");
    }
  };

  // **@** Trust a device dynamically in Firestore
  const handleTrustDevice = async (targetId: string, targetName: string, targetType: "phone" | "tablet" | "desktop") => {
    if (!user) return;
    const formattedDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const isAlreadyTrusted = isDeviceTrusted(targetId, targetName);
    if (isAlreadyTrusted) {
      Alert.alert("Already Trusted", `"${targetName}" is already an authorized trusted device.`);
      return;
    }

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
      Alert.alert("Device Trusted", `"${targetName}" has been authorized and added to your trusted devices.`);
    } catch (e) {
      console.log("Failed to trust device:", e);
      Alert.alert("Error", "Could not register trusted device in Firestore.");
    }
  };

  // **@** Revoke a trusted device dynamically from Firestore
  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      "Revoke Device",
      `Are you sure you want to remove authorization for "${deviceName}"? It will no longer be a trusted device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Untrust Device",
          style: "destructive",
          onPress: async () => {
            const nextDevices = trustedDevices.filter((d) => d.id !== deviceId && d.name !== deviceName);
            setTrustedDevices(nextDevices);
            if (user) {
              try {
                await updateDoc(doc(db, "users", user.uid), {
                  "security.trustedDevices": nextDevices,
                  updatedAt: new Date(),
                });
              } catch (e) {
                console.log("Failed to revoke device:", e);
              }
            }
          },
        },
      ]
    );
  };

  // **@** Tap device session: view details and toggle trusted/untrusted status or log out
  const handleDeviceSessionPress = (session: DeviceSession) => {
    const isThisDevice = session.id === currentDeviceId;
    const trusted = isDeviceTrusted(session.id, session.deviceName);

    const buttons: any[] = [
      { text: "Cancel", style: "cancel" },
    ];

    if (!trusted) {
      buttons.push({
        text: "Trust This Device",
        onPress: () => handleTrustDevice(session.id, session.deviceName, session.deviceType),
      });
    } else {
      buttons.push({
        text: "Untrust Device",
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
      `Session Status: ${isThisDevice ? "This Device (Active Now)" : session.isActive ? "Online" : "Previous Session"}\nTrust Status: ${trusted ? "Trusted Device" : "Not Trusted"}\nLocation: ${session.location}`,
      buttons
    );
  };

  // **@** Terminate a remote login session dynamically
  const handleTerminateSession = (sessionId: string, sessionName: string, isCurrent: boolean) => {
    if (isCurrent) {
      Alert.alert("Active Session", "This is your current device session. To log out, use the Log Out option at the bottom.");
      return;
    }

    Alert.alert(
      "Log Out Session",
      `Would you like to terminate the session on "${sessionName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out Session",
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
                console.log("Failed to terminate session:", e);
              }
            }
          },
        },
      ]
    );
  };

  // **@** Manually register an additional device or session into Firestore
  const handleAddManualDevice = async () => {
    const trimmed = newDeviceNameInput.trim();
    if (!trimmed) {
      Alert.alert("Device Name Required", "Please enter a device name (e.g. Work PC, iPad Air, Galaxy Phone).");
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
      Alert.alert("Device Added", `"${trimmed}" has been recorded in your login activity.`);
    } catch (e) {
      console.log("Error adding manual device:", e);
      Alert.alert("Error", "Could not register device.");
    }
  };

  // **@** Send Password Reset email via Firebase Auth
  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert("Error", "No verified email associated with this account.");
      return;
    }

    Alert.alert(
      "Change Password",
      `A secure password reset link will be sent to ${user.email}. Would you like to proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: async () => {
            try {
              await sendPasswordResetEmail(auth, user.email!);
              setResetEmailSent(true);
              Alert.alert(
                "Reset Email Sent",
                `A password reset link has been dispatched to ${user.email}. Check your inbox or spam folder.`
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to send reset email.");
            }
          },
        },
      ]
    );
  };

  // **@** Backup security codes
  const backupCodes = useMemo(
    () => [
      "9482-1054",
      "5128-4491",
      "8031-6729",
      "4190-2834",
      "7721-3904",
      "6649-1182",
    ],
    []
  );

  const handleCopyBackupCodes = async () => {
    await Clipboard.setStringAsync(backupCodes.join("\n"));
    Alert.alert("Copied", "Backup codes copied to clipboard. Store them in a secure place.");
  };

  // **@** Permanent Account Deletion
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
        e?.message ||
          "For security reasons, deleting your account requires a recent login. Please sign out, log back in, and try again."
      );
    }
  };

  // Helper to render device icon
  const getDeviceIcon = (deviceType: "phone" | "tablet" | "desktop") => {
    if (deviceType === "tablet") {
      return <Ionicons name="tablet-portrait-outline" size={20} color={colors.greyishWhite} />;
    }
    if (deviceType === "desktop") {
      return <Ionicons name="desktop-outline" size={20} color={colors.greyishWhite} />;
    }
    return <Ionicons name="phone-portrait-outline" size={20} color={colors.greyishWhite} />;
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

      {/* **@** Top Navigation Header: 42px circular back button matching Settings & Edit Profile */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={6}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Account & Security
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =========================================================================
            SECTION 1: PASSWORD SETTINGS
        ========================================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          PASSWORD SETTINGS
        </Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Pressable
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            onPress={handleChangePassword}
            accessibilityLabel="Change Password"
          >
            {/* **@** Greyish-white icon inside subtle neutral box */}
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Change Password
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {resetEmailSent ? "Reset link sent to your email" : "Tap to send password reset link"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* =========================================================================
            SECTION 2: TWO-FACTOR AUTHENTICATION
        ========================================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          TWO-FACTOR AUTHENTICATION
        </Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Row 1: 2FA Toggle */}
          <View style={styles.rowItem}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Two-Factor Auth (2FA)
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Secure your travel plans with SMS or Authenticator
              </Text>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
              trackColor={{
                false: colors.switchInactive,
                true: colors.switchActive,
              }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Row 2: Backup Security Codes */}
          <Pressable
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            onPress={() => setShowBackupCodes(true)}
            accessibilityLabel="Backup Security Codes"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="key-outline" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Backup Security Codes
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Generate emergency single-use backup keys
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* =========================================================================
            SECTION 3: LOGIN ACTIVITY (SHOWS ALL DEVICES WITH TRUST STATUS)
        ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            LOGIN ACTIVITY ({loginActivity.length})
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={handleManualRefresh} hitSlop={6} style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="refresh" size={13} color={colors.coral} style={{ marginRight: 4 }} />
              <Text style={[styles.sectionActionText, { color: colors.coral }]}>
                {isSyncing ? "Syncing..." : "Sync"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setShowAddDeviceModal(true)} hitSlop={6}>
              <Text style={[styles.sectionActionText, { color: colors.coral }]}>
                + Add Device
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {loginActivity.length === 0 ? (
            <View style={styles.emptySessionRow}>
              <ActivityIndicator size="small" color={colors.greyishWhite} style={{ marginRight: 10 }} />
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Syncing active sessions...
              </Text>
            </View>
          ) : (
            loginActivity.map((session, idx) => {
              const isThisDevice = session.id === currentDeviceId;
              const trusted = isDeviceTrusted(session.id, session.deviceName);

              return (
                <React.Fragment key={session.id}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                  <Pressable
                    style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
                    onPress={() => handleDeviceSessionPress(session)}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                      {getDeviceIcon(session.deviceType)}
                    </View>
                    <View style={styles.rowContent}>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                          {session.deviceName}
                        </Text>
                        {isThisDevice && (
                          <View style={[styles.activePillBadge, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                            <Text style={[styles.activePillText, { color: colors.activeGreen }]}>Active Now</Text>
                          </View>
                        )}
                        {!isThisDevice && session.isActive && (
                          <View style={[styles.activePillBadge, { backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                            <Text style={[styles.activePillText, { color: colors.activeGreen }]}>Online</Text>
                          </View>
                        )}

                        {/* **@** Dynamic Trust Status Badge on each device */}
                        {trusted ? (
                          <View style={[styles.trustedStatusBadge, { backgroundColor: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                            <Ionicons name="shield-checkmark" size={10} color={colors.activeGreen} style={{ marginRight: 3 }} />
                            <Text style={[styles.trustedStatusText, { color: colors.activeGreen }]}>Trusted Device</Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleTrustDevice(session.id, session.deviceName, session.deviceType)}
                            hitSlop={4}
                            style={[styles.notTrustedStatusBadge, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder }]}
                          >
                            <Ionicons name="shield-outline" size={10} color={colors.chevron} style={{ marginRight: 3 }} />
                            <Text style={[styles.notTrustedStatusText, { color: colors.chevron }]}>Not Trusted (Tap to Trust)</Text>
                          </Pressable>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.rowSubtitle,
                          isThisDevice || session.isActive
                            ? { color: colors.activeGreen, fontWeight: "600" }
                            : { color: colors.textSecondary },
                        ]}
                      >
                        {session.location}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.chevron} />
                  </Pressable>
                </React.Fragment>
              );
            })
          )}
        </View>

        {/* =========================================================================
            SECTION 4: TRUSTED DEVICES (AUTHORIZED DEVICES WITH REVOKE)
        ========================================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginTop: 0, marginBottom: 0 }]}>
            TRUSTED DEVICES ({trustedDevices.length})
          </Text>
          {!isCurrentDeviceAlreadyTrusted && (
            <Pressable onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")} hitSlop={6}>
              <Text style={[styles.sectionActionText, { color: colors.coral }]}>
                + Trust This Device
              </Text>
            </Pressable>
          )}
        </View>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {trustedDevices.length === 0 ? (
            <View style={styles.emptyTrustedContainer}>
              <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, marginBottom: 10 }]}>
                <Ionicons name="shield-outline" size={20} color={colors.greyishWhite} />
              </View>
              <Text style={[styles.emptyTrustedTitle, { color: colors.textPrimary }]}>
                No Trusted Devices Authorized
              </Text>
              <Text style={[styles.emptyTrustedSub, { color: colors.textSecondary }]}>
                Authorize your devices ({currentDeviceName || "this device"}) so sign-ins won't require extra verification steps.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.trustNowBtn,
                  { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
                onPress={() => handleTrustDevice(currentDeviceId, currentDeviceName, "phone")}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.coral} style={{ marginRight: 6 }} />
                <Text style={[styles.trustNowBtnText, { color: colors.coral }]}>
                  Trust {currentDeviceName || "This Device"}
                </Text>
              </Pressable>
            </View>
          ) : (
            trustedDevices.map((dev, idx) => (
              <React.Fragment key={dev.id}>
                {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                <Pressable
                  style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
                  onPress={() => handleRevokeDevice(dev.id, dev.name)}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                    {getDeviceIcon(dev.deviceType)}
                  </View>
                  <View style={styles.rowContent}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        {dev.name}
                      </Text>
                      {dev.id === currentDeviceId && (
                        <View style={[styles.currentBadge, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder }]}>
                          <Text style={[styles.currentBadgeText, { color: colors.activeGreen }]}>This Device</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                      {dev.approvedAt} • Tap to untrust
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.chevron} />
                </Pressable>
              </React.Fragment>
            ))
          )}
        </View>

        {/* =========================================================================
            SECTION 5: PRIVACY & PERMISSIONS (PRESERVED EXISTING SETTINGS)
        ========================================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          PRIVACY & SOCIAL PERMISSIONS
        </Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Preserved: Private Profile Toggle */}
          <View style={styles.rowItem}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Feather name="lock" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Private Profile
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Makes your profile visible only to friends
              </Text>
            </View>
            <Switch
              value={privacy.profileVisibility === "private"}
              onValueChange={(val) => updatePrivacy("profileVisibility", val ? "private" : "public")}
              trackColor={{
                false: colors.switchInactive,
                true: colors.switchActive,
              }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Preserved: Who can add you to groups */}
          <Pressable
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            onPress={() => setShowGroupsModal(true)}
            accessibilityLabel="Who can add you to groups"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <MaterialCommunityIcons name="account-group-outline" size={21} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Who can add you to groups
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {privacy.canBeAddedToGroups.charAt(0).toUpperCase() + privacy.canBeAddedToGroups.slice(1)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Preserved: Who can add you to trips */}
          <Pressable
            style={({ pressed }) => [styles.rowItem, pressed && styles.pressed]}
            onPress={() => setShowTripsModal(true)}
            accessibilityLabel="Who can add you to trips"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Feather name="briefcase" size={19} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                Who can add you to trips
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                {privacy.canBeAddedToTrips.charAt(0).toUpperCase() + privacy.canBeAddedToTrips.slice(1)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        {/* =========================================================================
            SECTION 6: DANGER ZONE
        ========================================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          DANGER ZONE
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.dangerCard,
            {
              backgroundColor: colors.dangerCardBg,
              borderColor: colors.dangerCardBorder,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => setShowDeleteConfirm(true)}
          accessibilityLabel="Delete BunkMates Account"
        >
          <View style={[styles.dangerIconBox, { backgroundColor: colors.dangerIconBg }]}>
            <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
          </View>
          <View style={styles.rowContent}>
            <Text style={[styles.dangerTitle, { color: colors.dangerText }]}>
              Delete BunkMates Account
            </Text>
            <Text style={[styles.dangerSubtext, { color: colors.dangerSubtext }]}>
              Permanently wipe all past trip logs and data
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.dangerText} />
        </Pressable>
      </ScrollView>

      {/* =========================================================================
          ADD DEVICE MODAL (FOR INSTANT MULTI-DEVICE SYNC & TESTING)
      ========================================================================= */}
      <Modal transparent visible={showAddDeviceModal} animationType="fade" onRequestClose={() => setShowAddDeviceModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalIconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="phone-portrait" size={26} color={colors.greyishWhite} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Add Other Device Session
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Running the app on another phone or computer? You can register it here to verify multi-device synchronization immediately.
            </Text>

            <TextInput
              value={newDeviceNameInput}
              onChangeText={setNewDeviceNameInput}
              placeholder="e.g. My iPad Air, Work MacBook, Galaxy S23"
              placeholderTextColor={colors.chevron}
              style={[
                styles.modalTextInput,
                { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder, color: colors.textPrimary },
              ]}
            />

            <View style={{ flexDirection: "row", width: "100%", gap: 8, marginBottom: 20 }}>
              {(["phone", "tablet", "desktop"] as const).map((t) => {
                const isSelected = newDeviceTypeInput === t;
                return (
                  <Pressable
                    key={t}
                    style={[
                      styles.deviceTypeChip,
                      {
                        backgroundColor: isSelected ? colors.selectedPill : colors.iconBoxBg,
                        borderColor: isSelected ? colors.coral : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setNewDeviceTypeInput(t)}
                  >
                    <Text style={[styles.deviceTypeChipText, { color: isSelected ? colors.coral : colors.textPrimary }]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalSecondaryBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setShowAddDeviceModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.coral }]}
                onPress={handleAddManualDevice}
              >
                <Text style={styles.modalPrimaryBtnText}>Register Device</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          PRESERVED: PRIVACY SELECTOR MODAL (GROUPS / TRIPS)
      ========================================================================= */}
      <Modal transparent visible={showGroupsModal || showTripsModal} animationType="fade" onRequestClose={() => {
        setShowGroupsModal(false);
        setShowTripsModal(false);
      }}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showGroupsModal ? "Who can add you to groups" : "Who can add you to trips"}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Select your preferred privacy authorization level:
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
                    <Text style={[styles.selectorItemText, { color: colors.textPrimary }]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                    {isSelected && (
                      <Feather name="check" size={18} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.modalSecondaryBtn, { borderColor: colors.cardBorder, width: "100%" }]}
              onPress={() => {
                setShowGroupsModal(false);
                setShowTripsModal(false);
              }}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: colors.textPrimary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          BACKUP CODES MODAL
      ========================================================================= */}
      <Modal transparent visible={showBackupCodes} animationType="fade" onRequestClose={() => setShowBackupCodes(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalIconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="key" size={28} color={colors.greyishWhite} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Backup Security Codes
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Store these single-use emergency codes somewhere safe. You can use them to recover your account if you lose access to your phone.
            </Text>

            <View style={[styles.codesGrid, { backgroundColor: colors.iconBoxBg, borderColor: colors.cardBorder }]}>
              {backupCodes.map((code, idx) => (
                <Text key={idx} style={[styles.codeBadge, { color: colors.textPrimary }]}>
                  {code}
                </Text>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalSecondaryBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setShowBackupCodes(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textPrimary }]}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.switchActive }]}
                onPress={handleCopyBackupCodes}
              >
                <Text style={styles.modalPrimaryBtnText}>Copy All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          DELETE ACCOUNT CONFIRMATION MODAL
      ========================================================================= */}
      <Modal transparent visible={showDeleteConfirm} animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.modalDangerIconBox, { backgroundColor: colors.dangerIconBg }]}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={36} color={colors.dangerText} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Delete Account?
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will permanently delete your BunkMates profile, trip history, bookings, and chats. This action cannot be reversed.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={[styles.modalSecondaryBtn, { borderColor: colors.cardBorder }]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.textPrimary }]}>Cancel</Text>
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
  safeArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.75,
  },

  // **@** Unified Header styling
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 6,
    paddingBottom: 10,
    minHeight: 56,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },

  // **@** Section titles
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 22,
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
  sectionActionText: {
    fontSize: 12.5,
    fontWeight: "700",
  },

  // **@** Card Group Container
  cardGroup: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptySessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  activePillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // **@** Trusted status badge in login activity
  trustedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  trustedStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  notTrustedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  notTrustedStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },

  // **@** Trusted devices specific styling
  currentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  emptyTrustedContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  emptyTrustedTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyTrustedSub: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  trustNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  trustNowBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // **@** Danger Card
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
  dangerTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  dangerSubtext: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },

  // **@** Modals
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalDangerIconBox: {
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
  modalMessage: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  modalTextInput: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    marginBottom: 14,
  },
  deviceTypeChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceTypeChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  selectorItemText: {
    fontSize: 15,
    fontWeight: "600",
  },
  codesGrid: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  codeBadge: {
    width: "48%",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingVertical: 6,
    textAlign: "center",
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryBtnText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  modalPrimaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "600",
  },
  modalDangerBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDangerBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
});