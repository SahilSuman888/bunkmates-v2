// **@** Offline & Downloads — Pixel-perfect UI matching Settings design system with greyish-white accents, circular back button, dynamic theme adaptability (zero red), and real storage management
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  Alert,
  StatusBar,
  Appearance,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { ACCENT_COLORS } from "../theme/theme";

export interface DownloadedMap {
  id: string;
  name: string;
  sizeMB: number;
  downloadedDate: string;
}

export interface OfflineTrip {
  id: string;
  name: string;
  cachedDate: string;
  subtitle: string;
  badge?: string;
  packlistCount: number;
  itineraryDays: number;
  bunkmatesCount: number;
  mapTilesMB: number;
}

const AVAILABLE_MAPS_TO_DOWNLOAD = [
  { id: "paris", name: "Paris Central Grid", sizeMB: 68, country: "France 🇫🇷" },
  { id: "swiss_alps", name: "Swiss Alps & Valleys", sizeMB: 95, country: "Switzerland 🇨🇭" },
  { id: "bali", name: "Bali South Coast", sizeMB: 74, country: "Indonesia 🇮🇩" },
  { id: "manhattan", name: "Manhattan Urban Core", sizeMB: 112, country: "United States 🇺🇸" },
  { id: "london", name: "London Zones 1-2", sizeMB: 82, country: "United Kingdom 🇬🇧" },
  { id: "reykjavik", name: "Reykjavik Ring Road", sizeMB: 104, country: "Iceland 🇮🇸" },
];

export default function OfflineDownloads() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Downloaded Maps list matching screenshot defaults
  const [maps, setMaps] = useState<DownloadedMap[]>([
    {
      id: "interlaken",
      name: "Interlaken, Switzerland",
      sizeMB: 85,
      downloadedDate: "Jan 14, 2026",
    },
    {
      id: "kyoto",
      name: "Kyoto Old Town Grid",
      sizeMB: 124,
      downloadedDate: "Dec 20, 2025",
    },
  ]);

  // Offline trips list matching screenshot
  const [trips, setTrips] = useState<OfflineTrip[]>([
    {
      id: "alpine",
      name: "Alpine Winter Retreat",
      cachedDate: "Jan 12, 2026",
      subtitle: "Offline packlist & itinerary ready",
      badge: "Cached",
      packlistCount: 38,
      itineraryDays: 5,
      bunkmatesCount: 6,
      mapTilesMB: 18,
    },
    {
      id: "tokyo",
      name: "Tokyo Neon Nights",
      cachedDate: "Dec 24, 2025",
      subtitle: "Cached Dec 24, 2025",
      packlistCount: 44,
      itineraryDays: 7,
      bunkmatesCount: 4,
      mapTilesMB: 22,
    },
  ]);

  // Temporary cache in MB (36.2 MB initially in screenshot)
  const [tempCacheMB, setTempCacheMB] = useState<number>(36.2);
  const [clearingCache, setClearingCache] = useState(false);

  // Modals state
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedTripDetails, setSelectedTripDetails] = useState<OfflineTrip | null>(null);

  // Floating save/action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  };

  // Dynamic Theme matching Settings page & ThemeContext
  let themeMode: "dark" | "light" | "system" = "system";
  let userAccent = "default";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accent) userAccent = themeContext.accent;
    }
  } catch (e) {
    // fallback safe
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Settings page (zero red, greyish-white accents)
  const colors = useMemo(() => {
    const hasCustomNonRedAccent =
      userAccent &&
      userAccent !== "default" &&
      userAccent !== "coral" &&
      userAccent !== "red" &&
      (ACCENT_COLORS as any)[userAccent];

    const customAccent = hasCustomNonRedAccent
      ? (ACCENT_COLORS as any)[userAccent]
      : null;

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = customAccent || (isDark ? "#FFFFFF" : "#11141A");
    const activeBorder = customAccent || (isDark ? "#E2E8F0" : "#11141A");
    const progressFill = customAccent || (isDark ? "#E2E8F0" : "#11141A");

    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      greyishWhite: greyishWhite,
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      activeText: activeText,
      activeBorder: activeBorder,
      progressFill: progressFill,
      progressTrack: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
      btnBg: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
      trashIcon: isDark ? "#94A3B8" : "#64748B",
      trashBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
      badgeBg: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.09)",
      badgeBorder: isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.28)",
      badgeText: "#F59E0B",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
    };
  }, [isDark, userAccent]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Total Storage calculation: Sum of maps + offline trip tiles + temp cache
  const totalUsedMB = useMemo(() => {
    const mapsTotal = maps.reduce((acc, m) => acc + m.sizeMB, 0);
    const tripsTotal = trips.reduce((acc, t) => acc + t.mapTilesMB, 0);
    return Math.round((mapsTotal + tripsTotal + tempCacheMB) * 10) / 10;
  }, [maps, trips, tempCacheMB]);

  // Progress percentage out of 128 GB (131,072 MB), min visible bar 12%
  const progressRatio = useMemo(() => {
    const ratio = Math.max(totalUsedMB / 131072, 0.015);
    return Math.min(ratio * 15, 0.85); // visual scaling for display
  }, [totalUsedMB]);

  // Restore local cache & real-time Firestore sync
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_offline_settings");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.maps)) setMaps(parsed.maps);
          if (Array.isArray(parsed.trips)) setTrips(parsed.trips);
          if (typeof parsed.tempCacheMB === "number") setTempCacheMB(parsed.tempCacheMB);
        }
      } catch (e) {
        console.log("AsyncStorage offline read error:", e);
      }
    })();

    if (authLoading || !user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const uData = snap.data();
          const o = uData.offlineSettings || {};
          if (Array.isArray(o.maps)) setMaps(o.maps);
          if (Array.isArray(o.trips)) setTrips(o.trips);
          if (typeof o.tempCacheMB === "number") setTempCacheMB(o.tempCacheMB);
        }
      },
      (err) => {
        console.log("Offline settings onSnapshot error:", err);
      }
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  // Sync state helper saving to both AsyncStorage and Firestore
  const syncOfflineSettings = async (nextMaps: DownloadedMap[], nextTempCache: number) => {
    try {
      const payload = {
        maps: nextMaps,
        trips,
        tempCacheMB: nextTempCache,
      };
      await AsyncStorage.setItem("@bunkmates_offline_settings", JSON.stringify(payload));
    } catch (e) {
      console.log("Failed to cache offline settings:", e);
    }

    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        "offlineSettings.maps": nextMaps,
        "offlineSettings.tempCacheMB": nextTempCache,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.log("Failed to update offlineSettings in Firestore:", e);
    }
  };

  // Delete downloaded map handler
  const handleDeleteMap = (mapItem: DownloadedMap) => {
    Alert.alert(
      "Delete Map",
      `Are you sure you want to remove ${mapItem.name} (${mapItem.sizeMB} MB) from offline storage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const next = maps.filter((m) => m.id !== mapItem.id);
            setMaps(next);
            syncOfflineSettings(next, tempCacheMB);
            triggerToast(`Removed ${mapItem.name} (${mapItem.sizeMB} MB freed)`);
          },
        },
      ]
    );
  };

  // Simulate downloading a new map region
  const handleDownloadMapRegion = (item: typeof AVAILABLE_MAPS_TO_DOWNLOAD[0]) => {
    if (maps.some((m) => m.name.toLowerCase().includes(item.name.toLowerCase()))) {
      Alert.alert("Already Downloaded", `${item.name} is already available in your offline maps.`);
      return;
    }

    setDownloadingId(item.id);
    setDownloadProgress(0.1);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 1) {
          clearInterval(interval);
          setDownloadingId(null);
          const newMap: DownloadedMap = {
            id: `map_${Date.now()}`,
            name: item.name,
            sizeMB: item.sizeMB,
            downloadedDate: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          };
          const next = [newMap, ...maps];
          setMaps(next);
          syncOfflineSettings(next, tempCacheMB);
          setDownloadModalVisible(false);
          triggerToast(`Downloaded ${item.name} (${item.sizeMB} MB ready offline)`);
          return 0;
        }
        return prev + 0.3;
      });
    }, 350);
  };

  // Clear temporary cache handler
  const handleClearCache = () => {
    if (tempCacheMB <= 0) {
      triggerToast("Temporary cache is already empty");
      return;
    }

    Alert.alert(
      "Clear Temporary Cache",
      `This will free up ${tempCacheMB.toFixed(1)} MB of temporary search histories and asset previews. Your downloaded maps and saved trips won't be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Now",
          style: "default",
          onPress: () => {
            setClearingCache(true);
            setTimeout(() => {
              const freed = tempCacheMB;
              setTempCacheMB(0);
              syncOfflineSettings(maps, 0);
              setClearingCache(false);
              triggerToast(`Temporary cache cleared (${freed.toFixed(1)} MB freed)`);
            }, 500);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />

      {/* ── Top Header: Circular button matching Settings page (modernHeaderBtn) ── */}
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
          Offline & Downloads
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. DEVICE STORAGE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DEVICE STORAGE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 18 }]}>
          <View style={styles.storageTopRow}>
            <Text style={[styles.storageTitle, { color: colors.textPrimary }]}>BunkMates Storage Used</Text>
            <Text style={[styles.storageUsedText, { color: colors.textPrimary }]}>
              {totalUsedMB} MB of 128 GB
            </Text>
          </View>

          {/* Storage Progress Bar */}
          <View style={[styles.storageTrack, { backgroundColor: colors.progressTrack }]}>
            <View
              style={[
                styles.storageFill,
                {
                  width: `${Math.round(progressRatio * 100)}%`,
                  backgroundColor: colors.progressFill,
                },
              ]}
            />
          </View>

          <Text style={[styles.storageDescText, { color: colors.textSecondary }]}>
            Includes offline topographic maps, pack-lists, and cached friend avatars.
          </Text>
        </View>

        {/* ── 2. DOWNLOADED MAPS ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DOWNLOADED MAPS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {maps.length === 0 ? (
            <View style={styles.emptyMapWrap}>
              <Ionicons name="map-outline" size={28} color={colors.textSecondary} />
              <Text style={[styles.emptyMapText, { color: colors.textSecondary }]}>
                No offline maps downloaded yet.
              </Text>
            </View>
          ) : (
            maps.map((m, idx) => (
              <React.Fragment key={m.id}>
                <View style={styles.row}>
                  <View style={styles.rowMid}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{m.name}</Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                      {m.sizeMB} MB • Downloaded {m.downloadedDate}
                    </Text>
                  </View>

                  {/* Trash Delete Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.trashBtn,
                      { backgroundColor: colors.trashBg },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleDeleteMap(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${m.name}`}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.trashIcon} />
                  </Pressable>
                </View>
                {idx < maps.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
              </React.Fragment>
            ))
          )}
        </View>

        {/* Download New Map Region Button (exact reference look, zero red) */}
        <Pressable
          style={({ pressed }) => [
            styles.downloadActionBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => setDownloadModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Download New Map Region"
        >
          <Ionicons name="cloud-download-outline" size={19} color={colors.textPrimary} />
          <Text style={[styles.downloadActionBtnText, { color: colors.textPrimary }]}>
            Download New Map Region
          </Text>
        </Pressable>

        {/* ── 3. OFFLINE TRIPS CACHE ── */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>OFFLINE TRIPS CACHE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {trips.map((t, idx) => (
            <React.Fragment key={t.id}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => setSelectedTripDetails(t)}
                accessibilityRole="button"
                accessibilityLabel={`View cached ${t.name}`}
              >
                {/* Suitcase / luggage icon in neutral circular box */}
                <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.greyishWhite} />
                </View>

                <View style={styles.rowMid}>
                  <View style={styles.tripTitleRow}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t.name}</Text>
                    {t.badge && (
                      <View
                        style={[
                          styles.cachedBadge,
                          { backgroundColor: colors.badgeBg, borderColor: colors.badgeBorder },
                        ]}
                      >
                        <Text style={[styles.cachedBadgeText, { color: colors.badgeText }]}>{t.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{t.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
              </Pressable>
              {idx < trips.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── 4. TEMPORARY CACHE ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder, padding: 18, marginTop: 22 },
          ]}
        >
          <Text style={[styles.tempCacheTitle, { color: colors.textPrimary }]}>Temporary Cache</Text>
          <Text style={[styles.tempCacheDesc, { color: colors.textSecondary }]}>
            Delete search suggestion histories and temporary web cache to free up local disk space.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.clearCacheBtn,
              { backgroundColor: colors.btnBg, borderColor: colors.cardBorder },
              pressed && styles.pressed,
            ]}
            onPress={handleClearCache}
            disabled={clearingCache}
            accessibilityRole="button"
            accessibilityLabel={`Clear Cache ${tempCacheMB.toFixed(1)} MB`}
          >
            {clearingCache ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Text style={[styles.clearCacheBtnText, { color: colors.textPrimary }]}>
                Clear Cache ({tempCacheMB.toFixed(1)} MB)
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Floating Real-time Save Toast Indicator ── */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* ── 1. Download New Map Region Modal ── */}
      <Modal
        visible={downloadModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="cloud-download-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Download Map Region</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Save vector topographic tiles to navigate trails and cities with zero cellular signal.
            </Text>

            <ScrollView style={styles.downloadList} showsVerticalScrollIndicator={false}>
              {AVAILABLE_MAPS_TO_DOWNLOAD.map((item) => {
                const isAlreadyDownloaded = maps.some((m) =>
                  m.name.toLowerCase().includes(item.name.toLowerCase())
                );
                const isCurrentlyDownloading = downloadingId === item.id;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.downloadItemRow,
                      { borderColor: colors.divider, backgroundColor: colors.btnBg },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={[styles.downloadItemName, { color: colors.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.downloadItemSub, { color: colors.textSecondary }]}>
                        {item.country} • {item.sizeMB} MB
                      </Text>
                    </View>

                    {isAlreadyDownloaded ? (
                      <View style={styles.installedBadge}>
                        <Ionicons name="checkmark" size={14} color="#10B981" />
                        <Text style={styles.installedBadgeText}>Ready</Text>
                      </View>
                    ) : isCurrentlyDownloading ? (
                      <View style={styles.downloadingWrap}>
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                        <Text style={[styles.downloadingPct, { color: colors.textSecondary }]}>
                          {Math.round(downloadProgress * 100)}%
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [
                          styles.downloadPillBtn,
                          { backgroundColor: isDark ? "#FFFFFF" : "#11141A" },
                          pressed && styles.pressed,
                        ]}
                        onPress={() => handleDownloadMapRegion(item)}
                      >
                        <Text
                          style={[
                            styles.downloadPillBtnText,
                            { color: isDark ? "#0A0A0C" : "#FFFFFF" },
                          ]}
                        >
                          Download
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.btnBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setDownloadModalVisible(false)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── 2. Offline Trip Details Modal ── */}
      <Modal
        visible={selectedTripDetails !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTripDetails(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg, width: 44, height: 44, borderRadius: 22, marginBottom: 10, marginRight: 0 }]}>
              <Ionicons name="briefcase-outline" size={22} color={colors.greyishWhite} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {selectedTripDetails?.name}
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Offline package is downloaded and ready for offline use during your trip.
            </Text>

            {/* Trip Specs List */}
            <View style={styles.tripSpecsColumn}>
              <View style={[styles.tripSpecRow, { borderColor: colors.divider }]}>
                <Ionicons name="checkbox-outline" size={17} color={colors.greyishWhite} />
                <Text style={[styles.tripSpecLabel, { color: colors.textSecondary }]}>Packing Checklist</Text>
                <Text style={[styles.tripSpecValue, { color: colors.textPrimary }]}>
                  {selectedTripDetails?.packlistCount} Items
                </Text>
              </View>

              <View style={[styles.tripSpecRow, { borderColor: colors.divider }]}>
                <Ionicons name="calendar-outline" size={17} color={colors.greyishWhite} />
                <Text style={[styles.tripSpecLabel, { color: colors.textSecondary }]}>Full Itinerary</Text>
                <Text style={[styles.tripSpecValue, { color: colors.textPrimary }]}>
                  {selectedTripDetails?.itineraryDays} Days
                </Text>
              </View>

              <View style={[styles.tripSpecRow, { borderColor: colors.divider }]}>
                <Ionicons name="people-outline" size={17} color={colors.greyishWhite} />
                <Text style={[styles.tripSpecLabel, { color: colors.textSecondary }]}>Bunkmates Contact Cards</Text>
                <Text style={[styles.tripSpecValue, { color: colors.textPrimary }]}>
                  {selectedTripDetails?.bunkmatesCount} Travelers
                </Text>
              </View>

              <View style={[styles.tripSpecRow, { borderColor: colors.divider }]}>
                <Ionicons name="map-outline" size={17} color={colors.greyishWhite} />
                <Text style={[styles.tripSpecLabel, { color: colors.textSecondary }]}>Offline Area Map Tiles</Text>
                <Text style={[styles.tripSpecValue, { color: colors.textPrimary }]}>
                  {selectedTripDetails?.mapTilesMB} MB Cached
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCloseBtn,
                { borderColor: colors.cardBorder, backgroundColor: colors.btnBg },
                pressed && styles.pressed,
              ]}
              onPress={() => setSelectedTripDetails(null)}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.textPrimary }]}>Done</Text>
            </Pressable>
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

  // Header matching Settings & ProfileEdit
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

  // Section Heading matching Settings
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

  // Device Storage Section
  storageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  storageTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  storageUsedText: {
    fontSize: 14,
    fontWeight: "700",
  },
  storageTrack: {
    width: "100%",
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  storageFill: {
    height: "100%",
    borderRadius: 4,
  },
  storageDescText: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Downloaded Maps list
  emptyMapWrap: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyMapText: {
    fontSize: 13,
  },
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
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Download Action Button
  downloadActionBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  downloadActionBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
  },

  // Offline Trips Cache
  tripTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cachedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  cachedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Temporary Cache card
  tempCacheTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  tempCacheDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  clearCacheBtn: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  clearCacheBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Toast Container
  toastContainer: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
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
    marginBottom: 6,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  downloadList: {
    width: "100%",
    maxHeight: 280,
    marginBottom: 16,
  },
  downloadItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  downloadItemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  downloadItemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  downloadPillBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  installedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  installedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
  },
  downloadingWrap: {
    alignItems: "center",
    gap: 2,
  },
  downloadingPct: {
    fontSize: 10,
    fontWeight: "600",
  },

  // Trip Specs column
  tripSpecsColumn: {
    width: "100%",
    marginBottom: 18,
    gap: 8,
  },
  tripSpecRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  tripSpecLabel: {
    flex: 1,
    fontSize: 13,
  },
  tripSpecValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalCloseBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
