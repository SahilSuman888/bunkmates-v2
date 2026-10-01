// **@** Privacy & Data — Exact Settings Page Design System with Greyish-White Icons, Modern Circular Back Button, and Fully Functional Settings
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";

type VisibilityOption = "public" | "friends" | "private";

export default function PrivacyAndData() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Settings states with persisted fallbacks
  const [visibility, setVisibility] = useState<VisibilityOption>("friends");
  const [locationSharing, setLocationSharing] = useState<boolean>(true);
  const [activityStatus, setActivityStatus] = useState<boolean>(false);
  const [hidePastTrips, setHidePastTrips] = useState<boolean>(false);
  const [analyticsCollection, setAnalyticsCollection] = useState<boolean>(true);

  // Export Data state
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportBundle, setExportBundle] = useState<any>(null);
  const [exportJsonString, setExportJsonString] = useState<string>("");
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);

  // Clear Search History state
  const [showClearHistoryModal, setShowClearHistoryModal] = useState<boolean>(false);
  const [isClearingHistory, setIsClearingHistory] = useState<boolean>(false);

  // Helper for dynamic alpha tints
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace("#", "");
    const fullHex = cleanHex.length === 3 ? cleanHex.split("").map((c) => c + c).join("") : cleanHex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 255;
    const g = parseInt(fullHex.substring(2, 4), 16) || 90;
    const b = parseInt(fullHex.substring(4, 6), 16) || 95;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Dynamic Theme matching ProfileSettings and ProfileEdit exactly
  let themeMode: "dark" | "light" | "system" = "system";
  let dynamicAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accentColor) dynamicAccent = themeContext.accentColor;
    }
  } catch {
    // fallback
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(() => {
    const accent = dynamicAccent;
    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      accent: accent,
      coral: accent,
      accentBg: isDark ? hexToRgba(accent, 0.16) : hexToRgba(accent, 0.09),
      switchActive: accent,
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      segmentBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F2F4F7",
      segmentActiveBg: isDark ? "#222228" : "#FFFFFF",
      pledgeBg: isDark ? "rgba(16, 185, 129, 0.10)" : "#EDFAF5",
      pledgeBorder: isDark ? "rgba(16, 185, 129, 0.35)" : "#86EFAC",
      pledgeIcon: "#10B981",
      pledgeTitle: isDark ? "#34D399" : "#059669",
      pledgeText: isDark ? "#A7F3D0" : "#4B5563",
    };
  }, [isDark, dynamicAccent]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Live Firestore subscription & local cache restoration
  useEffect(() => {
    // Restore cached settings from AsyncStorage first
    (async () => {
      try {
        const [savedVis, savedLoc, savedAct, savedHide, savedAna] = await Promise.all([
          AsyncStorage.getItem("privacy_profileVisibility"),
          AsyncStorage.getItem("location_sharing_enabled"),
          AsyncStorage.getItem("activity_status_enabled"),
          AsyncStorage.getItem("hide_past_trips"),
          AsyncStorage.getItem("analytics_collection"),
        ]);
        if (savedVis) setVisibility(savedVis as VisibilityOption);
        if (savedLoc !== null) setLocationSharing(savedLoc === "true");
        if (savedAct !== null) setActivityStatus(savedAct === "true");
        if (savedHide !== null) setHidePastTrips(savedHide === "true");
        if (savedAna !== null) setAnalyticsCollection(savedAna === "true");
      } catch (e) {
        console.log("AsyncStorage read error:", e);
      }
    })();

    if (authLoading || !user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const p = uData.privacy || {};

          // Visibility
          const currentVis = p.profileVisibility || uData.profileVisibility;
          if (currentVis) {
            if (currentVis === "private") setVisibility("private");
            else if (currentVis === "friends" || currentVis === "friends_only") setVisibility("friends");
            else setVisibility("public");
          }

          // Sharing & Data toggles
          if (p.locationSharing !== undefined) setLocationSharing(!!p.locationSharing);
          if (p.activityStatus !== undefined) setActivityStatus(!!p.activityStatus);
          if (p.hidePastTrips !== undefined) setHidePastTrips(!!p.hidePastTrips);
          if (p.analyticsCollection !== undefined) setAnalyticsCollection(!!p.analyticsCollection);
        }
      },
      (err) => {
        console.log("Privacy onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Firestore & AsyncStorage synchronization helper
  const syncSetting = async (field: string, value: any, storageKey?: string) => {
    if (storageKey) {
      AsyncStorage.setItem(storageKey, typeof value === "string" ? value : String(value)).catch(() => {});
    }

    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`privacy.${field}`]: value,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log(`Failed to update privacy.${field}:`, e);
    }
  };

  // 1. Profile Visibility
  const handleSelectVisibility = (val: VisibilityOption) => {
    setVisibility(val);
    syncSetting("profileVisibility", val, "privacy_profileVisibility");
  };

  // 2. Location Sharing
  const handleToggleLocationSharing = (val: boolean) => {
    setLocationSharing(val);
    syncSetting("locationSharing", val, "location_sharing_enabled");
  };

  // 3. Activity Status
  const handleToggleActivityStatus = (val: boolean) => {
    setActivityStatus(val);
    syncSetting("activityStatus", val, "activity_status_enabled");
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "privacy.showOnlineStatus": val,
        isOnline: val,
      }).catch(() => {});
    }
  };

  // 4. Hide Past Trips
  const handleToggleHidePastTrips = (val: boolean) => {
    setHidePastTrips(val);
    syncSetting("hidePastTrips", val, "hide_past_trips");
  };

  // 5. Analytics Collection
  const handleToggleAnalytics = (val: boolean) => {
    setAnalyticsCollection(val);
    syncSetting("analyticsCollection", val, "analytics_collection");
  };

  // 6. Download My Data (100% Functional Data Fetch & File Generation)
  const handleOpenExportModal = async () => {
    setShowExportModal(true);
    setCopiedToClipboard(false);
    setIsExporting(true);

    try {
      let profileData: any = {};
      let userTrips: any[] = [];

      if (user) {
        // Fetch User Profile
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          profileData = userSnap.data();
        }

        // Fetch User Trips
        try {
          const tripsQuery = query(collection(db, "trips"), where("owner", "==", user.uid));
          const tripsSnap = await getDocs(tripsQuery);
          userTrips = tripsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (tripErr) {
          console.log("Trip fetch for export:", tripErr);
        }
      }

      const bundle = {
        meta: {
          service: "BunkMates Travel & Adventure Platform",
          exportDate: new Date().toISOString(),
          formatVersion: "2.1",
        },
        userAccount: {
          uid: user?.uid || "guest",
          email: user?.email || profileData?.email || "",
          displayName: user?.displayName || profileData?.name || "",
          username: profileData?.username || "",
          mobile: profileData?.mobile || profileData?.phone || "",
          bio: profileData?.bio || "",
          homeCity: profileData?.homeCity || "",
        },
        privacyPreferences: {
          profileVisibility: visibility,
          locationSharing,
          activityStatus,
          hidePastTrips,
          analyticsCollection,
        },
        tripsSummary: {
          totalTrips: userTrips.length,
          trips: userTrips,
        },
      };

      const jsonStr = JSON.stringify(bundle, null, 2);
      setExportBundle(bundle);
      setExportJsonString(jsonStr);
    } catch (e) {
      console.log("Export compilation error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  // Share or Save JSON archive via system sheet
  const handleSaveExportFile = async () => {
    if (!exportJsonString) return;
    try {
      const fileName = `bunkmates_data_${user?.uid?.slice(0, 6) || "export"}_${Date.now()}.json`;
      const filePath = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, exportJsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/json",
          dialogTitle: "Download My BunkMates Data",
          UTI: "public.json",
        });
      } else {
        Alert.alert("Data Exported", `File saved successfully to:\n${filePath}`);
      }
    } catch (e: any) {
      console.log("File save error:", e);
      Alert.alert("Export Error", e?.message || "Could not save file to device.");
    }
  };

  // Copy JSON to clipboard
  const handleCopyExportJson = async () => {
    if (!exportJsonString) return;
    await Clipboard.setStringAsync(exportJsonString);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2500);
  };

  // 7. Clear Search History (100% Functional AsyncStorage & Firestore wipe)
  const handleConfirmClearHistory = async () => {
    setIsClearingHistory(true);
    try {
      await AsyncStorage.multiRemove([
        "@bunkmates_search_history",
        "@search_history",
        "searchHistory",
        "recent_searches",
        "@destination_searches",
      ]);

      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          searchHistory: [],
          updatedAt: new Date(),
        }).catch(() => {});
      }
    } catch (e) {
      console.log("Error wiping search history:", e);
    } finally {
      setIsClearingHistory(false);
      setShowClearHistoryModal(false);
      Alert.alert(
        "Search History Cleared",
        "All recent destination, places, and trip searches have been removed from this device."
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Exact circular button matching Settings page (modernHeaderBtn) ── */}
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
          Privacy & Data
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. PROFILE VISIBILITY ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>PROFILE VISIBILITY</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 16 }]}>
          <Text style={[styles.descText, { color: colors.textSecondary }]}>
            Choose who can find your profile and see your upcoming adventure plans.
          </Text>

          {/* 3-Option Segmented Control */}
          <View style={[styles.segmentContainer, { backgroundColor: colors.segmentBg }]}>
            {/* Public */}
            <Pressable
              style={[
                styles.segmentItem,
                visibility === "public" && [
                  styles.segmentItemActive,
                  { backgroundColor: colors.segmentActiveBg },
                ],
              ]}
              onPress={() => handleSelectVisibility("public")}
            >
              <Text
                style={[
                  styles.segmentText,
                  visibility === "public"
                    ? [styles.segmentTextActive, { color: colors.coral }]
                    : { color: colors.textPrimary },
                ]}
              >
                Public
              </Text>
            </Pressable>

            {/* Friends Only */}
            <Pressable
              style={[
                styles.segmentItem,
                visibility === "friends" && [
                  styles.segmentItemActive,
                  { backgroundColor: colors.segmentActiveBg },
                ],
              ]}
              onPress={() => handleSelectVisibility("friends")}
            >
              <Text
                style={[
                  styles.segmentText,
                  visibility === "friends"
                    ? [styles.segmentTextActive, { color: colors.coral }]
                    : { color: colors.textPrimary },
                ]}
              >
                Friends Only
              </Text>
            </Pressable>

            {/* Private */}
            <Pressable
              style={[
                styles.segmentItem,
                visibility === "private" && [
                  styles.segmentItemActive,
                  { backgroundColor: colors.segmentActiveBg },
                ],
              ]}
              onPress={() => handleSelectVisibility("private")}
            >
              <Text
                style={[
                  styles.segmentText,
                  visibility === "private"
                    ? [styles.segmentTextActive, { color: colors.coral }]
                    : { color: colors.textPrimary },
                ]}
              >
                Private
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── 2. SHARING PREFERENCES ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>SHARING PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Location Sharing */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="location-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Location Sharing</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Share live GPS trail with active trip bunkmates
              </Text>
            </View>
            <Switch
              value={locationSharing}
              onValueChange={handleToggleLocationSharing}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Activity Status */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="time-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Activity Status</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Show when you are active or currently traveling
              </Text>
            </View>
            <Switch
              value={activityStatus}
              onValueChange={handleToggleActivityStatus}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Hide Past Trips */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="eye-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Hide Past Trips</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Prevent friends from browsing your complete map archive
              </Text>
            </View>
            <Switch
              value={hidePastTrips}
              onValueChange={handleToggleHidePastTrips}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>
        </View>

        {/* ── 3. DATA PRIVACY ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DATA PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Analytics Collection */}
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="options-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Analytics Collection</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Help BunkMates improve with anonymous telemetry
              </Text>
            </View>
            <Switch
              value={analyticsCollection}
              onValueChange={handleToggleAnalytics}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Download My Data */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={handleOpenExportModal}
            accessibilityRole="button"
            accessibilityLabel="Download My Data"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Download My Data</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Export a backup of your trip memories and reviews
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Clear Search History */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => setShowClearHistoryModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Clear Search History"
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="trash-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Clear Search History</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                Wipe your local destination search records
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.chevron} />
          </Pressable>
        </View>

        {/* ── 4. SECURE DATA PLEDGE BANNER ── */}
        <View
          style={[
            styles.pledgeCard,
            {
              backgroundColor: colors.pledgeBg,
              borderColor: colors.pledgeBorder,
            },
          ]}
        >
          <View style={styles.pledgeIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.pledgeIcon} />
          </View>
          <View style={styles.pledgeContent}>
            <Text style={[styles.pledgeTitle, { color: colors.pledgeTitle }]}>Secure Data Pledge</Text>
            <Text style={[styles.pledgeBody, { color: colors.pledgeText }]}>
              BunkMates never sells your location logs or personal booking details to third-party ad brokers.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── DOWNLOAD DATA MODAL ── */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 46, height: 46, borderRadius: 23, marginBottom: 12, marginRight: 0 }]}>
              <Ionicons name="cloud-download-outline" size={24} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Export Your Data</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              A comprehensive archive containing your account profile, trips, and privacy configurations.
            </Text>

            {isExporting ? (
              <View style={styles.modalLoadingWrap}>
                <ActivityIndicator size="small" color={colors.coral} />
                <Text style={[styles.modalLoadingText, { color: colors.textSecondary }]}>Compiling your data package...</Text>
              </View>
            ) : exportBundle ? (
              <View style={[styles.exportInfoCard, { backgroundColor: colors.segmentBg, borderColor: colors.cardBorder }]}>
                <View style={styles.exportInfoRow}>
                  <Text style={[styles.exportInfoKey, { color: colors.textSecondary }]}>Account UID:</Text>
                  <Text style={[styles.exportInfoVal, { color: colors.textPrimary }]}>{user?.uid ? `${user.uid.slice(0, 10)}...` : "Active"}</Text>
                </View>
                <View style={styles.exportInfoRow}>
                  <Text style={[styles.exportInfoKey, { color: colors.textSecondary }]}>Saved Trips:</Text>
                  <Text style={[styles.exportInfoVal, { color: colors.textPrimary }]}>{exportBundle.tripsSummary?.totalTrips ?? 0} trips</Text>
                </View>
                <View style={styles.exportInfoRow}>
                  <Text style={[styles.exportInfoKey, { color: colors.textSecondary }]}>Format & Size:</Text>
                  <Text style={[styles.exportInfoVal, { color: colors.textPrimary }]}>JSON • {Math.max(1, Math.round(exportJsonString.length / 1024))} KB</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.modalBtnColumn}>
              {!isExporting && exportBundle && (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionBtn,
                      { backgroundColor: colors.coral },
                      pressed && styles.pressed,
                    ]}
                    onPress={handleSaveExportFile}
                  >
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.modalPrimBtnText}>Save / Share File</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.modalActionBtn,
                      { backgroundColor: colors.segmentBg, borderColor: colors.cardBorder, borderWidth: 1 },
                      pressed && styles.pressed,
                    ]}
                    onPress={handleCopyExportJson}
                  >
                    <Ionicons name={copiedToClipboard ? "checkmark-circle" : "copy-outline"} size={17} color={colors.textPrimary} style={{ marginRight: 8 }} />
                    <Text style={[styles.modalSecBtnText, { color: colors.textPrimary }]}>
                      {copiedToClipboard ? "Copied to Clipboard!" : "Copy JSON to Clipboard"}
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.modalActionBtn,
                  { borderColor: colors.cardBorder, borderWidth: 1 },
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={[styles.modalSecBtnText, { color: colors.textSecondary }]}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CLEAR SEARCH HISTORY MODAL ── */}
      <Modal
        visible={showClearHistoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 46, height: 46, borderRadius: 23, marginBottom: 12, marginRight: 0 }]}>
              <Ionicons name="trash-outline" size={24} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Clear Search History?</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              This will remove all recent destination, location, and trip search queries stored on this device.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSecBtn,
                  { borderColor: colors.cardBorder },
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowClearHistoryModal(false)}
                disabled={isClearingHistory}
              >
                <Text style={[styles.modalSecBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalDangerBtn,
                  { backgroundColor: colors.coral },
                  pressed && styles.pressed,
                ]}
                onPress={handleConfirmClearHistory}
                disabled={isClearingHistory}
              >
                {isClearingHistory ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDangerBtnText}>Clear History</Text>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header matching ProfileSettings & ProfileEdit exactly
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
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    flex: 1,
  },

  // Section Heading matching modernSectionHeading in Settings
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 22,
  },

  // Card matching modernCardGroup in Settings
  card: {
    marginHorizontal: 20,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },

  // Description text
  descText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 16,
  },

  // 3-Option Segmented Control
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  segmentItemActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  segmentTextActive: {
    fontWeight: "700",
  },

  // Row matching modernRow in Settings
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowMid: {
    flex: 1,
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Secure Data Pledge Banner matching card margins
  pledgeCard: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  pledgeIconWrap: {
    marginRight: 14,
    marginTop: 1,
  },
  pledgeContent: {
    flex: 1,
  },
  pledgeTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  pledgeBody: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "400",
  },

  // Modal dialogs
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  modalLoadingWrap: {
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  modalLoadingText: {
    fontSize: 13,
  },
  exportInfoCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  exportInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exportInfoKey: {
    fontSize: 12.5,
  },
  exportInfoVal: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  modalBtnColumn: {
    width: "100%",
    gap: 10,
  },
  modalActionBtn: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  modalSecBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalPrimBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalDangerBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDangerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
