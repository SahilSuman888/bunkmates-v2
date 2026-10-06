import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Dimensions,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  Keyboard,
  PanResponder,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polyline } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAP_WIDTH = SCREEN_WIDTH - 32;
const MAP_HEIGHT = 300;

/* ──────── Types ──────── */

interface FriendProfile {
  uid: string;
  name: string;
  username: string;
  photoURL: string;
  contribution?: number;
}

interface TimelineItem {
  title: string;
  time: string;
  note: string;
}

interface SearchResult {
  name: string;
  lat: number;
  lon: number;
}

const DEFAULT_NATURE_IMAGE =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop";

const STEPS_LIST = [
  "Route & Map",
  "Dates",
  "Identity & Weather",
  "Budget & Members",
  "Timeline & Checklist",
];

/* ──────── Slippy Map Math (Standard Web Mercator - Works in Expo Go!) ──────── */

function lon2tile(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function lat2tile(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function tile2lon(x: number, zoom: number) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tile2lat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/* ════════════════════════════════════════════════════════════════════
   UNIVERSAL EXPO GO MAP (No Google Maps API Key Needed!)
   ════════════════════════════════════════════════════════════════════ */

const ExpoGoMap = ({
  centerCoords,
  originCoords,
  destCoords,
  routeCoordinates,
  routeSummary,
  fromLocation,
  toLocation,
  zoom,
  onZoomIn,
  onZoomOut,
  onMapTap,
  onPanMap,
}: {
  centerCoords: [number, number];
  originCoords: [number, number] | null;
  destCoords: [number, number] | null;
  routeCoordinates?: [number, number][];
  routeSummary?: { distance: string; duration: string } | null;
  fromLocation: string;
  toLocation: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onMapTap: (lat: number, lon: number) => void;
  onPanMap: (dLat: number, dLon: number) => void;
}) => {
  const centerTileX = lon2tile(centerCoords[1], zoom);
  const centerTileY = lat2tile(centerCoords[0], zoom);

  const baseX = Math.floor(centerTileX);
  const baseY = Math.floor(centerTileY);

  const offsetX = (centerTileX - baseX) * 256;
  const offsetY = (centerTileY - baseY) * 256;

  // Render 3x3 tiles surrounding the center tile
  const tileDeltas = [-1, 0, 1, 2];
  const maxTile = Math.pow(2, zoom);

  // Marker pixel positions
  const getMarkerPixels = (coords: [number, number]) => {
    const tx = lon2tile(coords[1], zoom);
    const ty = lat2tile(coords[0], zoom);
    const px = (tx - centerTileX) * 256 + MAP_WIDTH / 2;
    const py = (ty - centerTileY) * 256 + MAP_HEIGHT / 2;
    return { px, py };
  };

  const originPx = originCoords ? getMarkerPixels(originCoords) : null;
  const destPx = destCoords ? getMarkerPixels(destCoords) : null;

  // Real Google Maps-style turn-by-turn driving route polyline points
  const routeSvgPoints = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) return "";
    const step = Math.max(1, Math.floor(routeCoordinates.length / 350));
    const pts: string[] = [];
    for (let i = 0; i < routeCoordinates.length; i += step) {
      const [lon, lat] = routeCoordinates[i];
      const tx = lon2tile(lon, zoom);
      const ty = lat2tile(lat, zoom);
      const px = (tx - centerTileX) * 256 + MAP_WIDTH / 2;
      const py = (ty - centerTileY) * 256 + MAP_HEIGHT / 2;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    const last = routeCoordinates[routeCoordinates.length - 1];
    const tx = lon2tile(last[0], zoom);
    const ty = lat2tile(last[1], zoom);
    pts.push(
      `${((tx - centerTileX) * 256 + MAP_WIDTH / 2).toFixed(1)},${((ty - centerTileY) * 256 + MAP_HEIGHT / 2).toFixed(1)}`
    );
    return pts.join(" ");
  }, [routeCoordinates, zoom, centerTileX, centerTileY]);

  const initialPinchDistanceRef = useRef<number | null>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
        },
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            initialPinchDistanceRef.current = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
          } else {
            initialPinchDistanceRef.current = null;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          // Two-finger Pinch to Zoom
          if (evt.nativeEvent.touches.length === 2) {
            const [t1, t2] = evt.nativeEvent.touches;
            const currentDist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
            if (initialPinchDistanceRef.current) {
              const diff = currentDist - initialPinchDistanceRef.current;
              if (diff > 35) {
                onZoomIn();
                initialPinchDistanceRef.current = currentDist;
              } else if (diff < -35) {
                onZoomOut();
                initialPinchDistanceRef.current = currentDist;
              }
            } else {
              initialPinchDistanceRef.current = currentDist;
            }
            return;
          }

          // Single-finger Smooth Drag to Pan
          if (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2) {
            const worldPixels = 256 * Math.pow(2, zoom);
            const dLon = -(gestureState.dx / worldPixels) * 360 * 0.04;
            const dLat = (gestureState.dy / worldPixels) * 180 * 0.04;
            onPanMap(dLat, dLon);
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          initialPinchDistanceRef.current = null;
          // ONLY trigger a deliberate map tap if displacement is very small (< 7px) - eliminates accidental clicks when zooming or panning!
          if (Math.abs(gestureState.dx) < 7 && Math.abs(gestureState.dy) < 7) {
            const { locationX, locationY } = evt.nativeEvent;
            const clickTx = centerTileX + (locationX - MAP_WIDTH / 2) / 256;
            const clickTy = centerTileY + (locationY - MAP_HEIGHT / 2) / 256;
            const clickLat = tile2lat(clickTy, zoom);
            const clickLon = tile2lon(clickTx, zoom);
            onMapTap(clickLat, clickLon);
          }
        },
      }),
    [centerTileX, centerTileY, zoom, onZoomIn, onZoomOut, onPanMap, onMapTap]
  );

  return (
    <View {...panResponder.panHandlers} style={s.mapContainer}>
      {/* Tile Grid */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {tileDeltas.map((dx) =>
          tileDeltas.map((dy) => {
            const tx = (baseX + dx + maxTile) % maxTile;
            const ty = baseY + dy;
            if (ty < 0 || ty >= maxTile) return null;

            const left = MAP_WIDTH / 2 - offsetX + dx * 256;
            const top = MAP_HEIGHT / 2 - offsetY + dy * 256;

            return (
              <ExpoImage
                key={`${zoom}-${tx}-${ty}`}
                source={{
                  uri: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`,
                }}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: 256,
                  height: 256,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            );
          })
        )}
      </View>

      {/* Dark tint overlay for sleek dark mode travel aesthetics */}
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10, 14, 24, 0.42)" }]}
        pointerEvents="none"
      />

      {/* Google Maps Real Turn-by-Turn Driving Route Line */}
      {routeSvgPoints ? (
        <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {/* Outer high-contrast navy outline */}
          <Polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#1d4ed8"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner Google Maps Navigation Blue */}
          <Polyline
            points={routeSvgPoints}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}

      {/* Google Maps Route Distance & Duration Summary Pill */}
      {routeSummary && (
        <View style={s.routeSummaryPill} pointerEvents="none">
          <Ionicons name="car" size={13} color="#38bdf8" />
          <Text style={s.routeSummaryText}>
            {routeSummary.duration} • {routeSummary.distance}
          </Text>
        </View>
      )}

      {/* Origin Pin (Green) */}
      {originPx &&
        originPx.px >= -20 &&
        originPx.px <= MAP_WIDTH + 20 &&
        originPx.py >= -20 &&
        originPx.py <= MAP_HEIGHT + 20 && (
          <View
            style={[s.mapMarkerWrap, { left: originPx.px - 14, top: originPx.py - 28 }]}
            pointerEvents="none"
          >
            <View style={s.greenMarkerPill}>
              <Ionicons name="location-sharp" size={16} color="#ffffff" />
            </View>
            <View style={s.markerBadge}>
              <Text style={s.markerBadgeText} numberOfLines={1}>
                {fromLocation?.split(",")[0] || "Origin"}
              </Text>
            </View>
          </View>
        )}

      {/* Destination Pin (Red) */}
      {destPx &&
        destPx.px >= -20 &&
        destPx.px <= MAP_WIDTH + 20 &&
        destPx.py >= -20 &&
        destPx.py <= MAP_HEIGHT + 20 && (
          <View
            style={[s.mapMarkerWrap, { left: destPx.px - 14, top: destPx.py - 28 }]}
            pointerEvents="none"
          >
            <View style={s.redMarkerPill}>
              <Ionicons name="flag" size={14} color="#ef4444" />
            </View>
            <View style={s.markerBadge}>
              <Text style={s.markerBadgeText} numberOfLines={1}>
                {toLocation?.split(",")[0] || "Destination"}
              </Text>
            </View>
          </View>
        )}

      {/* Zoom Controls (+ and −) */}
      <View style={s.mapZoomControls}>
        <Pressable onPress={onZoomIn} style={s.mapZoomBtn} hitSlop={6}>
          <Text style={{ color: "#000", fontWeight: "900", fontSize: 17 }}>+</Text>
        </Pressable>
        <Pressable
          onPress={onZoomOut}
          style={[s.mapZoomBtn, { borderTopWidth: 1, borderColor: "#e2e8f0" }]}
          hitSlop={6}
        >
          <Text style={{ color: "#000", fontWeight: "900", fontSize: 17 }}>−</Text>
        </Pressable>
      </View>

      {/* Attribution Badge */}
      <View style={s.mapAttr}>
        <Text style={s.mapAttrText}>© Esri • OpenStreetMap</Text>
      </View>
    </View>
  );
};

/* ── Multi-provider geocoder with zero rate limit ── */
const searchLocations = async (query: string): Promise<SearchResult[]> => {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  // 1. Nominatim with custom User-Agent
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        q
      )}&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent": "BunkMatesApp/2.0 (contact@bunkmates.app)",
          "Accept-Language": "en",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((d: any) => ({
          name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
        }));
      }
    }
  } catch (e) {
    console.log("Nominatim failed, trying fallback:", e);
  }

  // 2. Photon (Komoot OSM - open-source geocoder, no rate-limits)
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=en`
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.features?.length > 0) {
        return data.features.map((f: any) => {
          const p = f.properties;
          const labelParts = [p.name, p.city || p.town, p.state, p.country].filter(Boolean);
          return {
            name: labelParts.join(", "),
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          };
        });
      }
    }
  } catch (e) {
    console.log("Photon fallback failed:", e);
  }

  return [];
};

/* ════════════════════════════════════════════════════════════════════
   AIRBNB-STYLE INTERACTIVE CALENDAR COMPONENT (Image 2)
   ════════════════════════════════════════════════════════════════════ */

const AirbnbStyleCalendar = ({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const handleDateClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, "");
    } else if (startDate && !endDate) {
      if (new Date(dateStr) < new Date(startDate)) {
        onChange(dateStr, "");
      } else {
        onChange(startDate, dateStr);
      }
    }
  };

  const renderMonth = (monthOffset: number) => {
    const targetDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + monthOffset,
      1
    );
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = targetDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });

    const days: React.ReactNode[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${monthOffset}-${i}`} style={cal.emptyCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(day).padStart(2, "0");
      const dateStr = `${year}-${mStr}-${dStr}`;

      const isStart = startDate === dateStr;
      const isEnd = endDate === dateStr;
      const inRange =
        startDate &&
        endDate &&
        new Date(dateStr) > new Date(startDate) &&
        new Date(dateStr) < new Date(endDate);

      days.push(
        <Pressable
          key={dateStr}
          onPress={() => handleDateClick(dateStr)}
          style={[
            cal.dayCell,
            (isStart || isEnd) && cal.dayCellSelected,
            inRange && cal.dayCellRange,
          ]}
        >
          <Text
            style={[
              cal.dayText,
              (isStart || isEnd) && cal.dayTextSelected,
              inRange && cal.dayTextRange,
            ]}
          >
            {day}
          </Text>
        </Pressable>
      );
    }

    return (
      <View key={monthOffset} style={cal.monthWrapper}>
        <Text style={cal.monthTitle}>{monthName}</Text>
        <View style={cal.weekHeader}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text key={d} style={cal.weekHeaderText}>
              {d}
            </Text>
          ))}
        </View>
        <View style={cal.daysGrid}>{days}</View>
      </View>
    );
  };

  return (
    <View style={cal.card}>
      {/* Navigation Header */}
      <View style={cal.navHeader}>
        <Pressable
          onPress={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
            )
          }
          style={cal.navBtn}
        >
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>

        <Text style={cal.statusText}>
          {startDate
            ? `Start: ${startDate} ${endDate ? `→ End: ${endDate}` : ""}`
            : "Select Start Date"}
        </Text>

        <Pressable
          onPress={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
            )
          }
          style={cal.navBtn}
        >
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Two months stacked vertically matching Image 2 */}
      {renderMonth(0)}
      {renderMonth(1)}
    </View>
  );
};

/* ════════════════════════════════════════════════════════════════════
   MAIN CREATE TRIP SHEET COMPONENT
   ════════════════════════════════════════════════════════════════════ */

export default function CreateTripSheet({
  visible,
  onClose,
  initialPlace,
}: {
  visible: boolean;
  onClose: () => void;
  initialPlace?: any;
}) {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  /* ── Stepper State (Can be switched freely by clicking upper tabs) ── */
  const [activeStep, setActiveStep] = useState(0);

  /* ── Trip State ── */
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>([26.9124, 75.7873]); // Default Jaipur
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [activeMapField, setActiveMapField] = useState<"from" | "to">("from");

  // Map view center and zoom level (Works in Expo Go!)
  const [mapCenter, setMapCenter] = useState<[number, number]>([26.9124, 75.7873]);
  const [mapZoom, setMapZoom] = useState(6);

  // Google Maps Driving Route
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null);

  // Autocomplete Suggestions
  const [fromResults, setFromResults] = useState<SearchResult[]>([]);
  const [toResults, setToResults] = useState<SearchResult[]>([]);
  const searchDebounceRef = useRef<any>(null);

  // Dates
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Identity & Weather
  const [tripName, setTripName] = useState("");
  const [tripDescription, setTripDescription] = useState("");
  const [iconURL, setIconURL] = useState(DEFAULT_NATURE_IMAGE);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  // Budget & Members
  const [totalBudget, setTotalBudget] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "manual" | "auto">("equal");
  const [friendSuggestions, setFriendSuggestions] = useState<FriendProfile[]>([]);
  const [activeMembers, setActiveMembers] = useState<FriendProfile[]>([]);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  // Timeline & Checklist (Step 5)
  const [previewTimeline, setPreviewTimeline] = useState<TimelineItem[]>([]);
  const [previewChecklist, setPreviewChecklist] = useState<string[]>([
    "Government IDs & Passports",
    "Booking Confirmations & Tickets",
    "Phone Chargers & Power Banks",
    "Personal First Aid & Medicines",
    "Weather-Appropriate Clothing",
  ]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [isSavingStep5, setIsSavingStep5] = useState(false);

  /* ── Initialize with Creator ── */
  useEffect(() => {
    if (visible && user) {
      setActiveStep(0);
      setActiveMembers([
        {
          uid: user.uid,
          name: user.displayName || "You",
          username: user.email?.split("@")[0] || "you",
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/identicon/png?seed=${user.uid}`,
          contribution: 0,
        },
      ]);
    }
  }, [visible, user]);

  /* ── Prefill from initialPlace ── */
  useEffect(() => {
    if (visible && initialPlace) {
      setToLocation(initialPlace.name || "");
      if (initialPlace.coordinates) {
        const coords: [number, number] = [
          initialPlace.coordinates.latitude,
          initialPlace.coordinates.longitude,
        ];
        setDestCoords(coords);
        setMapCenter(coords);
      }
      if (initialPlace.images && initialPlace.images[0]) {
        setIconURL(initialPlace.images[0]);
      }
    }
  }, [visible, initialPlace]);

  const [isLocating, setIsLocating] = useState(false);

  /* ── Trigger "Use My Current Location" ── */
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow location access to use your current location.");
        setIsLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      setOriginCoords([lat, lon]);
      setMapCenter([lat, lon]);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { "User-Agent": "BunkMatesApp/2.0" } }
      );
      const data = await res.json();
      const city =
        data.display_name ||
        data.address?.city ||
        data.address?.town ||
        data.address?.state_district ||
        data.address?.state ||
        "My Current Location";
      setFromLocation(city);
      setFromResults([]);
      Keyboard.dismiss();
    } catch (e) {
      console.log("GPS Location error:", e);
      Alert.alert("Location Error", "Could not fetch current location. Please try again.");
    } finally {
      setIsLocating(false);
    }
  };

  /* ── Auto-resolve GPS Location on mount ── */
  useEffect(() => {
    if (visible && !fromLocation) {
      handleUseCurrentLocation();
    }
  }, [visible]);

  /* ── Fetch Friends for Step 4 ── */
  useEffect(() => {
    if (!visible || !user?.uid) return;
    (async () => {
      try {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        const friends = userDocSnap.exists() ? userDocSnap.data()?.friends || [] : [];
        const fetched: FriendProfile[] = [];
        for (const fid of friends.slice(0, 20)) {
          try {
            const fSnap = await getDoc(doc(db, "users", fid));
            if (fSnap.exists()) {
              const d = fSnap.data();
              fetched.push({
                uid: fid,
                name: d.name || d.displayName || d.username || "BunkMate",
                username: d.username || "bunkmate",
                photoURL: d.photoURL || `https://api.dicebear.com/7.x/identicon/png?seed=${fid}`,
                contribution: 0,
              });
            }
          } catch {}
        }
        setFriendSuggestions(fetched);
      } catch (e) {
        console.log("Failed to fetch friends:", e);
      }
    })();
  }, [visible, user?.uid]);

  /* ── User Typing Handler for "From" (debounced search only on physical typing!) ── */
  const handleFromTextChange = (text: string) => {
    setFromLocation(text);
    setActiveMapField("from");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!text || text.trim().length < 2) {
      setFromResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const res = await searchLocations(text);
      setFromResults(res);
    }, 300);
  };

  /* ── User Typing Handler for "To" (debounced search only on physical typing!) ── */
  const handleToTextChange = (text: string) => {
    setToLocation(text);
    setActiveMapField("to");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!text || text.trim().length < 2) {
      setToResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const res = await searchLocations(text);
      setToResults(res);
    }, 300);
  };

  /* ── Select Suggestion (Closes dropdown permanently without re-triggering search!) ── */
  const handleSelectFrom = (item: SearchResult) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setFromLocation(item.name);
    setOriginCoords([item.lat, item.lon]);
    setMapCenter([item.lat, item.lon]);
    setFromResults([]);
    Keyboard.dismiss();
  };

  const handleSelectTo = (item: SearchResult) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setToLocation(item.name);
    setDestCoords([item.lat, item.lon]);
    setMapCenter([item.lat, item.lon]);
    setToResults([]);
    Keyboard.dismiss();
  };

  /* ── Fit Both Markers when available ── */
  useEffect(() => {
    if (originCoords && destCoords) {
      const midLat = (originCoords[0] + destCoords[0]) / 2;
      const midLon = (originCoords[1] + destCoords[1]) / 2;
      setMapCenter([midLat, midLon]);
      const latDiff = Math.abs(originCoords[0] - destCoords[0]);
      if (latDiff > 10) setMapZoom(4);
      else if (latDiff > 4) setMapZoom(5);
      else setMapZoom(6);
    }
  }, [originCoords, destCoords]);

  /* ── Fetch Real Google Maps-style Driving Route from OSRM ── */
  useEffect(() => {
    if (!originCoords || !destCoords) {
      setRouteCoordinates([]);
      setRouteSummary(null);
      return;
    }

    const [fromLat, fromLon] = originCoords;
    const [toLat, toLon] = destCoords;

    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { headers: { "User-Agent": "BunkMatesApp/2.0" } });
        if (res.ok) {
          const data = await res.json();
          if (data.code === "Ok" && data.routes?.[0]) {
            const r = data.routes[0];
            setRouteCoordinates(r.geometry.coordinates);
            const distKm = Math.round(r.distance / 1000);
            const hours = Math.floor(r.duration / 3600);
            const mins = Math.round((r.duration % 3600) / 60);
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
            setRouteSummary({ distance: `${distKm} km`, duration: timeStr });
          }
        }
      } catch (e) {
        console.log("OSRM routing fetch error:", e);
      }
    })();
  }, [originCoords, destCoords]);

  /* ── Live Weather Fetch via Open-Meteo for Destination ── */
  useEffect(() => {
    if (!destCoords) return;
    (async () => {
      setIsWeatherLoading(true);
      try {
        const [lat, lon] = destCoords;
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
        );
        const data = await res.json();
        setWeatherData(data);
      } catch (e) {
        console.log("Weather fetch error:", e);
      }
      setIsWeatherLoading(false);
    })();
  }, [destCoords]);

  /* ── Auto AI Trip Name & Description Suggestions ── */
  useEffect(() => {
    if (fromLocation && toLocation) {
      const cleanFrom = fromLocation.split(",")[0].trim();
      const cleanTo = toLocation.split(",")[0].trim();
      if (!tripName || tripName.includes("Adventure") || tripName.includes("Trip")) {
        setTripName(`${cleanFrom} to ${cleanTo} Adventure`);
      }
      if (!tripDescription) {
        setTripDescription(
          `An unforgettable road trip and scenic journey from ${cleanFrom} to ${cleanTo}. Includes exploration, bunking with friends, and discovering local landmarks.`
        );
      }
    }
  }, [fromLocation, toLocation]);

  /* ── Generate Day-by-day Timeline and Checklist ── */
  const generateTimelineAndChecklist = () => {
    const sD = startDate ? new Date(startDate) : new Date();
    const eD = endDate ? new Date(endDate) : new Date(sD.getTime() + 86400000);
    const diffDays = Math.max(1, Math.round((eD.getTime() - sD.getTime()) / 86400000) + 1);

    const cleanFrom = fromLocation ? fromLocation.split(",")[0].trim() : "Origin";
    const cleanTo = toLocation ? toLocation.split(",")[0].trim() : "Destination";

    const items: TimelineItem[] = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(sD);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
      let title = `Day ${i + 1} - Main Destination Exploration`;
      let note = `Visit key local attractions and hotspots in ${cleanTo}, experience local food and culture.`;
      if (i === 0) {
        title = "Day 1 - Arrival & Check-in";
        note = `Travel from ${cleanFrom} to ${cleanTo}, check into accommodations, and settle in.`;
      } else if (i === diffDays - 1) {
        title = `Day ${i + 1} - Final Exploration & Departure`;
        note = `Souvenir shopping, local market exploration, and comfortable return journey back to ${cleanFrom}.`;
      }
      items.push({
        title,
        time: `${dateStr}, 10:00 am`,
        note,
      });
    }
    setPreviewTimeline(items);

    if (previewChecklist.length === 0) {
      setPreviewChecklist([
        "Government IDs & Passports",
        "Booking Confirmations & Tickets",
        "Phone Chargers & Power Banks",
        "Personal First Aid & Medicines",
        `Weather Appropriate Clothing for ${cleanTo}`,
        `Group Snacks & Water Bottles (${activeMembers.length} travelers)`,
      ]);
    }
  };

  /* ── Split Mode Calculation Handlers ── */
  const handleSplitModeChange = (mode: "equal" | "manual" | "auto") => {
    setSplitMode(mode);
    const bNum = parseFloat(totalBudget) || 0;
    if (activeMembers.length === 0) return;

    if (mode === "equal" || mode === "auto") {
      const share = Math.round(bNum / activeMembers.length);
      setActiveMembers((prev) => prev.map((m) => ({ ...m, contribution: share })));
    }
  };

  const handleTotalBudgetChange = (val: string) => {
    setTotalBudget(val);
    const bNum = parseFloat(val) || 0;
    if (splitMode === "equal" || splitMode === "auto") {
      if (activeMembers.length > 0) {
        const share = Math.round(bNum / activeMembers.length);
        setActiveMembers((prev) => prev.map((m) => ({ ...m, contribution: share })));
      }
    }
  };

  const handleContributionChange = (uid: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    const updated = activeMembers.map((m) => (m.uid === uid ? { ...m, contribution: num } : m));
    setActiveMembers(updated);

    if (splitMode === "manual" || splitMode === "auto") {
      const sum = updated.reduce((s, m) => s + (m.contribution || 0), 0);
      setTotalBudget(sum > 0 ? String(sum) : "");
    }
  };

  /* ── Step 4 Next Step Handler (No premature Firestore save!) ── */
  const handleProceedToStep5 = () => {
    if (!tripName.trim()) {
      const autoName = `${fromLocation.split(",")[0] || "Origin"} to ${toLocation.split(",")[0] || "Destination"} Trip`;
      setTripName(autoName);
    }
    generateTimelineAndChecklist();
    setActiveStep(4);
  };

  /* ── Step 5: Finish and Save Everything to Firestore ── */
  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinishAndSaveTrip = async (skipTimeline = false) => {
    if (!user) return;
    setIsFinishing(true);

    const finalTripName =
      tripName.trim() ||
      `${fromLocation.split(",")[0] || "Origin"} to ${toLocation.split(",")[0] || "Destination"} Trip`;

    try {
      const members = activeMembers.map((m) => m.uid);
      const contributors = activeMembers.map((m) => ({
        uid: m.uid,
        name: m.name || m.username,
        amount: m.contribution || 0,
      }));
      const total =
        contributors.reduce((sum, c) => sum + (c.amount || 0), 0) ||
        parseFloat(totalBudget) ||
        0;
      const finalLocation = toLocation || fromLocation || "Destination";

      // 1) Trip document in Firestore
      const tripDoc = await addDoc(collection(db, "trips"), {
        name: finalTripName,
        from: fromLocation,
        to: toLocation,
        location: finalLocation,
        description: tripDescription || `Road trip to ${finalLocation}`,
        startDate: startDate || "",
        endDate: endDate || "",
        budget: total.toString(),
        members,
        iconURL: iconURL || DEFAULT_NATURE_IMAGE,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      const tripId = tripDoc.id;

      // 2) Group Chat document (doc ID = tripId)
      await setDoc(doc(db, "groupChats", tripId), {
        tripId,
        name: finalTripName,
        members,
        description: tripDescription || `Group chat for ${finalTripName}`,
        iconURL: iconURL || DEFAULT_NATURE_IMAGE,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      // 3) Budgets document (doc ID = tripId)
      await setDoc(doc(db, "budgets", tripId), {
        tripId,
        tripName: finalTripName,
        total,
        used: 0,
        contributors,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
      });

      // 4) Subcollections: timeline & checklist
      if (!skipTimeline) {
        const timelineRef = collection(db, "trips", tripId, "timeline");
        for (const item of previewTimeline) {
          if (item.title?.trim()) {
            await addDoc(timelineRef, {
              title: item.title,
              time: item.time,
              note: item.note || "",
              completed: false,
              createdBy: user.uid,
              createdAt: new Date().toISOString(),
            });
          }
        }

        const checklistRef = collection(db, "trips", tripId, "checklist");
        for (const itemText of previewChecklist) {
          if (itemText?.trim()) {
            await addDoc(checklistRef, {
              text: itemText.trim(),
              completed: false,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      Alert.alert("Success 🎉", `Trip "${finalTripName}" has been created!`);
      onClose();
    } catch (err) {
      console.log("Error creating trip in Step 5:", err);
      Alert.alert("Error", "Could not create trip. Please try again.");
    } finally {
      setIsFinishing(false);
    }
  };

  /* ── Location Swap ── */
  const handleSwap = () => {
    const tempLoc = fromLocation;
    const tempCoords = originCoords;
    setFromLocation(toLocation);
    setOriginCoords(destCoords);
    setToLocation(tempLoc);
    setDestCoords(tempCoords);
    setFromResults([]);
    setToResults([]);
  };

  /* ── Image Upload with Base64 Conversion ── */
  const handlePickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Please allow access to photos to select a cover.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.6,
      });
      if (res.canceled || !res.assets || !res.assets[0]) return;

      const uri = res.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUri = `data:image/jpeg;base64,${base64}`;
      setIconURL(dataUri);
    } catch (e) {
      console.log("Photo pick error:", e);
    }
  };

  /* ── Add / Remove Members ── */
  const handleAddMember = (friend: FriendProfile) => {
    if (activeMembers.some((m) => m.uid === friend.uid)) return;
    setActiveMembers((prev) => [...prev, { ...friend, contribution: 0 }]);
  };

  const handleRemoveMember = (uid: string) => {
    if (uid === user?.uid) return;
    setActiveMembers((prev) => prev.filter((m) => m.uid !== uid));
  };

  /* ════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════ */

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[s.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          {/* Top Header */}
          <View style={s.topHeader}>
            <View>
              <Text style={s.headerTitle}>Create a Trip</Text>
              <Text style={s.headerSub}>
                Step {activeStep + 1} of 5 — {STEPS_LIST[activeStep]}
              </Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Stepper Horizontal Tabs - Clickable to freely switch between steps! */}
          <View style={s.stepperWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stepperRow}>
              {STEPS_LIST.map((stepName, idx) => {
                const isActive = activeStep === idx;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setFromResults([]);
                      setToResults([]);
                      if (idx === 4) {
                        generateTimelineAndChecklist();
                      }
                      setActiveStep(idx);
                    }}
                    style={[s.stepPill, isActive && s.stepPillActive]}
                  >
                    <Text style={[s.stepPillText, isActive && s.stepPillTextActive]}>
                      {idx + 1}. {stepName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ══════════════════════════════════════════════════════════
             STEP 1: Route & Map (Image 1)
             ══════════════════════════════════════════════════════════ */}
          {activeStep === 0 && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Inputs & Swap Row */}
              <View style={s.routeRow}>
                <View style={{ flex: 1, gap: 10 }}>
                  {/* From Input */}
                  <View style={[s.locInputBox, activeMapField === "from" && s.locInputBoxFocused]}>
                    <View style={s.inputHeaderRow}>
                      <Text style={s.inputLabel}>From (Origin)</Text>
                      <Pressable
                        onPress={handleUseCurrentLocation}
                        disabled={isLocating}
                        style={s.useLocationBtn}
                        hitSlop={6}
                      >
                        {isLocating ? (
                          <ActivityIndicator size="small" color="#ffffff" style={{ transform: [{ scale: 0.65 }] }} />
                        ) : (
                          <Ionicons name="navigate-circle" size={13} color="#ffffff" />
                        )}
                        <Text style={s.useLocationText}>
                          {isLocating ? "Detecting..." : "Use Current Location"}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={s.inputInner}>
                      <Ionicons name="location-sharp" size={16} color="#ffffff" />
                      <TextInput
                        value={fromLocation}
                        onChangeText={handleFromTextChange}
                        placeholder="Search starting location"
                        placeholderTextColor="#666"
                        style={s.locTextInput}
                        onFocus={() => {
                          setActiveMapField("from");
                          setToResults([]);
                        }}
                      />
                      {fromLocation ? (
                        <Pressable
                          onPress={() => {
                            setFromLocation("");
                            setFromResults([]);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={16} color="#888" />
                        </Pressable>
                      ) : (
                        <Pressable onPress={handleUseCurrentLocation} hitSlop={8}>
                          <Ionicons name="locate" size={18} color="#ffffff" />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {/* To Input */}
                  <View style={[s.locInputBox, activeMapField === "to" && s.locInputBoxFocused]}>
                    <Text style={s.inputLabel}>To (Destination)</Text>
                    <View style={s.inputInner}>
                      <Ionicons name="map" size={16} color="#ef4444" />
                      <TextInput
                        value={toLocation}
                        onChangeText={handleToTextChange}
                        placeholder="Search destination location"
                        placeholderTextColor="#666"
                        style={s.locTextInput}
                        onFocus={() => {
                          setActiveMapField("to");
                          setFromResults([]);
                        }}
                      />
                      {toLocation ? (
                        <Pressable
                          onPress={() => {
                            setToLocation("");
                            setToResults([]);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={16} color="#888" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Swap Button */}
                <Pressable onPress={handleSwap} style={s.swapBtn}>
                  <Ionicons name="swap-vertical" size={20} color="#fff" />
                </Pressable>
              </View>

              {/* Suggestions Dropdown for Origin */}
              {activeMapField === "from" && fromResults.length > 0 && (
                <View style={s.dropdownCard}>
                  {fromResults.map((item, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handleSelectFrom(item)}
                      style={s.dropdownItem}
                    >
                      <Ionicons name="location-sharp" size={15} color="#ffffff" />
                      <Text style={s.dropdownText} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Suggestions Dropdown for Destination */}
              {activeMapField === "to" && toResults.length > 0 && (
                <View style={s.dropdownCard}>
                  {toResults.map((item, i) => (
                    <Pressable
                      key={i}
                      onPress={() => handleSelectTo(item)}
                      style={s.dropdownItem}
                    >
                      <Ionicons name="flag" size={15} color="#ef4444" />
                      <Text style={s.dropdownText} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Map Target Toggle Status */}
              <View style={s.mapStatusRow}>
                <Text style={s.mapStatusText}>Currently clicking on map places: </Text>
                <Pressable
                  onPress={() => {
                    setFromResults([]);
                    setToResults([]);
                    setActiveMapField(activeMapField === "from" ? "to" : "from");
                  }}
                  style={s.mapToggleBadge}
                >
                  <Text style={s.mapToggleText}>{activeMapField.toUpperCase()}</Text>
                  <Ionicons name="swap-horizontal" size={12} color="#ffffff" />
                </Pressable>
              </View>

              {/* UNIVERSAL EXPO GO MAP (Guaranteed to render in Expo Go on Android!) */}
              <ExpoGoMap
                centerCoords={mapCenter}
                originCoords={originCoords}
                destCoords={destCoords}
                routeCoordinates={routeCoordinates}
                routeSummary={routeSummary}
                fromLocation={fromLocation}
                toLocation={toLocation}
                zoom={mapZoom}
                onZoomIn={() => setMapZoom((prev) => Math.min(14, prev + 1))}
                onZoomOut={() => setMapZoom((prev) => Math.max(3, prev - 1))}
                onMapTap={async (lat, lon) => {
                  setFromResults([]);
                  setToResults([]);
                  Keyboard.dismiss();
                  if (activeMapField === "from") {
                    setOriginCoords([lat, lon]);
                  } else {
                    setDestCoords([lat, lon]);
                  }

                  try {
                    const res = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
                      { headers: { "User-Agent": "BunkMatesApp/2.0" } }
                    );
                    const d = await res.json();
                    const place = d.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    if (activeMapField === "from") setFromLocation(place);
                    else setToLocation(place);
                  } catch {
                    const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    if (activeMapField === "from") setFromLocation(fallback);
                    else setToLocation(fallback);
                  }
                }}
                onPanMap={(dLat, dLon) => {
                  setMapCenter(([cLat, cLon]) => [cLat + dLat, cLon + dLon]);
                }}
              />

              {/* Bottom Buttons */}
              <View style={s.btnRow}>
                <Pressable onPress={onClose} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!fromLocation.trim() || !toLocation.trim()) {
                      Alert.alert("Required", "Please specify both starting location and destination.");
                      return;
                    }
                    setFromResults([]);
                    setToResults([]);
                    setActiveStep(1);
                  }}
                  style={s.nextBtn}
                >
                  <Text style={s.nextText}>Next: Select Dates</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ══════════════════════════════════════════════════════════
             STEP 2: Dates (Image 2)
             ══════════════════════════════════════════════════════════ */}
          {activeStep === 1 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={s.stepHeading}>Select Travel Schedule (Interactive Calendar)</Text>

              <AirbnbStyleCalendar
                startDate={startDate}
                endDate={endDate}
                onChange={(sDate, eDate) => {
                  setStartDate(sDate);
                  setEndDate(eDate);
                }}
              />

              <View style={s.btnRow}>
                <Pressable onPress={() => setActiveStep(0)} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!startDate || !endDate) {
                      Alert.alert("Required", "Please select travel dates from the calendar.");
                      return;
                    }
                    setActiveStep(2);
                  }}
                  style={s.nextBtn}
                >
                  <Text style={s.nextText}>Next: Identity & Weather</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ══════════════════════════════════════════════════════════
             STEP 3: Identity & Weather (Image 3)
             ══════════════════════════════════════════════════════════ */}
          {activeStep === 2 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Live Destination Weather Card (Matching Image 3) */}
              <View style={s.weatherCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 16 }}>☀️</Text>
                  <Text style={s.weatherTitle}>Live Destination Weather & Travel Indicator</Text>
                </View>

                {isWeatherLoading ? (
                  <Text style={s.weatherSub}>Fetching destination weather analysis...</Text>
                ) : weatherData?.current_weather ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
                      {weatherData.current_weather.temperature}°C
                    </Text>
                    <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                      Ideal Time to Visit • Weather conditions are favorable for outdoors.
                    </Text>
                  </View>
                ) : (
                  <Text style={s.weatherSub}>Fetching destination weather analysis...</Text>
                )}
              </View>

              {/* Photo Upload Section */}
              <View style={s.photoSection}>
                <ExpoImage source={{ uri: iconURL }} style={s.photoPreview} contentFit="cover" />
                <Pressable onPress={handlePickPhoto} style={s.uploadBtn}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#000" />
                  <Text style={s.uploadText}>Upload Photo</Text>
                </Pressable>
              </View>

              {/* Trip Name Input with AI Sparkle Icon */}
              <View style={s.inputWrap}>
                <Text style={s.inputWrapLabel}>Trip Name (Auto-Suggested by AI)</Text>
                <View style={s.inputRowWithIcon}>
                  <TextInput
                    value={tripName}
                    onChangeText={setTripName}
                    placeholder="e.g. Jaipur to Pokhara Adventure"
                    placeholderTextColor="#666"
                    style={s.mainInput}
                  />
                  <Ionicons name="sparkles" size={18} color="#ffffff" />
                </View>
              </View>

              {/* Trip Description Multiline */}
              <View style={s.inputWrap}>
                <Text style={s.inputWrapLabel}>Trip Description (Auto-Generated & Editable)</Text>
                <TextInput
                  value={tripDescription}
                  onChangeText={setTripDescription}
                  placeholder="Enter details about this trip..."
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  style={[s.mainInput, { height: 75, textAlignVertical: "top", paddingTop: 10 }]}
                />
              </View>

              {/* Bottom Buttons */}
              <View style={s.btnRow}>
                <Pressable onPress={() => setActiveStep(1)} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!tripName.trim()) {
                      Alert.alert("Required", "Please enter a trip name.");
                      return;
                    }
                    setActiveStep(3);
                  }}
                  style={s.nextBtn}
                >
                  <Text style={s.nextText}>Next: Budget & Members</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ══════════════════════════════════════════════════════════
             STEP 4: Budget & Members (Image 4)
             ══════════════════════════════════════════════════════════ */}
          {activeStep === 3 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={s.stepHeading}>Add Friends</Text>

              {/* Horizontal Scroll Friend Cards */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friendCardsRow}>
                {friendSuggestions.length > 0 ? (
                  friendSuggestions.map((f) => (
                    <View key={f.uid} style={s.friendCard}>
                      <ExpoImage source={{ uri: f.photoURL }} style={s.friendCardAv} contentFit="cover" />
                      <Text style={s.friendCardName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Pressable onPress={() => handleAddMember(f)} style={s.friendAddBtn}>
                        <Text style={s.friendAddText}>+ Add</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <View style={[s.friendCard, { width: 140, justifyContent: "center" }]}>
                    <Text style={{ color: "#888", fontSize: 11, textAlign: "center" }}>No friends found yet</Text>
                  </View>
                )}
              </ScrollView>

              {/* Selected Members Chips */}
              <View style={s.chipsWrap}>
                {activeMembers.map((m) => (
                  <View key={m.uid} style={s.memberChip}>
                    <ExpoImage source={{ uri: m.photoURL }} style={s.chipAv} contentFit="cover" />
                    <Text style={s.chipName}>{m.name}</Text>
                    {m.uid !== user?.uid && (
                      <Pressable onPress={() => handleRemoveMember(m.uid)} hitSlop={6}>
                        <Ionicons name="close-circle" size={16} color="#aaa" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>

              {/* Total Budget Input */}
              <View style={s.inputWrap}>
                <Text style={s.inputWrapLabel}>Total Budget</Text>
                <View style={s.budgetInputRow}>
                  <Text style={s.currPrefix}>₹</Text>
                  <TextInput
                    value={totalBudget}
                    onChangeText={handleTotalBudgetChange}
                    placeholder="Enter total amount"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    style={s.budgetTextInput}
                  />
                </View>
              </View>

              {/* Split Method Segmented Control */}
              <Text style={s.stepHeading}>Split Method</Text>
              <View style={s.splitBar}>
                <Pressable
                  onPress={() => handleSplitModeChange("equal")}
                  style={[s.splitBtn, splitMode === "equal" && s.splitBtnActive]}
                >
                  <Text style={[s.splitText, splitMode === "equal" && s.splitTextActive]}>EQUAL</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSplitModeChange("manual")}
                  style={[s.splitBtn, splitMode === "manual" && s.splitBtnActive]}
                >
                  <Text style={[s.splitText, splitMode === "manual" && s.splitTextActive]}>MANUAL</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSplitModeChange("auto")}
                  style={[s.splitBtn, splitMode === "auto" && s.splitBtnActive]}
                >
                  <Ionicons
                    name="calculator-outline"
                    size={14}
                    color={splitMode === "auto" ? "#ffffff" : "rgba(255,255,255,0.6)"}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[s.splitText, splitMode === "auto" && s.splitTextActive]}>AUTO</Text>
                </Pressable>
              </View>

              {/* Member Contribution Rows */}
              <View style={{ gap: 10, marginTop: 12 }}>
                {activeMembers.map((m) => (
                  <View key={m.uid} style={s.contribRow}>
                    <ExpoImage source={{ uri: m.photoURL }} style={s.contribAv} contentFit="cover" />
                    <Text style={s.contribName}>{m.name}</Text>
                    <View
                      style={[
                        s.contribInputBox,
                        splitMode === "equal" && { backgroundColor: "rgba(255,255,255,0.03)", opacity: 0.8 },
                      ]}
                    >
                      <Text style={s.contribLabel}>
                        {splitMode === "equal" ? "Equal Share" : "Contribution"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontSize: 13, marginRight: 2 }}>₹</Text>
                        <TextInput
                          value={String(m.contribution || "")}
                          onChangeText={(val) => handleContributionChange(m.uid, val)}
                          editable={splitMode !== "equal"}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#666"
                          style={s.contribInput}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Bottom Buttons */}
              <View style={s.btnRow}>
                <Pressable onPress={() => setActiveStep(2)} style={s.cancelBtn}>
                  <Text style={s.cancelText}>Back</Text>
                </Pressable>
                <Pressable
                  onPress={handleProceedToStep5}
                  style={s.nextBtn}
                >
                  <Text style={s.nextText}>Next: Timeline & Checklist</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ══════════════════════════════════════════════════════════
             STEP 5: Timeline & Checklist (Image 5)
             ══════════════════════════════════════════════════════════ */}
          {activeStep === 4 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Celebration Icon & Title */}
              <View style={s.step5Hero}>
                <View style={s.sparkleBadge}>
                  <Ionicons name="sparkles" size={26} color="#ffffff" />
                </View>
                <Text style={s.step5Title}>🎉 Review & Fine-tune Timeline & Checklist</Text>
                <Text style={s.step5Sub}>
                  Review, add notes, and edit activities for {tripName || `${fromLocation.split(",")[0] || "Origin"} to ${toLocation.split(",")[0] || "Destination"} Trip`}.
                </Text>
              </View>

              {/* Itinerary Timeline Card */}
              <View style={s.step5Card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <Feather name="trending-up" size={16} color="#ffffff" />
                  <Text style={s.step5CardTitle}>
                    Itinerary Timeline ({previewTimeline.length} Days)
                  </Text>
                </View>

                {previewTimeline.map((item, idx) => (
                  <View key={idx} style={s.timelineCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={s.dayBadge}>
                        <Text style={s.dayBadgeText}>Day {idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.miniLabel}>Event Title</Text>
                        <TextInput
                          value={item.title}
                          onChangeText={(val) => {
                            const updated = [...previewTimeline];
                            updated[idx].title = val;
                            setPreviewTimeline(updated);
                          }}
                          style={s.timelineTitleInput}
                        />
                      </View>
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <Text style={s.miniLabel}>Scheduled Date & Time</Text>
                      <TextInput
                        value={item.time}
                        onChangeText={(val) => {
                          const updated = [...previewTimeline];
                          updated[idx].time = val;
                          setPreviewTimeline(updated);
                        }}
                        style={s.timelineTimeInput}
                      />
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <Text style={s.miniLabel}>Activity Description / Note</Text>
                      <TextInput
                        value={item.note}
                        onChangeText={(val) => {
                          const updated = [...previewTimeline];
                          updated[idx].note = val;
                          setPreviewTimeline(updated);
                        }}
                        multiline
                        placeholder="Add details (e.g. Visit spots, check-in details, transit modes)..."
                        placeholderTextColor="#666"
                        style={s.timelineNoteInput}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Relevant Packing Checklist Card */}
              <View style={[s.step5Card, { marginTop: 14 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <Ionicons name="list" size={16} color="#00b0ff" />
                  <Text style={s.step5CardTitle}>Relevant Packing Checklist</Text>
                </View>

                <View style={{ gap: 8 }}>
                  {previewChecklist.map((itemText, idx) => (
                    <View key={idx} style={s.checklistItemRow}>
                      <TextInput
                        value={itemText}
                        onChangeText={(val) => {
                          const updated = [...previewChecklist];
                          updated[idx] = val;
                          setPreviewChecklist(updated);
                        }}
                        style={s.checklistInput}
                      />
                      <Pressable
                        onPress={() => setPreviewChecklist(previewChecklist.filter((_, i) => i !== idx))}
                        style={s.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>

                {/* Add Custom Item */}
                <View style={s.addChecklistRow}>
                  <TextInput
                    value={newChecklistText}
                    onChangeText={setNewChecklistText}
                    placeholder="Add custom item (e.g. Camera Chargers)..."
                    placeholderTextColor="#666"
                    style={s.addChecklistInput}
                  />
                  <Pressable
                    onPress={() => {
                      if (newChecklistText.trim()) {
                        setPreviewChecklist([...previewChecklist, newChecklistText.trim()]);
                        setNewChecklistText("");
                      }
                    }}
                    style={s.addChecklistBtn}
                  >
                    <Text style={s.addChecklistText}>+ Add</Text>
                  </Pressable>
                </View>
              </View>

              {/* Finish & Save Buttons */}
              <View style={{ marginTop: 20, gap: 10 }}>
                <Pressable
                  onPress={() => handleFinishAndSaveTrip(false)}
                  disabled={isFinishing}
                  style={[s.finishBtn, { backgroundColor: "#ffffff" }]}
                >
                  {isFinishing ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#000" />
                      <Text style={s.finishText}>Finish & Save to Trip</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleFinishAndSaveTrip(true)}
                  disabled={isFinishing}
                  style={s.skipBtn}
                >
                  <Text style={s.skipText}>Skip for Now</Text>
                </Pressable>

                <Pressable onPress={() => setActiveStep(3)} style={[s.skipBtn, { borderColor: "transparent" }]}>
                  <Text style={[s.skipText, { color: "rgba(255,255,255,0.4)" }]}>Back to Budget</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STYLES
   ════════════════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)" },
  content: { flex: 1, paddingHorizontal: 16 },

  /* Top Header */
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerSub: { color: "rgba(255, 255, 255, 0.5)", fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stepper Horizontal Scroll */
  stepperWrap: { marginBottom: 18 },
  stepperRow: { gap: 8, paddingHorizontal: 2 },
  stepPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  stepPillActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  stepPillText: { color: "rgba(255, 255, 255, 0.6)", fontSize: 11, fontWeight: "700" },
  stepPillTextActive: { color: "#000000", fontWeight: "900" },

  /* Step 1: Route & Map */
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  locInputBox: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  locInputBoxFocused: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  useLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  useLocationText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "800",
  },
  inputLabel: { color: "rgba(255, 255, 255, 0.6)", fontSize: 10, fontWeight: "700" },
  inputInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  locTextInput: { flex: 1, color: "#fff", fontSize: 13, paddingVertical: 2 },
  swapBtn: {
    width: 44,
    height: 88,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },

  dropdownCard: {
    backgroundColor: "#161922",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 12,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  dropdownText: { color: "#fff", fontSize: 12.5, flex: 1, fontWeight: "600" },

  mapStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  mapStatusText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  mapToggleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  mapToggleText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  /* Slippy Map Styles (Universal Expo Go Map) */
  mapContainer: {
    height: MAP_HEIGHT,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "#0a0e18",
    position: "relative",
    marginBottom: 20,
  },
  mapMarkerWrap: {
    position: "absolute",
    alignItems: "center",
    zIndex: 20,
  },
  greenMarkerPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  redMarkerPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 2,
    borderColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  markerBadge: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  markerBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800", maxWidth: 90 },

  routeSummaryPill: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    elevation: 4,
    zIndex: 30,
  },
  routeSummaryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },

  mapZoomControls: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    elevation: 3,
    zIndex: 30,
  },
  mapZoomBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  mapAttr: {
    position: "absolute",
    bottom: 6,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 30,
  },
  mapAttrText: { color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "600" },

  /* Step Headings */
  stepHeading: { color: "#fff", fontSize: 13.5, fontWeight: "800", marginBottom: 12 },

  /* Step 3: Identity & Weather */
  weatherCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0, 230, 118, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.25)",
    marginBottom: 16,
  },
  weatherTitle: { color: "#fff", fontSize: 12, fontWeight: "800" },
  weatherSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "500" },

  photoSection: { alignItems: "center", marginBottom: 18 },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "#1c1f28",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  uploadText: { color: "#000000", fontSize: 11.5, fontWeight: "800" },

  inputWrap: { marginBottom: 14 },
  inputWrapLabel: { color: "rgba(255, 255, 255, 0.7)", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  inputRowWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  mainInput: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    paddingVertical: 12,
  },

  /* Step 4: Budget & Friends */
  friendCardsRow: { gap: 10, paddingBottom: 10 },
  friendCard: {
    width: 110,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  friendCardAv: { width: 44, height: 44, borderRadius: 22, marginBottom: 8, backgroundColor: "#333" },
  friendCardName: { color: "#fff", fontSize: 11, fontWeight: "700", marginBottom: 8 },
  friendAddBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  friendAddText: { color: "#000", fontSize: 10.5, fontWeight: "800" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipAv: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#222" },
  chipName: { color: "#fff", fontSize: 11, fontWeight: "700" },

  budgetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  currPrefix: { color: "#fff", fontSize: 16, fontWeight: "800", marginRight: 6 },
  budgetTextInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 12, fontWeight: "700" },

  splitBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  splitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 12,
  },
  splitBtnActive: { backgroundColor: "#ffffff" },
  splitText: { color: "rgba(255, 255, 255, 0.6)", fontSize: 11, fontWeight: "800" },
  splitTextActive: { color: "#000000", fontWeight: "900" },

  contribRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  contribAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#333", marginRight: 10 },
  contribName: { color: "#fff", fontSize: 12.5, fontWeight: "700", flex: 1 },
  contribInputBox: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    width: 120,
  },
  contribLabel: { color: "rgba(255,255,255,0.4)", fontSize: 8.5, fontWeight: "700" },
  contribInput: { color: "#fff", fontSize: 12, fontWeight: "700", padding: 0 },

  /* Step 5: Timeline & Checklist */
  step5Hero: { alignItems: "center", marginVertical: 14 },
  sparkleBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  step5Title: { color: "#fff", fontSize: 17, fontWeight: "900", textAlign: "center" },
  step5Sub: { color: "rgba(255,255,255,0.5)", fontSize: 11.5, textAlign: "center", marginTop: 4 },

  step5Card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  step5CardTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },

  timelineCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  dayBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dayBadgeText: { color: "#000", fontSize: 10.5, fontWeight: "900" },
  miniLabel: { color: "rgba(255, 255, 255, 0.45)", fontSize: 9.5, fontWeight: "700", marginBottom: 3 },
  timelineTitleInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  timelineTimeInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 12,
  },
  timelineNoteInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 11.5,
    minHeight: 48,
  },

  checklistItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  checklistInput: { flex: 1, color: "#fff", fontSize: 12, paddingVertical: 10 },
  trashBtn: { padding: 6 },

  addChecklistRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addChecklistInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  addChecklistBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  addChecklistText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },

  finishBtn: {
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  finishText: { color: "#000", fontSize: 14, fontWeight: "900" },
  skipBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  skipText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },

  /* Bottom Buttons Navigation */
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: "#000000", fontSize: 13, fontWeight: "900" },
  nextBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#161922",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  nextText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});

/* Calendar Styles */
const cal = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
  },
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },

  monthWrapper: { marginBottom: 20 },
  monthTitle: { color: "#fff", fontSize: 15, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  weekHeader: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  weekHeaderText: { color: "rgba(255, 255, 255, 0.4)", fontSize: 11, fontWeight: "800", width: 36, textAlign: "center" },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" },

  emptyCell: { width: `${100 / 7}%`, height: 38 },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: "#ffffff",
    borderRadius: 19,
  },
  dayCellRange: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 0,
  },
  dayText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  dayTextSelected: { color: "#000000", fontWeight: "900" },
  dayTextRange: { color: "#ffffff", fontWeight: "800" },
});