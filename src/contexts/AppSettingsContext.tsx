// src/contexts/AppSettingsContext.tsx
// Unified Application Settings Context providing reactive functional settings across Bunkmates
// Purely functional: does NOT modify any UI styling, layout, or color palette.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { auth, db } from "../lib/firebase";

// -------------------------------------------------------------
// TYPES & DEFAULTS
// -------------------------------------------------------------

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export const DEFAULT_CURRENCY: CurrencyItem = {
  code: "USD",
  name: "United States Dollar",
  symbol: "$",
  flag: "🇺🇸",
};

export type TempUnit = "°F" | "°C" | "K";
export type DateFormat =
  | "MM/DD/YYYY"
  | "DD/MM/YYYY"
  | "YYYY-MM-DD"
  | "DD MMM YYYY"
  | "MMM DD, YYYY";

export type FirstDayOfWeek = "Sunday" | "Monday" | "Saturday";

export type HapticType =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export interface CurrencyPreferences {
  baseCurrency: CurrencyItem;
  showSymbol: boolean;
  autoRoundOff: boolean;
  splitMethod: string;
  autoCategorize: boolean;
  savingsGoalEnabled: boolean;
  savingsGoalAmount: number;
}

export interface WeatherPreferences {
  tempUnit: TempUnit;
  forecastHorizon: string;
  severeAlerts: boolean;
  rainNotifications: boolean;
  uvAlerts: boolean;
  widgetLayout: string;
  showFeelsLike: boolean;
  showWindSpeed: boolean;
  refreshInterval: string;
  highPollutionAlerts: boolean;
}

export interface LocalePreferences {
  dateFormat: DateFormat;
  is24Hour: boolean;
  firstDayOfWeek: FirstDayOfWeek;
}

export interface AccessibilityPreferences {
  screenReaderCompat: boolean;
  highContrastMode: boolean;
  largeTouchTargets: boolean;
  colorBlindMode: string;
  reduceMotion: boolean;
  hapticFeedback: boolean;
}

export interface PrivacyPreferences {
  visibility?: "public" | "private";
  profileVisibility?: "public" | "private";
  locationSharing?: boolean;
  activityStatus?: boolean;
  hidePastTrips?: boolean;
  analyticsCollection?: boolean;
}

export interface TripPreferences {
  travelStyle: "Budget" | "Mid-Range" | "Luxury";
  accommodations: string[];
  tripDuration: string;
  groupSize: string;
  dietary: string[];
  activities: string[];
}

export interface AppSettingsContextType {
  // Currency & Expenses
  currency: CurrencyItem;
  showSymbol: boolean;
  autoRoundOff: boolean;
  splitMethod: string;
  formatCurrency: (amount: number | string | undefined | null) => string;
  updateCurrencyPreferences: (prefs: Partial<CurrencyPreferences>) => Promise<void>;

  // Weather
  tempUnit: TempUnit;
  formatTemperature: (
    tempInCelsius: number | string | undefined | null,
    sourceUnit?: "C" | "F"
  ) => string;
  convertTemperatureNumber: (
    tempInCelsius: number | undefined | null,
    sourceUnit?: "C" | "F"
  ) => number | null;
  updateWeatherPreferences: (prefs: Partial<WeatherPreferences>) => Promise<void>;

  // Locale & Formats
  dateFormat: DateFormat;
  is24Hour: boolean;
  firstDayOfWeek: FirstDayOfWeek;
  formatDate: (
    dateInput: Date | string | number | undefined | null,
    formatOverride?: string
  ) => string;
  formatTime: (dateInput?: Date | string | number | null, showSeconds?: boolean) => string;
  updateLocalePreferences: (prefs: Partial<LocalePreferences>) => Promise<void>;

  // Accessibility & Haptics
  hapticFeedback: boolean;
  reduceMotion: boolean;
  highContrastMode: boolean;
  triggerHaptic: (type?: HapticType) => void;
  updateAccessibilityPreferences: (prefs: Partial<AccessibilityPreferences>) => Promise<void>;

  // Privacy & Data
  hidePastTrips: boolean;
  locationSharing: boolean;
  activityStatus: boolean;
  analyticsCollection: boolean;
  updatePrivacyPreferences: (prefs: Partial<PrivacyPreferences>) => Promise<void>;

  // Trip Preferences
  tripPreferences: TripPreferences;
  updateTripPreferences: (prefs: Partial<TripPreferences>) => Promise<void>;
}

// -------------------------------------------------------------
// STANDALONE IN-MEMORY FALLBACK CACHE (for non-hook helpers)
// -------------------------------------------------------------
const memoryCache = {
  currency: DEFAULT_CURRENCY,
  showSymbol: true,
  autoRoundOff: false,
  tempUnit: "°C" as TempUnit,
  dateFormat: "DD/MM/YYYY" as DateFormat,
  is24Hour: false,
  hapticFeedback: true,
  hidePastTrips: false,
};

export function triggerAppHaptic(type: HapticType = "selection") {
  if (!memoryCache.hapticFeedback) return;
  try {
    switch (type) {
      case "selection":
        Haptics.selectionAsync().catch(() => {});
        break;
      case "light":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case "heavy":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
      default:
        Haptics.selectionAsync().catch(() => {});
    }
  } catch {}
}

export function formatCurrencyValue(
  amount: number | string | undefined | null,
  currency: CurrencyItem = memoryCache.currency,
  showSymbol: boolean = memoryCache.showSymbol,
  autoRoundOff: boolean = memoryCache.autoRoundOff
): string {
  if (amount === undefined || amount === null || amount === "") {
    return showSymbol ? `${currency.symbol}0` : `0 ${currency.code}`;
  }
  const numeric = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  if (isNaN(numeric)) {
    return showSymbol ? `${currency.symbol}0` : `0 ${currency.code}`;
  }

  let formattedNum = "";
  if (autoRoundOff) {
    formattedNum = Math.round(numeric).toLocaleString();
  } else {
    // If integer, show without decimals. If decimal, show up to 2 decimal places.
    const isInt = Number.isInteger(numeric);
    formattedNum = isInt
      ? numeric.toLocaleString()
      : numeric.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }

  if (showSymbol) {
    return `${currency.symbol}${formattedNum}`;
  } else {
    return `${formattedNum} ${currency.code}`;
  }
}

export function formatTemperatureValue(
  tempInCelsius: number | string | undefined | null,
  unit: TempUnit = memoryCache.tempUnit,
  sourceUnit: "C" | "F" = "C"
): string {
  if (tempInCelsius === undefined || tempInCelsius === null || tempInCelsius === "") {
    return "--";
  }
  let c = typeof tempInCelsius === "number" ? tempInCelsius : parseFloat(String(tempInCelsius));
  if (isNaN(c)) return "--";

  if (sourceUnit === "F") {
    c = ((c - 32) * 5) / 9;
  }

  if (unit === "°F") {
    const f = Math.round((c * 9) / 5 + 32);
    return `${f}°F`;
  } else if (unit === "K") {
    const k = Math.round(c + 273.15);
    return `${k}K`;
  } else {
    const rounded = Math.round(c);
    return `${rounded}°C`;
  }
}

export function formatDateValue(
  dateInput: Date | string | number | undefined | null,
  format: DateFormat = memoryCache.dateFormat
): string {
  if (!dateInput) return "";
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === "number") {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return String(dateInput);

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const day = pad(d.getDate());
  const monthNum = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const monthShort = d.toLocaleString("en-US", { month: "short" });

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
      return `${day}/${monthNum}/${year}`;
  }
}

export function formatTimeValue(
  dateInput?: Date | string | number | null,
  is24Hour: boolean = memoryCache.is24Hour,
  showSeconds: boolean = false
): string {
  const d = dateInput
    ? dateInput instanceof Date
      ? dateInput
      : new Date(dateInput)
    : new Date();
  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  let hours = d.getHours();
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());

  if (is24Hour) {
    return showSeconds ? `${pad(hours)}:${mins}:${secs}` : `${pad(hours)}:${mins}`;
  } else {
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return showSeconds
      ? `${hours}:${mins}:${secs} ${ampm}`
      : `${hours}:${mins} ${ampm}`;
  }
}

// -------------------------------------------------------------
// CONTEXT CREATION & PROVIDER
// -------------------------------------------------------------

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Currency
  const [currency, setCurrency] = useState<CurrencyItem>(DEFAULT_CURRENCY);
  const [showSymbol, setShowSymbol] = useState<boolean>(true);
  const [autoRoundOff, setAutoRoundOff] = useState<boolean>(false);
  const [splitMethod, setSplitMethod] = useState<string>("Equally");

  // Weather
  const [tempUnit, setTempUnit] = useState<TempUnit>("°C");

  // Locale & Formats
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [is24Hour, setIs24Hour] = useState<boolean>(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<FirstDayOfWeek>("Monday");

  // Accessibility & Haptics
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(true);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [highContrastMode, setHighContrastMode] = useState<boolean>(false);

  // Privacy
  const [hidePastTrips, setHidePastTrips] = useState<boolean>(false);
  const [locationSharing, setLocationSharing] = useState<boolean>(true);
  const [activityStatus, setActivityStatus] = useState<boolean>(false);
  const [analyticsCollection, setAnalyticsCollection] = useState<boolean>(true);

  // Trip Preferences
  const [tripPreferences, setTripPreferences] = useState<TripPreferences>({
    travelStyle: "Budget",
    accommodations: ["Hostel", "Airbnb", "Boutique Hotel"],
    tripDuration: "4 - 7 Days",
    groupSize: "3 - 6 Bunkmates",
    dietary: ["No Restrictions"],
    activities: ["Museums", "Hiking & Nature", "Nightlife", "Street Food"],
  });

  // Keep memory cache updated
  useEffect(() => {
    memoryCache.currency = currency;
    memoryCache.showSymbol = showSymbol;
    memoryCache.autoRoundOff = autoRoundOff;
    memoryCache.tempUnit = tempUnit;
    memoryCache.dateFormat = dateFormat;
    memoryCache.is24Hour = is24Hour;
    memoryCache.hapticFeedback = hapticFeedback;
    memoryCache.hidePastTrips = hidePastTrips;
  }, [
    currency,
    showSymbol,
    autoRoundOff,
    tempUnit,
    dateFormat,
    is24Hour,
    hapticFeedback,
    hidePastTrips,
  ]);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Restore cached settings from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [
          cachedCurr,
          cachedWeather,
          cachedLocale,
          cachedAccess,
          savedHide,
          savedLoc,
          savedAct,
          savedAna,
          cachedTrip,
        ] = await Promise.all([
          AsyncStorage.getItem("@bunkmates_currency_preferences"),
          AsyncStorage.getItem("@bunkmates_weather_preferences"),
          AsyncStorage.getItem("@bunkmates_locale_preferences"),
          AsyncStorage.getItem("@bunkmates_accessibility_preferences"),
          AsyncStorage.getItem("hide_past_trips"),
          AsyncStorage.getItem("location_sharing_enabled"),
          AsyncStorage.getItem("activity_status_enabled"),
          AsyncStorage.getItem("analytics_collection"),
          AsyncStorage.getItem("@bunkmates_trip_preferences"),
        ]);

        if (cachedCurr) {
          const parsed = JSON.parse(cachedCurr);
          if (parsed.baseCurrency) setCurrency(parsed.baseCurrency);
          if (parsed.showSymbol !== undefined) setShowSymbol(parsed.showSymbol);
          if (parsed.autoRoundOff !== undefined) setAutoRoundOff(parsed.autoRoundOff);
          if (parsed.splitMethod) setSplitMethod(parsed.splitMethod);
        }

        if (cachedWeather) {
          const parsed = JSON.parse(cachedWeather);
          if (parsed.tempUnit) setTempUnit(parsed.tempUnit);
        }

        if (cachedLocale) {
          const parsed = JSON.parse(cachedLocale);
          if (parsed.dateFormat) setDateFormat(parsed.dateFormat);
          if (parsed.is24Hour !== undefined) setIs24Hour(parsed.is24Hour);
          if (parsed.firstDayOfWeek) setFirstDayOfWeek(parsed.firstDayOfWeek);
        }

        if (cachedAccess) {
          const parsed = JSON.parse(cachedAccess);
          if (parsed.hapticFeedback !== undefined) setHapticFeedback(parsed.hapticFeedback);
          if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
          if (parsed.highContrastMode !== undefined) setHighContrastMode(parsed.highContrastMode);
        }

        if (savedHide !== null) setHidePastTrips(savedHide === "true");
        if (savedLoc !== null) setLocationSharing(savedLoc === "true");
        if (savedAct !== null) setActivityStatus(savedAct === "true");
        if (savedAna !== null) setAnalyticsCollection(savedAna === "true");

        if (cachedTrip) {
          const parsed = JSON.parse(cachedTrip);
          setTripPreferences((prev) => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.log("AppSettingsContext read AsyncStorage error:", e);
      }
    })();
  }, []);

  // Real-time Firestore sync
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        // Currency
        if (data.currencyPreferences) {
          const cp = data.currencyPreferences;
          if (cp.baseCurrency) setCurrency(cp.baseCurrency);
          if (cp.showSymbol !== undefined) setShowSymbol(cp.showSymbol);
          if (cp.autoRoundOff !== undefined) setAutoRoundOff(cp.autoRoundOff);
          if (cp.splitMethod) setSplitMethod(cp.splitMethod);
        }

        // Weather
        if (data.weatherPreferences) {
          const wp = data.weatherPreferences;
          if (wp.tempUnit) setTempUnit(wp.tempUnit);
        }

        // Locale
        if (data.localePreferences) {
          const lp = data.localePreferences;
          if (lp.dateFormat) setDateFormat(lp.dateFormat);
          if (lp.is24Hour !== undefined) setIs24Hour(lp.is24Hour);
          if (lp.firstDayOfWeek) setFirstDayOfWeek(lp.firstDayOfWeek);
        }

        // Accessibility
        if (data.accessibilityPreferences) {
          const ap = data.accessibilityPreferences;
          if (ap.hapticFeedback !== undefined) setHapticFeedback(ap.hapticFeedback);
          if (ap.reduceMotion !== undefined) setReduceMotion(ap.reduceMotion);
          if (ap.highContrastMode !== undefined) setHighContrastMode(ap.highContrastMode);
        }

        // Privacy
        if (data.privacy) {
          const pp = data.privacy;
          if (pp.hidePastTrips !== undefined) setHidePastTrips(pp.hidePastTrips);
          if (pp.locationSharing !== undefined) setLocationSharing(pp.locationSharing);
          if (pp.activityStatus !== undefined) setActivityStatus(pp.activityStatus);
          if (pp.analyticsCollection !== undefined) setAnalyticsCollection(pp.analyticsCollection);
        }

        // Trip Preferences
        if (data.tripPreferences) {
          setTripPreferences((prev) => ({ ...prev, ...data.tripPreferences }));
        }
      },
      (err) => {
        console.log("AppSettings onSnapshot error:", err);
      }
    );

    return () => unsub();
  }, [user]);

  // Update methods
  const updateCurrencyPreferences = useCallback(
    async (prefs: Partial<CurrencyPreferences>) => {
      if (prefs.baseCurrency) setCurrency(prefs.baseCurrency);
      if (prefs.showSymbol !== undefined) setShowSymbol(prefs.showSymbol);
      if (prefs.autoRoundOff !== undefined) setAutoRoundOff(prefs.autoRoundOff);
      if (prefs.splitMethod) setSplitMethod(prefs.splitMethod);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_currency_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_currency_preferences",
          JSON.stringify(updated)
        );
      } catch (e) {
        console.log("updateCurrencyPreferences AsyncStorage error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            currencyPreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updateCurrencyPreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  const updateWeatherPreferences = useCallback(
    async (prefs: Partial<WeatherPreferences>) => {
      if (prefs.tempUnit) setTempUnit(prefs.tempUnit);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_weather_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_weather_preferences",
          JSON.stringify(updated)
        );
      } catch (e) {
        console.log("updateWeatherPreferences AsyncStorage error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            weatherPreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updateWeatherPreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  const updateLocalePreferences = useCallback(
    async (prefs: Partial<LocalePreferences>) => {
      if (prefs.dateFormat) setDateFormat(prefs.dateFormat);
      if (prefs.is24Hour !== undefined) setIs24Hour(prefs.is24Hour);
      if (prefs.firstDayOfWeek) setFirstDayOfWeek(prefs.firstDayOfWeek);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_locale_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_locale_preferences",
          JSON.stringify(updated)
        );
      } catch (e) {
        console.log("updateLocalePreferences AsyncStorage error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            localePreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updateLocalePreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  const updateAccessibilityPreferences = useCallback(
    async (prefs: Partial<AccessibilityPreferences>) => {
      if (prefs.hapticFeedback !== undefined) setHapticFeedback(prefs.hapticFeedback);
      if (prefs.reduceMotion !== undefined) setReduceMotion(prefs.reduceMotion);
      if (prefs.highContrastMode !== undefined) setHighContrastMode(prefs.highContrastMode);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_accessibility_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_accessibility_preferences",
          JSON.stringify(updated)
        );
      } catch (e) {
        console.log("updateAccessibilityPreferences AsyncStorage error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            accessibilityPreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updateAccessibilityPreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  const updatePrivacyPreferences = useCallback(
    async (prefs: Partial<PrivacyPreferences>) => {
      if (prefs.hidePastTrips !== undefined) {
        setHidePastTrips(prefs.hidePastTrips);
        await AsyncStorage.setItem("hide_past_trips", String(prefs.hidePastTrips));
      }
      if (prefs.locationSharing !== undefined) {
        setLocationSharing(prefs.locationSharing);
        await AsyncStorage.setItem("location_sharing_enabled", String(prefs.locationSharing));
      }
      if (prefs.activityStatus !== undefined) {
        setActivityStatus(prefs.activityStatus);
        await AsyncStorage.setItem("activity_status_enabled", String(prefs.activityStatus));
      }
      if (prefs.analyticsCollection !== undefined) {
        setAnalyticsCollection(prefs.analyticsCollection);
        await AsyncStorage.setItem("analytics_collection", String(prefs.analyticsCollection));
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            privacy: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updatePrivacyPreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  const updateTripPreferences = useCallback(
    async (prefs: Partial<TripPreferences>) => {
      setTripPreferences((prev) => ({ ...prev, ...prefs }));

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_trip_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, ...prefs };
        await AsyncStorage.setItem(
          "@bunkmates_trip_preferences",
          JSON.stringify(updated)
        );
      } catch (e) {
        console.log("updateTripPreferences AsyncStorage error:", e);
      }

      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          await updateDoc(userDocRef, {
            tripPreferences: prefs,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("updateTripPreferences Firestore error:", e);
        }
      }
    },
    [user]
  );

  // Format helpers bound to state
  const formatCurrency = useCallback(
    (amount: number | string | undefined | null) => {
      return formatCurrencyValue(amount, currency, showSymbol, autoRoundOff);
    },
    [currency, showSymbol, autoRoundOff]
  );

  const formatTemperature = useCallback(
    (
      tempInCelsius: number | string | undefined | null,
      sourceUnit: "C" | "F" = "C"
    ) => {
      return formatTemperatureValue(tempInCelsius, tempUnit, sourceUnit);
    },
    [tempUnit]
  );

  const convertTemperatureNumber = useCallback(
    (
      tempInCelsius: number | undefined | null,
      sourceUnit: "C" | "F" = "C"
    ): number | null => {
      if (tempInCelsius === undefined || tempInCelsius === null) return null;
      let c = tempInCelsius;
      if (sourceUnit === "F") c = ((c - 32) * 5) / 9;
      if (tempUnit === "°F") return Math.round((c * 9) / 5 + 32);
      if (tempUnit === "K") return Math.round(c + 273.15);
      return Math.round(c);
    },
    [tempUnit]
  );

  const formatDate = useCallback(
    (
      dateInput: Date | string | number | undefined | null,
      formatOverride?: string
    ) => {
      return formatDateValue(dateInput, (formatOverride as DateFormat) || dateFormat);
    },
    [dateFormat]
  );

  const formatTime = useCallback(
    (dateInput?: Date | string | number | null, showSeconds?: boolean) => {
      return formatTimeValue(dateInput, is24Hour, showSeconds);
    },
    [is24Hour]
  );

  const triggerHaptic = useCallback(
    (type: HapticType = "selection") => {
      if (!hapticFeedback) return;
      triggerAppHaptic(type);
    },
    [hapticFeedback]
  );

  return (
    <AppSettingsContext.Provider
      value={{
        // Currency
        currency,
        showSymbol,
        autoRoundOff,
        splitMethod,
        formatCurrency,
        updateCurrencyPreferences,

        // Weather
        tempUnit,
        formatTemperature,
        convertTemperatureNumber,
        updateWeatherPreferences,

        // Locale & Formats
        dateFormat,
        is24Hour,
        firstDayOfWeek,
        formatDate,
        formatTime,
        updateLocalePreferences,

        // Accessibility & Haptics
        hapticFeedback,
        reduceMotion,
        highContrastMode,
        triggerHaptic,
        updateAccessibilityPreferences,

        // Privacy
        hidePastTrips,
        locationSharing,
        activityStatus,
        analyticsCollection,
        updatePrivacyPreferences,

        // Trip Preferences
        tripPreferences,
        updateTripPreferences,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export function useAppSettings(): AppSettingsContextType {
  const context = useContext(AppSettingsContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      currency: memoryCache.currency,
      showSymbol: memoryCache.showSymbol,
      autoRoundOff: memoryCache.autoRoundOff,
      splitMethod: "Equally",
      formatCurrency: (amt) => formatCurrencyValue(amt),
      updateCurrencyPreferences: async () => {},

      tempUnit: memoryCache.tempUnit,
      formatTemperature: (t, src) => formatTemperatureValue(t, undefined, src),
      convertTemperatureNumber: (t) => (t != null ? Math.round(t) : null),
      updateWeatherPreferences: async () => {},

      dateFormat: memoryCache.dateFormat,
      is24Hour: memoryCache.is24Hour,
      firstDayOfWeek: "Sunday",
      formatDate: (d, f) => formatDateValue(d, f as DateFormat),
      formatTime: (d, s) => formatTimeValue(d, undefined, s),
      updateLocalePreferences: async () => {},

      hapticFeedback: memoryCache.hapticFeedback,
      reduceMotion: false,
      highContrastMode: false,
      triggerHaptic: (type) => triggerAppHaptic(type),
      updateAccessibilityPreferences: async () => {},

      hidePastTrips: memoryCache.hidePastTrips,
      locationSharing: true,
      activityStatus: false,
      analyticsCollection: true,
      updatePrivacyPreferences: async () => {},

      tripPreferences: {
        travelStyle: "Budget",
        accommodations: ["Hostel"],
        tripDuration: "4 - 7 Days",
        groupSize: "3 - 6 Bunkmates",
        dietary: ["No Restrictions"],
        activities: ["Museums"],
      },
      updateTripPreferences: async () => {},
    };
  }
  return context;
}
