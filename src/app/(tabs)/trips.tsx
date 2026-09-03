import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
  ActivityIndicator,
  Platform,
  Share,
  Animated,
  Alert,
  Linking,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Circle } from "react-native-svg";
import { useUserGroups } from "../../hooks/useUserGroups";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ──────── Types ──────── */

interface TripMemberProfile {
  uid: string;
  name: string;
  username: string;
  photoURL: string;
}

interface TripBudget {
  total: number;
  used: number;
  expensesCount: number;
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
  travelType?: string;
  members?: string[];
  memberProfiles?: TripMemberProfile[];
  budget?: TripBudget | null;
  timelineStats?: { completed: number; total: number };
  timelineProgress?: number;
}

/* ──────── Helpers ──────── */

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const getTripAccent = (id: string) => {
  const colors = ["#4A90D9", "#34D399", "#FBBF24"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatDateRange = (startStr?: string, endStr?: string) => {
  if (!startStr && !endStr) return "";
  const parse = (s?: string) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const dStart = parse(startStr);
  const dEnd = parse(endStr);
  if (!dStart && !dEnd) return `${startStr || ""} to ${endStr || ""}`;
  if (dStart && !dEnd) {
    return dStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  if (!dStart && dEnd) {
    return dEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  const sDay = dStart!.getDate();
  const sMon = dStart!.toLocaleDateString("en-GB", { month: "short" });
  const sYear = dStart!.getFullYear();
  const eDay = dEnd!.getDate();
  const eMon = dEnd!.toLocaleDateString("en-GB", { month: "short" });
  const eYear = dEnd!.getFullYear();

  if (sYear === eYear && sMon === eMon) {
    return `${sDay} ${sMon} to ${eDay} ${eMon} ${eYear}`;
  }
  if (sYear === eYear) {
    return `${sDay} ${sMon} to ${eDay} ${eMon} ${eYear}`;
  }
  return `${sDay} ${sMon} ${sYear} to ${eDay} ${eMon} ${eYear}`;
};

const formatSpanHorizon = (startStr?: string, endStr?: string) => {
  if (!startStr && !endStr) return "Flexible Dates";
  const formatSingle = (s?: string) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const day = d.getDate();
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };
  if (startStr && !endStr) return formatSingle(startStr);
  if (!startStr && endStr) return formatSingle(endStr);
  return `${formatSingle(startStr)} — ${formatSingle(endStr)}`;
};

/* Curated scenic destination images */
const getFallbackImage = (location?: string, name?: string) => {
  const text = `${location || ""} ${name || ""}`.toLowerCase();
  if (text.includes("udaipur") || text.includes("city palace")) {
    return "https://images.unsplash.com/photo-1595658658481-d53d3f999875?q=80&w=800&auto=format&fit=crop";
  }
  if (text.includes("jaipur") || text.includes("bunk1") || text.includes("bunk")) {
    return "https://images.unsplash.com/photo-1506461883276-594a12b11cf3?q=80&w=800&auto=format&fit=crop";
  }
  if (text.includes("delhi") || text.includes("india gate")) {
    return "https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=800&auto=format&fit=crop";
  }
  if (text.includes("jaisalmer") || text.includes("thar") || text.includes("desert")) {
    return "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop";
  }
  if (text.includes("goa") || text.includes("beach")) {
    return "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=800&auto=format&fit=crop";
  }
  if (text.includes("manali") || text.includes("mountain") || text.includes("himachal")) {
    return "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=800&auto=format&fit=crop";
  }
  return "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?q=80&w=800&auto=format&fit=crop";
};

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function TripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  // Real-time group chats hook (already manages groupChats for current user)
  const { groups = [] } = useUserGroups(user?.uid || null) || {};

  /* ── State ── */
  const [trips, setTrips] = useState<TripData[]>([]);
  const [directGroupIcons, setDirectGroupIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterPlace, setFilterPlace] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<"All" | "Upcoming" | "Ongoing" | "Pinned" | "Past">("All");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [pinnedTripIds, setPinnedTripIds] = useState<string[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

  const detailsAnim = useRef(new Animated.Value(0)).current;

  /* ── Open create sheet from params ── */
  useEffect(() => {
    if (params?.createFromPlace) setCreateSheetOpen(true);
  }, [params?.createFromPlace]);

  /* ── Load pinned trips ── */
  useEffect(() => {
    if (!user?.uid) return;
    AsyncStorage.getItem(`bunkmate.pinnedTrips.${user.uid}`).then((val) => {
      if (val) {
        try {
          setPinnedTripIds(JSON.parse(val));
        } catch { }
      }
    });
  }, [user?.uid]);

  /* ── Realtime Firestore Subscription for Trips ── */
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "trips"), where("members", "array-contains", user.uid));

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
              location:
                data.location ||
                (data.from && data.to
                  ? `${data.from}, ${data.to?.split(",")[0]?.trim() || data.to}`
                  : "Destination"),
              startDate: data.startDate || "",
              endDate: data.endDate || "",
              travelType: data.travelType || "Adventure",
              members: data.members || [user.uid],
              iconURL: data.iconURL || data.coverImage || data.image || data.photoURL || "",
            };

            // Direct fetch from groupChats for this trip ID
            try {
              const gSnap = await getDoc(doc(db, "groupChats", trip.id));
              if (gSnap.exists()) {
                const gd = gSnap.data();
                const icon =
                  gd.iconURL ||
                  gd.photoURL ||
                  gd.groupChatIcon ||
                  gd.groupIcon ||
                  gd.imageBackgroundUrl ||
                  "";
                if (icon) {
                  setDirectGroupIcons((prev) => ({ ...prev, [trip.id]: icon }));
                  trip.iconURL = icon;
                }
              }
            } catch (err) {
              console.log("Direct groupChat fetch error:", err);
            }

            // Fetch budget
            try {
              const budgetSnap = await getDoc(doc(db, "budgets", trip.id));
              if (budgetSnap.exists()) {
                const bData = budgetSnap.data();
                const expenses = Array.isArray(bData.expenses) ? bData.expenses : [];
                const used = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                const total = parseFloat(bData.total) || parseFloat(data.budget) || 0;
                trip.budget = { total, used, expensesCount: expenses.length };
              } else if (data.budget) {
                trip.budget = { total: parseFloat(data.budget) || 0, used: 0, expensesCount: 0 };
              }
            } catch {
              trip.budget = null;
            }

            // Fetch member profiles
            try {
              const profiles = await Promise.all(
                (trip.members || []).slice(0, 6).map(async (uid) => {
                  const uSnap = await getDoc(doc(db, "users", uid));
                  if (uSnap.exists()) {
                    const uData = uSnap.data();
                    return {
                      uid: uSnap.id,
                      name: uData.name || uData.displayName || "User",
                      username: uData.username || "user",
                      photoURL: uData.photoURL || `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`,
                    };
                  }
                  return {
                    uid,
                    name: "Traveler",
                    username: "traveler",
                    photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`,
                  };
                })
              );
              trip.memberProfiles = profiles;
            } catch {
              trip.memberProfiles = [];
            }

            // Fetch timeline stats
            try {
              const timelineSnap = await getDocs(collection(db, "trips", trip.id, "timeline"));
              const events = timelineSnap.docs.map((d) => d.data());
              const total = events.length || 1;
              const completed = events.filter((e: any) => e?.completed === true).length;
              trip.timelineStats = { total, completed };
              trip.timelineProgress = Math.round((completed / total) * 100);
            } catch {
              trip.timelineStats = { total: 1, completed: 0 };
              trip.timelineProgress = 0;
            }

            return trip;
          })
        );
        setTrips(fetchedTrips);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  /* ── Helper to resolve the exact group icon for any trip ── */
  const getTripDisplayImage = useCallback(
    (trip: TripData): string => {
      // 1. Direct fetch from groupChats document by trip ID
      if (directGroupIcons[trip.id]) {
        return directGroupIcons[trip.id];
      }

      // 2. Search groups list from useUserGroups hook
      const matchedGroup = (groups || []).find((g: any) => {
        if (!g) return false;
        if (g.id === trip.id) return true;
        if (g.tripId === trip.id) return true;
        if (g.name && trip.name && g.name.trim().toLowerCase() === trip.name.trim().toLowerCase()) return true;
        return false;
      });

      if (matchedGroup) {
        const icon =
          matchedGroup.iconURL ||
          matchedGroup.photoURL ||
          matchedGroup.groupChatIcon ||
          matchedGroup.groupIcon ||
          matchedGroup.imageBackgroundUrl;
        if (icon && typeof icon === "string" && icon.trim().length > 0) {
          return icon.trim();
        }
      }

      // 3. Check trip's own fields
      if (trip.iconURL && typeof trip.iconURL === "string" && trip.iconURL.trim().length > 0) {
        return trip.iconURL.trim();
      }

      // 4. Scenic destination fallback
      return getFallbackImage(trip.location, trip.name);
    },
    [directGroupIcons, groups]
  );

  /* ── Flexible Date Parser (dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd) ── */
  const parseFlexibleDate = useCallback((dateStr?: string | null): Date | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const s = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parts = s.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return isNaN(d.getTime()) ? null : d;
    }
    const ddmmyyyy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  /* ── Quick Presets for Date Horizon ── */
  const handleSetQuickHorizon = useCallback((type: "today" | "week" | "month" | "clear") => {
    if (type === "clear") {
      setFilterStartDate("");
      setFilterEndDate("");
      return;
    }
    const now = new Date();
    const formatD = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    if (type === "today") {
      setFilterStartDate(formatD(now));
      setFilterEndDate(formatD(now));
    } else if (type === "week") {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      setFilterStartDate(formatD(now));
      setFilterEndDate(formatD(nextWeek));
    } else if (type === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFilterStartDate(formatD(startOfMonth));
      setFilterEndDate(formatD(endOfMonth));
    }
  }, []);

  /* ── Filtering ── */
  const today = useMemo(() => new Date(), []);

  const sortPinnedFirst = useCallback(
    (a: TripData, b: TripData) => {
      return (pinnedTripIds.includes(b.id) ? 1 : 0) - (pinnedTripIds.includes(a.id) ? 1 : 0);
    },
    [pinnedTripIds]
  );

  const filteredTrips = useMemo(() => {
    const pool = [...trips].sort(sortPinnedFirst);
    return pool.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQ = q
        ? (t.name && t.name.toLowerCase().includes(q)) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.from && t.from.toLowerCase().includes(q)) ||
        (t.to && t.to.toLowerCase().includes(q))
        : true;

      const p = filterPlace.toLowerCase().trim();
      const matchP = p
        ? (t.location && t.location.toLowerCase().includes(p)) ||
        (t.name && t.name.toLowerCase().includes(p)) ||
        (t.from && t.from.toLowerCase().includes(p)) ||
        (t.to && t.to.toLowerCase().includes(p))
        : true;

      const sHorizon = parseFlexibleDate(filterStartDate);
      const eHorizon = parseFlexibleDate(filterEndDate);
      const tripStart = parseFlexibleDate(t.startDate);
      const tripEnd = parseFlexibleDate(t.endDate) || tripStart;

      let matchS = true;
      let matchE = true;

      if (sHorizon) {
        matchS = tripEnd ? tripEnd >= sHorizon : true;
      }
      if (eHorizon) {
        matchE = tripStart ? tripStart <= eHorizon : true;
      }

      if (!matchQ || !matchP || !matchS || !matchE) return false;

      if (activeTab === "Upcoming") return tripStart ? tripStart > today : true;
      if (activeTab === "Ongoing") {
        return tripStart && tripEnd ? tripStart <= today && tripEnd >= today : true;
      }
      if (activeTab === "Pinned") return pinnedTripIds.includes(t.id);
      if (activeTab === "Past") return tripEnd ? tripEnd < today : true;
      return true;
    });
  }, [
    trips,
    searchQuery,
    filterPlace,
    filterStartDate,
    filterEndDate,
    activeTab,
    pinnedTripIds,
    sortPinnedFirst,
    today,
    parseFlexibleDate,
  ]);

  /* ── Dynamic Calendar Days ── */
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 10);
    for (let i = 0; i < 28; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [today]);

  const calendarScrollRef = useRef<ScrollView>(null);

  const centerCurrentDate = useCallback((animated = false) => {
    const todayIdx = calendarDays.findIndex((d) => isSameDay(d, new Date()));
    if (todayIdx >= 0 && calendarScrollRef.current) {
      const PILL_WIDTH = 50;
      const GAP = 8;
      const visibleWidth = SCREEN_WIDTH - 32;
      const offset = todayIdx * (PILL_WIDTH + GAP) - (visibleWidth / 2) + (PILL_WIDTH / 2);
      calendarScrollRef.current.scrollTo({ x: Math.max(0, offset), animated });
    }
  }, [calendarDays]);

  useEffect(() => {
    if (!loading && calendarScrollRef.current) {
      const t1 = setTimeout(() => centerCurrentDate(false), 60);
      const t2 = setTimeout(() => centerCurrentDate(false), 350);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [loading, centerCurrentDate]);

  /* ── Actions ── */
  const handleDeleteTrip = async () => {
    if (!selectedTrip) return;
    try {
      await deleteDoc(doc(db, "trips", selectedTrip.id));
      await deleteDoc(doc(db, "groupChats", selectedTrip.id)).catch(() => { });
      await deleteDoc(doc(db, "budgets", selectedTrip.id)).catch(() => { });
      setDeleteDialogOpen(false);
      closeDetailsModal();
    } catch (e) {
      console.log("Delete trip error:", e);
    }
  };

  const togglePinForTrip = async (tripId: string) => {
    if (!user?.uid) return;
    setPinnedTripIds((prev) => {
      const isPinned = prev.includes(tripId);
      const updated = isPinned ? prev.filter((id) => id !== tripId) : [...prev, tripId];
      AsyncStorage.setItem(`bunkmate.pinnedTrips.${user.uid}`, JSON.stringify(updated));
      return updated;
    });
  };

  const togglePin = async () => {
    if (!selectedTrip || !user?.uid) return;
    togglePinForTrip(selectedTrip.id);
  };

  const handleShare = async () => {
    if (!selectedTrip) return;
    try {
      await Share.share({
        message: `🗺️ BunkMates Trip: ${selectedTrip.name}\n📍 ${selectedTrip.location}\n📅 ${formatSpanHorizon(
          selectedTrip.startDate,
          selectedTrip.endDate
        )}`,
      });
    } catch { }
  };

  /* ── Save Trip to Device / Phone Calendar (.ics & Native Intent) ── */
  const handleSaveToPhoneCalendar = async (trip: TripData | null) => {
    if (!trip) return;
    try {
      const title = trip.name || "Trip";
      const location = trip.location || "";
      const travelType = trip.travelType || "Trip";

      // Parse start and end dates
      let startD = trip.startDate ? new Date(trip.startDate) : new Date();
      if (isNaN(startD.getTime())) startD = new Date();

      let endD = trip.endDate ? new Date(trip.endDate) : new Date(startD.getTime() + 86400000);
      if (isNaN(endD.getTime())) endD = new Date(startD.getTime() + 86400000);

      // Ensure end date is after start date
      if (endD.getTime() <= startD.getTime()) {
        endD = new Date(startD.getTime() + 86400000);
      }

      // Format ISO string without symbols for ICS (YYYYMMDDTHHMMSSZ)
      const toICSDate = (d: Date, hour = 9) => {
        const copy = new Date(d);
        copy.setHours(hour, 0, 0, 0);
        const year = copy.getUTCFullYear();
        const month = String(copy.getUTCMonth() + 1).padStart(2, "0");
        const day = String(copy.getUTCDate()).padStart(2, "0");
        const hours = String(copy.getUTCHours()).padStart(2, "0");
        const minutes = String(copy.getUTCMinutes()).padStart(2, "0");
        const seconds = String(copy.getUTCSeconds()).padStart(2, "0");
        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
      };

      const dtStart = toICSDate(startD, 9);
      const dtEnd = toICSDate(endD, 18);
      const nowStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      const sanitize = (str: string) =>
        str.replace(/[\r\n]+/g, " ").replace(/[\\;,]/g, " ").trim();

      const icsString = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bunkmates//Trip Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:bunkmates-trip-${trip.id || Date.now()}@bunkmates.app`,
        `DTSTAMP:${nowStr}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${sanitize(title)}`,
        `DESCRIPTION:${sanitize(
          `Adventure organized with Bunkmates.\nLocation: ${location}\nTravel Type: ${travelType}`
        )}`,
        location ? `LOCATION:${sanitize(location)}` : "",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Trip Reminder: Pack your bags!",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .filter(Boolean)
        .join("\r\n");

      const cleanFileName = (trip.name || "trip")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 30);
      const filePath = `${FileSystem.cacheDirectory}${cleanFileName}.ics`;

      await FileSystem.writeAsStringAsync(filePath, icsString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/calendar",
          dialogTitle: "Save Trip to Phone Calendar",
          UTI: "com.apple.ical.ics",
        });
      } else {
        // Direct fallback to Google Calendar URL
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
          title
        )}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(
          `Adventure organized with Bunkmates. Location: ${location}`
        )}&location=${encodeURIComponent(location)}`;
        await Linking.openURL(gcalUrl);
      }
    } catch (err) {
      console.log("Error saving to calendar:", err);
      if (trip) {
        const startD = trip.startDate ? new Date(trip.startDate) : new Date();
        const endD = trip.endDate ? new Date(trip.endDate) : new Date(startD.getTime() + 86400000);
        const toGcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
          trip.name || "Trip"
        )}&dates=${toGcalDate(startD)}/${toGcalDate(endD)}&location=${encodeURIComponent(
          trip.location || ""
        )}`;
        Linking.openURL(gcalUrl).catch(() => { });
      }
    }
  };

  /* ── Details Modal Animations ── */
  const openDetailsModal = (trip: TripData) => {
    const resolvedImage = getTripDisplayImage(trip);
    setSelectedTrip({ ...trip, iconURL: resolvedImage });
    setDetailsModalOpen(true);
    Animated.spring(detailsAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const closeDetailsModal = () => {
    Animated.timing(detailsAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setDetailsModalOpen(false);
      setSelectedTrip(null);
    });
  };

  const isSelectedPinned = selectedTrip ? pinnedTripIds.includes(selectedTrip.id) : false;

  // Pre-calculated stats for the new header & cards
  const userFirstName = user?.displayName ? user.displayName.split(" ")[0] : "Explorer";
  const currentHour = new Date().getHours();
  const greetingWord = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";

  const allCount = trips.length;
  const upcomingTripsList = trips.filter(
    (t) => t.startDate && new Date(t.startDate).getTime() > Date.now()
  );
  const upcomingCount = upcomingTripsList.length;

  const ongoingTripsList = trips.filter((t) => {
    if (!t.startDate) return false;
    const now = Date.now();
    const st = new Date(t.startDate).getTime();
    const et = t.endDate ? new Date(t.endDate).getTime() : st + 86400000;
    return now >= st && now <= et;
  });
  const ongoingCount = ongoingTripsList.length;

  const pinnedCount = trips.filter((t) => pinnedTripIds.includes(t.id)).length;

  const pastTripsList = trips.filter((t) => {
    if (!t.endDate && !t.startDate) return false;
    const end = new Date(t.endDate || t.startDate!).getTime();
    return end < Date.now();
  });
  const pastCount = pastTripsList.length;

  const nextTrip = upcomingTripsList.sort(
    (a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime()
  )[0];
  const nextTripDays = nextTrip?.startDate
    ? Math.max(0, Math.ceil((new Date(nextTrip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const uniqueBunkmates = new Set<string>();
  trips.forEach((t) => {
    (t.members || []).forEach((m) => {
      if (m && m !== user?.uid) uniqueBunkmates.add(m);
    });
  });

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */

  return (
    <View style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── SCROLLABLE TRIPS DASHBOARD ── */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#00e676" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 120,
          }}
          scrollEventThrottle={16}
        >
          {/* 1. Sleek Ambient Header */}
          <View style={s.topHeaderRow}>
            <View>
              <Text style={s.welcomeSubText}>{greetingWord.toUpperCase()} • READY TO EXPLORE?</Text>
              <Text style={s.mainGreeting}>Where next, {userFirstName}?</Text>
            </View>
            <View style={s.topHeaderRight}>
              <NotificationBell />
            </View>
          </View>

          {/* 2. Featured Upcoming Adventure Spotlight Card */}
          {nextTrip ? (
            <Pressable
              onPress={() => router.push(`/trips/${nextTrip.id}` as any)}
              style={s.spotlightCard}
            >
              <ExpoImage
                source={{ uri: getTripDisplayImage(nextTrip) }}
                style={s.spotlightBg}
                contentFit="cover"
                transition={250}
              />
              <LinearGradient
                colors={[
                  "rgba(10, 14, 22, 0.35)",
                  "rgba(10, 14, 22, 0.78)",
                  "rgba(12, 14, 21, 0.96)",
                ]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.spotlightContent}>
                <View style={s.spotlightBadgeRow}>
                  <View style={s.spotlightTagPill}>
                    <Ionicons name="sparkles" size={12} color="#00e676" />
                    <Text style={s.spotlightTagText}>NEXT ADVENTURE</Text>
                  </View>
                  <View style={s.spotlightCountdownPill}>
                    <Text style={s.spotlightCountdownText}>
                      {nextTripDays === 0 ? "Departs Today!" : `In ${nextTripDays} ${nextTripDays === 1 ? "Day" : "Days"}`}
                    </Text>
                  </View>
                </View>

                <Text style={s.spotlightTitle} numberOfLines={1}>
                  {nextTrip.name}
                </Text>

                {/* Origin ➔ Destination Route Bar */}
                <View style={s.spotlightRouteRow}>
                  <View style={s.spotlightCityBadge}>
                    <Ionicons name="navigate-circle" size={13} color="#00e676" />
                    <Text style={s.spotlightCityText}>
                      {nextTrip.from ? nextTrip.from.split(",")[0].trim() : "Origin"}
                    </Text>
                  </View>
                  <View style={s.spotlightRouteDash}>
                    <View style={s.spotlightRouteLine} />
                    <Ionicons name="car-sport" size={15} color="rgba(255, 255, 255, 0.8)" />
                    <View style={s.spotlightRouteLine} />
                  </View>
                  <View style={s.spotlightCityBadge}>
                    <Ionicons name="location-sharp" size={13} color="#38bdf8" />
                    <Text style={s.spotlightCityText}>
                      {nextTrip.to ? nextTrip.to.split(",")[0].trim() : nextTrip.location ? nextTrip.location.split(",")[0].trim() : "Destination"}
                    </Text>
                  </View>
                </View>

                <View style={s.spotlightFooter}>
                  <View style={s.spotlightDateWrap}>
                    <Ionicons name="calendar-outline" size={13} color="rgba(255, 255, 255, 0.7)" />
                    <Text style={s.spotlightDateText}>
                      {formatDateRange(nextTrip.startDate, nextTrip.endDate)}
                    </Text>
                  </View>
                  <View style={s.spotlightActionBtn}>
                    <Text style={s.spotlightActionText}>View Itinerary</Text>
                    <Ionicons name="arrow-forward" size={13} color="#000000" />
                  </View>
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* 3. Quick Travel Summary Stats Cards */}
          <View style={s.statsSummaryRow}>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{allCount}</Text>
              <Text style={s.statLabel}>Total Trips</Text>
            </View>
            <View style={[s.statCard, s.statCardHighlight]}>
              <Text style={[s.statNumber, { color: "#00e676" }]}>
                {nextTripDays !== null ? (nextTripDays === 0 ? "Today" : `${nextTripDays}d`) : "—"}
              </Text>
              <Text style={s.statLabel} numberOfLines={1}>
                {nextTrip ? (nextTrip.location || nextTrip.name)?.split(",")[0] : "Next Trip"}
              </Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{uniqueBunkmates.size}</Text>
              <Text style={s.statLabel}>Bunkmates</Text>
            </View>
          </View>

          {/* 4. Search & Filter Bar */}
          <View style={s.searchBarRow}>
            <View style={s.searchCapsule}>
              <Feather name="search" size={17} color="rgba(255,255,255,0.45)" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search trips by destination or name..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={s.searchInputField}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => setFilterModalOpen(true)}
              style={[
                s.filterActionBtn,
                (filterPlace || filterStartDate || filterEndDate) && s.filterActionBtnActive,
              ]}
            >
              <Ionicons name="options-outline" size={19} color="#ffffff" />
              {(filterPlace || filterStartDate || filterEndDate) ? (
                <View style={s.filterActiveDot} />
              ) : null}
            </Pressable>
          </View>

          {/* Active Filter Indicator Tag */}
          {(filterPlace || filterStartDate || filterEndDate) ? (
            <View style={s.activeFilterRow}>
              <View style={s.activeFilterPill}>
                <Ionicons name="funnel" size={11} color="#00e676" />
                <Text style={s.activeFilterText} numberOfLines={1}>
                  {filterPlace ? `"${filterPlace}" ` : ""}{filterStartDate ? `${filterStartDate} ` : ""}{filterEndDate ? `→ ${filterEndDate}` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setFilterPlace("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
                hitSlop={8}
                style={s.activeFilterClear}
              >
                <Text style={s.activeFilterClearText}>Reset</Text>
                <Ionicons name="close-circle" size={13} color="#f87171" />
              </Pressable>
            </View>
          ) : null}

          {/* 5. Horizontal Horizon Calendar Strip */}
          <View style={s.calSectionWrap}>
            <View style={s.calHeaderRow}>
              <Text style={s.calMonthTitle}>
                {selectedCalendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
              <Pressable
                onPress={() => {
                  setSelectedCalendarDate(new Date());
                  centerCurrentDate(true);
                }}
                hitSlop={8}
                style={s.calTodayBtn}
              >
                <Text style={s.calTodayBtnText}>Today</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={calendarScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.calScrollContent}
              onContentSizeChange={() => {
                centerCurrentDate(false);
              }}
              onLayout={() => {
                centerCurrentDate(false);
              }}
            >
              {calendarDays.map((date, i) => {
                const isToday = isSameDay(date, selectedCalendarDate);
                const activeTrips = trips.filter((t) => {
                  const st = new Date(t.startDate || "");
                  const et = new Date(t.endDate || "");
                  return date >= st && date <= et;
                });
                const hasTrips = activeTrips.length > 0;
                const dotColor = hasTrips ? getTripAccent(activeTrips[0].id) : "transparent";

                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSelectedCalendarDate(date);
                      if (hasTrips) openDetailsModal(activeTrips[0]);
                    }}
                    style={[
                      s.calDayPill,
                      isToday && s.calDayPillToday,
                      hasTrips && !isToday && { borderColor: "rgba(0, 230, 118, 0.45)" },
                    ]}
                  >
                    <Text style={[s.calDayName, isToday && s.calDayNameToday]}>
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <Text style={[s.calDayNum, isToday && s.calDayNumToday]}>
                      {date.getDate()}
                    </Text>
                    {hasTrips && !isToday && (
                      <View style={[s.calTripDot, { backgroundColor: dotColor }]} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. Status Tabs Row with Counts (Including Pinned) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.statusTabsScroll}
            style={s.statusTabsScrollWrap}
          >
            {(
              [
                { key: "All", count: allCount, icon: "earth" },
                { key: "Upcoming", count: upcomingCount, icon: "time" },
                { key: "Ongoing", count: ongoingCount, icon: "navigate" },
                { key: "Pinned", count: pinnedCount, icon: "bookmark" },
                { key: "Past", count: pastCount, icon: "checkmark-circle" },
              ] as const
            ).map((t) => {
              const active = activeTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setActiveTab(t.key as any)}
                  style={[s.statusTabPill, active && s.statusTabPillActive]}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={14}
                    color={active ? "#00e676" : "rgba(255, 255, 255, 0.45)"}
                  />
                  <Text style={[s.statusTabText, active && s.statusTabTextActive]}>
                    {t.key}
                  </Text>
                  <View style={[s.statusTabCount, active && s.statusTabCountActive]}>
                    <Text style={[s.statusTabCountText, active && s.statusTabCountTextActive]}>
                      {t.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 7. Luxury Trip Cards List */}
          {filteredTrips.length > 0 ? (
            filteredTrips.map((trip) => {
              const isOngoing =
                trip.startDate &&
                trip.endDate &&
                Date.now() >= new Date(trip.startDate).getTime() &&
                Date.now() <= new Date(trip.endDate).getTime();

              const isUpcoming =
                trip.startDate && new Date(trip.startDate).getTime() > Date.now();

              const daysUntil = trip.startDate
                ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0;

              const tripDays =
                trip.startDate && trip.endDate
                  ? Math.max(
                    1,
                    Math.round(
                      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                    )
                  )
                  : 0;

              const budgetTotal = trip.budget?.total || 0;
              const budgetUsed = trip.budget?.used || 0;
              const budgetPct =
                budgetTotal > 0 ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100)) : 0;
              const budgetRemaining = Math.max(0, budgetTotal - budgetUsed);

              const members = trip.memberProfiles || [];
              const totalMembers = trip.members?.length || members.length || 1;
              const extraCount = Math.max(0, totalMembers - Math.min(3, members.length));

              const cardCoverImage = getTripDisplayImage(trip);

              const routeFrom = trip.from ? trip.from.split(",")[0].trim() : "";
              const routeTo = trip.to
                ? trip.to.split(",")[0].trim()
                : trip.location
                  ? trip.location.split(",")[0].trim()
                  : "";
              const routeDisplay = routeFrom && routeTo ? `${routeFrom} ➔ ${routeTo}` : routeTo || routeFrom || "Scenic Journey";

              const isPinned = pinnedTripIds.includes(trip.id);

              return (
                <Pressable
                  key={trip.id}
                  onPress={() => router.push(`/trips/${trip.id}` as any)}
                  style={s.premiumCard}
                >
                  {/* Full-bleed scenic / group chat photo */}
                  <ExpoImage
                    source={{ uri: cardCoverImage }}
                    style={s.premiumCardBg}
                    contentFit="cover"
                    transition={250}
                  />

                  {/* Multi-stage dark vignette & glass overlay */}
                  <LinearGradient
                    colors={[
                      "rgba(10, 13, 20, 0.4)",
                      "rgba(10, 13, 20, 0.76)",
                      "rgba(12, 14, 21, 0.98)",
                    ]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={s.premiumCardBody}>
                    {/* TOP ROW: Status badge, Travel Type, Direct Pin & 3-Dots Action */}
                    <View style={s.cardTopRow}>
                      <View style={s.cardBadgeGroup}>
                        {/* Status Chip */}
                        <View style={[s.statusChip, isOngoing ? s.statusChipOngoing : isUpcoming ? s.statusChipUpcoming : s.statusChipPast]}>
                          <View style={[s.statusDot, isOngoing ? s.statusDotOngoing : isUpcoming ? s.statusDotUpcoming : s.statusDotPast]} />
                          <Text style={s.statusChipText}>
                            {isOngoing ? "Ongoing" : isUpcoming ? (daysUntil > 0 ? `In ${daysUntil}d` : "Upcoming") : "Past"}
                          </Text>
                        </View>

                        {/* Travel Type Chip */}
                        {trip.travelType ? (
                          <View style={s.travelTypeChip}>
                            <Text style={s.travelTypeText}>{trip.travelType}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Right Icons: Companion Avatars (if any) + Direct Pin + 3-Dots Menu */}
                      <View style={s.cardTopRightActions}>
                        {members.length > 1 ? (
                          <View style={s.avatarOverlapRow}>
                            {members.slice(0, 3).map((m, idx) => (
                              m.photoURL ? (
                                <ExpoImage
                                  key={m.uid}
                                  source={{ uri: m.photoURL }}
                                  style={[s.memberAv, idx > 0 && { marginLeft: -8 }]}
                                  contentFit="cover"
                                />
                              ) : null
                            ))}
                            {extraCount > 0 && (
                              <View style={[s.memberAv, s.memberAvExtra, { marginLeft: -8 }]}>
                                <Text style={s.memberAvExtraText}>+{extraCount}</Text>
                              </View>
                            )}
                          </View>
                        ) : null}

                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            togglePinForTrip(trip.id);
                          }}
                          hitSlop={10}
                          style={[s.cardActionCircle, isPinned && s.cardPinActive]}
                        >
                          <Ionicons
                            name={isPinned ? "bookmark" : "bookmark-outline"}
                            size={16}
                            color={isPinned ? "#fbbf24" : "rgba(255, 255, 255, 0.8)"}
                          />
                        </Pressable>

                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            openDetailsModal(trip);
                          }}
                          hitSlop={10}
                          style={s.cardActionCircle}
                        >
                          <Ionicons name="ellipsis-horizontal" size={17} color="#ffffff" />
                        </Pressable>
                      </View>
                    </View>

                    {/* MIDDLE SECTION: Title, Route, Dates */}
                    <View style={s.cardMidSection}>
                      <Text style={s.premiumTripName} numberOfLines={1}>
                        {trip.name}
                      </Text>

                      {/* Route Row: Origin ➔ Destination */}
                      <View style={s.routeRow}>
                        <Ionicons name="location-sharp" size={14} color="#00e676" />
                        <Text style={s.routeText} numberOfLines={1}>
                          {routeDisplay}
                        </Text>
                      </View>

                      {/* Date Span & Duration */}
                      <View style={s.dateRow}>
                        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.6)" />
                        <Text style={s.dateText}>
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </Text>
                        {tripDays > 0 ? (
                          <View style={s.daysBadge}>
                            <Text style={s.daysBadgeText}>{tripDays} {tripDays === 1 ? "Day" : "Days"}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* BOTTOM SECTION: Budget indicator & Dual Quick Action Buttons */}
                    <View style={s.cardBottomSection}>
                      {trip.budget && budgetTotal > 0 ? (
                        <View style={s.cardBudgetBox}>
                          <Text style={s.cardBudgetLabel}>
                            ₹{budgetUsed.toLocaleString()} / ₹{budgetTotal.toLocaleString()}
                          </Text>
                          <View style={s.cardBudgetTrack}>
                            <View
                              style={[
                                s.cardBudgetFill,
                                { width: `${budgetPct}%` },
                                budgetUsed > budgetTotal && { backgroundColor: "#ef4444" },
                              ]}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={{ flex: 1 }} />
                      )}

                      {/* Quick Action Buttons on Bottom Right */}
                      <View style={s.cardBottomRightActions}>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            router.push(`/(tabs)/group-chatroom/${trip.id}` as any);
                          }}
                          hitSlop={8}
                          style={s.cardQuickChatBtn}
                        >
                          <Ionicons name="chatbubbles-outline" size={13} color="#ffffff" />
                          <Text style={s.cardQuickChatText}>Chat</Text>
                        </Pressable>

                        <View style={s.explorePill}>
                          <Text style={s.explorePillText}>Details</Text>
                          <Ionicons name="arrow-forward" size={12} color="#00e676" />
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={s.emptyStateBox}>
              <Text style={s.emptyStateIcon}>🧭</Text>
              <Text style={s.emptyStateTitle}>No Adventures Found</Text>
              <Text style={s.emptyStateDesc}>
                {searchQuery || filterPlace
                  ? "No trips matched your search or active filters."
                  : activeTab === "Pinned"
                    ? "You haven't pinned any trips yet. Tap the bookmark icon on any trip card to pin it here!"
                    : "You don't have any trips in this tab yet. Start planning your next memorable getaway!"}
              </Text>
              <Pressable style={s.emptyStateCreateBtn} onPress={() => setCreateSheetOpen(true)}>
                <Text style={s.emptyStateCreateBtnText}>+ Plan a Trip</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── ONLY CREATE TRIP ICON AT BOTTOM ── */}
      <View style={[s.floatingActionContainer, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
        <Pressable onPress={() => setCreateSheetOpen(true)} style={s.createBtn}>
          <Feather name="edit-3" size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* ═══════════════════════════════════════════════════════════
         TRIP DETAILS MODAL (Exact match to Image 4)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        animationType="none"
        transparent
        visible={detailsModalOpen}
        onRequestClose={closeDetailsModal}
      >
        {/* Full-screen ambient scenic backdrop with heavy blur (Matches Image 1) */}
        {selectedTrip?.iconURL ? (
          <ExpoImage
            source={{ uri: selectedTrip.iconURL }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={Platform.OS === "ios" ? 40 : 28}
          />
        ) : null}
        <BlurView intensity={Platform.OS === "ios" ? 85 : 70} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(10, 14, 22, 0.4)", "rgba(10, 14, 22, 0.7)", "rgba(8, 10, 15, 0.92)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeDetailsModal}
        />

        <Animated.View
          style={[
            s.modalWrapper,
            {
              paddingTop: insets.top + 8,
              opacity: detailsAnim,
              transform: [
                {
                  scale: detailsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
                {
                  translateY: detailsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 110 }}
          >
            {/* 1. Hero Image Card (Matches Image 4) */}
            <View style={s.heroCard}>
              <ExpoImage
                source={{ uri: selectedTrip?.iconURL }}
                style={s.heroImg}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.35)", "rgba(12,15,22,0.95)"]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />

              <View style={s.heroContent}>
                <View style={s.heroTopRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={s.heroName}>{selectedTrip?.name}</Text>
                    <View style={s.heroUnderline} />
                  </View>
                  <View style={s.heroBadgeRow}>
                    {isSelectedPinned && (
                      <View style={s.heroBadgeFilled}>
                        <Text style={s.heroBadgeFilledText}>PINNED</Text>
                      </View>
                    )}
                    <View style={s.heroBadge}>
                      <Text style={s.heroBadgeText}>{selectedTrip?.travelType || "Adventure"}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="location-sharp" size={16} color="#fff" />
                    <Text style={s.heroLoc}>{selectedTrip?.location}</Text>
                  </View>
                  {selectedTrip?.from || selectedTrip?.to ? (
                    <Text style={s.heroRoute}>
                      Route Direction Matrix: {selectedTrip?.from || selectedTrip?.location} →{" "}
                      {selectedTrip?.to || "Destination"}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* 2. Budget Utilization Spectrum Card (Matches Image 1 & 4) */}
            {selectedTrip && (
              <View style={s.infoCard}>
                <BlurView intensity={Platform.OS === "ios" ? 35 : 25} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  {(() => {
                    const budgetTotal = selectedTrip.budget?.total || 0;
                    const budgetUsed = selectedTrip.budget?.used || 0;
                    const pct =
                      budgetTotal > 0
                        ? Math.min(100, Math.round((budgetUsed / budgetTotal) * 100))
                        : 0;
                    const radius = 21;
                    const strokeWidth = 4.5;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (circumference * pct) / 100;

                    return (
                      <View style={{ width: 54, height: 54, alignItems: "center", justifyContent: "center" }}>
                        <Svg
                          width={54}
                          height={54}
                          viewBox="0 0 54 54"
                          style={{ transform: [{ rotate: "-90deg" }] }}
                        >
                          <Circle
                            cx="27"
                            cy="27"
                            r={radius}
                            stroke="rgba(255, 255, 255, 0.12)"
                            strokeWidth={strokeWidth}
                            fill="none"
                          />
                          <Circle
                            cx="27"
                            cy="27"
                            r={radius}
                            stroke="#ffffff"
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            fill="none"
                          />
                        </Svg>
                        <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#ffffff", fontSize: 12.5, fontWeight: "900" }}>{pct}%</Text>
                        </View>
                      </View>
                    );
                  })()}

                  <View style={{ flex: 1 }}>
                    <Text style={s.infoCardLabel}>BUDGET UTILIZATION SPECTRUM</Text>
                    <Text style={s.infoCardVal}>
                      ₹{selectedTrip.budget?.used || 0}{" "}
                      <Text style={{ fontWeight: "400", opacity: 0.5, fontSize: 13 }}>used of</Text>{" "}
                      <Text style={{ fontWeight: "900" }}>₹{selectedTrip.budget?.total || 0}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* 3. Timeline Span Horizon Card (Matches Image 1 & 4) */}
            <View style={s.infoCard}>
              <BlurView intensity={Platform.OS === "ios" ? 35 : 25} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={s.infoCardLabel}>TIMELINE SPAN HORIZON</Text>
              <Text style={s.infoCardDate}>
                {formatSpanHorizon(selectedTrip?.startDate, selectedTrip?.endDate)}
              </Text>
            </View>

            {/* 4. Account System Deployed Members Card (Matches Image 1 & 4) */}
            <View style={s.infoCard}>
              <BlurView intensity={Platform.OS === "ios" ? 35 : 25} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={s.infoCardLabel}>ACCOUNT SYSTEM DEPLOYED MEMBERS</Text>
              <View style={s.memberChips}>
                {selectedTrip?.memberProfiles && selectedTrip.memberProfiles.length > 0 ? (
                  selectedTrip.memberProfiles.map((m) => (
                    <View key={m.uid} style={s.chip}>
                      <ExpoImage source={{ uri: m.photoURL }} style={s.chipAv} contentFit="cover" />
                      <Text style={s.chipName} numberOfLines={1}>
                        {m.name || m.username}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={s.chip}>
                    <View style={[s.chipAv, { backgroundColor: "#444" }]} />
                    <Text style={s.chipName}>1 Deployed Member</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </Animated.View>

        {/* 5. Floating Bottom Toolbar (Matches Image 4) */}
        {detailsModalOpen && selectedTrip && (
          <Animated.View
            style={[
              s.modalToolbar,
              {
                bottom: insets.bottom + 16,
                opacity: detailsAnim,
                transform: [
                  {
                    translateY: detailsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [60, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={handleShare} style={s.tbCircleBtn}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="share-outline" size={20} color="#fff" />
            </Pressable>

            <View style={s.tbCapsule}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <Pressable
                onPress={() => handleSaveToPhoneCalendar(selectedTrip)}
                style={s.tbCapsuleBtn}
                hitSlop={8}
              >
                <Ionicons name="calendar-outline" size={19} color="#ffffff" />
              </Pressable>
              <Pressable onPress={togglePin} style={s.tbCapsuleBtn}>
                <MaterialCommunityIcons
                  name={isSelectedPinned ? "pin" : "pin-outline"}
                  size={19}
                  color={isSelectedPinned ? "#00e6b0" : "#ffffff"}
                  style={!isSelectedPinned ? { transform: [{ rotate: "45deg" }] } : undefined}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  closeDetailsModal();
                  setTimeout(() => {
                    if (selectedTrip) router.push(`/trips/${selectedTrip.id}` as any);
                  }, 200);
                }}
                style={s.tbCapsuleBtn}
              >
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              </Pressable>
            </View>

            <Pressable onPress={() => setDeleteDialogOpen(true)} style={s.tbCircleBtn}>
              <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="trash-outline" size={20} color="#ffffff" />
            </Pressable>
          </Animated.View>
        )}
      </Modal>

      {/* ── FILTER MODAL (Exact glossy glassmorphic style with blur effect) ── */}
      <Modal
        animationType="fade"
        transparent
        visible={filterModalOpen}
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          {/* Full Screen Heavy Blur Effect Behind Modal */}
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterModalOpen(false)} />

          {/* Glossy Frosted Glass Card */}
          <Pressable onPress={(e) => e.stopPropagation?.()} style={s.filterCardContainer}>
            <View style={s.filterCard}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Card Gloss Sheen Highlight */}
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.14)", "rgba(255, 255, 255, 0.02)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 0.6 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={s.filterCardInner}>
                {/* Header: Title & Close Button */}
                <View style={s.filterHead}>
                  <Text style={s.filterTitle}>Filter Framework Matrix</Text>
                  <Pressable
                    onPress={() => setFilterModalOpen(false)}
                    hitSlop={12}
                    style={s.filterCloseBtn}
                  >
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </Pressable>
                </View>

                {/* Location / Place Input */}
                <View style={s.filterInputBox}>
                  <TextInput
                    value={filterPlace}
                    onChangeText={setFilterPlace}
                    placeholder="Filter by Location / Place"
                    placeholderTextColor="rgba(255, 255, 255, 0.42)"
                    style={s.filterInput}
                  />
                  {filterPlace ? (
                    <Pressable onPress={() => setFilterPlace("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.5)" />
                    </Pressable>
                  ) : null}
                </View>

                {/* Date Horizon Row */}
                <View style={s.horizonRow}>
                  {/* Start Horizon */}
                  <View style={{ flex: 1 }}>
                    <Text style={s.horizonLabel}>Timeline Horizon Start</Text>
                    <View style={s.horizonPill}>
                      <TextInput
                        value={filterStartDate}
                        onChangeText={setFilterStartDate}
                        placeholder="dd-mm-yyyy"
                        placeholderTextColor="rgba(255, 255, 255, 0.35)"
                        style={s.horizonInput}
                      />
                      <Pressable onPress={() => handleSetQuickHorizon("today")} hitSlop={6}>
                        <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.5)" />
                      </Pressable>
                    </View>
                  </View>

                  {/* End Horizon */}
                  <View style={{ flex: 1 }}>
                    <Text style={s.horizonLabel}>Timeline Horizon End</Text>
                    <View style={s.horizonPill}>
                      <TextInput
                        value={filterEndDate}
                        onChangeText={setFilterEndDate}
                        placeholder="dd-mm-yyyy"
                        placeholderTextColor="rgba(255, 255, 255, 0.35)"
                        style={s.horizonInput}
                      />
                      <Pressable onPress={() => handleSetQuickHorizon("week")} hitSlop={6}>
                        <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.5)" />
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Quick Date Horizon Presets */}
                <View style={s.presetsRow}>
                  <Pressable onPress={() => handleSetQuickHorizon("today")} style={s.presetChip}>
                    <Text style={s.presetText}>Today</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSetQuickHorizon("week")} style={s.presetChip}>
                    <Text style={s.presetText}>Next 7 Days</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSetQuickHorizon("month")} style={s.presetChip}>
                    <Text style={s.presetText}>This Month</Text>
                  </Pressable>
                  {(filterStartDate || filterEndDate) ? (
                    <Pressable
                      onPress={() => handleSetQuickHorizon("clear")}
                      style={[s.presetChip, { borderColor: "rgba(239, 68, 68, 0.25)", backgroundColor: "rgba(239, 68, 68, 0.08)" }]}
                    >
                      <Text style={[s.presetText, { color: "#f87171" }]}>Reset Dates</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Action Buttons: Clear & Apply Filter */}
                <View style={s.filterActions}>
                  <Pressable
                    onPress={() => {
                      setFilterPlace("");
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    style={s.clearBtn}
                  >
                    <Text style={s.clearText}>Clear</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setFilterModalOpen(false)}
                    style={s.applyBtn}
                  >
                    <Text style={s.applyText}>Apply Filter</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* ── DELETE CONFIRM DIALOG ── */}
      <ConfirmDeleteDialog
        visible={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteTrip}
        tripName={selectedTrip?.name}
      />

      {/* ── CREATE TRIP SHEET ── */}
      <CreateTripSheet visible={createSheetOpen} onClose={() => setCreateSheetOpen(false)} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c0e15" },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* 1. Header */
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  welcomeSubText: {
    color: "#00e676",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  mainGreeting: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  topHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userAvatarHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#00e676",
  },
  userAvatarHeaderPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderWidth: 1.5,
    borderColor: "#00e676",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarInitial: {
    color: "#00e676",
    fontSize: 16,
    fontWeight: "900",
  },

  /* 2. Featured Spotlight Card */
  spotlightCard: {
    minHeight: 195,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1.2,
    borderColor: "rgba(0, 230, 118, 0.35)",
    backgroundColor: "#121520",
    position: "relative",
  },
  spotlightBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  spotlightContent: {
    padding: 16,
    flex: 1,
    justifyContent: "space-between",
  },
  spotlightBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  spotlightTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 230, 118, 0.18)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.4)",
  },
  spotlightTagText: {
    color: "#00e676",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  spotlightCountdownPill: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  spotlightCountdownText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  spotlightTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  spotlightRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  spotlightCityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  spotlightCityText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  spotlightRouteDash: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
    gap: 4,
  },
  spotlightRouteLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  spotlightFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spotlightDateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  spotlightDateText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  spotlightActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#00e676",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  spotlightActionText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "900",
  },

  /* 3. Quick Travel Stats Row */
  statsSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statCardHighlight: {
    borderColor: "rgba(0, 230, 118, 0.3)",
    backgroundColor: "rgba(0, 230, 118, 0.08)",
  },
  statNumber: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  /* 4. Search & Filter */
  searchBarRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  searchCapsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    gap: 8,
  },
  searchInputField: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13.5,
  },
  filterActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    position: "relative",
  },
  filterActionBtnActive: {
    borderColor: "#00e676",
    backgroundColor: "rgba(0, 230, 118, 0.15)",
  },
  filterActiveDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00e676",
  },

  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 230, 118, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: "80%",
  },
  activeFilterText: {
    color: "#00e676",
    fontSize: 11,
    fontWeight: "700",
  },
  activeFilterClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeFilterClearText: {
    color: "#f87171",
    fontSize: 11,
    fontWeight: "700",
  },

  /* 5. Calendar Horizon */
  calSectionWrap: { marginBottom: 14 },
  calHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calMonthTitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  calTodayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  calTodayBtnText: {
    color: "#00e676",
    fontSize: 11,
    fontWeight: "700",
  },
  calScrollContent: { gap: 8, paddingHorizontal: 2 },
  calDayPill: {
    width: 50,
    height: 64,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  calDayPillToday: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  calDayNameToday: { color: "#000000", fontWeight: "900" },
  calDayNum: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  calDayNumToday: { color: "#000000", fontWeight: "900" },
  calTripDot: {
    position: "absolute",
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* 6. Status Tabs */
  statusTabsScrollWrap: {
    marginBottom: 16,
  },
  statusTabsScroll: {
    gap: 8,
    paddingHorizontal: 2,
  },
  statusTabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusTabPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  statusTabText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12.5,
    fontWeight: "700",
  },
  statusTabTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  statusTabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  statusTabCountActive: {
    backgroundColor: "#00e676",
  },
  statusTabCountText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10.5,
    fontWeight: "800",
  },
  statusTabCountTextActive: {
    color: "#000000",
    fontWeight: "900",
  },

  /* 7. Premium Trip Card */
  premiumCard: {
    borderRadius: 26,
    marginBottom: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "#131620",
    minHeight: 240,
  },
  premiumCardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  premiumCardBody: {
    flex: 1,
    padding: 18,
    justifyContent: "space-between",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
  },
  statusChipOngoing: {
    borderColor: "rgba(0, 230, 118, 0.5)",
    backgroundColor: "rgba(0, 230, 118, 0.15)",
  },
  statusChipUpcoming: {
    borderColor: "rgba(56, 189, 248, 0.5)",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  statusChipPast: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOngoing: { backgroundColor: "#00e676" },
  statusDotUpcoming: { backgroundColor: "#38bdf8" },
  statusDotPast: { backgroundColor: "rgba(255, 255, 255, 0.4)" },
  statusChipText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  travelTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  travelTypeText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    fontWeight: "700",
  },
  cardTopRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardActionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPinActive: {
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    borderColor: "rgba(251, 191, 36, 0.45)",
  },

  cardMidSection: {
    marginBottom: 16,
  },
  premiumTripName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  routeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  daysBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  daysBadgeText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "800",
  },

  cardBottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 12,
  },
  cardBudgetBox: {
    flex: 1,
    marginRight: 10,
  },
  cardBudgetLabel: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardBudgetTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    maxWidth: 120,
  },
  cardBudgetFill: {
    height: "100%",
    backgroundColor: "#00e676",
    borderRadius: 2,
  },
  avatarOverlapRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberAv: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#131620",
    backgroundColor: "#202534",
  },
  memberAvExtra: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvExtraText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "900",
  },

  cardBottomRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardQuickChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cardQuickChatText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  explorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 230, 118, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  explorePillText: {
    color: "#00e676",
    fontSize: 12,
    fontWeight: "800",
  },

  /* Empty State */
  emptyStateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  emptyStateTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyStateDesc: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyStateCreateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderWidth: 1.2,
    borderColor: "rgba(0, 230, 118, 0.4)",
  },
  emptyStateCreateBtnText: {
    color: "#00e676",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Floating Create Trip Button (Bottom Right) */
  floatingActionContainer: {
    position: "absolute",
    right: 20,
    zIndex: 99,
  },
  createBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#161922",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.22)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  /* ═══════════════════════════════════════════════════════════
     DETAILS MODAL STYLES (Image 4)
     ═══════════════════════════════════════════════════════════ */
  modalWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* Hero Card */
  heroCard: {
    height: 270,
    borderRadius: 26,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#1a1d28",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  heroImg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroName: {
    color: "#ffffff",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroUnderline: {
    width: 75,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginTop: 6,
    marginBottom: 4,
  },
  heroBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" },
  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroBadgeText: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "700" },
  heroBadgeFilled: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  heroBadgeFilledText: {
    color: "#000",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroLoc: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  heroRoute: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 4,
    paddingLeft: 22,
  },

  /* Info Cards (Frosted glassmorphic cards with blur - Exact match to Image 1) */
  infoCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  infoCardLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoCardVal: { color: "#ffffff", fontSize: 15.5, fontWeight: "800" },
  infoCardDate: { color: "#ffffff", fontSize: 14.5, fontWeight: "700" },

  /* Member Chips */
  memberChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  chipAv: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#333" },
  chipName: { color: "rgba(255, 255, 255, 0.95)", fontSize: 12, fontWeight: "700" },

  /* Floating Bottom Toolbar in Details Modal (Image 1) */
  modalToolbar: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tbCircleBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "rgba(18, 22, 32, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  tbCapsule: {
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "rgba(18, 22, 32, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 18,
  },
  tbCapsuleBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Filter Modal - Exact Glossy Style & Blur Effect */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  filterCardContainer: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },
  filterCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(18, 22, 32, 0.68)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderTopColor: "rgba(255, 255, 255, 0.28)",
  },
  filterCardInner: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
  },
  filterHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  filterTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  filterCloseBtn: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  filterInputBox: {
    height: 50,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 25,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.13)",
    flexDirection: "row",
    alignItems: "center",
  },
  filterInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13.5,
  },
  horizonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  horizonLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 6,
  },
  horizonPill: {
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.13)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  horizonInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 13,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  presetText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  filterActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  clearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.11)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  applyText: {
    color: "#0a0e1a",
    fontSize: 14,
    fontWeight: "800",
  },
});
