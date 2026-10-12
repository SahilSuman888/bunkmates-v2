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
  PanResponder,
  Easing,
  LayoutAnimation,
  UIManager,
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
  addDoc,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import NotificationBell from "../../components/NotificationBell";
import CreateTripSheet from "../../components/trips/CreateTripSheet";
import ConfirmDeleteDialog from "../../components/trip_components/ConfirmDeleteDialog";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Circle } from "react-native-svg";
import { useUserGroups } from "../../hooks/useUserGroups";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SUGGESTED_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 42) / 2);

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

interface CalendarReminder {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD or date string
  time?: string;
  completed?: boolean;
  tripId?: string;
  tripName?: string;
}

/* ──────── Helpers ──────── */

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isSameDateString = (date: Date, dateStr?: string) => {
  if (!dateStr) return false;
  const key = formatDateKey(date);
  if (dateStr === key || dateStr.startsWith(key)) return true;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return isSameDay(date, parsed);
  return false;
};

const getTripAccent = (id: string) => {
  const colors = ["#ffffff", "#e2e8f0", "#FBBF24"];
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

const memoryCachedTrips: Record<string, TripData[]> = {};
const memoryCachedCalendarReminders: Record<string, CalendarReminder[]> = {};

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function TripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const { formatCurrency, formatDate, hidePastTrips } = useAppSettings();
  const { t } = useLanguage();

  // Real-time group chats hook (already manages groupChats for current user)
  const { groups = [] } = useUserGroups(user?.uid || null) || {};

  /* ── State (0ms instant render from memory cache) ── */
  const [trips, setTrips] = useState<TripData[]>(() => {
    return (user?.uid && memoryCachedTrips[user.uid]) || [];
  });
  const [directGroupIcons, setDirectGroupIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(() => {
    return !(user?.uid && memoryCachedTrips[user.uid]?.length);
  });
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

  /* ── 3-Trip Limit & Load More State ── */
  const INITIAL_TRIP_LIMIT = 3;
  const [visibleTripsCount, setVisibleTripsCount] = useState<number>(INITIAL_TRIP_LIMIT);

  // Automatically reset to initial 3 trips when filters, search, or active tab change
  useEffect(() => {
    setVisibleTripsCount(INITIAL_TRIP_LIMIT);
  }, [searchQuery, filterPlace, filterStartDate, filterEndDate, activeTab]);

  const detailsAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const modalScrollOffset = useRef(0);
  const mainScrollY = useRef(new Animated.Value(0)).current;

  // Dynamic blur opacity: 0 when at top, smoothly fades in as user scrolls
  const headerBlurOpacity = useMemo(() => {
    return mainScrollY.interpolate({
      inputRange: [0, 20, 65],
      outputRange: [0, 0.7, 1],
      extrapolate: "clamp",
    });
  }, [mainScrollY]);

  /* ── Calendar Drawer & Google Calendar Reminders State ── */
  const [calendarDrawerOpen, setCalendarDrawerOpen] = useState(false);
  const [archiveMonthOffset, setArchiveMonthOffset] = useState(0);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<Date>(new Date());
  const [selectedArchiveTrip, setSelectedArchiveTrip] = useState<TripData | null>(null);
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminder[]>(() => {
    return (user?.uid && memoryCachedCalendarReminders[user.uid]) || [];
  });
  const [newReminderModalOpen, setNewReminderModalOpen] = useState(false);
  const [newReminderText, setNewReminderText] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("10:00 AM");
  const [newReminderTripId, setNewReminderTripId] = useState("");
  const [monthYearPickerOpen, setMonthYearPickerOpen] = useState(false);
  const [pickerSelectedYear, setPickerSelectedYear] = useState(new Date().getFullYear());
  const calendarDrawerAnim = useRef(new Animated.Value(0)).current;
  const calendarDrawerPanY = useRef(new Animated.Value(0)).current;
  const calendarDrawerScrollOffset = useRef(0);

  /* ── Calendar Pull Down & Framer Motion Drag Physics ── */
  const [mainScrollEnabled, setMainScrollEnabled] = useState(true);
  const [isPullingCalendar, setIsPullingCalendar] = useState(false);
  const calPullAnim = useRef(new Animated.Value(0)).current;

  /* ── AI Suggested Trips State (Inline Grid View) ── */
  const [suggestedExpanded, setSuggestedExpanded] = useState(false);
  const [visibleSuggestedCount, setVisibleSuggestedCount] = useState(4);
  const [prefilledTripData, setPrefilledTripData] = useState<any>(null);
  const mainScrollRef = useRef<any>(null);

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

  /* ── Realtime Reminders Subscription for Travel Calendar (0ms Offline Hydration) ── */
  useEffect(() => {
    if (!user?.uid) return;

    AsyncStorage.getItem(`bunkmate.cachedCalendarReminders.${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCachedCalendarReminders[user.uid] = parsed;
            setCalendarReminders(parsed);
          }
        } catch { }
      }
    });

    const q = query(collection(db, "reminders"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CalendarReminder[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() || {};
          list.push({
            id: docSnap.id,
            text: d.text || d.title || "Reminder",
            date: d.date || "",
            time: d.time || "10:00 AM",
            completed: !!d.completed,
            tripId: d.tripId || "",
            tripName: d.tripName || "",
          });
        });
        memoryCachedCalendarReminders[user.uid] = list;
        setCalendarReminders(list);
        AsyncStorage.setItem(`bunkmate.cachedCalendarReminders.${user.uid}`, JSON.stringify(list)).catch(() => { });
      },
      (err) => {
        console.log("Reminders subscription error:", err);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  /* ── Realtime Firestore Subscription for Trips with Offline Resilience ── */
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate previous trips from offline cache (like WhatsApp)
    AsyncStorage.getItem(`bunkmate.cachedTrips.${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCachedTrips[user.uid] = parsed;
            setTrips(parsed);
            setLoading(false);
          }
        } catch (e) { }
      }
    });

    if (!trips.length && !memoryCachedTrips[user.uid]?.length) {
      setLoading(true);
    }

    const q = query(collection(db, "trips"), where("members", "array-contains", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // FAST-PATH: Render primary trip cards immediately without waiting for secondary queries
        const fastTrips: TripData[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
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
            budget: data.budget ? { total: parseFloat(data.budget) || 0, used: 0, expensesCount: 0 } : null,
            memberProfiles: [],
            timelineStats: { total: 1, completed: 0 },
            timelineProgress: 0,
          };
        });

        // Merge with existing trips to retain any previously loaded budgets/profiles
        setTrips((prevTrips) => {
          const prevMap = new Map(prevTrips.map((t) => [t.id, t]));
          const merged = fastTrips.map((ft) => {
            const existing = prevMap.get(ft.id);
            if (!existing) return ft;
            return {
              ...ft,
              budget: existing.budget || ft.budget,
              memberProfiles: existing.memberProfiles?.length ? existing.memberProfiles : ft.memberProfiles,
              timelineStats: existing.timelineStats || ft.timelineStats,
              timelineProgress: existing.timelineProgress ?? ft.timelineProgress,
              iconURL: existing.iconURL || ft.iconURL,
            };
          });
          memoryCachedTrips[user.uid] = merged;
          return merged;
        });
        setLoading(false);

        // BACKGROUND ENRICHMENT: Fetch group icons, budgets, member profiles, and timeline asynchronously
        (async () => {
          try {
            const enrichedTrips = await Promise.all(
              fastTrips.map(async (trip) => {
                const tripCopy = { ...trip };

                // Direct fetch from groupChats for this trip ID
                try {
                  const gSnap = await getDoc(doc(db, "groupChats", tripCopy.id));
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
                      setDirectGroupIcons((prev) => ({ ...prev, [tripCopy.id]: icon }));
                      tripCopy.iconURL = icon;
                    }
                  }
                } catch (err) { }

                // Fetch budget
                try {
                  const budgetSnap = await getDoc(doc(db, "budgets", tripCopy.id));
                  if (budgetSnap.exists()) {
                    const bData = budgetSnap.data();
                    const expenses = Array.isArray(bData.expenses) ? bData.expenses : [];
                    const used = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                    const total = parseFloat(bData.total) || (tripCopy.budget?.total || 0);
                    tripCopy.budget = { total, used, expensesCount: expenses.length };
                  }
                } catch { }

                // Fetch member profiles
                try {
                  const profiles = await Promise.all(
                    (tripCopy.members || []).slice(0, 6).map(async (uid) => {
                      try {
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
                      } catch { }
                      return {
                        uid,
                        name: "Traveler",
                        username: "traveler",
                        photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${uid}`,
                      };
                    })
                  );
                  tripCopy.memberProfiles = profiles;
                } catch {
                  tripCopy.memberProfiles = [];
                }

                // Fetch timeline stats
                try {
                  const timelineSnap = await getDocs(collection(db, "trips", tripCopy.id, "timeline"));
                  const events = timelineSnap.docs.map((d) => d.data());
                  const total = events.length || 1;
                  const completed = events.filter((e: any) => e?.completed === true).length;
                  tripCopy.timelineStats = { total, completed };
                  tripCopy.timelineProgress = Math.round((completed / total) * 100);
                } catch {
                  tripCopy.timelineStats = { total: 1, completed: 0 };
                  tripCopy.timelineProgress = 0;
                }

                return tripCopy;
              })
            );

            memoryCachedTrips[user.uid] = enrichedTrips;
            setTrips(enrichedTrips);
            AsyncStorage.setItem(`bunkmate.cachedTrips.${user.uid}`, JSON.stringify(enrichedTrips)).catch(() => { });
          } catch (enrichErr) {
            console.log("Background trip enrichment error:", enrichErr);
          }
        })();
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

  const displayedTrips = useMemo(() => {
    return filteredTrips.slice(0, visibleTripsCount);
  }, [filteredTrips, visibleTripsCount]);

  const remainingTripsCount = Math.max(0, filteredTrips.length - visibleTripsCount);
  const hasMoreTrips = remainingTripsCount > 0;

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
      const filePath = `${(FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || ""}${cleanFileName}.ics`;

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

  /* ── Details Modal Fluid Animations & Gesture Mechanics ── */
  const dismissModalWithAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(panY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(detailsAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDetailsModalOpen(false);
      setSelectedTrip(null);
      panY.setValue(0);
      detailsAnim.setValue(0);
      modalScrollOffset.current = 0;
    });
  }, [detailsAnim, panY]);

  const closeDetailsModal = useCallback(() => {
    dismissModalWithAnimation();
  }, [dismissModalWithAnimation]);

  const openDetailsModal = useCallback(
    (trip: TripData) => {
      const resolvedImage = getTripDisplayImage(trip);
      setSelectedTrip({ ...trip, iconURL: resolvedImage });
      panY.setValue(0);
      modalScrollOffset.current = 0;
      detailsAnim.setValue(0);
      setDetailsModalOpen(true);
      requestAnimationFrame(() => {
        Animated.spring(detailsAnim, {
          toValue: 1,
          damping: 24,
          stiffness: 190,
          mass: 0.9,
          useNativeDriver: true,
        }).start();
      });
    },
    [getTripDisplayImage, detailsAnim, panY]
  );

  // Dedicated PanResponder for the top visual pull handle (instant, guaranteed response)
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.4) {
          dismissModalWithAnimation();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Container PanResponder for swiping down from the cards when scroll is at top
  const containerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          modalScrollOffset.current <= 0 &&
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.3
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          dismissModalWithAnimation();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const modalTranslateY = Animated.add(
    detailsAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [SCREEN_HEIGHT, 0],
    }),
    panY
  );

  const modalScale = panY.interpolate({
    inputRange: [0, SCREEN_HEIGHT],
    outputRange: [1, 0.88],
    extrapolate: "clamp",
  });

  const backdropFade = panY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.7],
    outputRange: [1, 0.15],
    extrapolate: "clamp",
  });

  /* ── Calendar Drawer & Reminders Handlers ── */
  const getTripForArchiveDate = useCallback(
    (date: Date): TripData | null => {
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return (
        trips.find((t) => {
          if (!t.startDate) return false;
          const st = parseFlexibleDate(t.startDate);
          if (!st) return false;
          const et = t.endDate ? parseFlexibleDate(t.endDate) || st : st;
          const sTime = new Date(st.getFullYear(), st.getMonth(), st.getDate()).getTime();
          const eTime = new Date(et.getFullYear(), et.getMonth(), et.getDate()).getTime();
          return target >= sTime && target <= eTime;
        }) || null
      );
    },
    [trips, parseFlexibleDate]
  );

  const getTripsForDate = useCallback(
    (date: Date): TripData[] => {
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return trips.filter((t) => {
        if (!t.startDate) return false;
        const st = parseFlexibleDate(t.startDate);
        if (!st) return false;
        const et = t.endDate ? parseFlexibleDate(t.endDate) || st : st;
        const sTime = new Date(st.getFullYear(), st.getMonth(), st.getDate()).getTime();
        const eTime = new Date(et.getFullYear(), et.getMonth(), et.getDate()).getTime();
        return target >= sTime && target <= eTime;
      });
    },
    [trips, parseFlexibleDate]
  );

  const getRemindersForDate = useCallback(
    (date: Date): CalendarReminder[] => {
      return calendarReminders.filter((r) => isSameDateString(date, r.date));
    },
    [calendarReminders]
  );

  const closeCalendarDrawer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.parallel([
      Animated.timing(calendarDrawerPanY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        easing: Easing.bezier(0.3, 0.05, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(calendarDrawerAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.bezier(0.3, 0.05, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCalendarDrawerOpen(false);
      setSelectedArchiveTrip(null);
      calendarDrawerPanY.setValue(0);
      calendarDrawerAnim.setValue(0);
      calendarDrawerScrollOffset.current = 0;
    });
  }, [calendarDrawerAnim, calendarDrawerPanY]);

  const openCalendarDrawer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    calendarDrawerPanY.setValue(0);
    calendarDrawerAnim.setValue(0);
    setSelectedArchiveDate(selectedCalendarDate || new Date());
    const matched = getTripForArchiveDate(selectedCalendarDate || new Date());
    setSelectedArchiveTrip(matched);
    calendarDrawerScrollOffset.current = 0;
    setCalendarDrawerOpen(true);
    requestAnimationFrame(() => {
      Animated.spring(calendarDrawerAnim, {
        toValue: 1,
        damping: 24,
        stiffness: 220,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    });
  }, [calendarDrawerAnim, calendarDrawerPanY, selectedCalendarDate, getTripForArchiveDate]);

  const toggleReminder = useCallback(async (remId: string, currentCompleted: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCalendarReminders((prev) =>
      prev.map((r) => (r.id === remId ? { ...r, completed: !currentCompleted } : r))
    );
    try {
      await setDoc(doc(db, "reminders", remId), { completed: !currentCompleted }, { merge: true });
    } catch (e) {
      console.log("Error updating reminder:", e);
    }
  }, []);

  const deleteReminder = useCallback(async (remId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCalendarReminders((prev) => prev.filter((r) => r.id !== remId));
    try {
      await deleteDoc(doc(db, "reminders", remId));
    } catch (e) {
      console.log("Error deleting reminder:", e);
    }
  }, []);

  const handleCreateReminder = useCallback(async () => {
    if (!newReminderText.trim() || !user?.uid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const targetDateStr = formatDateKey(selectedArchiveDate);
    const matchedTrip = trips.find((t) => t.id === newReminderTripId);
    const reminderData = {
      uid: user.uid,
      text: newReminderText.trim(),
      date: targetDateStr,
      time: newReminderTime,
      tripId: newReminderTripId || "",
      tripName: matchedTrip ? matchedTrip.name : "",
      completed: false,
      createdAt: new Date().toISOString(),
    };
    try {
      const docRef = await addDoc(collection(db, "reminders"), reminderData);
      setCalendarReminders((prev) => [{ id: docRef.id, ...reminderData }, ...prev]);
      setNewReminderText("");
      setNewReminderTripId("");
      setNewReminderModalOpen(false);
    } catch (e) {
      console.log("Error adding reminder:", e);
    }
  }, [newReminderText, user?.uid, selectedArchiveDate, newReminderTripId, newReminderTime, trips]);

  const calendarHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          calendarDrawerPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 70 || gestureState.vy > 0.4) {
          closeCalendarDrawer();
        } else {
          Animated.spring(calendarDrawerPanY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const calendarDrawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          calendarDrawerScrollOffset.current <= 0 &&
          gestureState.dy > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.3
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          calendarDrawerPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.4) {
          closeCalendarDrawer();
        } else {
          Animated.spring(calendarDrawerPanY, {
            toValue: 0,
            damping: 24,
            stiffness: 300,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  /* ── Dedicated Framer-Motion Elastic PanResponder for Calendar Pull Handle ── */
  const calPullBarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setMainScrollEnabled(false);
        setIsPullingCalendar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      },
      onPanResponderMove: (_, gestureState) => {
        const dy = gestureState.dy;
        if (dy > 0) {
          // Rubber-band physics curve matching Framer-Motion drag="y"
          const rubber = dy * (1 - Math.exp((-dy * 0.3) / 100));
          calPullAnim.setValue(rubber);
        } else {
          calPullAnim.setValue(dy * 0.15);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setMainScrollEnabled(true);
        setIsPullingCalendar(false);
        const isTap = Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.dx) < 5;
        if (gestureState.dy > 25 || gestureState.vy > 0.25 || isTap) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
          openCalendarDrawer();
        }
        Animated.spring(calPullAnim, {
          toValue: 0,
          stiffness: 220,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        setMainScrollEnabled(true);
        setIsPullingCalendar(false);
        Animated.spring(calPullAnim, {
          toValue: 0,
          stiffness: 220,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  /* ── Swiping/scrolling down on horizontal calendar strip triggers the full calendar drawer ── */
  const calStripPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.6;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.6;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setMainScrollEnabled(false);
        setIsPullingCalendar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      },
      onPanResponderMove: (_, gestureState) => {
        const dy = gestureState.dy;
        if (dy > 0) {
          const rubber = dy * (1 - Math.exp((-dy * 0.3) / 100));
          calPullAnim.setValue(rubber);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setMainScrollEnabled(true);
        setIsPullingCalendar(false);
        if (gestureState.dy > 25 || gestureState.vy > 0.25) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
          openCalendarDrawer();
        }
        Animated.spring(calPullAnim, {
          toValue: 0,
          stiffness: 220,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        setMainScrollEnabled(true);
        setIsPullingCalendar(false);
        Animated.spring(calPullAnim, {
          toValue: 0,
          stiffness: 220,
          damping: 22,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  /* ── Framer-Motion Elastic Drag Animations (Native Driver ScaleX instead of Width) ── */
  const pullBarScaleX = calPullAnim.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 2],
    extrapolate: "clamp",
  });

  const pullBarTranslateY = calPullAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 10],
    extrapolate: "clamp",
  });

  const pullChevronOpacity = calPullAnim.interpolate({
    inputRange: [0, 25, 60],
    outputRange: [0.65, 0.9, 1],
    extrapolate: "clamp",
  });

  const calendarStripTranslateY = calPullAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 8],
    extrapolate: "clamp",
  });

  // Vibrant scenic background wallpaper for ambient blur (matches User Image 2)
  const calendarBackgroundImage = useMemo(() => {
    if (selectedTrip) return getTripDisplayImage(selectedTrip);
    if (trips.length > 0 && trips[0]) return getTripDisplayImage(trips[0]);
    return "https://images.unsplash.com/photo-1506461883276-594a12b11cf3?q=80&w=1200&auto=format&fit=crop";
  }, [selectedTrip, trips, getTripDisplayImage]);

  const calendarDrawerTranslateY = Animated.add(
    calendarDrawerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [SCREEN_HEIGHT * 0.85, 0],
    }),
    calendarDrawerPanY
  );

  const calendarDrawerScale = Animated.multiply(
    calendarDrawerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.93, 1],
      extrapolate: "clamp",
    }),
    calendarDrawerPanY.interpolate({
      inputRange: [0, SCREEN_HEIGHT],
      outputRange: [1, 0.88],
      extrapolate: "clamp",
    })
  );

  const calendarBackdropFade = calendarDrawerPanY.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.7],
    outputRange: [1, 0.15],
    extrapolate: "clamp",
  });

  /* ── Month Grid Horizontal Swipe Gesture (Left = Next Month, Right = Prev Month) ── */
  const monthSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 20 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -35) {
          // Swiped left -> next month
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setArchiveMonthOffset((prev) => prev + 1);
        } else if (gestureState.dx > 35) {
          // Swiped right -> prev month
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setArchiveMonthOffset((prev) => prev - 1);
        }
      },
    })
  ).current;

  /* ── Instagram-Style Travel Archive Calendar Data ── */
  const currentArchiveDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + archiveMonthOffset);
    return d;
  }, [archiveMonthOffset]);

  const archiveMonthTitle = useMemo(() => {
    return currentArchiveDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentArchiveDate]);

  const archiveGridDays = useMemo(() => {
    const year = currentArchiveDate.getFullYear();
    const month = currentArchiveDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid: ({ dayNum: number; date: Date } | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ dayNum: d, date: new Date(year, month, d) });
    }
    return grid;
  }, [currentArchiveDate]);

  /* ── AI Suggested Trips Handlers (Inline Grid View) ── */
  const toggleSuggestedExpanded = useCallback(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSuggestedExpanded((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          if (mainScrollRef.current) {
            if (typeof mainScrollRef.current.scrollToEnd === "function") {
              mainScrollRef.current.scrollToEnd({ animated: true });
            } else if (
              mainScrollRef.current.getNode &&
              typeof mainScrollRef.current.getNode().scrollToEnd === "function"
            ) {
              mainScrollRef.current.getNode().scrollToEnd({ animated: true });
            }
          }
        }, 120);
      }
      return next;
    });
  }, []);

  /* ── AI Analysis for Genuine Suggested Trips based on User Past Trips ── */
  const suggestedTripsData = useMemo(() => {
    let totalBudgetSum = 0;
    let budgetCount = 0;
    const typeFreq: Record<string, number> = {};
    const fromFreq: Record<string, number> = {};
    const visitedKeywords: string[] = [];

    trips.forEach((t) => {
      if (t.travelType) {
        typeFreq[t.travelType] = (typeFreq[t.travelType] || 0) + 1;
      }
      if (t.from) {
        const city = t.from.split(",")[0].trim();
        if (city) fromFreq[city] = (fromFreq[city] || 0) + 1;
      }
      const text = `${t.name || ""} ${t.location || ""} ${t.to || ""}`.toLowerCase();
      visitedKeywords.push(text);

      const b = t.budget?.total || parseFloat(t.budget as any) || 0;
      if (b > 0) {
        totalBudgetSum += b;
        budgetCount++;
      }
    });

    // Detect user's main origin city from past trips (e.g. Jaipur, Delhi, Mumbai)
    let originCity = "Jaipur";
    let maxFromCount = 0;
    Object.entries(fromFreq).forEach(([city, count]) => {
      if (count > maxFromCount) {
        maxFromCount = count;
        originCity = city;
      }
    });

    const avgBudget = budgetCount > 0 ? Math.round(totalBudgetSum / budgetCount) : 18000;

    let favType = "Adventure";
    let maxC = 0;
    Object.entries(typeFreq).forEach(([tp, c]) => {
      if (c > maxC) {
        maxC = c;
        favType = tp;
      }
    });

    const allVisited = visitedKeywords.join(" ");
    const likesRajasthan =
      allVisited.includes("jaipur") ||
      allVisited.includes("udaipur") ||
      allVisited.includes("jodhpur") ||
      allVisited.includes("rajasthan") ||
      allVisited.includes("bunk");
    const likesMountains =
      allVisited.includes("manali") ||
      allVisited.includes("shimla") ||
      allVisited.includes("kasol") ||
      allVisited.includes("spiti") ||
      allVisited.includes("himachal") ||
      allVisited.includes("mountain");
    const likesUttarakhand =
      allVisited.includes("rishikesh") ||
      allVisited.includes("dehradun") ||
      allVisited.includes("mussoorie") ||
      allVisited.includes("uttarakhand");

    const curatedList = [
      {
        id: "sug-jaisalmer",
        name: "Jaisalmer Desert & Sam Dunes Safari",
        location: "Jaisalmer, Rajasthan",
        from: originCity,
        to: "Jaisalmer & Thar Desert",
        travelType: "Heritage & Desert",
        budget: Math.max(12000, Math.round(avgBudget * 0.95)),
        days: 4,
        coords: [26.9157, 70.9083],
        originCoords: [26.9124, 75.7873],
        image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop",
        insight: `Analyzed from your Rajasthan trips • Camel safari & Thar desert camp fitting your ₹${avgBudget.toLocaleString()} budget`,
      },
      {
        id: "sug-jibhi",
        name: "Jibhi & Tirthan Valley Riverside Escape",
        location: "Tirthan Valley, Himachal Pradesh",
        from: originCity === "Jaipur" ? "Delhi" : originCity,
        to: "Jibhi & Great Himalayan National Park",
        travelType: "Nature & Mountains",
        budget: Math.max(13000, Math.round(avgBudget * 0.95)),
        days: 4,
        coords: [31.6375, 77.3820],
        originCoords: [28.6139, 77.2090],
        image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=800&auto=format&fit=crop",
        insight: `Pine forests, trout stream wooden huts & Jalori Pass • Perfect fresh mountain circuit`,
      },
      {
        id: "sug-rishikesh",
        name: "Rishikesh Rapids & Shivpuri River Camp",
        location: "Rishikesh, Uttarakhand",
        from: originCity === "Jaipur" ? "Delhi" : originCity,
        to: "Rishikesh & Ganga Valley",
        travelType: "Adventure & Rapids",
        budget: Math.max(9000, Math.round(avgBudget * 0.75)),
        days: 3,
        coords: [30.1348, 78.3888],
        originCoords: [28.6139, 77.2090],
        image: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?q=80&w=800&auto=format&fit=crop",
        insight: `Grade-3 white-water rafting & cliff jumping • High energy adventure for your squad`,
      },
      {
        id: "sug-kumbhalgarh",
        name: "Kumbhalgarh Citadel & Ranakpur Valley",
        location: "Kumbhalgarh, Rajasthan",
        from: originCity,
        to: "Kumbhalgarh & Ranakpur",
        travelType: "Heritage & Scenic",
        budget: Math.max(10000, Math.round(avgBudget * 0.85)),
        days: 3,
        coords: [25.1479, 73.5872],
        originCoords: [26.9124, 75.7873],
        image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=800&auto=format&fit=crop",
        insight: `Great Wall of India & lush Aravalli fortress trail • Matches your comfort spend`,
      },
      {
        id: "sug-gokarna",
        name: "Gokarna Coastal Trail & Kudle Sunsets",
        location: "Gokarna, Karnataka",
        from: "Goa",
        to: "Gokarna Beach Trail",
        travelType: "Coastal & Relaxation",
        budget: Math.max(14000, Math.round(avgBudget * 1.05)),
        days: 4,
        coords: [14.5479, 74.3188],
        originCoords: [15.2993, 74.1240],
        image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=800&auto=format&fit=crop",
        insight: `Cliffside beach treks & relaxed sea shacks • Fits your preferred relaxed journey pace`,
      },
      {
        id: "sug-spiti",
        name: "Spiti High-Pass Trans-Himalayan Circuit",
        location: "Spiti Valley, Himachal Pradesh",
        from: originCity === "Jaipur" ? "Delhi" : originCity,
        to: "Kaza & Chandratal Lake",
        travelType: "High Altitude Adventure",
        budget: Math.max(16000, Math.round(avgBudget * 1.15)),
        days: 6,
        coords: [32.2461, 78.0349],
        originCoords: [28.6139, 77.2090],
        image: "https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=800&auto=format&fit=crop",
        insight: `Key Monastery & highest postal post at Hikkim • Grand trans-Himalayan route`,
      },
      {
        id: "sug-chopta",
        name: "Chopta Tungnath & Chandrashila Ridge",
        location: "Chopta, Uttarakhand",
        from: originCity === "Jaipur" ? "Delhi" : originCity,
        to: "Chopta & Tungnath Peak",
        travelType: "Alpine Trek & Nature",
        budget: Math.max(11000, Math.round(avgBudget * 0.85)),
        days: 4,
        coords: [30.4854, 79.1764],
        originCoords: [28.6139, 77.2090],
        image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop",
        insight: `Mini Switzerland of Uttarakhand & highest Shiva shrine • 360° summit views`,
      },
      {
        id: "sug-varkala",
        name: "Varkala Cliff & Alleppey Backwaters",
        location: "Varkala, Kerala",
        from: "Kochi",
        to: "Varkala Cliff & Backwater Lagoon",
        travelType: "Coastal & Tropical",
        budget: Math.max(15000, Math.round(avgBudget * 1.1)),
        days: 5,
        coords: [8.7379, 76.7163],
        originCoords: [9.9312, 76.2673],
        image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=800&auto=format&fit=crop",
        insight: `Red laterite cliffs, sunset ocean cafes & private houseboat lagoons`,
      },
      {
        id: "sug-pushkar",
        name: "Pushkar Sacred Ghats & Desert Glamping",
        location: "Pushkar, Rajasthan",
        from: originCity,
        to: "Pushkar Ghats & Thar Desert",
        travelType: "Heritage & Culture",
        budget: Math.max(8000, Math.round(avgBudget * 0.7)),
        days: 3,
        coords: [26.4897, 74.5511],
        originCoords: [26.9124, 75.7873],
        image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=800&auto=format&fit=crop",
        insight: `Sacred lake ghats, camel safaris & peaceful sunset ridge viewpoints`,
      },
      {
        id: "sug-coorg",
        name: "Coorg Coffee Highlands & Abbey Falls",
        location: "Coorg, Karnataka",
        from: "Bengaluru",
        to: "Madikeri & Coffee Plantations",
        travelType: "Misty Hills & Nature",
        budget: Math.max(12000, Math.round(avgBudget * 0.9)),
        days: 3,
        coords: [12.4244, 75.7382],
        originCoords: [12.9716, 77.5946],
        image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800&auto=format&fit=crop",
        insight: `Aroma spice plantations, misty morning waterfalls & Western Ghats greenery`,
      },
    ];

    return {
      list: curatedList.slice(0, visibleSuggestedCount),
      totalCount: curatedList.length,
      hasMore: visibleSuggestedCount < curatedList.length,
      avgBudget,
      favType,
      originCity,
    };
  }, [trips, visibleSuggestedCount]);

  /* ── Open Create Trip Sheet with Pre-filled Suggested Trip Data ── */
  const handleOpenCreateWithSuggestion = (suggestion: any) => {
    const start = new Date();
    start.setDate(start.getDate() + 14);
    const end = new Date(start);
    end.setDate(end.getDate() + (suggestion.days || 4));

    // Must be YYYY-MM-DD for CreateTripSheet calendar & state
    const toYMD = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    setPrefilledTripData({
      name: suggestion.name,
      from: suggestion.from,
      to: suggestion.to,
      location: suggestion.location,
      startDate: toYMD(start),
      endDate: toYMD(end),
      budget: suggestion.budget.toString(),
      iconURL: suggestion.image,
      travelType: suggestion.travelType,
      destCoords: suggestion.coords || null,
      originCoords: suggestion.originCoords || null,
      description: `Curated ${suggestion.travelType} adventure to ${suggestion.to}. ${suggestion.insight || ""}`,
    });

    setCreateSheetOpen(true);
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

      {/* Top Safe Area background spacer cap */}
      <View style={{ height: insets.top, width: "100%", backgroundColor: "#0c0e15", zIndex: 999 }} />

      {/* ── Trips Page Native Blur Backdrop when Calendar Drawer is Open ── */}
      {calendarDrawerOpen && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 900,
              opacity: calendarDrawerAnim,
            },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={Platform.OS === "ios" ? 80 : 45}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(10, 14, 22, 0.55)" },
            ]}
          />
        </Animated.View>
      )}

      {/* ── SCROLLABLE TRIPS DASHBOARD ── */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <Animated.ScrollView
          ref={mainScrollRef}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={mainScrollEnabled}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 120,
          }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: mainScrollY } } }],
            { useNativeDriver: true }
          )}
        >
          {/* ── SECTION 0: COLLAPSIBLE TOP HEADER (SCROLLS UP AND COLLAPSES) ── */}
          <View style={s.collapsibleTopSection}>
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
                      <Ionicons name="sparkles" size={12} color="#ffffff" />
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
                      <Ionicons name="navigate-circle" size={13} color="#ffffff" />
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
                      <Ionicons name="location-sharp" size={13} color="#ffffff" />
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
                <Text style={[s.statNumber, { color: "#ffffff" }]}>
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
          </View>

          {/* ── SECTION 1: STICKY SEARCH & CALENDAR HEADER WITH BLUR BACKDROP ── */}
          <View style={s.stickyHeaderContainer}>
            {/* Scroll-Driven Native Frosted Glass Blur Backdrop — 0 at top, fades in smoothly on scroll */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: headerBlurOpacity,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255, 255, 255, 0.14)",
                },
              ]}
              pointerEvents="none"
            >
              <BlurView
                intensity={Platform.OS === "ios" ? 95 : 75}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />

              <LinearGradient
                colors={[
                  "rgba(10, 14, 22, 0.98)",
                  "rgba(11, 15, 24, 0.95)",
                  "rgba(12, 16, 26, 0.90)",
                ]}
                locations={[0, 0.65, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Bottom progressive feather fade extending past the tabs */}
              <LinearGradient
                colors={["rgba(12, 16, 26, 0.90)", "transparent"]}
                style={s.stickyFeatherBottom}
                pointerEvents="none"
              />
            </Animated.View>

            <View style={s.stickyHeaderContent}>
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
                    <Ionicons name="funnel" size={11} color="#ffffff" />
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

              {/* 5. Horizontal Horizon Calendar Strip (Slide down or tap header opens Travel Calendar Drawer) */}
              <Animated.View
                {...calStripPanResponder.panHandlers}
                style={[
                  s.calSectionWrap,
                  { transform: [{ translateY: calendarStripTranslateY }] },
                ]}
              >
                <View style={s.calHeaderRow}>
                  <Pressable
                    onPress={openCalendarDrawer}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Text style={s.calMonthTitle}>
                      {selectedCalendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={openCalendarDrawer}
                      hitSlop={8}
                      style={s.calArchiveBtn}
                    >
                      <Ionicons name="calendar-outline" size={13} color="#ffffff" />
                      <Text style={s.calArchiveBtnText}>Calendar</Text>
                      <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setSelectedCalendarDate(new Date());
                        centerCurrentDate(true);
                      }}
                      hitSlop={8}
                      style={[
                        s.calTodayBtn,
                        isSameDay(selectedCalendarDate, new Date()) && s.calTodayBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.calTodayBtnText,
                          isSameDay(selectedCalendarDate, new Date()) && s.calTodayBtnTextActive,
                        ]}
                      >
                        Today
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Interactive Swipe-Down Pull Handle (Framer Motion Elastic Drag) */}
                <Animated.View
                  {...calPullBarPanResponder.panHandlers}
                  style={[
                    s.calPullIndicatorWrap,
                    { transform: [{ translateY: pullBarTranslateY }] },
                  ]}
                >
                  <Animated.View
                    style={[
                      s.calPullIndicatorBar,
                      {
                        transform: [{ scaleX: pullBarScaleX }],
                        backgroundColor: isPullingCalendar
                          ? "rgba(255, 255, 255, 0.85)"
                          : "rgba(255, 255, 255, 0.3)",
                      },
                    ]}
                  />
                  <Animated.View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      marginTop: 3,
                      opacity: pullChevronOpacity,
                    }}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={11}
                      color={isPullingCalendar ? "#ffffff" : "rgba(255, 255, 255, 0.6)"}
                    />
                    <Text
                      style={{
                        fontSize: 9.5,
                        color: isPullingCalendar ? "#ffffff" : "rgba(255, 255, 255, 0.55)",
                        fontWeight: "700",
                        letterSpacing: 0.3,
                        textTransform: "uppercase",
                      }}
                    >
                      {isPullingCalendar ? "Release to Open Calendar" : "Swipe Down for Calendar"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={11}
                      color={isPullingCalendar ? "#ffffff" : "rgba(255, 255, 255, 0.6)"}
                    />
                  </Animated.View>
                </Animated.View>

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
                    const isSelected = isSameDay(date, selectedCalendarDate);
                    const isCurrentToday = isSameDay(date, new Date());
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
                          isSelected && s.calDayPillSelected,
                          isCurrentToday && !isSelected && s.calDayPillCurrentToday,
                          hasTrips && !isSelected && !isCurrentToday && { borderColor: "rgba(255, 255, 255, 0.4)" },
                        ]}
                      >
                        <Text
                          style={[
                            s.calDayName,
                            isSelected && s.calDayNameSelected,
                            isCurrentToday && !isSelected && s.calDayNameCurrentToday,
                          ]}
                        >
                          {date.toLocaleDateString("en-US", { weekday: "short" })}
                        </Text>
                        <Text
                          style={[
                            s.calDayNum,
                            isSelected && s.calDayNumSelected,
                            isCurrentToday && !isSelected && s.calDayNumCurrentToday,
                          ]}
                        >
                          {date.getDate()}
                        </Text>

                        {/* Distinction for Today indicator & Trip dot */}
                        {isCurrentToday ? (
                          <View
                            style={[
                              s.calTodayDot,
                              isSelected && { backgroundColor: "#000000" },
                            ]}
                          />
                        ) : hasTrips ? (
                          <View
                            style={[
                              s.calTripDot,
                              { backgroundColor: isSelected ? "#000000" : dotColor },
                            ]}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>

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
                        color={active ? "#ffffff" : "rgba(255, 255, 255, 0.45)"}
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
            </View>
          </View>

          {/* ── SECTION 2: LUXURY TRIP CARDS LIST (SCROLLS UNDER STICKY BLUR HEADER) ── */}
          <View style={s.tripsListSection}>
            {filteredTrips.length > 0 ? (
              <>
                {displayedTrips.map((trip) => {
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
                    <View
                      key={trip.id}
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
                              onPress={() => togglePinForTrip(trip.id)}
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
                              onPress={() => openDetailsModal(trip)}
                              hitSlop={10}
                              style={s.cardActionCircle}
                            >
                              <Ionicons name="ellipsis-horizontal" size={17} color="#ffffff" />
                            </Pressable>
                          </View>
                        </View>

                        {/* MIDDLE SECTION: Title, Route, Dates (Navigates to Trip Itinerary) */}
                        <Pressable
                          onPress={() => router.push(`/trips/${trip.id}` as any)}
                          style={s.cardMidSection}
                        >
                          <Text style={s.premiumTripName} numberOfLines={1}>
                            {trip.name}
                          </Text>

                          {/* Route Row: Origin ➔ Destination */}
                          <View style={s.routeRow}>
                            <Ionicons name="location-sharp" size={14} color="#ffffff" />
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
                        </Pressable>

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
                              onPress={() => router.push(`/(tabs)/group-chatroom/${trip.id}` as any)}
                              hitSlop={8}
                              style={s.cardQuickChatBtn}
                            >
                              <Ionicons name="chatbubbles-outline" size={13} color="#ffffff" />
                              <Text style={s.cardQuickChatText}>Chat</Text>
                            </Pressable>

                            <Pressable
                              onPress={() => router.push(`/trips/${trip.id}` as any)}
                              style={s.explorePill}
                            >
                              <Text style={s.explorePillText}>Details</Text>
                              <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Show More / Show Less Pagination Option after 3 Trips */}
                {filteredTrips.length > INITIAL_TRIP_LIMIT && (
                  <View style={s.showMoreContainer}>
                    {hasMoreTrips ? (
                      <Pressable
                        onPress={() => setVisibleTripsCount((prev) => prev + 3)}
                        style={({ pressed }) => [
                          s.showMoreBtn,
                          pressed && s.showMoreBtnPressed,
                        ]}
                      >
                        <LinearGradient
                          colors={["rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.05)"]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <View style={s.showMoreInner}>
                          <View style={s.showMoreIconCircle}>
                            <Ionicons name="sparkles" size={14} color="#ffffff" />
                          </View>
                          <View style={s.showMoreTextWrap}>
                            <Text style={s.showMoreTitle}>Show More Trips</Text>
                            <Text style={s.showMoreSubtitle}>
                              +{remainingTripsCount} more {remainingTripsCount === 1 ? "adventure" : "adventures"} available
                            </Text>
                          </View>
                          <View style={s.showMoreChevronCircle}>
                            <Ionicons name="chevron-down" size={16} color="#ffffff" />
                          </View>
                        </View>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => setVisibleTripsCount(INITIAL_TRIP_LIMIT)}
                        style={({ pressed }) => [
                          s.showLessBtn,
                          pressed && s.showMoreBtnPressed,
                        ]}
                      >
                        <View style={s.showLessInner}>
                          <Text style={s.showLessText}>Show Less</Text>
                          <Ionicons name="chevron-up" size={14} color="rgba(255, 255, 255, 0.7)" />
                        </View>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* ── AI SUGGESTED TRIPS SECTION (INLINE EXPANDABLE GRID VIEW) ── */}
                <View style={s.suggestedSectionContainer}>
                  <Pressable
                    onPress={toggleSuggestedExpanded}
                    style={({ pressed }) => [
                      s.suggestedTripsTriggerBtn,
                      suggestedExpanded && s.suggestedTripsTriggerBtnActive,
                      pressed && s.showMoreBtnPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        suggestedExpanded
                          ? ["rgba(255, 255, 255, 0.16)", "rgba(255, 255, 255, 0.07)"]
                          : ["rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.04)"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={s.suggestedTriggerInner}>
                      <View style={[s.suggestedTriggerIconWrap, suggestedExpanded && s.suggestedTriggerIconWrapActive]}>
                        <Ionicons name="sparkles" size={17} color={suggestedExpanded ? "#fbbf24" : "#ffffff"} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={s.suggestedTriggerTitle}>Suggested Trips</Text>
                          <View style={s.aiBadge}>
                            <Text style={s.aiBadgeText}>AI CURATED</Text>
                          </View>
                        </View>
                        <Text style={s.suggestedTriggerSub}>
                          {suggestedExpanded
                            ? "AI curated based on your taste & budget • Tap to collapse"
                            : "Analyzed from your past places, travel taste & budget"}
                        </Text>
                      </View>
                      <View style={[s.suggestedArrowCircle, suggestedExpanded && s.suggestedArrowCircleActive]}>
                        <Ionicons
                          name={suggestedExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color="#ffffff"
                        />
                      </View>
                    </View>
                  </Pressable>

                  {/* ── INLINE GRID VIEW (Directly inside Trip Page) ── */}
                  {suggestedExpanded && (
                    <View style={s.suggestedGridContainer}>
                      {/* Grid Header Info Banner */}
                      <View style={s.suggestedGridHeader}>
                        <View style={s.suggestedGridHeaderLeft}>
                          <Ionicons name="sparkles" size={12} color="#fbbf24" />
                          <Text style={s.suggestedGridHeaderText}>
                            Tailored for <Text style={s.suggestedGridHeaderHighlight}>{suggestedTripsData.favType}</Text> • ~₹{suggestedTripsData.avgBudget.toLocaleString()}
                          </Text>
                        </View>
                        <View style={s.suggestedGridHeaderCountBadge}>
                          <Text style={s.suggestedGridHeaderCountText}>
                            {suggestedTripsData.list.length} of {suggestedTripsData.totalCount}
                          </Text>
                        </View>
                      </View>

                      {/* 2-Column Grid */}
                      <View style={s.suggestedGridRow}>
                        {suggestedTripsData.list.map((sug) => (
                          <Pressable
                            key={sug.id}
                            onPress={() => handleOpenCreateWithSuggestion(sug)}
                            style={({ pressed }) => [
                              s.sugGridCard,
                              pressed && s.sugGridCardPressed,
                            ]}
                          >
                            <ExpoImage
                              source={{ uri: sug.image }}
                              style={s.sugGridCardBg}
                              contentFit="cover"
                              transition={200}
                            />
                            <LinearGradient
                              colors={[
                                "rgba(10, 13, 20, 0.2)",
                                "rgba(10, 13, 20, 0.55)",
                                "rgba(10, 13, 20, 0.96)",
                              ]}
                              locations={[0, 0.45, 1]}
                              style={StyleSheet.absoluteFill}
                            />

                            {/* Top row badges */}
                            <View style={s.sugGridTopRow}>
                              <View style={s.sugGridTypeBadge}>
                                <Text style={s.sugGridTypeBadgeText} numberOfLines={1}>
                                  {sug.travelType.split("&")[0].trim()}
                                </Text>
                              </View>
                              <View style={s.sugGridDaysBadge}>
                                <Text style={s.sugGridDaysBadgeText}>{sug.days}d</Text>
                              </View>
                            </View>

                            {/* Bottom Card Details */}
                            <View style={s.sugGridBottomInfo}>
                              <Text style={s.sugGridTitle} numberOfLines={2}>
                                {sug.name}
                              </Text>

                              <View style={s.sugGridLocationRow}>
                                <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.7)" />
                                <Text style={s.sugGridLocationText} numberOfLines={1}>
                                  {sug.location.split(",")[0].trim()}
                                </Text>
                              </View>

                              <View style={s.sugGridFooterRow}>
                                <View style={s.sugGridBudgetPill}>
                                  <Text style={s.sugGridBudgetText}>
                                    ₹{sug.budget.toLocaleString()}
                                  </Text>
                                </View>
                                <View style={s.sugGridActionBtn}>
                                  <Ionicons name="sparkles" size={10} color="#000000" />
                                  <Text style={s.sugGridActionBtnText}>Plan</Text>
                                </View>
                              </View>
                            </View>
                          </Pressable>
                        ))}
                      </View>

                      {/* Load More / Show Less pagination */}
                      <View style={s.sugGridPaginationRow}>
                        {suggestedTripsData.hasMore ? (
                          <Pressable
                            onPress={() => setVisibleSuggestedCount((prev) => prev + 2)}
                            style={({ pressed }) => [
                              s.sugGridLoadMoreBtn,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Ionicons name="sparkles" size={13} color="#ffffff" />
                            <Text style={s.sugGridLoadMoreText}>
                              Load More Suggestions ({suggestedTripsData.totalCount - visibleSuggestedCount} more)
                            </Text>
                            <Ionicons name="chevron-down" size={13} color="#ffffff" />
                          </Pressable>
                        ) : visibleSuggestedCount > 4 ? (
                          <Pressable
                            onPress={() => setVisibleSuggestedCount(4)}
                            style={({ pressed }) => [
                              s.sugGridLoadMoreBtn,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text style={s.sugGridLoadMoreText}>Show Less</Text>
                            <Ionicons name="chevron-up" size={13} color="#ffffff" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              </>
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
          </View>
        </Animated.ScrollView>
      )}

      {/* ── ONLY CREATE TRIP ICON AT BOTTOM ── */}
      <View style={[s.floatingActionContainer, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
        <Pressable onPress={() => setCreateSheetOpen(true)} style={s.createBtn}>
          <Feather name="edit-3" size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* ═══════════════════════════════════════════════════════════
         TRIP DETAILS MODAL (Exact match to Image with smooth animations & pull-down handle)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        animationType="none"
        transparent
        visible={detailsModalOpen}
        onRequestClose={closeDetailsModal}
      >
        {/* Full-screen ambient scenic backdrop with heavy blur and animated fade */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: detailsAnim }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropFade }]}>
            <ExpoImage
              source={{ uri: selectedTrip ? getTripDisplayImage(selectedTrip) : calendarBackgroundImage }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={Platform.OS === "ios" ? 22 : 16}
            />
            <BlurView intensity={Platform.OS === "ios" ? 45 : 30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(6, 9, 15, 0.35)", "rgba(8, 12, 20, 0.65)", "rgba(10, 14, 24, 0.88)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeDetailsModal}
            />
          </Animated.View>
        </Animated.View>

        {/* Animated modal container with downward drag-to-dismiss gesture & Apple-like scale */}
        <Animated.View
          {...containerPanResponder.panHandlers}
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateY: modalTranslateY }, { scale: modalScale }],
            },
          ]}
        >
          {/* Top Pull Handle Indicator (Shows user clearly where to pull down) */}
          <View
            {...handlePanResponder.panHandlers}
            style={[s.modalPullHeader, { paddingTop: insets.top + 8 }]}
          >
            <View style={s.modalPullPill} />
          </View>

          <View style={s.modalWrapper}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                modalScrollOffset.current = e.nativeEvent.contentOffset.y;
              }}
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
          </View>

          {/* 5. Floating Bottom Toolbar (Matches Image 4) */}
          {detailsModalOpen && selectedTrip && (
            <View
              style={[
                s.modalToolbar,
                {
                  bottom: insets.bottom + 16,
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
                    color={isSelectedPinned ? "#fbbf24" : "#ffffff"}
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
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
         INSTAGRAM & GOOGLE CALENDAR TRAVEL ARCHIVE DRAWER (Matches Image 3)
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        animationType="none"
        transparent
        visible={calendarDrawerOpen}
        onRequestClose={closeCalendarDrawer}
      >
        {/* Full-screen backdrop blurring the underlying trip page */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: calendarDrawerAnim }]}>
          <BlurView intensity={Platform.OS === "ios" ? 85 : 55} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4, 7, 12, 0.78)" }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCalendarDrawer} />
        </Animated.View>

        {/* Sliding Calendar Drawer Card with Apple Spring & Drag-to-Dismiss Physics */}
        <Animated.View
          {...calendarDrawerPanResponder.panHandlers}
          style={[
            s.archiveDrawerModalContainer,
            {
              paddingTop: insets.top + 8,
              transform: [{ translateY: calendarDrawerTranslateY }, { scale: calendarDrawerScale }],
            },
          ]}
        >
          {/* Top Pull Handle (Slide down to close) */}
          <View
            {...calendarHandlePanResponder.panHandlers}
            style={s.modalPullHeader}
          >
            <View style={s.modalPullPill} />
          </View>

          <View style={s.archiveDrawerWrapper}>
            {/* Header with Title and Google Calendar "+ Add" Action */}
            <View style={s.archiveHeaderRow}>
              <Pressable onPress={closeCalendarDrawer} hitSlop={10} style={s.archiveBackBtn}>
                <Ionicons name="arrow-back" size={22} color="#ffffff" />
              </Pressable>
              <View style={s.archiveTitleRow}>
                <Ionicons name="calendar" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={s.archiveTitleText}>Travel Calendar</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setNewReminderModalOpen(true);
                  }}
                  hitSlop={8}
                  style={s.archiveAddEventBtn}
                >
                  <Ionicons name="add" size={16} color="#000000" />
                  <Text style={s.archiveAddEventText}>Add</Text>
                </Pressable>
                <Pressable onPress={closeCalendarDrawer} hitSlop={10} style={s.archiveCloseBtn}>
                  <Ionicons name="close" size={22} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                calendarDrawerScrollOffset.current = e.nativeEvent.contentOffset.y;
              }}
              contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            >
              {/* 1. Month Navigator & Grid in Glass Card (with Swipe Left/Right Gesture) */}
              <View style={s.archiveGlassCard} {...monthSwipePanResponder.panHandlers}>
                <View style={s.archiveMonthNavRow}>
                  <Pressable
                    onPress={() => setArchiveMonthOffset((prev) => prev - 1)}
                    hitSlop={12}
                    style={s.archiveMonthNavBtn}
                  >
                    <Ionicons name="chevron-back" size={20} color="#ffffff" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setPickerSelectedYear(currentArchiveDate.getFullYear());
                      setMonthYearPickerOpen(true);
                    }}
                    hitSlop={10}
                    style={s.archiveMonthTitleBtn}
                  >
                    <Text style={s.archiveMonthTitleText}>{archiveMonthTitle}</Text>
                    <Ionicons name="chevron-down" size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 5 }} />
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable
                      onPress={() => {
                        setArchiveMonthOffset(0);
                        setSelectedArchiveDate(new Date());
                      }}
                      hitSlop={8}
                      style={[
                        s.calTodayBtn,
                        isSameDay(selectedArchiveDate, new Date()) && s.calTodayBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.calTodayBtnText,
                          isSameDay(selectedArchiveDate, new Date()) && s.calTodayBtnTextActive,
                        ]}
                      >
                        Today
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setArchiveMonthOffset((prev) => prev + 1)}
                      hitSlop={12}
                      style={s.archiveMonthNavBtn}
                    >
                      <Ionicons name="chevron-forward" size={20} color="#ffffff" />
                    </Pressable>
                  </View>
                </View>

                {/* Weekday Labels (Sun..Sat) */}
                <View style={s.archiveWeekdayRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w, idx) => (
                    <View key={idx} style={s.archiveWeekdayCell}>
                      <Text style={s.archiveWeekdayText}>{w}</Text>
                    </View>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={s.archiveGridContainer}>
                  {archiveGridDays.map((item, idx) => {
                    if (!item) {
                      return <View key={`empty-${idx}`} style={s.archiveDayCell} />;
                    }

                    const isToday = isSameDay(item.date, new Date());
                    const isSelected = isSameDay(item.date, selectedArchiveDate);
                    const dayTrips = getTripsForDate(item.date);
                    const dayReminders = getRemindersForDate(item.date);
                    const hasTrip = dayTrips.length > 0;
                    const hasReminder = dayReminders.length > 0;

                    return (
                      <View key={`day-${item.dayNum}`} style={s.archiveDayCell}>
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSelectedArchiveDate(item.date);
                            setSelectedArchiveTrip(hasTrip ? dayTrips[0] : null);
                          }}
                          style={[
                            s.archiveDayContainer,
                            isSelected && s.archiveDayContainerSelected,
                          ]}
                        >
                          {hasTrip ? (
                            /* Trip Date: Circular Thumbnail with Trip Image & Day Number (Previous Travel Archive Style) */
                            <View
                              style={[
                                s.archivePhotoCircle,
                                isSelected && s.archivePhotoCircleSelected,
                              ]}
                            >
                              <ExpoImage
                                source={{ uri: getTripDisplayImage(dayTrips[0]) }}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                              />
                              <View style={s.archivePhotoCircleOverlay} />
                              <Text style={s.archivePhotoDayText}>{item.dayNum}</Text>
                            </View>
                          ) : isSelected ? (
                            /* Selected Date (when no trip): Pure White Circle with Black Text */
                            <View style={s.archiveSelectedCircle}>
                              <Text style={s.archiveSelectedDayText}>{item.dayNum}</Text>
                            </View>
                          ) : isToday ? (
                            /* Today Date: Frosted White Border Circle */
                            <View style={s.archiveTodayCircle}>
                              <Text style={s.archiveTodayDayText}>{item.dayNum}</Text>
                            </View>
                          ) : (
                            /* Plain Day */
                            <View style={s.archivePlainDay}>
                              <Text style={s.archivePlainDayText}>
                                {item.dayNum}
                              </Text>
                            </View>
                          )}

                          {/* Indicators Row: White Dot for Trip, Alarm Icon for Reminder */}
                          <View style={s.archiveDayIndicatorsRow}>
                            {hasTrip && <View style={s.archivePhotoWhiteDot} />}
                            {hasReminder && (
                              <Ionicons
                                name="alarm"
                                size={10}
                                color="#F59E0B"
                                style={hasTrip ? { marginLeft: 2 } : undefined}
                              />
                            )}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 2. Google Calendar Style: Selected Day Agenda & Schedule */}
              <View style={s.archiveAgendaCard}>
                <View style={s.archiveAgendaHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.archiveAgendaDateTitle}>
                      {selectedArchiveDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                    <View style={s.archiveAgendaBadgesRow}>
                      {getTripsForDate(selectedArchiveDate).length > 0 && (
                        <View style={s.archiveAgendaTripBadge}>
                          <Ionicons name="airplane" size={10} color="#10B981" />
                          <Text style={s.archiveAgendaTripBadgeText}>
                            {getTripsForDate(selectedArchiveDate).length} Trip Active
                          </Text>
                        </View>
                      )}
                      {getRemindersForDate(selectedArchiveDate).length > 0 && (
                        <View style={s.archiveAgendaRemBadge}>
                          <Ionicons name="alarm" size={10} color="#F59E0B" />
                          <Text style={s.archiveAgendaRemBadgeText}>
                            {getRemindersForDate(selectedArchiveDate).length} Reminders
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setNewReminderModalOpen(true);
                    }}
                    style={s.archiveAgendaQuickAddBtn}
                  >
                    <Ionicons name="add" size={13} color="#ffffff" />
                    <Text style={s.archiveAgendaQuickAddText}>Add Event</Text>
                  </Pressable>
                </View>

                {/* A. Trips on this date */}
                {getTripsForDate(selectedArchiveDate).map((t) => (
                  <View key={`agenda-trip-${t.id}`} style={s.agendaTripItem}>
                    <ExpoImage
                      source={{ uri: getTripDisplayImage(t) }}
                      style={s.agendaTripThumb}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={s.agendaTripTitle} numberOfLines={1}>{t.name}</Text>
                      <Text style={s.agendaTripRoute} numberOfLines={1}>
                        📍 {t.from && t.to ? `${t.from} ➔ ${t.to}` : t.location || "Scenic Location"}
                      </Text>
                      <Text style={s.agendaTripDates}>
                        📅 {formatSpanHorizon(t.startDate, t.endDate)}
                      </Text>
                      <Pressable
                        onPress={() => {
                          closeCalendarDrawer();
                          setTimeout(() => openDetailsModal(t), 220);
                        }}
                        style={s.agendaTripOpenBtn}
                      >
                        <Text style={s.agendaTripOpenText}>Open Trip Details</Text>
                        <Ionicons name="arrow-forward" size={12} color="#000000" />
                      </Pressable>
                    </View>
                  </View>
                ))}

                {/* B. Reminders on this date */}
                {getRemindersForDate(selectedArchiveDate).length > 0 ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.agendaSectionSubTitle}>Reminders & Tasks</Text>
                    {getRemindersForDate(selectedArchiveDate).map((rem) => (
                      <View key={`agenda-rem-${rem.id}`} style={s.agendaRemItem}>
                        <Pressable
                          onPress={() => toggleReminder(rem.id, !!rem.completed)}
                          hitSlop={8}
                          style={[s.agendaRemCheck, rem.completed && s.agendaRemCheckDone]}
                        >
                          {rem.completed && <Ionicons name="checkmark" size={13} color="#000000" />}
                        </Pressable>
                        <View style={{ flex: 1, paddingHorizontal: 10 }}>
                          <Text style={[s.agendaRemText, rem.completed && s.agendaRemTextDone]}>
                            {rem.text}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            {rem.time ? (
                              <View style={s.agendaRemTimeTag}>
                                <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.7)" />
                                <Text style={s.agendaRemTimeText}>{rem.time}</Text>
                              </View>
                            ) : null}
                            {rem.tripName ? (
                              <View style={s.agendaRemTripTag}>
                                <Ionicons name="briefcase-outline" size={10} color="#60A5FA" />
                                <Text style={s.agendaRemTripText} numberOfLines={1}>{rem.tripName}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Pressable
                          onPress={() => deleteReminder(rem.id)}
                          hitSlop={10}
                          style={s.agendaRemTrashBtn}
                        >
                          <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.7)" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* C. Empty Agenda state if neither trips nor reminders on this date */}
                {getTripsForDate(selectedArchiveDate).length === 0 && getRemindersForDate(selectedArchiveDate).length === 0 && (
                  <View style={s.agendaEmptyState}>
                    <Ionicons name="calendar-outline" size={30} color="rgba(255,255,255,0.25)" />
                    <Text style={s.agendaEmptyText}>No trips or reminders scheduled for this date</Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setNewReminderModalOpen(true);
                      }}
                      style={s.agendaEmptyActionBtn}
                    >
                      <Ionicons name="add-circle-outline" size={15} color="#ffffff" />
                      <Text style={s.agendaEmptyActionText}>Add Trip Reminder</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* 3. Upcoming Reminders Overview Card */}
              {calendarReminders.length > 0 && (
                <View style={s.archiveOverviewCard}>
                  <View style={s.archiveOverviewHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="alarm-outline" size={16} color="#F59E0B" />
                      <Text style={s.archiveOverviewTitle}>All Trip Reminders</Text>
                    </View>
                    <View style={s.archiveOverviewBadge}>
                      <Text style={s.archiveOverviewBadgeText}>
                        {calendarReminders.filter((r) => !r.completed).length} Pending
                      </Text>
                    </View>
                  </View>

                  {calendarReminders.slice(0, 5).map((rem) => (
                    <View key={`overview-rem-${rem.id}`} style={s.agendaRemItem}>
                      <Pressable
                        onPress={() => toggleReminder(rem.id, !!rem.completed)}
                        hitSlop={8}
                        style={[s.agendaRemCheck, rem.completed && s.agendaRemCheckDone]}
                      >
                        {rem.completed && <Ionicons name="checkmark" size={13} color="#000000" />}
                      </Pressable>
                      <View style={{ flex: 1, paddingHorizontal: 10 }}>
                        <Text style={[s.agendaRemText, rem.completed && s.agendaRemTextDone]}>
                          {rem.text}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Text style={s.agendaRemTimeText}>📅 {rem.date} {rem.time ? `• ${rem.time}` : ""}</Text>
                          {rem.tripName ? (
                            <Text style={s.agendaRemTripText}>• {rem.tripName}</Text>
                          ) : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => deleteReminder(rem.id)}
                        hitSlop={10}
                        style={s.agendaRemTrashBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="rgba(239,68,68,0.7)" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Animated.View>

        {/* ── Google Calendar: Quick "+ Add Reminder / Trip Event" Modal ── */}
        <Modal
          animationType="fade"
          transparent
          visible={newReminderModalOpen}
          onRequestClose={() => setNewReminderModalOpen(false)}
        >
          <View style={s.addRemOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setNewReminderModalOpen(false)} />
            <View style={s.addRemCard}>
              <View style={s.addRemHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="alarm" size={18} color="#F59E0B" />
                  <Text style={s.addRemTitle}>Add Trip Reminder</Text>
                </View>
                <Pressable onPress={() => setNewReminderModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color="#ffffff" />
                </Pressable>
              </View>

              <Text style={s.addRemDateNote}>
                📅 Date: {selectedArchiveDate.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </Text>

              {/* Reminder Note Input */}
              <TextInput
                value={newReminderText}
                onChangeText={setNewReminderText}
                placeholder="What to remember? (e.g. Flight web check-in, Pack boots)..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                style={s.addRemInput}
                autoFocus
              />

              {/* Time Presets */}
              <Text style={s.addRemSectionLabel}>Suggested Time</Text>
              <View style={s.addRemTimePillsRow}>
                {["08:00 AM", "10:00 AM", "01:00 PM", "06:00 PM", "09:00 PM"].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setNewReminderTime(t)}
                    style={[s.addRemTimePill, newReminderTime === t && s.addRemTimePillActive]}
                  >
                    <Text style={[s.addRemTimePillText, newReminderTime === t && s.addRemTimePillTextActive]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Link to Trip (Optional) */}
              {trips.length > 0 && (
                <>
                  <Text style={s.addRemSectionLabel}>Link to Trip (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {trips.map((tr) => {
                      const isChosen = newReminderTripId === tr.id;
                      return (
                        <Pressable
                          key={tr.id}
                          onPress={() => setNewReminderTripId(isChosen ? "" : tr.id)}
                          style={[s.addRemTripChip, isChosen && s.addRemTripChipActive]}
                        >
                          <Text style={[s.addRemTripChipText, isChosen && s.addRemTripChipTextActive]}>
                            {tr.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* Save & Cancel Buttons */}
              <View style={s.addRemActionsRow}>
                <Pressable
                  onPress={() => setNewReminderModalOpen(false)}
                  style={s.addRemCancelBtn}
                >
                  <Text style={s.addRemCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreateReminder}
                  style={[s.addRemSaveBtn, !newReminderText.trim() && { opacity: 0.5 }]}
                  disabled={!newReminderText.trim()}
                >
                  <Ionicons name="checkmark" size={16} color="#000000" />
                  <Text style={s.addRemSaveText}>Save Reminder</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Month & Year Fast Selector Modal (Tapping Month/Year opens this) ── */}
        <Modal
          animationType="fade"
          transparent
          visible={monthYearPickerOpen}
          onRequestClose={() => setMonthYearPickerOpen(false)}
        >
          <View style={s.myPickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMonthYearPickerOpen(false)} />
            <View style={s.myPickerCard}>
              <View style={s.myPickerHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="calendar-outline" size={18} color="#ffffff" />
                  <Text style={s.myPickerTitle}>Select Month & Year</Text>
                </View>
                <Pressable onPress={() => setMonthYearPickerOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color="#ffffff" />
                </Pressable>
              </View>

              {/* Year Selector with Left/Right Arrows */}
              <View style={s.myPickerYearRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setPickerSelectedYear((y) => y - 1);
                  }}
                  hitSlop={10}
                  style={s.myPickerYearNavBtn}
                >
                  <Ionicons name="chevron-back" size={18} color="#ffffff" />
                </Pressable>
                <Text style={s.myPickerYearText}>{pickerSelectedYear}</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setPickerSelectedYear((y) => y + 1);
                  }}
                  hitSlop={10}
                  style={s.myPickerYearNavBtn}
                >
                  <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                </Pressable>
              </View>

              {/* 12 Months Grid */}
              <View style={s.myPickerMonthsGrid}>
                {[
                  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ].map((mName, mIdx) => {
                  const isCurrent =
                    currentArchiveDate.getFullYear() === pickerSelectedYear &&
                    currentArchiveDate.getMonth() === mIdx;
                  const isNowMonth =
                    new Date().getFullYear() === pickerSelectedYear &&
                    new Date().getMonth() === mIdx;

                  return (
                    <Pressable
                      key={mName}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        const now = new Date();
                        const newOffset = (pickerSelectedYear - now.getFullYear()) * 12 + (mIdx - now.getMonth());
                        setArchiveMonthOffset(newOffset);
                        setMonthYearPickerOpen(false);
                      }}
                      style={[
                        s.myPickerMonthChip,
                        isCurrent && s.myPickerMonthChipActive,
                        isNowMonth && !isCurrent && s.myPickerMonthChipNow,
                      ]}
                    >
                      <Text
                        style={[
                          s.myPickerMonthChipText,
                          isCurrent && s.myPickerMonthChipTextActive,
                          isNowMonth && !isCurrent && s.myPickerMonthChipTextNow,
                        ]}
                      >
                        {mName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Quick Jump to Current Month */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setArchiveMonthOffset(0);
                  setSelectedArchiveDate(new Date());
                  setMonthYearPickerOpen(false);
                }}
                style={s.myPickerResetBtn}
              >
                <Text style={s.myPickerResetText}>Jump to Current Month</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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

      {/* ── CREATE TRIP SHEET (Supports Auto-fill from AI Suggested Trips) ── */}
      <CreateTripSheet
        visible={createSheetOpen}
        onClose={() => {
          setCreateSheetOpen(false);
          setPrefilledTripData(null);
        }}
        initialTripData={prefilledTripData}
      />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c0e15" },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },

  collapsibleTopSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  stickyHeaderContainer: {
    width: "100%",
    zIndex: 20,
    elevation: 8,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  stickyHeaderContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tripsListSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* 1. Header */
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 4,
  },
  welcomeSubText: {
    color: "rgba(255, 255, 255, 0.75)",
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
    borderColor: "#ffffff",
  },
  userAvatarHeaderPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarInitial: {
    color: "#ffffff",
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
    borderColor: "rgba(255, 255, 255, 0.2)",
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
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  spotlightTagText: {
    color: "#ffffff",
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
    backgroundColor: "#ffffff",
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
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  filterActiveDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
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
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: "80%",
  },
  activeFilterText: {
    color: "#ffffff",
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
  calArchiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  calArchiveBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  calTodayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  calTodayBtnActive: {
    backgroundColor: "#ffffff",
  },
  calTodayBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  calTodayBtnTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  calPullIndicatorWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  calPullIndicatorBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
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
  calDayPillSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    transform: [{ scale: 1.02 }],
  },
  calDayNameSelected: {
    color: "#000000",
    fontWeight: "900",
  },
  calDayNumSelected: {
    color: "#000000",
    fontWeight: "900",
  },
  calDayPillCurrentToday: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "#ffffff",
    borderWidth: 1.5,
  },
  calDayNameCurrentToday: {
    color: "#ffffff",
    fontWeight: "900",
  },
  calDayNumCurrentToday: {
    color: "#ffffff",
    fontWeight: "900",
  },
  calTodayDot: {
    position: "absolute",
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#ffffff",
  },
  calDayName: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
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

  /* Show More Button */
  showMoreContainer: {
    marginTop: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  showMoreBtn: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    backgroundColor: "rgba(18, 22, 34, 0.85)",
  },
  showMoreBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  showMoreInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  showMoreIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  showMoreTextWrap: {
    flex: 1,
  },
  showMoreTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  showMoreSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  showMoreChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  showLessBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  showLessInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  showLessText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12.5,
    fontWeight: "700",
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
    backgroundColor: "#ffffff",
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
    borderColor: "rgba(255, 255, 255, 0.4)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
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
  statusDotOngoing: { backgroundColor: "#ffffff" },
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
    backgroundColor: "#ffffff",
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
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  explorePillText: {
    color: "#ffffff",
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
    backgroundColor: "#ffffff",
    borderWidth: 1.2,
    borderColor: "#ffffff",
  },
  emptyStateCreateBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
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
  modalPullHeader: {
    width: "100%",
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalPullPill: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
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

  /* ── Suggested Trips Trigger & Inline Grid Styles ── */
  suggestedSectionContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  suggestedTripsTriggerBtn: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  suggestedTripsTriggerBtnActive: {
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  suggestedTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  suggestedTriggerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  suggestedTriggerIconWrapActive: {
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  suggestedTriggerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  suggestedTriggerSub: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 16,
  },
  aiBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  aiBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  suggestedArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestedArrowCircleActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  suggestedGridContainer: {
    marginTop: 14,
  },
  suggestedGridHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  suggestedGridHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  suggestedGridHeaderText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  suggestedGridHeaderHighlight: {
    color: "#ffffff",
    fontWeight: "800",
  },
  suggestedGridHeaderCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  suggestedGridHeaderCountText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "700",
  },
  suggestedGridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  sugGridCard: {
    width: SUGGESTED_CARD_WIDTH,
    height: 235,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#141724",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
    justifyContent: "space-between",
  },
  sugGridCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  sugGridCardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  sugGridTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    zIndex: 2,
  },
  sugGridTypeBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    maxWidth: "68%",
  },
  sugGridTypeBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "800",
  },
  sugGridDaysBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sugGridDaysBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "800",
  },
  sugGridBottomInfo: {
    padding: 11,
    zIndex: 2,
  },
  sugGridTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16.5,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  sugGridLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  sugGridLocationText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 10.5,
    fontWeight: "600",
  },
  sugGridFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  sugGridBudgetPill: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3.5,
  },
  sugGridBudgetText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  sugGridActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
  },
  sugGridActionBtnText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
  },
  sugGridPaginationRow: {
    marginTop: 12,
    alignItems: "center",
    gap: 8,
  },
  sugGridLoadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: "100%",
  },
  sugGridLoadMoreText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ── Instagram-Style Travel Archive Calendar Drawer Styles ── */
  archiveDrawerWrapper: {
    flex: 1,
    paddingHorizontal: 16,
  },
  archiveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  archiveBackBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  archiveTitleText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  archiveCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveTabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    marginBottom: 16,
  },
  archiveTabItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  archiveTabItemActive: {
    position: "relative",
  },
  archiveTabActiveLine: {
    position: "absolute",
    bottom: -8,
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: "#ffffff",
    borderRadius: 1,
  },
  archiveMonthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  archiveMonthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  archiveMonthTitleText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  archiveWeekdayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
  },
  archiveWeekdayCell: {
    width: (SCREEN_WIDTH - 32) / 7,
    alignItems: "center",
  },
  archiveWeekdayText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11.5,
    fontWeight: "700",
  },
  archiveGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 8,
  },
  archiveDayCell: {
    width: (SCREEN_WIDTH - 32) / 7,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveDayContainer: {
    width: (SCREEN_WIDTH - 32) / 7,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  archiveDayContainerSelected: {
    transform: [{ scale: 1.05 }],
  },
  archivePhotoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  archivePhotoCircleSelected: {
    borderColor: "#ffffff",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  archivePhotoCircleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.38)",
  },
  archivePhotoDayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  archiveTodayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  archiveTodayCircleSelected: {
    borderWidth: 2,
    borderColor: "#ffffff",
    transform: [{ scale: 1.08 }],
  },
  archiveTodayDayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  archiveSelectedCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  archiveSelectedDayText: {
    color: "#000000",
    fontSize: 13.5,
    fontWeight: "900",
  },
  archivePlainDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  archivePlainDaySelected: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  archivePlainDayText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
  archivePlainDayTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  archiveDayIndicatorsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 12,
    marginTop: 2,
    gap: 3,
  },
  archivePhotoWhiteDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: "#ffffff",
  },
  archiveMonthTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },

  /* ── Month & Year Picker Styles ── */
  myPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  myPickerCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(18, 22, 34, 0.96)",
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },
  myPickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  myPickerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  myPickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  myPickerYearNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  myPickerYearText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  myPickerMonthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 18,
  },
  myPickerMonthChip: {
    width: "31%",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  myPickerMonthChipActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  myPickerMonthChipNow: {
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  myPickerMonthChipText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
    fontWeight: "700",
  },
  myPickerMonthChipTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  myPickerMonthChipTextNow: {
    color: "#ffffff",
  },
  myPickerResetBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  myPickerResetText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12.5,
    fontWeight: "700",
  },
  archiveTripPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginTop: 20,
    overflow: "hidden",
  },
  archivePreviewCover: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  archivePreviewName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  archivePreviewLoc: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 2,
  },
  archivePreviewDates: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 2,
  },
  archivePreviewActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 6,
  },
  archivePreviewActionText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  moreSuggestionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 44,
  },
  moreSuggestionsBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  /* ── Sticky Header Progressive Scroll Feather ── */
  stickyFeatherBottom: {
    position: "absolute",
    bottom: -22,
    left: 0,
    right: 0,
    height: 22,
  },

  /* ── Google Calendar & Travel Archive Modal Styles ── */
  archiveDrawerModalContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0d101a",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderBottomWidth: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.85,
    shadowRadius: 28,
    elevation: 28,
  },
  archiveAddEventBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  archiveAddEventText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  archiveGlassCard: {
    backgroundColor: "rgba(20, 25, 38, 0.94)",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  archiveDayPill: {
    width: 38,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  archiveDayPillSelected: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  archiveDayPillToday: {
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.6)",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  archiveDayPillText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13,
    fontWeight: "700",
  },
  archiveDayPillTextSelected: {
    color: "#000000",
    fontWeight: "900",
  },
  archiveDayPillTextToday: {
    color: "#ffffff",
    fontWeight: "800",
  },
  archiveDayDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 2,
    height: 5,
  },
  archiveDayTripDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  archiveDayReminderDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F59E0B",
  },

  /* Selected Day Agenda Card (Google Calendar style) */
  archiveAgendaCard: {
    backgroundColor: "rgba(20, 25, 38, 0.94)",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 18,
    marginBottom: 16,
  },
  archiveAgendaHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  archiveAgendaDateTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  archiveAgendaBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  archiveAgendaTripBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  archiveAgendaTripBadgeText: {
    color: "#34D399",
    fontSize: 10.5,
    fontWeight: "700",
  },
  archiveAgendaRemBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  archiveAgendaRemBadgeText: {
    color: "#FBBF24",
    fontSize: 10.5,
    fontWeight: "700",
  },
  archiveAgendaQuickAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  archiveAgendaQuickAddText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
  agendaTripItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 10,
  },
  agendaTripThumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
  },
  agendaTripTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  agendaTripRoute: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 3,
  },
  agendaTripDates: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  agendaTripOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    marginTop: 8,
  },
  agendaTripOpenText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  agendaSectionSubTitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  agendaRemItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 8,
  },
  agendaRemCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  agendaRemCheckDone: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  agendaRemText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "600",
  },
  agendaRemTextDone: {
    textDecorationLine: "line-through",
    color: "rgba(255, 255, 255, 0.4)",
  },
  agendaRemTimeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  agendaRemTimeText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  agendaRemTripTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 140,
  },
  agendaRemTripText: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "600",
  },
  agendaRemTrashBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  agendaEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  agendaEmptyText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  agendaEmptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  agendaEmptyActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  /* All Reminders Overview Section */
  archiveOverviewCard: {
    backgroundColor: "rgba(20, 25, 38, 0.94)",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 18,
    marginBottom: 16,
  },
  archiveOverviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  archiveOverviewTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  archiveOverviewBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  archiveOverviewBadgeText: {
    color: "#FBBF24",
    fontSize: 10.5,
    fontWeight: "700",
  },

  /* Add Reminder Popup Modal */
  addRemOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  addRemCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(20, 24, 36, 0.96)",
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 24,
  },
  addRemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  addRemTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  addRemDateNote: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 14,
  },
  addRemInput: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  addRemSectionLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  addRemTimePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  addRemTimePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  addRemTimePillActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  addRemTimePillText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11.5,
    fontWeight: "600",
  },
  addRemTimePillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  addRemTripChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 14,
  },
  addRemTripChipActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  addRemTripChipText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
  addRemTripChipTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  addRemActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  addRemCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  addRemCancelText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "700",
  },
  addRemSaveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  addRemSaveText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
});
