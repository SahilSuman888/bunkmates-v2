import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  TextInput,
  Image,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import CreateTripSheet from "../../components/trips/CreateTripSheet";
import ConfirmDeleteDialog from "../../components/trip_components/ConfirmDeleteDialog";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeToggle } from "../../contexts/ThemeContext";

const { width } = Dimensions.get("window");

interface TripMemberProfile {
  uid: string;
  name: string;
  username: string;
  photoURL: string;
}

interface TripData {
  id: string;
  name: string;
  from?: string;
  to?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  iconURL?: string;
  members?: string[];
  memberProfiles?: TripMemberProfile[];
  budget?: {
    total?: number;
    used?: number;
  } | null;
  timelineStats?: {
    completed: number;
    total: number;
  };
  timelineProgress?: number;
}

export default function TripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const user = auth.currentUser;
  const { formatCurrency, formatDate, hidePastTrips } = useAppSettings();
  const { t } = useLanguage();

  const [trips, setTrips] = useState<TripData[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const { isDark, themeColors, accentColor, background, scaleFont } = useThemeToggle();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterPlace, setFilterPlace] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Tab State: 0 = All, 1 = Upcoming, 2 = Ongoing, 3 = Past
  const [activeTab, setActiveTab] = useState<"All" | "Upcoming" | "Ongoing" | "Past">("All");

  // Selected Date Pill index
  const [selectedDateIdx, setSelectedDateIdx] = useState(4); // default Sun 9

  // Create Trip Sheet
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Options & Delete dialog
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

  // Handle open from place parameter
  useEffect(() => {
    if (params?.createFromPlace) {
      setCreateSheetOpen(true);
    }
  }, [params?.createFromPlace]);

  // Realtime Firestore Subscription matching bunk-mates-master Trips.js
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "trips"),
      where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const fetchedTrips = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() || {};
            const trip: TripData = {
              id: docSnap.id,
              name: data.name || "Untitled Trip",
              from: data.from || "",
              to: data.to || "",
              location: data.location || (data.from && data.to ? `${data.from} → ${data.to}` : "Destination"),
              startDate: data.startDate || "Jan 16, 2026",
              endDate: data.endDate || "Jan 20, 2026",
              members: data.members || [user.uid],
            };

            // Fetch Group Chat image for this trip (user set group image)
            try {
              let gSnap = await getDoc(doc(db, "groupChats", trip.id));
              if (!gSnap.exists()) {
                const gQuery = query(collection(db, "groupChats"), where("tripId", "==", trip.id));
                const qSnap = await getDocs(gQuery);
                if (!qSnap.empty) gSnap = qSnap.docs[0];
              }
              if (gSnap.exists()) {
                const gData = gSnap.data();
                const groupImg = gData.iconURL || gData.groupChatIcon || gData.photoURL || gData.groupIcon || gData.imageBackgroundUrl;
                if (groupImg) {
                  trip.iconURL = groupImg;
                }
              }
            } catch (e) {
              console.log("GroupChat image lookup error:", e);
            }

            // Fetch Budget info
            try {
              const budgetRef = doc(db, "budgets", trip.id);
              const budgetSnap = await getDoc(budgetRef);
              if (budgetSnap.exists()) {
                const bData = budgetSnap.data();
                trip.budget = {
                  total: bData.total || 32000,
                  used: bData.used || 0,
                };
              } else {
                trip.budget = { total: 10000, used: 0 };
              }
            } catch {
              trip.budget = { total: 0, used: 0 };
            }

            // Fetch Member Profiles
            try {
              const profiles = await Promise.all(
                (trip.members || []).slice(0, 5).map(async (uid) => {
                  const uSnap = await getDoc(doc(db, "users", uid));
                  if (uSnap.exists()) {
                    const uData = uSnap.data();
                    return {
                      uid: uSnap.id,
                      name: uData.name || uData.displayName || "User",
                      username: uData.username || "user",
                      photoURL: uData.photoURL || `https://i.pravatar.cc/150?u=${uid}`,
                    };
                  }
                  return {
                    uid,
                    name: "Traveler",
                    username: "traveler",
                    photoURL: `https://i.pravatar.cc/150?u=${uid}`,
                  };
                })
              );
              trip.memberProfiles = profiles;
            } catch {
              trip.memberProfiles = [];
            }

            // Fetch Timeline events
            try {
              const timelineSnap = await getDocs(
                collection(db, "trips", trip.id, "timeline")
              );
              const events = timelineSnap.docs.map((d) => d.data());
              const total = events.length || 6;
              const completed = events.filter((e: any) => e?.completed === true).length;
              trip.timelineStats = { total, completed };
              trip.timelineProgress = Math.round((completed / total) * 100);
            } catch {
              trip.timelineStats = { total: 6, completed: 5 };
              trip.timelineProgress = 83;
            }

            return trip;
          })
        );

        setTrips(fetchedTrips);
        setLoading(false);
      },
      (err) => {
        console.log("Trips snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Date Pills Row Data
  const datePills = useMemo(() => {
    const days = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
    const dates = [5, 6, 7, 8, 9, 10, 11];
    return days.map((day, i) => ({ day, date: dates[i] }));
  }, []);

  // Filtered trips matching Trips.js logic
  const filteredTrips = useMemo(() => {
    const today = new Date();
    return trips.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = q
        ? t.name.toLowerCase().includes(q) ||
          (t.location && t.location.toLowerCase().includes(q))
        : true;

      const p = filterPlace.toLowerCase().trim();
      const matchPlace = p
        ? (t.location && t.location.toLowerCase().includes(p)) ||
          (t.from && t.from.toLowerCase().includes(p)) ||
          (t.to && t.to.toLowerCase().includes(p))
        : true;

      const matchStart = filterStartDate
        ? new Date(t.startDate || "") >= new Date(filterStartDate)
        : true;
      const matchEnd = filterEndDate
        ? new Date(t.endDate || "") <= new Date(filterEndDate)
        : true;

      if (!matchQuery || !matchPlace || !matchStart || !matchEnd) {
        return false;
      }

      if (activeTab === "Upcoming") {
        return new Date(t.startDate || today) > today;
      }
      if (activeTab === "Ongoing") {
        const s = new Date(t.startDate || today);
        const e = new Date(t.endDate || today);
        return s <= today && e >= today;
      }
      if (activeTab === "Past") {
        return new Date(t.endDate || today) < today;
      }

      // If user enabled hidePastTrips in Privacy settings, automatically filter out past trips
      if (hidePastTrips) {
        if (new Date(t.endDate || today) < today) {
          return false;
        }
      }

      return true;
    });
  }, [trips, searchQuery, filterPlace, filterStartDate, filterEndDate, activeTab, hidePastTrips]);

  const handleDeleteTrip = async () => {
    if (!selectedTrip) return;
    try {
      await deleteDoc(doc(db, "trips", selectedTrip.id));
      await deleteDoc(doc(db, "groupChats", selectedTrip.id));
      await deleteDoc(doc(db, "budgets", selectedTrip.id));
      setDeleteDialogOpen(false);
      setOptionsModalOpen(false);
      setSelectedTrip(null);
    } catch (e) {
      console.log("Delete trip error:", e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background.mode === "solid" ? themeColors.background : "transparent" }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.background}
      />

      <View style={[styles.container, { backgroundColor: background.mode === "solid" ? themeColors.background : "transparent" }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text, fontSize: scaleFont(28) }]}>
            {t("where_next", "Where next?")}
          </Text>
          <NotificationBell />
        </View>

        {/* SEARCH BAR & FILTER BUTTON */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: themeColors.card, borderWidth: 0 }]}>
            <Feather name="search" size={17} color={themeColors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("search_trips", "Search trips by name or destination...")}
              placeholderTextColor={themeColors.textSecondary}
              style={[styles.searchInput, { color: themeColors.text, fontSize: scaleFont(13) }]}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => setFilterModalOpen(true)}
            style={[
              styles.filterBtn,
              { backgroundColor: themeColors.card, borderWidth: 0 },
              (filterPlace || filterStartDate) && { backgroundColor: accentColor },
            ]}
          >
            <Ionicons name="options-outline" size={20} color={isDark ? "#ffffff" : "#11141A"} />
          </Pressable>
        </View>

        {/* HORIZONTAL CALENDAR DATE PILLS */}
        <View style={styles.calendarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
            {datePills.map((item, idx) => {
              const isSelected = selectedDateIdx === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedDateIdx(idx)}
                  style={[
                    styles.datePill,
                    { backgroundColor: themeColors.card, borderWidth: 0 },
                    isSelected && { backgroundColor: accentColor },
                  ]}
                >
                  <Text style={[styles.dateDayText, { color: themeColors.textSecondary }, isSelected && { color: "#ffffff" }]}>
                    {item.day}
                  </Text>
                  <Text style={[styles.dateNumText, { color: themeColors.text }, isSelected && { color: "#ffffff" }]}>
                    {item.date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* TRIPS LIST */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 175 }}
          >
            {filteredTrips.length > 0 ? (
              filteredTrips.map((trip) => {
                const totalTimeline = trip.timelineStats?.total || 6;
                const completedTimeline = trip.timelineStats?.completed || 5;
                const progressPct = Math.round((completedTimeline / totalTimeline) * 100);

                const budgetTotal = trip.budget?.total || 32000;
                const budgetUsed = trip.budget?.used || 0;
                const budgetPct = budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0;

                const memberList = trip.memberProfiles || [];
                const extraMembersCount = (trip.members?.length || 1) - Math.min(3, memberList.length);

                return (
                  <Pressable
                    key={trip.id}
                    onPress={() => router.push(`/trips/${trip.id}` as any)}
                    style={styles.tripCard}
                  >
                    {/* BACKGROUND IMAGE OVERLAY */}
                    <Image source={{ uri: trip.iconURL }} style={styles.cardBgImage} />
                    <View style={styles.cardOverlay} />

                    {/* CARD CONTENT */}
                    <View style={styles.cardContent}>
                      {/* HEADER ROW */}
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {trip.name}
                        </Text>

                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {/* MEMBER AVATAR STACK */}
                          <View style={styles.avatarGroup}>
                            {memberList.slice(0, 3).map((m, i) => (
                              <Image
                                key={m.uid || i}
                                source={{ uri: m.photoURL }}
                                style={[styles.avatar, { marginLeft: i > 0 ? -10 : 0 }]}
                              />
                            ))}
                            {extraMembersCount > 0 && (
                              <View style={[styles.avatar, styles.extraAvatar, { marginLeft: -10 }]}>
                                <Text style={styles.extraAvatarText}>+{extraMembersCount}</Text>
                              </View>
                            )}
                          </View>

                          {/* THREE DOTS MENU */}
                          <Pressable
                            onPress={() => {
                              setSelectedTrip(trip);
                              setOptionsModalOpen(true);
                            }}
                            style={styles.moreBtn}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color="#ffffff" />
                          </Pressable>
                        </View>
                      </View>

                      {/* LOCATION & DATES */}
                      <View style={styles.locationRow}>
                        <Ionicons name="location-sharp" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {trip.location} — {trip.startDate ? formatDate(trip.startDate) : "TBD"} to {trip.endDate ? formatDate(trip.endDate) : "TBD"}
                        </Text>
                      </View>

                      {/* BUDGET USED BAR */}
                      {trip.budget ? (
                        <View style={styles.progressSection}>
                          <View style={styles.progressLabelRow}>
                            <Text style={styles.progressLabel}>{t("budget_used", "Budget Used:")}</Text>
                            <Text style={styles.progressValue}>
                              {formatCurrency(budgetUsed)} / {formatCurrency(budgetTotal)}
                            </Text>
                          </View>
                          <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${budgetPct}%` }]} />
                          </View>
                        </View>
                      ) : null}

                      {/* TIMELINE PROGRESS BAR */}
                      <View style={styles.progressSection}>
                        <View style={styles.progressLabelRow}>
                          <Text style={styles.progressLabel}>
                            {t("timeline", "Timeline")}: {completedTimeline} / {totalTimeline} {t("completed", "completed")}
                          </Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="compass-outline" size={36} color="#666666" />
                <Text style={{ color: "#888888", fontSize: 13, marginTop: 8 }}>
                  {t("no_trips", "No trips match your current filter.")}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* FLOATING SEGMENTED TAB BAR & CREATE BUTTON */}
        <View style={styles.floatingBarContainer}>
          <View style={[styles.pillBar, { backgroundColor: isDark ? "rgba(22, 22, 24, 0.88)" : "rgba(255, 255, 255, 0.92)", borderWidth: 0 }]}>
            {(["All", "Upcoming", "Ongoing", "Past"] as const).map((tab) => {
              const isTabActive = activeTab === tab;
              const tabLabels: Record<string, string> = {
                All: t("all", "All"),
                Upcoming: t("upcoming", "Upcoming"),
                Ongoing: t("ongoing", "Ongoing"),
                Past: t("past", "Past"),
              };
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tabPill, isTabActive && [styles.tabPillActive, { backgroundColor: accentColor }]]}
                >
                  <Text style={[styles.tabPillText, isTabActive ? { color: "#ffffff", fontWeight: "900" } : { color: themeColors.textSecondary }]}>
                    {tabLabels[tab] || tab}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => setCreateSheetOpen(true)} style={[styles.floatingCreateBtn, { backgroundColor: accentColor, borderWidth: 0 }]}>
            <Feather name="edit-3" size={18} color="#ffffff" />
          </Pressable>
        </View>

        {/* FILTER FRAMEWORK MATRIX MODAL matching image screenshot */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={filterModalOpen}
          onRequestClose={() => setFilterModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setFilterModalOpen(false)} />
            <View style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>{t("Filter Framework Matrix")}</Text>
                <Pressable onPress={() => setFilterModalOpen(false)}>
                  <Ionicons name="close" size={20} color="#ffffff" />
                </Pressable>
              </View>

              <TextInput
                value={filterPlace}
                onChangeText={setFilterPlace}
                placeholder={t("Filter by Location / Place")}
                placeholderTextColor="#777777"
                style={styles.filterInput}
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t("Timeline Horizon Start")}</Text>
                  <View style={styles.dateInputWrap}>
                    <TextInput
                      value={filterStartDate}
                      onChangeText={setFilterStartDate}
                      placeholder="dd-mm-yyyy"
                      placeholderTextColor="#777777"
                      style={styles.dateInput}
                    />
                    <Feather name="calendar" size={14} color="#777" />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t("Timeline Horizon End")}</Text>
                  <View style={styles.dateInputWrap}>
                    <TextInput
                      value={filterEndDate}
                      onChangeText={setFilterEndDate}
                      placeholder="dd-mm-yyyy"
                      placeholderTextColor="#777777"
                      style={styles.dateInput}
                    />
                    <Feather name="calendar" size={14} color="#777" />
                  </View>
                </View>
              </View>

              <View style={styles.filterActionRow}>
                <Pressable
                  onPress={() => {
                    setFilterPlace("");
                    setFilterStartDate("");
                    setFilterEndDate("");
                  }}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>{t("Clear")}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setFilterModalOpen(false)}
                  style={styles.applyBtn}
                >
                  <Text style={styles.applyBtnText}>{t("Apply Filter")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* TRIP OPTIONS MODAL */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={optionsModalOpen}
          onRequestClose={() => setOptionsModalOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setOptionsModalOpen(false)}>
            <View style={styles.optionsCard}>
              <Text style={styles.optionsTitle}>{selectedTrip?.name}</Text>

              <Pressable
                onPress={() => {
                  setOptionsModalOpen(false);
                  if (selectedTrip) router.push(`/trips/${selectedTrip.id}` as any);
                }}
                style={styles.optionRow}
              >
                <Ionicons name="eye-outline" size={18} color="#ffffff" />
                <Text style={styles.optionText}>{t("View Details")}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setOptionsModalOpen(false);
                  setDeleteDialogOpen(true);
                }}
                style={styles.optionRow}
              >
                <Ionicons name="trash-outline" size={18} color="#ff4757" />
                <Text style={[styles.optionText, { color: "#ff4757" }]}>{t("Delete Trip")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* CONFIRM DELETE DIALOG */}
        <ConfirmDeleteDialog
          visible={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteTrip}
          tripName={selectedTrip?.name}
        />

        {/* CREATE TRIP SHEET */}
        <CreateTripSheet
          visible={createSheetOpen}
          onClose={() => setCreateSheetOpen(false)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121214",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: "#1e1e24",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#121214",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e1e24",
  },
  filterBtnActive: {
    borderColor: "#00e6b0",
    backgroundColor: "rgba(0,230,176,0.12)",
  },
  calendarContainer: {
    marginBottom: 16,
  },
  calendarScroll: {
    gap: 8,
  },
  datePill: {
    width: 48,
    height: 52,
    borderRadius: 24,
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "#1e1e24",
    alignItems: "center",
    justifyContent: "center",
  },
  datePillActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  dateDayText: {
    color: "#777777",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dateNumText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  dateTextActive: {
    color: "#000000",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tripCard: {
    height: 170,
    borderRadius: 20,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  cardBgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: "cover",
  },
  cardOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(12, 14, 20, 0.72)",
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
    marginRight: 8,
  },
  avatarGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#121214",
    backgroundColor: "#222228",
  },
  extraAvatar: {
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  extraAvatarText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  moreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -4,
  },
  locationText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  progressSection: {
    marginTop: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10.5,
    fontWeight: "700",
  },
  progressValue: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  floatingBarContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 106 : 92,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 99,
  },
  pillBar: {
    flexDirection: "row",
    backgroundColor: "rgba(18, 20, 26, 0.92)",
    borderRadius: 30,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 4,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: "#ffffff",
  },
  tabPillText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontWeight: "700",
  },
  tabPillTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  floatingCreateBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#181a20",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  filterCard: {
    width: "100%",
    backgroundColor: "rgba(20, 24, 32, 0.96)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  filterTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  filterInput: {
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  fieldLabel: {
    color: "#aaaaaa",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
  },
  dateInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  dateInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 12,
  },
  filterActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  clearBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  applyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
  },
  optionsCard: {
    width: 260,
    backgroundColor: "#181a20",
    borderRadius: 20,
    padding: 16,
    alignSelf: "center",
    marginTop: "auto",
    marginBottom: "auto",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  optionsTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  optionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
