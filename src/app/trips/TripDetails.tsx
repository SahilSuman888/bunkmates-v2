import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StatusBar,
  Dimensions,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  onSnapshot,
  collection,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { useUserGroups } from "../../hooks/useUserGroups";

/* COMPONENTS */
import ChecklistDrawer from "../../components/trip_components/ChecklistDrawer";
import ChecklistViewAllDrawer from "../../components/trip_components/ChecklistViewAllDrawer";
import TimelineDrawer from "../../components/trip_components/TimelineDrawer";
import TimelineAllDrawer from "../../components/trip_components/TimelineAllDrawer";
import BudgetDrawer from "../../components/trip_components/BudgetDrawer";
import ConfirmDeleteDialog from "../../components/trip_components/ConfirmDeleteDialog";
import ShareDrawer from "../../components/trip_components/ShareDrawer";
import LinkDrawer from "../../components/trip_components/LinkDrawer";
import SettingsDrawer from "../../components/trip_components/SettingsDrawer";

import { useGroqAI } from "../../hooks/useGroqAI";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";

const { width } = Dimensions.get("window");

const getCurrentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatTripDateRange = (startDate?: string, endDate?: string) => {
  if (!startDate) return "Dates not set";
  const parseD = (str: string) => {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    return null;
  };
  const s = parseD(startDate);
  const e = endDate ? parseD(endDate) : s;
  if (!s) return startDate;

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  };
  const sStr = s.toLocaleDateString("en-US", options);
  const eStr = e ? e.toLocaleDateString("en-US", options) : sStr;
  return `${sStr} → ${eStr}`;
};

const getWeatherInfo = (code: number, temp: number): { emoji: string; text: string } => {
  if (temp > 30) return { emoji: "🔥", text: "Broken Clouds" };
  if (code === 0) return { emoji: "☀️", text: "Clear Sky" };
  if (code <= 3) return { emoji: "☁️", text: "Broken Clouds" };
  if (code >= 51 && code <= 65) return { emoji: "🌧️", text: "Rain Showers" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", text: "Cold & Snow" };
  if (code >= 95) return { emoji: "⛈️", text: "Thunderstorm" };
  return { emoji: "🔥", text: "Broken Clouds" };
};

const getCuratedPlacesFallback = (dest: string) => {
  const d = (dest || "").toLowerCase();
  if (d.includes("jaipur")) {
    return [
      { name: "Amber Fort", category: "Historical Monument", description: "Majestic hilltop fort featuring stunning mirror work and panoramic vistas.", suggestedTime: "Morning" },
      { name: "Hawa Mahal", category: "Heritage Landmark", description: "Iconic five-story pink sandstone palace with 953 intricate honeycomb windows.", suggestedTime: "Morning" },
      { name: "City Palace", category: "Royal Residence", description: "Magnificent complex of courtyards, gardens, and buildings in the heart of the city.", suggestedTime: "Afternoon" },
      { name: "Jantar Mantar", category: "Astronomical Observatory", description: "UNESCO World Heritage site featuring nineteen architectural astronomical instruments.", suggestedTime: "Afternoon" },
      { name: "Nahargarh Fort", category: "Scenic Viewpoint", description: "Standing on the edge of the Aravalli Hills, offering breathtaking views over Jaipur.", suggestedTime: "Evening" },
    ];
  }
  if (d.includes("dehradun") || d.includes("mussoorie")) {
    return [
      { name: "Mindrolling Monastery", category: "Religious Site", description: "A beautiful Buddhist monastery with stunning architecture and peaceful surroundings.", suggestedTime: "Morning" },
      { name: "Tapkeshwar Temple", category: "Religious Site", description: "An ancient Shiva temple situated on the banks of a river, known for its natural water spring and peaceful ambiance.", suggestedTime: "Morning" },
      { name: "Sahastradhara", category: "Natural Attraction", description: "A scenic spot with numerous waterfalls, caves, and a sulfur spring, perfect for relaxation and rejuvenation.", suggestedTime: "Afternoon" },
      { name: "Forest Research Institute", category: "Heritage & Nature", description: "A sprawling Greco-Roman architectural marvel surrounded by lush botanical gardens.", suggestedTime: "Afternoon" },
      { name: "Robber's Cave (Guchhupani)", category: "Adventure & River", description: "A natural river cave formation where you can wade through cool stream waters.", suggestedTime: "Evening" },
    ];
  }
  const cleanDest = (dest || "Destination").split(",")[0].trim();
  return [
    { name: `${cleanDest} Old Town & Local Market`, category: "Culture & Market", description: `Explore lively streets, vibrant bazaars, and local culinary traditions of ${cleanDest}.`, suggestedTime: "Morning" },
    { name: `${cleanDest} Heritage Landmark`, category: "Historical Site", description: `Iconic heritage site showcasing historical architecture and cultural significance.`, suggestedTime: "Morning" },
    { name: `${cleanDest} Scenic Nature Park`, category: "Natural Attraction", description: `Peaceful natural park with lush walking paths and panoramic viewpoints.`, suggestedTime: "Afternoon" },
    { name: `${cleanDest} Panoramic Viewpoint`, category: "Scenic Viewpoint", description: `High elevation lookout offering expansive 360-degree vistas of ${cleanDest}.`, suggestedTime: "Evening" },
    { name: `${cleanDest} Evening Promenade`, category: "Leisure & Dining", description: `Popular evening gathering area with vibrant street cafes and welcoming atmosphere.`, suggestedTime: "Evening" },
  ];
};

const getCuratedChecklistFallback = (dest: string) => {
  return [
    "Travel Adapter & Power Bank",
    "Water Bottle & Hydration Flask",
    "Rain Gear & Windbreaker",
    "Portable Bluetooth Speaker",
    "Government IDs & Booking Passes",
    "First Aid Kit & Medications",
    "Comfortable Walking / Trail Shoes",
  ];
};

const getCuratedTimelineFallback = (from: string, to: string, startDate?: string, endDate?: string) => {
  const cFrom = (from || "Origin").split(",")[0].trim();
  const cTo = (to || "Destination").split(",")[0].trim();
  const sD = startDate ? new Date(startDate) : new Date();
  const formatIso = (baseDate: Date, addDays: number, hours: number) => {
    const copy = new Date(baseDate.getTime() + addDays * 86400000);
    copy.setHours(hours, 0, 0, 0);
    return copy.toISOString();
  };

  return [
    {
      title: `Day 0 - Towards ${cTo}`,
      time: formatIso(sD, 0, 17),
      note: `Departure from ${cFrom}, transit, and travel preparation.`,
    },
    {
      title: `Day 1 - Arrival & Explore ${cTo} local and famous places`,
      time: formatIso(sD, 1, 13),
      note: `Arrival, hotel check-in, relax, and explore local neighborhood.`,
    },
    {
      title: `Day 2 - Landmark Exploration & Sightseeing`,
      time: formatIso(sD, 2, 10),
      note: `Visiting famous monuments, viewpoints, and cultural spots.`,
    },
    {
      title: `Day 3 - Scenic Adventure & Camping Experience`,
      time: formatIso(sD, 3, 11),
      note: `Outdoor trails, viewpoints, nature photography, and group gathering.`,
    },
    {
      title: `Day 4 - Final Exploration & Departure`,
      time: formatIso(sD, 4, 10),
      note: `Souvenir shopping, local delicacies, and return transit back to ${cFrom}.`,
    },
  ];
};

export default function TripDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = auth.currentUser;
  const uid = user?.uid || null;
  const insets = useSafeAreaInsets();
  const { themeColors, isDark, background } = useThemeToggle();
  const { formatTemperature } = useAppSettings();
  const { groups = [] } = useUserGroups(uid) || {};

  /* ─── DATA STATE ─── */
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coverImage, setCoverImage] = useState("");
  const [groupChatIcon, setGroupChatIcon] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [budget, setBudget] = useState<any>({ total: 0, used: 0, contributors: [], expenses: [] });
  const [memberDetails, setMemberDetails] = useState<any[]>([]);
  const [famousPlaces, setFamousPlaces] = useState<any[]>([]);

  /* ─── DRAWER STATE ─── */
  const [checklistDrawerOpen, setChecklistDrawerOpen] = useState(false);
  const [checklistViewAllOpen, setChecklistViewAllOpen] = useState(false);
  const [timelineDrawerOpen, setTimelineDrawerOpen] = useState(false);
  const [timelineAllDrawerOpen, setTimelineAllDrawerOpen] = useState(false);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [shareDrawerOpen, setShareDrawerOpen] = useState(false);
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);

  /* ─── FORM STATE ─── */
  const [newTask, setNewTask] = useState("");
  const [checklistDrafts, setChecklistDrafts] = useState<string[]>([]);
  const [newEvent, setNewEvent] = useState({ title: "", time: getCurrentDate() + "T" + getCurrentTime(), note: "" });
  const [timelineDrafts, setTimelineDrafts] = useState<any[]>([]);
  const [newLink, setNewLink] = useState({ title: "", url: "" });
  const [editBudget, setEditBudget] = useState({ total: "", contributors: [] as any[] });

  /* ─── AI STATE ─── */
  const [isGeneratingPlaces, setIsGeneratingPlaces] = useState(false);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);

  /* ─── FIRESTORE SUBSCRIPTIONS ─── */
  useEffect(() => {
    if (!id) return;

    const unsubTrip = onSnapshot(doc(db, "trips", id), (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const data = snap.data();
      setTrip({ id: snap.id, ...data });
      setLoading(false);

      if (data.iconURL || data.imageURL || data.coverImage) {
        setGroupChatIcon(data.iconURL || data.imageURL || data.coverImage);
      }

      /* load member details */
      if (data.members?.length) {
        Promise.all(
          data.members.map((mUid: string) =>
            getDoc(doc(db, "users", mUid))
              .then(s => s.exists() ? { uid: s.id, ...s.data() } : null)
              .catch(() => null)
          )
        ).then(results => {
          setMemberDetails(results.filter(Boolean) as any[]);
        });
      }
    });

    /* Fetch Group Chat icon image for this trip (Direct or via tripId query) */
    const unsubGroup = onSnapshot(doc(db, "groupChats", id), async (snap) => {
      if (snap.exists()) {
        const gData = snap.data();
        const icon =
          gData.iconURL ||
          gData.photoURL ||
          gData.groupChatIcon ||
          gData.groupIcon ||
          gData.imageBackgroundUrl;
        if (icon) setGroupChatIcon(icon);
      } else {
        try {
          const q = query(collection(db, "groupChats"), where("tripId", "==", id));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const gData = qSnap.docs[0].data();
            const icon =
              gData.iconURL ||
              gData.photoURL ||
              gData.groupChatIcon ||
              gData.groupIcon ||
              gData.imageBackgroundUrl;
            if (icon) setGroupChatIcon(icon);
          }
        } catch (e) {
          console.warn("Could not query groupChats by tripId:", e);
        }
      }
    });

    const unsubChecklist = onSnapshot(collection(db, "trips", id, "checklist"), (snap) => {
      setChecklist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTimeline = onSnapshot(collection(db, "trips", id, "timeline"), (snap) => {
      const events = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const now = new Date().toISOString();
      const visible = events.filter((e: any) => {
        if (!e.surprise) return true;
        if (e.createdBy === uid) return true;
        if (e.revealed) return true;
        if (e.revealAt && e.revealAt <= now) return true;
        return false;
      });
      setTimeline(visible.sort((a: any, b: any) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime()));
    });

    const unsubBudget = onSnapshot(doc(db, "budgets", id), (snap) => {
      if (!snap.exists()) {
        setBudget({ total: 0, used: 0, contributors: [], expenses: [] });
        return;
      }
      const data = snap.data();
      const used = (data.expenses || []).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
      setBudget({ ...data, used, expenses: data.expenses || [] });
      setEditBudget({ total: String(data.total || 0), contributors: data.contributors || [] });
    });

    const unsubPlaces = onSnapshot(collection(db, "trips", id, "places"), (snap) => {
      setFamousPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubTrip();
      unsubGroup();
      unsubChecklist();
      unsubTimeline();
      unsubBudget();
      unsubPlaces();
    };
  }, [id, uid]);

  /* ─── LIVE WEATHER FETCH FOR DESTINATION ─── */
  useEffect(() => {
    const loc = trip?.to || trip?.location || trip?.from;
    if (!loc) return;
    (async () => {
      try {
        const clean = loc.split(",")[0].trim();
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1`,
          { headers: { "User-Agent": "BunkMatesApp/2.0" } }
        );
        const geoData = await geoRes.json();
        let lat = 26.9124;
        let lon = 75.7873;
        if (geoData?.[0]) {
          lat = parseFloat(geoData[0].lat);
          lon = parseFloat(geoData[0].lon);
        }
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const wData = await wRes.json();
        if (wData?.current_weather) {
          const temp = Math.round(wData.current_weather.temperature);
          const wCode = wData.current_weather.weathercode;
          const { emoji, text } = getWeatherInfo(wCode, temp);
          setWeather({
            temp,
            emoji,
            description: text,
            locationName: clean,
          });
        }
      } catch (err) {
        console.log("Weather fetch error in TripDetails:", err);
      }
    })();
  }, [trip?.to, trip?.location, trip?.from]);

  /* ─── CHECKLIST ACTIONS ─── */
  const addTask = async () => {
    if (!newTask.trim() || !id) return;
    await addDoc(collection(db, "trips", id, "checklist"), { text: newTask.trim(), completed: false });
    setNewTask("");
  };

  const toggleTask = async (task: any) => {
    if (!id) return;
    await updateDoc(doc(db, "trips", id, "checklist", task.id), { completed: !task.completed });
  };

  const addAllChecklistItems = async () => {
    if (!id || !checklistDrafts.length) return;
    await Promise.all(
      checklistDrafts.map(text =>
        addDoc(collection(db, "trips", id, "checklist"), { text, completed: false })
      )
    );
    setChecklistDrafts([]);
    setChecklistDrawerOpen(false);
  };

  /* ─── TIMELINE ACTIONS ─── */
  const addTimelineEvent = async () => {
    if (!id || !newEvent.title) return;
    await addDoc(collection(db, "trips", id, "timeline"), {
      title: newEvent.title,
      time: newEvent.time,
      note: newEvent.note || "",
      completed: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      surprise: false,
      revealed: true,
    });
    setNewEvent({ title: "", time: getCurrentDate() + "T" + getCurrentTime(), note: "" });
    setTimelineDrawerOpen(false);
  };

  const toggleEventCompleted = async (event: any) => {
    if (!id) return;
    await updateDoc(doc(db, "trips", id, "timeline", event.id), { completed: !event.completed });
  };

  const addAllTimelineEvents = async () => {
    if (!id || !timelineDrafts.length) return;
    await Promise.all(
      timelineDrafts.map(d =>
        addDoc(collection(db, "trips", id, "timeline"), {
          title: d.title || "Untitled",
          time: d.time || new Date().toISOString(),
          note: d.note || "",
          completed: false,
          createdBy: uid,
          createdAt: serverTimestamp(),
          surprise: false,
          revealed: true,
        })
      )
    );
    setTimelineDrafts([]);
    setTimelineDrawerOpen(false);
  };

  /* ─── LINK ACTIONS ─── */
  const handleAddLink = async () => {
    if (!id || !newLink.url || !newLink.title) return;
    const updatedLinks = [
      ...(trip?.links || []),
      { id: Date.now().toString(), ...newLink, createdBy: uid, createdAt: new Date().toISOString() },
    ];
    await updateDoc(doc(db, "trips", id), { links: updatedLinks });
    setNewLink({ title: "", url: "" });
    setLinkDrawerOpen(false);
  };

  /* ─── BUDGET ACTIONS ─── */
  const saveBudget = async () => {
    if (!id) return;
    const { setDoc } = await import("firebase/firestore");
    await setDoc(
      doc(db, "budgets", id),
      { total: Number(editBudget.total) || 0, contributors: editBudget.contributors, tripId: id, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    setBudgetDrawerOpen(false);
  };

  /* ─── DELETE TRIP ─── */
  const handleDeleteTrip = async () => {
    if (!id) return;
    await deleteDoc(doc(db, "trips", id));
    await deleteDoc(doc(db, "groupChats", id)).catch(() => {});
    await deleteDoc(doc(db, "budgets", id)).catch(() => {});
    router.replace("/(tabs)/trips");
  };

  /* ─── REAL-TIME GROQ AI FROM FIRESTORE ─── */
  const { defaultModel } = useGroqAI();

  const parseAiJson = (rawContent: string) => {
    if (!rawContent) return null;
    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  /**
   * Resilient Groq Chat Completion API caller with multi-model fallback
   */
  const callGroqChatApi = async (prompt: string) => {
    const generateCompletion = httpsCallable<
      { model: string; prompt: string },
      { content: string }
    >(functions, "generateGroqChatCompletion");
    const modelsToTry = [
      defaultModel || "llama-3.3-70b-versatile",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ];

    let lastError: any = null;

    for (const modelCandidate of modelsToTry) {
      if (
        modelCandidate.includes("orpheus") ||
        modelCandidate.includes("whisper") ||
        modelCandidate.includes("canopylabs")
      ) {
        continue;
      }

      try {
        const result = await generateCompletion({ model: modelCandidate, prompt });
        if (result.data?.content) return result.data.content;
        lastError = new Error("Groq returned an empty completion.");
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Failed to generate response from Groq API.");
  };

  /* ─── AI: FAMOUS PLACES ─── */
  const handleGenerateAiPlaces = async () => {
    const dest = trip?.to || trip?.location || trip?.name;
    if (!dest) {
      Alert.alert("Trip Location", "No destination location set for this trip.");
      return;
    }

    setIsGeneratingPlaces(true);
    let placesToAdd: any[] = [];

    try {
      const prompt = `Give me 5 famous, must-visit tourist attractions and local places to visit in "${dest}".
Return strictly raw JSON format without reasoning or explanation:
{"places":[{"name":"Place Name","category":"Historical Monument","description":"Short description.","suggestedTime":"Morning"}]}`;

      const rawContent = await callGroqChatApi(prompt);
      const parsed = parseAiJson(rawContent);
      if (parsed?.places?.length) {
        placesToAdd = parsed.places;
      }
    } catch (e: any) {
      console.warn("Groq AI places error, using curated fallback:", e);
    }

    if (!placesToAdd.length) {
      placesToAdd = getCuratedPlacesFallback(dest);
    }

    try {
      if (id && placesToAdd.length) {
        for (const item of placesToAdd) {
          await addDoc(collection(db, "trips", id, "places"), {
            name: item.name,
            category: item.category || "Sightseeing",
            description: item.description || "",
            suggestedTime: item.suggestedTime || "Morning",
            createdAt: new Date().toISOString(),
            createdBy: uid,
          });
        }
        Alert.alert("✨ Famous Places Added", `Discovered ${placesToAdd.length} top spots for ${dest.split(",")[0]}!`);
      }
    } catch (err: any) {
      console.error("Error saving places to firestore:", err);
      Alert.alert("Save Error", "Could not save places. Please try again.");
    } finally {
      setIsGeneratingPlaces(false);
    }
  };

  /* ─── AI: TIMELINE ─── */
  const handleGenerateAiTimeline = async () => {
    const origin = trip?.from || "Current Location";
    const dest = trip?.to || trip?.location || trip?.name || "Destination";

    setIsGeneratingTimeline(true);
    let timelineToAdd: any[] = [];

    try {
      let numDays = 3;
      if (trip?.startDate && trip?.endDate) {
        const diff = Math.abs(new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime());
        numDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      const prompt = `Generate a ${numDays}-day itinerary timeline for travel from "${origin}" to "${dest}" starting on "${trip?.startDate || "N/A"}".
Return strictly raw JSON format without reasoning or explanation:
{"timeline":[{"title":"Day 1 - Arrival & Hotel Check-in","time":"${trip?.startDate || getCurrentDate()}T10:00","note":"Transit to destination, check in and evening sightseeing."}]}`;

      const rawContent = await callGroqChatApi(prompt);
      const parsed = parseAiJson(rawContent);
      if (parsed?.timeline?.length) {
        timelineToAdd = parsed.timeline;
      }
    } catch (e: any) {
      console.warn("Groq AI timeline error, using fallback:", e);
    }

    if (!timelineToAdd.length) {
      timelineToAdd = getCuratedTimelineFallback(origin, dest, trip?.startDate, trip?.endDate);
    }

    try {
      if (id && timelineToAdd.length) {
        for (const item of timelineToAdd) {
          await addDoc(collection(db, "trips", id, "timeline"), {
            title: item.title,
            time: item.time || `${getCurrentDate()}T10:00`,
            note: item.note || "",
            completed: false,
            createdBy: uid,
            createdAt: serverTimestamp(),
            surprise: false,
            revealed: true,
          });
        }
        Alert.alert("✨ AI Timeline Generated", `Added ${timelineToAdd.length} timeline events!`);
      }
    } catch (err: any) {
      console.error("Error saving timeline to firestore:", err);
    } finally {
      setIsGeneratingTimeline(false);
    }
  };

  /* ─── AI: CHECKLIST ─── */
  const handleGenerateAiChecklist = async () => {
    const dest = trip?.to || trip?.location || trip?.name || "Destination";

    setIsGeneratingChecklist(true);
    let checklistToAdd: string[] = [];

    try {
      const prompt = `Generate an essential packing checklist for a trip to "${dest}".
Return strictly raw JSON format without reasoning or explanation:
{"checklist":["Government IDs & Tickets","Phone Chargers","First Aid Kit","Comfortable Shoes"]}`;

      const rawContent = await callGroqChatApi(prompt);
      const parsed = parseAiJson(rawContent);
      if (parsed?.checklist?.length) {
        checklistToAdd = parsed.checklist;
      }
    } catch (e: any) {
      console.warn("Groq AI checklist error, using fallback:", e);
    }

    if (!checklistToAdd.length) {
      checklistToAdd = getCuratedChecklistFallback(dest);
    }

    try {
      if (id && checklistToAdd.length) {
        for (const text of checklistToAdd) {
          await addDoc(collection(db, "trips", id, "checklist"), { text, completed: false });
        }
        Alert.alert("✨ AI Checklist Added", `Added ${checklistToAdd.length} packing checklist items!`);
      }
    } catch (err: any) {
      console.error("Error saving checklist to firestore:", err);
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  /* ─── PLACE ACTIONS ─── */
  const handleAddPlaceToTimeline = async (place: any) => {
    if (!id) return;
    await addDoc(collection(db, "trips", id, "timeline"), {
      title: `Visit ${place.name}`,
      time: `${trip?.startDate || getCurrentDate()}T10:00`,
      note: place.description || `${place.category} in ${trip?.to || trip?.location}`,
      completed: false,
      createdBy: uid,
      createdAt: serverTimestamp(),
      surprise: false,
      revealed: true,
    });
    Alert.alert("Added to Timeline", `Added "${place.name}" to Timeline!`);
  };

  const handleAddPlaceToChecklist = async (place: any) => {
    if (!id) return;
    await addDoc(collection(db, "trips", id, "checklist"), {
      text: `Explore ${place.name} (${place.category})`,
      completed: false,
    });
    Alert.alert("Added to Checklist", `Added "${place.name}" to Checklist!`);
  };

  const handleDeletePlace = async (placeId: string) => {
    if (!id) return;
    await deleteDoc(doc(db, "trips", id, "places", placeId));
  };

  /* ─── HELPERS ─── */
  const getMemberName = (mUid?: string): string => {
    if (!mUid) return "Unknown";
    const m = memberDetails.find((x: any) => x.uid === mUid);
    if (mUid === uid) return `${m?.name || "You"} (Me)`;
    return m?.name || "Unknown";
  };

  const usedAmount = budget?.expenses?.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) || 0;
  const totalBudget = Number(budget?.total || 0);
  const budgetProgress = totalBudget === 0 ? 0 : Math.min(100, (usedAmount / totalBudget) * 100);

  // Group Icon Resolution (Priority: groupChatIcon from groupChats doc, matching group in useUserGroups, trip's own fields)
  const matchedGroup = (groups || []).find((g: any) => {
    if (!g) return false;
    if (g.id === id || g.tripId === id) return true;
    if (g.name && trip?.name && g.name.trim().toLowerCase() === trip.name.trim().toLowerCase()) return true;
    return false;
  });

  const displayImage =
    groupChatIcon ||
    matchedGroup?.iconURL ||
    matchedGroup?.photoURL ||
    matchedGroup?.groupChatIcon ||
    matchedGroup?.groupIcon ||
    matchedGroup?.imageBackgroundUrl ||
    trip?.iconURL ||
    trip?.coverImage ||
    trip?.photoURL ||
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop";

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip?.from || "")}&destination=${encodeURIComponent(trip?.to || "")}`;

  const routeFrom = trip?.from ? trip.from.split(",")[0].trim() : "";
  const routeTo = trip?.to ? trip.to.split(",")[0].trim() : trip?.location ? trip.location.split(",")[0].trim() : "";
  const routeText = routeFrom && routeTo ? `${routeFrom} → ${routeTo}` : routeTo || routeFrom || "Direct Route";

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: background.mode === "solid" ? themeColors.background : "transparent" }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── FLOATING TOP BAR NAVIGATION (Fixed on screen top with safe-area) ── */}
      <View style={[styles.topBarFixed, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={17} color="#ffffff" />
          <Text style={styles.backPillText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topRightBtns}>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setShareDrawerOpen(true)}>
            <Ionicons name="share-social" size={18} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => router.push(`/(tabs)/group-chatroom/${id}` as any)}
          >
            <Ionicons name="people" size={18} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setSettingsDrawerOpen(true)}>
            <Ionicons name="settings-sharp" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── MAIN SCROLLVIEW (Hero image scrolls up naturally like Image 2!) ── */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* ── HERO IMAGE (Inside ScrollView, scrollable with page) ── */}
        <View style={styles.heroScrollContainer}>
          <ImageBackground
            source={{ uri: displayImage }}
            style={styles.hero}
            resizeMode="cover"
          >
            {/* Top dark gradient for back & settings button contrast */}
            <LinearGradient
              colors={["rgba(0,0,0,0.6)", "transparent"]}
              style={styles.heroTopGradient}
            />

            {/* WEATHER CHIP (Floating on hero image bottom-left, Image 1) */}
            {weather && (
              <View style={styles.weatherChip}>
                <Text style={styles.weatherEmoji}>{weather.emoji || "🔥"}</Text>
                <View style={styles.weatherTextWrap}>
                  <Text style={styles.weatherTempText}>{formatTemperature(weather.temp, "C")}</Text>
                  <Text style={styles.weatherDescText}>{weather.description}</Text>
                </View>
                <Text style={styles.weatherLocText}>
                  IN {weather.locationName?.toUpperCase()}
                </Text>
              </View>
            )}

            {/* Bottom blur/gradient fade blending hero image into title card (Image 1) */}
            <LinearGradient
              colors={["transparent", "rgba(12, 14, 21, 0.4)", "rgba(12, 14, 21, 0.9)", "#0c0e15"]}
              locations={[0, 0.35, 0.75, 1]}
              style={styles.heroBottomGradient}
            />
          </ImageBackground>
        </View>

        {/* ── SLIDING CONTENT SHEET (Overlapping hero with rounded top & blur blend) ── */}
        <View style={styles.sheetContentWrap}>
          {/* ─── TRIP OVERVIEW INFO (Screenshot 1) ─── */}
          <View style={styles.tripInfoPad}>
            <Text style={styles.tripTitle}>{trip?.name}</Text>

            <View style={styles.metaRow}>
              <Ionicons name="location-sharp" size={16} color="#8e92a4" />
              <Text style={styles.metaText}>{trip?.location || trip?.to}</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={16} color="#8e92a4" />
              <Text style={styles.metaText}>{formatTripDateRange(trip?.startDate, trip?.endDate)}</Text>
            </View>

            <View style={styles.routeContainer}>
              <Text style={styles.routeLabel}>Route:</Text>
              <View style={styles.routeRow}>
                <Text style={styles.routeText}>{routeText}</Text>
                <TouchableOpacity
                  style={styles.navSquareBtn}
                  onPress={() => Linking.openURL(mapsUrl)}
                >
                  <Ionicons name="navigate" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ─── FAMOUS PLACES & TOP ATTRACTIONS (Screenshots 1 & 2) ─── */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="compass" size={22} color="#ffffff" />
                <Text style={styles.sectionMainTitle}>Famous Places & Top Attractions</Text>
              </View>
              <TouchableOpacity
                style={styles.discoverPlacesBtn}
                onPress={handleGenerateAiPlaces}
                disabled={isGeneratingPlaces}
              >
                {isGeneratingPlaces ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Ionicons name="sparkles" size={13} color="#ffffff" />
                    <Text style={styles.discoverPlacesText}>Discover Places</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {famousPlaces.length === 0 ? (
              <View style={styles.emptyCardBox}>
                <Text style={styles.emptyCardText}>
                  No places discovered yet. Tap "Discover Places" to find top local spots with Groq AI!
                </Text>
              </View>
            ) : (
              famousPlaces.map((place) => (
                <View key={place.id} style={styles.placeCard}>
                  <View style={styles.placeTopRow}>
                    <Text style={styles.placeTitle}>{place.name}</Text>
                    <TouchableOpacity onPress={() => handleDeletePlace(place.id)} hitSlop={10}>
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.placeTagsRow}>
                    <View style={styles.placeCategoryBadge}>
                      <Text style={styles.placeCategoryText}>{place.category || "Sightseeing"}</Text>
                    </View>
                    {place.suggestedTime ? (
                      <View style={styles.placeTimeBadge}>
                        <Text style={styles.placeTimeText}>{place.suggestedTime}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.placeDesc}>{place.description}</Text>

                  {/* EXACT SOLID WHITE PILL BUTTONS FROM SCREENSHOTS 1 & 2 */}
                  <View style={styles.placeActionRow}>
                    <TouchableOpacity
                      style={styles.solidWhiteBtn}
                      onPress={() => handleAddPlaceToTimeline(place)}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#000000" style={{ marginRight: 6 }} />
                      <Text style={styles.solidWhiteBtnText}>+ Timeline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.solidWhiteBtn}
                      onPress={() => handleAddPlaceToChecklist(place)}
                    >
                      <Ionicons name="list" size={16} color="#000000" style={{ marginRight: 6 }} />
                      <Text style={styles.solidWhiteBtnText}>+ Checklist</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ─── CHECKLIST (Screenshot 3) ─── */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSectionHeader}>Checklist</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={styles.aiWhiteBtn}
                  onPress={handleGenerateAiChecklist}
                  disabled={isGeneratingChecklist}
                >
                  {isGeneratingChecklist ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="sparkles" size={13} color="#ffffff" />
                      <Text style={styles.aiWhiteBtnText}>AI Checklist</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addPillBtn}
                  onPress={() => setChecklistDrawerOpen(true)}
                >
                  <Text style={styles.addPillBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {checklist.slice(0, 5).map((task) => (
              <TouchableOpacity
                key={task.id}
                style={styles.checkItemRow}
                onPress={() => toggleTask(task)}
              >
                <Ionicons
                  name={task.completed ? "checkbox" : "square-outline"}
                  size={22}
                  color={task.completed ? "#ffffff" : "rgba(255,255,255,0.4)"}
                  style={{ marginRight: 14 }}
                />
                <Text
                  style={[
                    styles.checkItemText,
                    task.completed && styles.checkItemTextDone,
                  ]}
                >
                  {task.text || task.title}
                </Text>
              </TouchableOpacity>
            ))}

            {checklist.length === 0 && (
              <Text style={styles.emptySimpleText}>No checklist items yet.</Text>
            )}

            <TouchableOpacity style={styles.viewAllDarkBtn} onPress={() => setChecklistViewAllOpen(true)}>
              <Text style={styles.viewAllDarkText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* ─── TRIP TIMELINE (Screenshots 3 & 4) ─── */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSectionHeader}>Trip Timeline</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={styles.aiWhiteBtn}
                  onPress={handleGenerateAiTimeline}
                  disabled={isGeneratingTimeline}
                >
                  {isGeneratingTimeline ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="sparkles" size={13} color="#ffffff" />
                      <Text style={styles.aiWhiteBtnText}>AI Timeline</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addPillBtn}
                  onPress={() => setTimelineDrawerOpen(true)}
                >
                  <Text style={styles.addPillBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {timeline.slice(0, 5).map((item) => {
              const itemTime = item.time ? new Date(item.time) : null;
              const timeStr = itemTime && !isNaN(itemTime.getTime())
                ? `${itemTime.getMonth() + 1}/${itemTime.getDate()}/${itemTime.getFullYear()}, ${itemTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`
                : item.time;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.timelineCardBox}
                  onPress={() => toggleEventCompleted(item)}
                >
                  <Ionicons
                    name={item.completed ? "checkbox" : "square-outline"}
                    size={20}
                    color={item.completed ? "#ffffff" : "rgba(255,255,255,0.4)"}
                    style={{ marginRight: 12, marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.timelineTitleText,
                        item.completed && styles.timelineTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.timelineTimeText}>
                      {timeStr}{item.note ? ` — ${item.note}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {timeline.length === 0 && (
              <Text style={styles.emptySimpleText}>No timeline events yet.</Text>
            )}

            <TouchableOpacity style={styles.viewAllDarkBtn} onPress={() => setTimelineAllDrawerOpen(true)}>
              <Text style={styles.viewAllDarkText}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* ─── MEMBERS (Screenshot 4) ─── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionSectionHeader}>Members</Text>

            {memberDetails.map((m) => (
              <View key={m.uid} style={styles.memberItemRow}>
                <ExpoImage
                  source={{ uri: m?.photoURL || `https://i.pravatar.cc/150?u=${m.uid}` }}
                  style={styles.memberAvatarImg}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberNameText}>
                    {m.uid === uid ? `${m.name || "You"} (Me)` : m.name || "Member"}
                  </Text>
                  <Text style={styles.memberEmailText}>{m.email || m.username || "bunkmate"}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ─── BUDGET ─── */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSectionHeader}>Budget</Text>
              <TouchableOpacity style={styles.addPillBtn} onPress={() => setBudgetDrawerOpen(true)}>
                <Text style={styles.addPillBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.budgetText}>₹{usedAmount} used of ₹{totalBudget}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${budgetProgress}%` }]} />
            </View>
          </View>

          {/* ─── DANGER ZONE ─── */}
          <View style={[styles.sectionContainer, { paddingBottom: 24 }]}>
            <TouchableOpacity
              style={styles.deleteTripBtn}
              onPress={() => setConfirmDeleteOpen(true)}
            >
              <Ionicons name="trash-outline" size={17} color="#ef4444" />
              <Text style={styles.deleteTripText}>Delete Trip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ─── DRAWER COMPONENTS ─── */}
      <ChecklistDrawer
        visible={checklistDrawerOpen}
        onClose={() => { setChecklistDrawerOpen(false); setChecklistDrafts([]); }}
        tripId={id || ""}
        checklist={checklist}
        mode="dark"
      />

      <ChecklistViewAllDrawer
        checklistViewAllOpen={checklistViewAllOpen}
        setChecklistViewAllOpen={setChecklistViewAllOpen}
        checklist={checklist.map(c => ({ id: c.id, text: c.text || c.title || "", completed: !!c.completed }))}
        toggleTask={toggleTask}
        mode="dark"
      />

      <TimelineDrawer
        timelineDrawerOpen={timelineDrawerOpen}
        setTimelineDrawerOpen={setTimelineDrawerOpen}
        timelineDrafts={timelineDrafts}
        setTimelineDrafts={setTimelineDrafts}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        addTimelineEvent={addTimelineEvent}
        addEmptyTimelineDraft={() => setTimelineDrafts(s => [...s, { title: "", time: getCurrentDate() + "T" + getCurrentTime(), note: "" }])}
        addAllTimelineEvents={addAllTimelineEvents}
        updateTimelineDraft={(i: number, val: any) => setTimelineDrafts(s => s.map((it, idx) => idx === i ? val : it))}
        removeTimelineDraft={(i: number) => setTimelineDrafts(s => s.filter((_, idx) => idx !== i))}
        mode="dark"
        onAiGenerateTimeline={handleGenerateAiTimeline}
      />

      <TimelineAllDrawer
        timelineAllDrawerOpen={timelineAllDrawerOpen}
        setTimelineAllDrawerOpen={setTimelineAllDrawerOpen}
        timeline={timeline}
        toggleEventCompleted={toggleEventCompleted}
        mode="dark"
      />

      <BudgetDrawer
        visible={budgetDrawerOpen}
        onClose={() => setBudgetDrawerOpen(false)}
        budget={budget}
        setBudget={setBudget}
        userId={id || ""}
        editBudget={editBudget}
        setEditBudget={setEditBudget}
        saveBudget={saveBudget}
        memberDetails={memberDetails}
        mode="dark"
      />

      <ConfirmDeleteDialog
        visible={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteTrip}
        tripName={trip?.name}
        mode="dark"
      />

      <ShareDrawer
        shareDrawerOpen={shareDrawerOpen}
        setShareDrawerOpen={setShareDrawerOpen}
        inviteLink={`https://bunk-mates.vercel.app/join?trip=${id}`}
        trip={trip}
        memberDetails={memberDetails}
        mode="dark"
        setSnackbar={() => {}}
      />

      <LinkDrawer
        visible={linkDrawerOpen}
        onClose={() => setLinkDrawerOpen(false)}
        tripId={id || ""}
        links={trip?.links || []}
        mode="dark"
      />

      <SettingsDrawer
        settingsDrawerOpen={settingsDrawerOpen}
        setSettingsDrawerOpen={setSettingsDrawerOpen}
        trip={trip}
        tripAdmins={[trip?.createdBy].filter(Boolean)}
        memberDetails={memberDetails}
        tripPermissions={{}}
        updatePermissions={() => {}}
        mode="dark"
        setConfirmDeleteOpen={setConfirmDeleteOpen}
        getMemberName={getMemberName}
        currentUseruid={uid || ""}
      />
    </View>
  );
}

/* ──────── STYLES (Matching Screenshots 1, 2, 3 & 4) ──────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0e15",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0c0e15",
  },
  topBarFixed: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 99,
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: "#0c0e15",
  },
  heroScrollContainer: {
    height: 400,
    width: "100%",
  },
  hero: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  heroTopGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroBottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  sheetContentWrap: {
    backgroundColor: "#0c0e15",
    marginTop: -32,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  backPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 22, 32, 0.65)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    gap: 6,
  },
  backPillText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  topRightBtns: {
    flexDirection: "row",
    gap: 10,
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(18, 22, 32, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },

  /* Weather Chip (Screenshot 1) */
  weatherChip: {
    position: "absolute",
    bottom: 52,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 18, 26, 0.65)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    zIndex: 10,
  },
  weatherEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  weatherTextWrap: {
    marginRight: 16,
  },
  weatherTempText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  weatherDescText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontWeight: "500",
  },
  weatherLocText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  tripInfoPad: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 16,
  },
  tripTitle: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    color: "#a1a6b8",
    fontSize: 13.5,
    fontWeight: "500",
  },

  /* Route Container (Screenshot 1) */
  routeContainer: {
    marginTop: 14,
  },
  routeLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  navSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sections */
  sectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionMainTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSectionHeader: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  discoverPlacesBtn: {
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  discoverPlacesText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  aiWhiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  aiWhiteBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  addPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  addPillBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyCardBox: {
    backgroundColor: "#141720",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  emptyCardText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  emptySimpleText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13,
    marginVertical: 8,
  },

  /* Famous Places Cards (Screenshots 1 & 2) */
  placeCard: {
    backgroundColor: "#141720",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  placeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  placeTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  placeTagsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  placeCategoryBadge: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  placeCategoryText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  placeTimeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  placeTimeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  placeDesc: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  placeActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  solidWhiteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    height: 44,
  },
  solidWhiteBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Checklist Items (Screenshot 3) */
  checkItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  checkItemText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  checkItemTextDone: {
    textDecorationLine: "line-through",
    color: "rgba(255, 255, 255, 0.35)",
  },
  viewAllDarkBtn: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    height: 44,
  },
  viewAllDarkText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Timeline Items (Screenshots 3 & 4) */
  timelineCardBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#141720",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  timelineTitleText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 3,
  },
  timelineTitleDone: {
    textDecorationLine: "line-through",
    color: "rgba(255, 255, 255, 0.35)",
  },
  timelineTimeText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
  },

  /* Members (Screenshot 4) */
  memberItemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  memberAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    backgroundColor: "#1c2130",
  },
  memberNameText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14.5,
  },
  memberEmailText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 2,
  },

  /* Budget */
  budgetText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 13,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 3,
  },

  /* Danger Zone */
  deleteTripBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 16,
    height: 48,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  deleteTripText: {
    color: "#ef4444",
    fontSize: 13.5,
    fontWeight: "700",
  },
});