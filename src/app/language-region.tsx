// **@** Language & Region Settings — Pixel-perfect UI matching design system with greyish-white icons, circular back button, dynamic theme adaptability (zero red), and real Firestore & AsyncStorage persistence
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
  Modal,
  StatusBar,
  Appearance,
  Animated,
  TextInput,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { ACCENT_COLORS } from "../theme/theme";

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  greeting: string;
}

export interface RegionOption {
  code: string;
  name: string;
  flag: string;
  defaultFirstDay: "Sunday" | "Monday" | "Saturday";
  defaultDateFormat: string;
  default24Hour: boolean;
}

export interface DateFormatOption {
  format: string;
  label: string;
}

export interface FirstDayOption {
  day: "Sunday" | "Monday" | "Saturday";
  desc: string;
  weekDays: string[];
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en-US", name: "English (US)", nativeName: "English (United States)", flag: "🇺🇸", greeting: "Welcome to Bunkmates" },
  { code: "en-GB", name: "English (UK)", nativeName: "English (United Kingdom)", flag: "🇬🇧", greeting: "Welcome to Bunkmates" },
  { code: "en-IN", name: "English (IN)", nativeName: "English (India)", flag: "🇮🇳", greeting: "Welcome to Bunkmates" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", greeting: "बंकमेट्स में आपका स्वागत है" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", greeting: "Bienvenido a Bunkmates" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", greeting: "Bienvenue sur Bunkmates" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", greeting: "Willkommen bei Bunkmates" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", greeting: "Bunkmatesへようこそ" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", greeting: "欢迎使用 Bunkmates" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português", flag: "🇧🇷", greeting: "Bem-vindo ao Bunkmates" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", greeting: "Benvenuto su Bunkmates" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇦🇪", greeting: "مرحبًا بك في بانكميتس" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", greeting: "Добро пожаловать в Bunkmates" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", greeting: "Bunkmates에 오신 것을 환영합니다" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", greeting: "Welkom bij Bunkmates" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩", greeting: "বাঙ্কমেইটসে স্বাগতম" },
];

export const REGIONS: RegionOption[] = [
  { code: "US", name: "United States", flag: "🇺🇸", defaultFirstDay: "Sunday", defaultDateFormat: "MM/DD/YYYY", default24Hour: false },
  { code: "IN", name: "India", flag: "🇮🇳", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: false },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "CA", name: "Canada", flag: "🇨🇦", defaultFirstDay: "Sunday", defaultDateFormat: "YYYY-MM-DD", default24Hour: false },
  { code: "AU", name: "Australia", flag: "🇦🇺", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: false },
  { code: "DE", name: "Germany", flag: "🇩🇪", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "FR", name: "France", flag: "🇫🇷", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "JP", name: "Japan", flag: "🇯🇵", defaultFirstDay: "Sunday", defaultDateFormat: "YYYY-MM-DD", default24Hour: true },
  { code: "SG", name: "Singapore", flag: "🇸🇬", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", defaultFirstDay: "Saturday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "ES", name: "Spain", flag: "🇪🇸", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "IT", name: "Italy", flag: "🇮🇹", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "BR", name: "Brazil", flag: "🇧🇷", defaultFirstDay: "Sunday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: false },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", defaultFirstDay: "Monday", defaultDateFormat: "DD/MM/YYYY", default24Hour: true },
];

export const DATE_FORMATS: DateFormatOption[] = [
  { format: "MM/DD/YYYY", label: "Month / Day / Year (US Standard)" },
  { format: "DD/MM/YYYY", label: "Day / Month / Year (UK, India, Global)" },
  { format: "YYYY-MM-DD", label: "Year-Month-Day (ISO 8601 Standard)" },
  { format: "DD MMM YYYY", label: "Day Month Name Year" },
  { format: "MMM DD, YYYY", label: "Month Name Day, Year" },
];

export const FIRST_DAY_OPTIONS: FirstDayOption[] = [
  { day: "Sunday", desc: "Common in United States, Canada, Japan", weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
  { day: "Monday", desc: "Standard in Europe, India, ISO 8601", weekDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
  { day: "Saturday", desc: "Standard in Middle Eastern regions", weekDays: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] },
];

// Helper to format any date dynamically
export function formatDynamicDate(format: string, date: Date = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const day = pad(date.getDate());
  const monthNum = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthShort = monthNamesShort[date.getMonth()];

  switch (format) {
    case "MM/DD/YYYY":
      return `${monthNum}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${monthNum}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${monthNum}-${day}`;
    case "DD MMM YYYY":
      return `${day} ${monthShort} ${year}`;
    case "MMM DD, YYYY":
      return `${monthShort} ${day}, ${year}`;
    default:
      return `${monthNum}/${day}/${year}`;
  }
}

// Helper to format any time dynamically
export function formatDynamicTime(is24Hour: boolean, date: Date = new Date(), showSeconds: boolean = true): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  let hours = date.getHours();
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());

  if (is24Hour) {
    return showSeconds ? `${pad(hours)}:${mins}:${secs}` : `${pad(hours)}:${mins}`;
  } else {
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return showSeconds ? `${hours}:${mins}:${secs} ${ampm}` : `${hours}:${mins} ${ampm}`;
  }
}

export default function LanguageRegionSettings() {
  const router = useRouter();

  // Auth & user state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // States matching reference image defaults
  const [language, setLanguage] = useState<string>("English (US)");
  const [languageCode, setLanguageCode] = useState<string>("en-US");
  const [region, setRegion] = useState<string>("United States");
  const [regionCode, setRegionCode] = useState<string>("US");
  const [dateFormat, setDateFormat] = useState<string>("MM/DD/YYYY");
  const [timeFormat24, setTimeFormat24] = useState<boolean>(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"Sunday" | "Monday" | "Saturday">("Sunday");

  // Dynamic ticking clock state (ticks every second)
  const [currentClock, setCurrentClock] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClock(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals state
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [dateFormatModalVisible, setDateFormatModalVisible] = useState(false);
  const [firstDayModalVisible, setFirstDayModalVisible] = useState(false);

  // Modal search queries
  const [langSearch, setLangSearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");

  // Floating save/action toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

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
      switchActive: isDark ? "#34C759" : "#10B981",
      switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
      activeText: activeText,
      activeBorder: activeBorder,
      activeRowBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.03)",
      inputBg: isDark ? "rgba(255, 255, 255, 0.07)" : "#F2F4F7",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      previewBg: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
      previewBorder: isDark ? "rgba(255, 255, 255, 0.07)" : "#E5E7EB",
      chipBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#EEF2F6",
      weekdayActiveBg: isDark ? "rgba(255, 255, 255, 0.15)" : "#E5E7EB",
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

  // Restore local cache & real-time Firestore sync
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_locale_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.language) setLanguage(parsed.language);
          if (parsed.languageCode) setLanguageCode(parsed.languageCode);
          if (parsed.region) setRegion(parsed.region);
          if (parsed.regionCode) setRegionCode(parsed.regionCode);
          if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
          if (parsed.timeFormat24 !== undefined) setTimeFormat24(parsed.timeFormat24);
          if (parsed.firstDayOfWeek) setFirstDayOfWeek(parsed.firstDayOfWeek);
        }
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
          const p = uData.localePreferences || {};
          if (p.language) setLanguage(p.language);
          if (p.languageCode) setLanguageCode(p.languageCode);
          if (p.region) setRegion(p.region);
          if (p.regionCode) setRegionCode(p.regionCode);
          if (p.dateFormat) setDateFormat(p.dateFormat);
          if (p.timeFormat24 !== undefined) setTimeFormat24(p.timeFormat24);
          if (p.firstDayOfWeek) setFirstDayOfWeek(p.firstDayOfWeek);
        }
      },
      (error) => {
        console.log("Firestore locale snapshot error:", error);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // Persistence handler
  const savePreferences = async (updated: Partial<{
    language: string;
    languageCode: string;
    region: string;
    regionCode: string;
    dateFormat: string;
    timeFormat24: boolean;
    firstDayOfWeek: "Sunday" | "Monday" | "Saturday";
  }>) => {
    const current = {
      language,
      languageCode,
      region,
      regionCode,
      dateFormat,
      timeFormat24,
      firstDayOfWeek,
      ...updated,
    };

    try {
      await AsyncStorage.setItem("@bunkmates_locale_preferences", JSON.stringify(current));
    } catch (e) {
      console.log("AsyncStorage write error:", e);
    }

    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          localePreferences: current,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log("Firestore write error:", e);
      }
    }
  };

  // Selection handlers with dynamic smart logic
  const handleSelectLanguage = (lang: LanguageOption) => {
    setLanguage(lang.name);
    setLanguageCode(lang.code);
    savePreferences({ language: lang.name, languageCode: lang.code });
    setLanguageModalVisible(false);
    triggerToast(`Language set to ${lang.name}`);
  };

  const handleSelectRegion = (reg: RegionOption) => {
    setRegion(reg.name);
    setRegionCode(reg.code);

    // Dynamic Regional auto-preset suggestion:
    // When changing region, offer to also match typical date format and week start
    Alert.alert(
      `Set Regional Formats for ${reg.name}?`,
      `Would you like to automatically update your date format (${reg.defaultDateFormat}), 24-hour time (${reg.default24Hour ? "On" : "Off"}), and first day of week (${reg.defaultFirstDay}) to match ${reg.name}?`,
      [
        {
          text: "Keep Current Formats",
          style: "cancel",
          onPress: () => {
            savePreferences({ region: reg.name, regionCode: reg.code });
            triggerToast(`Region set to ${reg.name}`);
          },
        },
        {
          text: "Apply Regional Defaults",
          style: "default",
          onPress: () => {
            setDateFormat(reg.defaultDateFormat);
            setTimeFormat24(reg.default24Hour);
            setFirstDayOfWeek(reg.defaultFirstDay);
            savePreferences({
              region: reg.name,
              regionCode: reg.code,
              dateFormat: reg.defaultDateFormat,
              timeFormat24: reg.default24Hour,
              firstDayOfWeek: reg.defaultFirstDay,
            });
            triggerToast(`Region & formats updated for ${reg.name}`);
          },
        },
      ]
    );

    setRegionModalVisible(false);
  };

  const handleSelectDateFormat = (df: DateFormatOption) => {
    setDateFormat(df.format);
    savePreferences({ dateFormat: df.format });
    setDateFormatModalVisible(false);
    triggerToast(`Date format: ${df.format}`);
  };

  const handleTimeFormatToggle = (val: boolean) => {
    setTimeFormat24(val);
    savePreferences({ timeFormat24: val });
    triggerToast(val ? "24-hour clock enabled" : "12-hour clock enabled");
  };

  const handleSelectFirstDay = (day: "Sunday" | "Monday" | "Saturday") => {
    setFirstDayOfWeek(day);
    savePreferences({ firstDayOfWeek: day });
    setFirstDayModalVisible(false);
    triggerToast(`First day of week: ${day}`);
  };

  // Filtered lists for search modals
  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  const filteredRegions = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    if (!q) return REGIONS;
    return REGIONS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
    );
  }, [regionSearch]);

  // Dynamic greetings translation for the currently selected language
  const activeGreeting = useMemo(() => {
    const found = LANGUAGES.find((l) => l.name === language || l.code === languageCode);
    return found ? found.greeting : "Welcome to Bunkmates";
  }, [language, languageCode]);

  // Formatted date-time live example that dynamically ticks
  const liveDateString = useMemo(() => {
    return formatDynamicDate(dateFormat, currentClock);
  }, [dateFormat, currentClock]);

  const liveTimeString = useMemo(() => {
    return formatDynamicTime(timeFormat24, currentClock, true);
  }, [timeFormat24, currentClock]);

  // Dynamic 7-day week sequence based on selected firstDayOfWeek
  const dynamicWeekDays = useMemo(() => {
    const option = FIRST_DAY_OPTIONS.find((f) => f.day === firstDayOfWeek);
    return option ? option.weekDays : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }, [firstDayOfWeek]);

  // Today's day abbreviation to highlight
  const todayDayAbbr = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[currentClock.getDay()];
  }, [currentClock]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Floating Save/Status Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            {
              backgroundColor: colors.toastBg,
              opacity: toastOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header with Circular Back Button */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Language & Region
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Live Locale & Formats Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: colors.previewBg, borderColor: colors.previewBorder }]}>
          <View style={styles.previewTopRow}>
            <View style={styles.previewLabelRow}>
              <Ionicons name="sparkles" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>LIVE DYNAMIC PREVIEW</Text>
            </View>
            <View style={[styles.previewChip, { backgroundColor: colors.chipBg }]}>
              <Text style={[styles.previewChipText, { color: colors.textPrimary }]}>{regionCode}</Text>
            </View>
          </View>

          {/* Dynamic Ticking Time & Date */}
          <Text style={[styles.previewDateTime, { color: colors.textPrimary }]}>
            {liveDateString} • {liveTimeString}
          </Text>

          {/* Localized Greeting & Details */}
          <Text style={[styles.previewGreeting, { color: colors.textPrimary }]}>
            "{activeGreeting}"
          </Text>

          <Text style={[styles.previewDetails, { color: colors.textSecondary }]}>
            Language: {language} • Week begins on {firstDayOfWeek}
          </Text>

          {/* Dynamic 7-day Week Strip Preview */}
          <View style={styles.weekStrip}>
            {dynamicWeekDays.map((d) => {
              const isToday = d === todayDayAbbr;
              return (
                <View
                  key={d}
                  style={[
                    styles.weekDayPill,
                    { backgroundColor: isToday ? colors.switchActive : colors.chipBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayPillText,
                      { color: isToday ? "#FFFFFF" : colors.textSecondary, fontWeight: isToday ? "700" : "500" },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ========================================================
            1. LOCALE SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>LOCALE</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* App Language */}
          <Pressable
            onPress={() => {
              setLangSearch("");
              setLanguageModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="globe-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>App Language</Text>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>{language}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>

          {/* Region */}
          <Pressable
            onPress={() => {
              setRegionSearch("");
              setRegionModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Feather name="map" size={19} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Region</Text>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>{region}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            2. SYSTEM FORMATS SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>SYSTEM FORMATS</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Date Format */}
          <Pressable
            onPress={() => setDateFormatModalVisible(true)}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Date Format</Text>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>{dateFormat}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>

          {/* Time Format (24-Hour) */}
          <View style={styles.rowItem}>
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="time-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Time Format (24-Hour)</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Use 24-hour clock instead of 12-hour
                </Text>
              </View>
              <Switch
                value={timeFormat24}
                onValueChange={handleTimeFormatToggle}
                trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* First Day of Week */}
          <Pressable
            onPress={() => setFirstDayModalVisible(true)}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="calendar" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>First Day of Week</Text>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>{firstDayOfWeek}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL 1: APP LANGUAGE PICKER
      ========================================================= */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLanguageModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Select App Language</Text>
              <Pressable
                onPress={() => setLanguageModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search languages..."
                placeholderTextColor={colors.textSecondary}
                value={langSearch}
                onChangeText={setLangSearch}
                autoCorrect={false}
              />
              {langSearch.length > 0 && (
                <Pressable onPress={() => setLangSearch("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredLanguages}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isSelected = language === item.name;
                return (
                  <Pressable
                    onPress={() => handleSelectLanguage(item)}
                    style={({ pressed }) => [
                      styles.modalListItem,
                      isSelected && { backgroundColor: colors.activeRowBg },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.flagIcon}>{item.flag}</Text>
                    <View style={styles.modalItemTextGroup}>
                      <Text style={[styles.modalItemTitle, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "500" }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.modalItemSubtitle, { color: colors.textSecondary }]}>
                        {item.nativeName} • "{item.greeting}"
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 2: REGION PICKER
      ========================================================= */}
      <Modal
        visible={regionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRegionModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setRegionModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Select Region</Text>
              <Pressable
                onPress={() => setRegionModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search country or region..."
                placeholderTextColor={colors.textSecondary}
                value={regionSearch}
                onChangeText={setRegionSearch}
                autoCorrect={false}
              />
              {regionSearch.length > 0 && (
                <Pressable onPress={() => setRegionSearch("")}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filteredRegions}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const isSelected = region === item.name;
                return (
                  <Pressable
                    onPress={() => handleSelectRegion(item)}
                    style={({ pressed }) => [
                      styles.modalListItem,
                      isSelected && { backgroundColor: colors.activeRowBg },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.flagIcon}>{item.flag}</Text>
                    <View style={styles.modalItemTextGroup}>
                      <Text style={[styles.modalItemTitle, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "500" }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.modalItemSubtitle, { color: colors.textSecondary }]}>
                        Format: {item.defaultDateFormat} • Starts {item.defaultFirstDay}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 3: DATE FORMAT PICKER (Dynamic live today's date sample)
      ========================================================= */}
      <Modal
        visible={dateFormatModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDateFormatModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDateFormatModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Choose Date Format</Text>
              <Pressable
                onPress={() => setDateFormatModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {DATE_FORMATS.map((item) => {
                const isSelected = dateFormat === item.format;
                const liveSample = formatDynamicDate(item.format, currentClock);
                return (
                  <Pressable
                    key={item.format}
                    onPress={() => handleSelectDateFormat(item)}
                    style={({ pressed }) => [
                      styles.modalListItem,
                      isSelected && { backgroundColor: colors.activeRowBg },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.iconBoxSmall, { backgroundColor: colors.iconBoxBg }]}>
                      <Ionicons name="calendar-outline" size={17} color={colors.greyishWhite} />
                    </View>
                    <View style={styles.modalItemTextGroup}>
                      <Text style={[styles.modalItemTitle, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "500" }]}>
                        {item.format}
                      </Text>
                      <Text style={[styles.modalItemSubtitle, { color: colors.textSecondary }]}>
                        Today: {liveSample} • {item.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 4: FIRST DAY OF WEEK PICKER
      ========================================================= */}
      <Modal
        visible={firstDayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFirstDayModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFirstDayModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>First Day of Week</Text>
              <Pressable
                onPress={() => setFirstDayModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {FIRST_DAY_OPTIONS.map((item) => {
                const isSelected = firstDayOfWeek === item.day;
                return (
                  <Pressable
                    key={item.day}
                    onPress={() => handleSelectFirstDay(item.day)}
                    style={({ pressed }) => [
                      styles.modalListItem,
                      isSelected && { backgroundColor: colors.activeRowBg },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.iconBoxSmall, { backgroundColor: colors.iconBoxBg }]}>
                      <Ionicons name="today-outline" size={17} color={colors.greyishWhite} />
                    </View>
                    <View style={styles.modalItemTextGroup}>
                      <Text style={[styles.modalItemTitle, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "500" }]}>
                        {item.day}
                      </Text>
                      <Text style={[styles.modalItemSubtitle, { color: colors.textSecondary }]}>
                        {item.desc}
                      </Text>
                      {/* Mini week day sequence preview */}
                      <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                        {item.weekDays.map((wd, i) => (
                          <View
                            key={wd}
                            style={{
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                              backgroundColor: i === 0 ? colors.switchActive : colors.chipBg,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                fontWeight: "600",
                                color: i === 0 ? "#FFFFFF" : colors.textSecondary,
                              }}
                            >
                              {wd}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.switchActive} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  previewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
    marginBottom: 24,
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  previewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  previewChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  previewDateTime: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  previewGreeting: {
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
    marginBottom: 4,
  },
  previewDetails: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 10,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  weekDayPill: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayPillText: {
    fontSize: 10,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
    textTransform: "uppercase",
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  iconBoxSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  labelGroup: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
    lineHeight: 16,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightValueText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sheetCloseBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  modalListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  flagIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  modalItemTextGroup: {
    flex: 1,
  },
  modalItemTitle: {
    fontSize: 15,
  },
  modalItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Toast
  toastBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
