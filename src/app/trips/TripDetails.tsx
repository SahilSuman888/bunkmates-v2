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
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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

const { width } = Dimensions.get("window");
const UNSPLASH_KEY = "MGCA3bsEUNBsSG6XbcqnJXckFB4dDyN5ZPKVBrD0FeQ";

const getCurrentDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export default function TripDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = auth.currentUser;
  const uid = user?.uid || null;

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

      if (data.iconURL || data.imageURL) {
        setGroupChatIcon(data.iconURL || data.imageURL);
      }

      /* fetch cover image from Unsplash */
      const loc = data.location || data.to || data.name;
      if (loc && !coverImage) {
        fetch(`https://api.unsplash.com/photos/random?query=travel+${encodeURIComponent(loc)}&client_id=${UNSPLASH_KEY}`)
          .then(r => r.json())
          .then(d => { if (d?.urls?.regular) setCoverImage(d.urls.regular); })
          .catch(() => {});
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

    /* Fetch Group Chat icon image for this trip */
    const unsubGroup = onSnapshot(doc(db, "groupChats", id), (snap) => {
      if (snap.exists()) {
        const gData = snap.data();
        const icon = gData.iconURL || gData.groupChatIcon || gData.photoURL || gData.groupIcon || gData.imageBackgroundUrl;
        if (icon) setGroupChatIcon(icon);
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
  const { groqApiKey: hookGroqApiKey, defaultModel, fetchKeyDirectly } = useGroqAI();

  const getActiveGroqKey = async (): Promise<string | null> => {
    if (hookGroqApiKey) return hookGroqApiKey;
    return await fetchKeyDirectly();
  };

  const parseAiJson = (rawContent: string) => {
    if (!rawContent) return null;
    let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  };

  /**
   * Resilient Groq Chat Completion API caller.
   * If the chosen model fails (e.g. non-chat model, terms required, or rate-limited),
   * it automatically retries with "llama-3.3-70b-versatile" or "llama-3.1-8b-instant".
   */
  const callGroqChatApi = async (apiKey: string, prompt: string) => {
    const modelsToTry = [
      defaultModel || "llama-3.3-70b-versatile",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ];

    let lastError: any = null;

    for (const modelCandidate of modelsToTry) {
      // Skip audio/TTS models if passed by mistake
      if (
        modelCandidate.includes("orpheus") ||
        modelCandidate.includes("whisper") ||
        modelCandidate.includes("canopylabs")
      ) {
        continue;
      }

      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        });

        const data = await res.json();
        if (res.ok && data?.choices?.[0]?.message?.content) {
          return data.choices[0].message.content;
        }

        lastError = new Error(data?.error?.message || `API Error (${res.status})`);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Failed to generate response from Groq API.");
  };

  /* ─── AI: FAMOUS PLACES ─── */
  const handleGenerateAiPlaces = async () => {
    const dest = trip?.to || trip?.location || trip?.name;
    if (!dest) { Alert.alert("Trip Location", "No destination location set for this trip."); return; }

    const activeKey = await getActiveGroqKey();
    if (!activeKey) {
      Alert.alert("API Key Required", "Please configure and validate your Groq API Key in Profile > AI Features.");
      return;
    }

    setIsGeneratingPlaces(true);
    try {
      const prompt = `Give me 5 famous, must-visit tourist attractions and local places to visit in "${dest}".
Return strictly raw JSON format without reasoning or explanation:
{"places":[{"name":"Place Name","category":"Historical Monument","description":"Short description.","suggestedTime":"Morning"}]}`;

      const rawContent = await callGroqChatApi(activeKey, prompt);
      const parsed = parseAiJson(rawContent);

      if (parsed?.places?.length && id) {
        for (const item of parsed.places) {
          await addDoc(collection(db, "trips", id, "places"), {
            name: item.name,
            category: item.category || "Sightseeing",
            description: item.description || "",
            suggestedTime: item.suggestedTime || "Flexible",
            createdAt: new Date().toISOString(),
            createdBy: uid,
          });
        }
        Alert.alert("✨ Famous Places Added", `Added ${parsed.places.length} famous places for ${dest}!`);
      } else {
        Alert.alert("AI Error", "Could not parse places from AI response. Please try again.");
      }
    } catch (e: any) {
      console.error("handleGenerateAiPlaces error:", e);
      Alert.alert("AI Error", e.message || "Failed to generate AI places. Try again.");
    } finally {
      setIsGeneratingPlaces(false);
    }
  };

  /* ─── AI: TIMELINE ─── */
  const handleGenerateAiTimeline = async () => {
    const origin = trip?.from || "Current Location";
    const dest = trip?.to || trip?.location || trip?.name || "Destination";

    const activeKey = await getActiveGroqKey();
    if (!activeKey) {
      Alert.alert("API Key Required", "Please configure and validate your Groq API Key in Profile > AI Features.");
      return;
    }

    setIsGeneratingTimeline(true);
    try {
      let numDays = 3;
      if (trip?.startDate && trip?.endDate) {
        const diff = Math.abs(new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime());
        numDays = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }

      const prompt = `Generate a ${numDays}-day itinerary timeline for travel from "${origin}" to "${dest}" starting on "${trip?.startDate || "N/A"}".
Return strictly raw JSON format without reasoning or explanation:
{"timeline":[{"title":"Day 1 - Arrival & Hotel Check-in","time":"${trip?.startDate || getCurrentDate()}T10:00","note":"Transit to destination, check in and evening sightseeing."}]}`;

      const rawContent = await callGroqChatApi(activeKey, prompt);
      const parsed = parseAiJson(rawContent);

      if (parsed?.timeline?.length && id) {
        for (const item of parsed.timeline) {
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
        Alert.alert("✨ AI Timeline Generated", `Added ${parsed.timeline.length} timeline events!`);
      } else {
        Alert.alert("AI Error", "Could not parse timeline from AI response. Please try again.");
      }
    } catch (e: any) {
      console.error("handleGenerateAiTimeline error:", e);
      Alert.alert("AI Error", e.message || "Failed to generate AI Timeline.");
    } finally {
      setIsGeneratingTimeline(false);
    }
  };

  /* ─── AI: CHECKLIST ─── */
  const handleGenerateAiChecklist = async () => {
    const dest = trip?.to || trip?.location || trip?.name || "Destination";

    const activeKey = await getActiveGroqKey();
    if (!activeKey) {
      Alert.alert("API Key Required", "Please configure and validate your Groq API Key in Profile > AI Features.");
      return;
    }

    setIsGeneratingChecklist(true);
    try {
      const prompt = `Generate an essential packing checklist for a trip to "${dest}".
Return strictly raw JSON format without reasoning or explanation:
{"checklist":["Government IDs & Tickets","Phone Chargers","First Aid Kit","Comfortable Shoes"]}`;

      const rawContent = await callGroqChatApi(activeKey, prompt);
      const parsed = parseAiJson(rawContent);

      if (parsed?.checklist?.length && id) {
        for (const text of parsed.checklist) {
          await addDoc(collection(db, "trips", id, "checklist"), { text, completed: false });
        }
        Alert.alert("✨ AI Checklist Added", `Added ${parsed.checklist.length} packing checklist items!`);
      } else {
        Alert.alert("AI Error", "Could not parse checklist items from AI response. Please try again.");
      }
    } catch (e: any) {
      console.error("handleGenerateAiChecklist error:", e);
      Alert.alert("AI Error", e.message || "Failed to generate AI Checklist.");
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
    Alert.alert(`Added "${place.name}" to Timeline!`);
  };

  const handleAddPlaceToChecklist = async (place: any) => {
    if (!id) return;
    await addDoc(collection(db, "trips", id, "checklist"), {
      text: `Explore ${place.name} (${place.category})`,
      completed: false,
    });
    Alert.alert(`Added "${place.name}" to Checklist!`);
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
  const displayImage = trip?.iconURL || coverImage;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip?.from || "")}&destination=${encodeURIComponent(trip?.to || "")}`;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00e6b0" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── HERO IMAGE ── */}
      <View style={styles.heroContainer}>
        <ImageBackground
          source={displayImage ? { uri: displayImage } : undefined}
          style={styles.hero}
        >
          {!displayImage && (
            <LinearGradient colors={["#1a1a2e", "#16213e"]} style={styles.hero}>
              <Text style={{ color: "#fff", fontSize: 60, fontWeight: "900", opacity: 0.3 }}>
                {trip?.name?.charAt(0)?.toUpperCase() || "T"}
              </Text>
            </LinearGradient>
          )}

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.88)"]}
            style={styles.heroGradient}
          />

          {/* TOP BUTTONS ROW */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={16} color="#fff" />
              <Text style={styles.headerBtnText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.topRightBtns}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShareDrawerOpen(true)}>
                <Ionicons name="share-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/(tabs)/group-chatroom/${id}` as any)}>
                <Ionicons name="people-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsDrawerOpen(true)}>
                <Ionicons name="information-circle-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* WEATHER CHIP */}
          {weather && (
            <View style={styles.weatherChip}>
              <Text style={styles.weatherTemp}>
                {weather.temp > 32 ? "🔥" : weather.temp < 10 ? "❄️" : "☀️"} {Math.round(weather.temp)}°C
              </Text>
              <Text style={styles.weatherDesc}>{weather.description}</Text>
              <Text style={styles.weatherLoc}>IN {trip?.location?.toUpperCase()}</Text>
            </View>
          )}
        </ImageBackground>
      </View>

      {/* ── CONTENT CARD ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip Info */}
        <View style={styles.contentPad}>
          <Text style={styles.tripTitle}>{trip?.name}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="location-sharp" size={14} color="#aaa" />
            <Text style={styles.infoText}>{trip?.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color="#aaa" />
            <Text style={styles.infoText}>
              {trip?.startDate
                ? `${new Date(trip.startDate).toDateString()} → ${new Date(trip?.endDate || trip.startDate).toDateString()}`
                : "Dates not set"}
            </Text>
          </View>

          {trip?.from && trip?.to && (
            <View style={styles.routeBox}>
              <Text style={styles.routeLabel}>Route:</Text>
              <View style={styles.routeRow}>
                <Text style={styles.routeText}>
                  {trip.from} → {trip.to}
                </Text>
                <TouchableOpacity
                  style={styles.mapsBtn}
                  onPress={() => Linking.openURL(mapsUrl)}
                >
                  <Ionicons name="navigate" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ─── FAMOUS PLACES & TOP ATTRACTIONS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="compass" size={20} color="#00e6b0" />
              <Text style={styles.sectionTitle}>Famous Places & Top Attractions</Text>
            </View>
            <TouchableOpacity
              style={styles.aiBtn}
              onPress={handleGenerateAiPlaces}
              disabled={isGeneratingPlaces}
            >
              {isGeneratingPlaces ? (
                <ActivityIndicator size="small" color="#00e6b0" />
              ) : (
                <Text style={styles.aiBtnText}>✦ ✨ Discover Places</Text>
              )}
            </TouchableOpacity>
          </View>

          {famousPlaces.length === 0 ? (
            <Text style={styles.emptyText}>
              No places discovered yet. Tap "Discover Places" to find top local spots with AI!
            </Text>
          ) : (
            famousPlaces.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                <View style={styles.placeHeaderRow}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <TouchableOpacity onPress={() => handleDeletePlace(place.id)}>
                    <Ionicons name="trash" size={18} color="#ff4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.placeTagRow}>
                  <View style={styles.placeTagOutline}>
                    <Text style={styles.placeTagOutlineText}>{place.category}</Text>
                  </View>
                  {place.suggestedTime && (
                    <View style={styles.placeTagGreen}>
                      <Text style={styles.placeTagGreenText}>{place.suggestedTime}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.placeDesc}>{place.description}</Text>

                <View style={styles.placeActionRow}>
                  <TouchableOpacity
                    style={styles.placeActionBtnSolid}
                    onPress={() => handleAddPlaceToTimeline(place)}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#000" />
                    <Text style={styles.placeActionBtnSolidText}> + Timeline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.placeActionBtnOutline}
                    onPress={() => handleAddPlaceToChecklist(place)}
                  >
                    <Ionicons name="list-outline" size={14} color="#fff" />
                    <Text style={styles.placeActionBtnOutlineText}> + Checklist</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ─── CHECKLIST ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={styles.aiBtn}
                onPress={handleGenerateAiChecklist}
                disabled={isGeneratingChecklist}
              >
                {isGeneratingChecklist ? (
                  <ActivityIndicator size="small" color="#00e6b0" />
                ) : (
                  <Text style={styles.aiBtnText}>✦ ✨ AI Checklist</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setChecklistDrawerOpen(true)}
              >
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {checklist.slice(0, 5).map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.checkRow}
              onPress={() => toggleTask(task)}
            >
              <Ionicons
                name={task.completed ? "checkbox" : "square-outline"}
                size={22}
                color={task.completed ? "#4caf50" : "#888"}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[
                  styles.checkText,
                  task.completed && { textDecorationLine: "line-through", color: "#666" },
                ]}
              >
                {task.text || task.title}
              </Text>
            </TouchableOpacity>
          ))}

          {checklist.length === 0 && (
            <Text style={styles.emptyText}>No checklist items yet.</Text>
          )}

          <TouchableOpacity style={styles.viewAllBtn} onPress={() => setChecklistViewAllOpen(true)}>
            <Text style={styles.viewAllBtnText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* ─── TRIP TIMELINE ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trip Timeline</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={styles.aiBtn}
                onPress={handleGenerateAiTimeline}
                disabled={isGeneratingTimeline}
              >
                {isGeneratingTimeline ? (
                  <ActivityIndicator size="small" color="#00e6b0" />
                ) : (
                  <Text style={styles.aiBtnText}>✦ ✨ AI Timeline</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setTimelineDrawerOpen(true)}
              >
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {timeline.slice(0, 3).map((item) => {
            const itemTime = item.time ? new Date(item.time) : null;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.timelineCard}
                onPress={() => toggleEventCompleted(item)}
              >
                <Ionicons
                  name={item.completed ? "checkbox" : "square-outline"}
                  size={20}
                  color={item.completed ? "#4caf50" : "#888"}
                  style={{ marginRight: 12, marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      item.completed && { textDecorationLine: "line-through", color: "#666" },
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {itemTime ? itemTime.toLocaleString() : item.time}
                    {item.note ? ` — ${item.note}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {timeline.length === 0 && (
            <Text style={styles.emptyText}>No timeline events yet.</Text>
          )}

          <TouchableOpacity style={styles.viewAllBtn} onPress={() => setTimelineAllDrawerOpen(true)}>
            <Text style={styles.viewAllBtnText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* ─── MEMBERS ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>

          {memberDetails.map((m) => (
            <View key={m.uid} style={styles.memberRow}>
              <Image
                source={m?.photoURL ? { uri: m.photoURL } : { uri: `https://i.pravatar.cc/150?u=${m.uid}` }}
                style={styles.memberAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.uid === uid ? `${m.name || "You"} (Me)` : m.name || "Unknown"}
                </Text>
                <Text style={styles.memberEmail}>{m.email || m.username || ""}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShareDrawerOpen(true)}>
            <Text style={styles.inviteBtnText}>Invite Members</Text>
          </TouchableOpacity>
        </View>

        {/* ─── BUDGET ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setBudgetDrawerOpen(true)}>
              <Text style={styles.addBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.budgetText}>₹{usedAmount} used of ₹{totalBudget}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${budgetProgress}%` }]} />
          </View>
        </View>

        {/* ─── DANGER ZONE ─── */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setConfirmDeleteOpen(true)}
          >
            <Ionicons name="trash-outline" size={16} color="#ff4444" />
            <Text style={styles.deleteBtnText}>Delete Trip</Text>
          </TouchableOpacity>
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
        inviteLink={`https://bunkmates.app/join?trip=${id}`}
        trip={trip}
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

      {/* Settings drawer */}
      <SettingsDrawer
        settingsDrawerOpen={settingsDrawerOpen}
        setSettingsDrawerOpen={setSettingsDrawerOpen}
        trip={trip}
        tripAdmins={[trip?.createdBy].filter(Boolean)}
        memberDetails={memberDetails}
        tripPermissions={{}}
        updatePermissions={() => {}}
        promoteToAdmin={() => {}}
        demoteAdmin={() => {}}
        mode="dark"
        setConfirmDeleteOpen={setConfirmDeleteOpen}
        getMemberName={getMemberName}
        currentUseruid={uid || ""}
        displaySettings={{ layout: "list", gridCols: 1, listCols: 1, cardType: "regular" }}
        updateDisplaySettings={() => {}}
      />
    </View>
  );
}

/* ──────── STYLES ──────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050505",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050505",
  },
  heroContainer: {
    height: 340,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
    backdropFilter: "blur(20px)" as any,
  },
  headerBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  topRightBtns: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  weatherChip: {
    position: "absolute",
    bottom: 90,
    left: 16,
    backgroundColor: "rgba(20,20,20,0.5)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backdropFilter: "blur(20px)" as any,
  },
  weatherTemp: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  weatherDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    textTransform: "capitalize",
  },
  weatherLoc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#050505",
  },
  contentPad: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  tripTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  infoText: {
    color: "#aaaaaa",
    fontSize: 13,
  },
  routeBox: {
    marginTop: 12,
  },
  routeLabel: {
    color: "#888",
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
    fontSize: 15,
    fontWeight: "800",
  },
  mapsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderColor: "#1e1e1e",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#00e6b0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(0, 230, 176, 0.08)",
  },
  aiBtnText: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "800",
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  addBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: "#666",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 10,
  },
  placeCard: {
    backgroundColor: "#111114",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  placeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  placeName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    marginRight: 8,
  },
  placeTagRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  placeTagOutline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  placeTagOutlineText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
  },
  placeTagGreen: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  placeTagGreenText: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "700",
  },
  placeDesc: {
    color: "#999",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  placeActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  placeActionBtnSolid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 8,
  },
  placeActionBtnSolidText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  placeActionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    paddingVertical: 8,
  },
  placeActionBtnOutlineText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#1e1e1e",
  },
  checkText: {
    color: "#ffffff",
    fontSize: 14,
    flex: 1,
  },
  timelineCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111114",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  timelineTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  timelineTime: {
    color: "#888",
    fontSize: 12,
  },
  viewAllBtn: {
    marginTop: 14,
    alignItems: "center",
    backgroundColor: "#111114",
    borderRadius: 20,
    paddingVertical: 12,
  },
  viewAllBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#222",
  },
  memberName: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  memberEmail: {
    color: "#888",
    fontSize: 12,
    marginTop: 1,
  },
  inviteBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  inviteBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  budgetText: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00e6b0",
    borderRadius: 3,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#ff4444",
    borderRadius: 14,
    paddingVertical: 13,
  },
  deleteBtnText: {
    color: "#ff4444",
    fontSize: 13,
    fontWeight: "700",
  },
});