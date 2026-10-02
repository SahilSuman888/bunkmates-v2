// contexts/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export type LanguageCode =
  | "en-US"
  | "en-GB"
  | "en-IN"
  | "hi"
  | "es"
  | "fr"
  | "de"
  | "ja"
  | "zh-CN"
  | "pt-BR"
  | "it"
  | "ar"
  | "ru"
  | "ko"
  | "nl"
  | "bn";

// Dictionary of translations for core settings & UI keys
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  // English (US)
  "en-US": {
    "language_region_title": "Language & Region",
    "locale_section": "LOCALE",
    "app_language": "App Language",
    "region": "Region",
    "system_formats_section": "SYSTEM FORMATS",
    "date_format": "Date Format",
    "time_format_24": "Time Format (24-Hour)",
    "time_format_desc": "Use 24-hour clock instead of 12-hour",
    "first_day_of_week": "First Day of Week",
    "live_preview": "LIVE DYNAMIC PREVIEW",
    "week_begins_on": "Week begins on",
    "sunday": "Sunday",
    "monday": "Monday",
    "saturday": "Saturday",
    "select_language": "Select App Language",
    "select_region": "Select Region",
    "choose_date_format": "Choose Date Format",
    "search_languages": "Search languages...",
    "search_region": "Search country or region...",
    "today": "Today",
    "welcome_greeting": "Welcome to Bunkmates",
    "settings": "Settings",
    "appearance": "Appearance",
    "back": "Back",
  },
  // English (UK)
  "en-GB": {
    "language_region_title": "Language & Region",
    "locale_section": "LOCALE",
    "app_language": "App Language",
    "region": "Region",
    "system_formats_section": "SYSTEM FORMATS",
    "date_format": "Date Format",
    "time_format_24": "Time Format (24-Hour)",
    "time_format_desc": "Use 24-hour clock instead of 12-hour",
    "first_day_of_week": "First Day of Week",
    "live_preview": "LIVE DYNAMIC PREVIEW",
    "week_begins_on": "Week begins on",
    "sunday": "Sunday",
    "monday": "Monday",
    "saturday": "Saturday",
    "select_language": "Select App Language",
    "select_region": "Select Region",
    "choose_date_format": "Choose Date Format",
    "search_languages": "Search languages...",
    "search_region": "Search country or region...",
    "today": "Today",
    "welcome_greeting": "Welcome to Bunkmates",
    "settings": "Settings",
    "appearance": "Appearance",
    "back": "Back",
  },
  // English (IN)
  "en-IN": {
    "language_region_title": "Language & Region",
    "locale_section": "LOCALE",
    "app_language": "App Language",
    "region": "Region",
    "system_formats_section": "SYSTEM FORMATS",
    "date_format": "Date Format",
    "time_format_24": "Time Format (24-Hour)",
    "time_format_desc": "Use 24-hour clock instead of 12-hour",
    "first_day_of_week": "First Day of Week",
    "live_preview": "LIVE DYNAMIC PREVIEW",
    "week_begins_on": "Week begins on",
    "sunday": "Sunday",
    "monday": "Monday",
    "saturday": "Saturday",
    "select_language": "Select App Language",
    "select_region": "Select Region",
    "choose_date_format": "Choose Date Format",
    "search_languages": "Search languages...",
    "search_region": "Search country or region...",
    "today": "Today",
    "welcome_greeting": "Welcome to Bunkmates",
    "settings": "Settings",
    "appearance": "Appearance",
    "back": "Back",
  },
  // Hindi (हिन्दी)
  "hi": {
    "language_region_title": "भाषा और क्षेत्र",
    "locale_section": "लोकेल",
    "app_language": "ऐप की भाषा",
    "region": "क्षेत्र",
    "system_formats_section": "सिस्टम प्रारूप",
    "date_format": "तारीख का प्रारूप",
    "time_format_24": "समय प्रारूप (24-घंटे)",
    "time_format_desc": "12-घंटे के बजाय 24-घंटे की घड़ी का प्रयोग करें",
    "first_day_of_week": "सप्ताह का पहला दिन",
    "live_preview": "लाइव पूर्वावलोकन",
    "week_begins_on": "सप्ताह शुरू होता है",
    "sunday": "रविवार",
    "monday": "सोमवार",
    "saturday": "शनिवार",
    "select_language": "ऐप भाषा चुनें",
    "select_region": "क्षेत्र चुनें",
    "choose_date_format": "तारीख प्रारूप चुनें",
    "search_languages": "भाषाएं खोजें...",
    "search_region": "देश या क्षेत्र खोजें...",
    "today": "आज",
    "welcome_greeting": "बंकमेट्स में आपका स्वागत है",
    "settings": "सेटिंग्स",
    "appearance": "दिखावट",
    "back": "पीछे",
  },
  // Spanish (Español)
  "es": {
    "language_region_title": "Idioma y región",
    "locale_section": "LOCAL",
    "app_language": "Idioma de la app",
    "region": "Región",
    "system_formats_section": "FORMATOS DEL SISTEMA",
    "date_format": "Formato de fecha",
    "time_format_24": "Formato de hora (24 horas)",
    "time_format_desc": "Usar reloj de 24 horas en lugar de 12 horas",
    "first_day_of_week": "Primer día de la semana",
    "live_preview": "VISTA PREVIA EN VIVO",
    "week_begins_on": "La semana comienza el",
    "sunday": "Domingo",
    "monday": "Lunes",
    "saturday": "Sábado",
    "select_language": "Seleccionar idioma de la app",
    "select_region": "Seleccionar región",
    "choose_date_format": "Elegir formato de fecha",
    "search_languages": "Buscar idiomas...",
    "search_region": "Buscar país o región...",
    "today": "Hoy",
    "welcome_greeting": "Bienvenido a Bunkmates",
    "settings": "Ajustes",
    "appearance": "Apariencia",
    "back": "Atrás",
  },
  // French (Français)
  "fr": {
    "language_region_title": "Langue et région",
    "locale_section": "PARAMÈTRES RÉGIONAUX",
    "app_language": "Langue de l'application",
    "region": "Région",
    "system_formats_section": "FORMATS DU SYSTÈME",
    "date_format": "Format de la date",
    "time_format_24": "Format de l'heure (24 h)",
    "time_format_desc": "Afficher l'heure sur 24 heures au lieu de 12 heures",
    "first_day_of_week": "Premier jour de la semaine",
    "live_preview": "APERÇU EN DIRECT",
    "week_begins_on": "La semaine commence le",
    "sunday": "Dimanche",
    "monday": "Lundi",
    "saturday": "Samedi",
    "select_language": "Choisir la langue de l'application",
    "select_region": "Choisir la région",
    "choose_date_format": "Choisir le format de la date",
    "search_languages": "Rechercher des langues...",
    "search_region": "Rechercher un pays ou une région...",
    "today": "Aujourd'hui",
    "welcome_greeting": "Bienvenue sur Bunkmates",
    "settings": "Paramètres",
    "appearance": "Apparence",
    "back": "Retour",
  },
  // German (Deutsch)
  "de": {
    "language_region_title": "Sprache & Region",
    "locale_section": "GEBIETSSCHEMA",
    "app_language": "App-Sprache",
    "region": "Region",
    "system_formats_section": "SYSTEMFORMATE",
    "date_format": "Datumsformat",
    "time_format_24": "Zeitformat (24 Stunden)",
    "time_format_desc": "24-Stunden-Format anstelle von 12-Stunden verwenden",
    "first_day_of_week": "Erster Wochentag",
    "live_preview": "LIVE-VORSCHAU",
    "week_begins_on": "Woche beginnt am",
    "sunday": "Sonntag",
    "monday": "Montag",
    "saturday": "Samstag",
    "select_language": "App-Sprache auswählen",
    "select_region": "Region auswählen",
    "choose_date_format": "Datumsformat wählen",
    "search_languages": "Sprachen suchen...",
    "search_region": "Land oder Region suchen...",
    "today": "Heute",
    "welcome_greeting": "Willkommen bei Bunkmates",
    "settings": "Einstellungen",
    "appearance": "Erscheinungsbild",
    "back": "Zurück",
  },
  // Japanese (日本語)
  "ja": {
    "language_region_title": "言語と地域",
    "locale_section": "ロケール",
    "app_language": "アプリの言語",
    "region": "地域",
    "system_formats_section": "システム形式",
    "date_format": "日付の形式",
    "time_format_24": "24時間表示",
    "time_format_desc": "12時間表示ではなく24時間表示を使用",
    "first_day_of_week": "週の最初の曜日",
    "live_preview": "リアルタイムプレビュー",
    "week_begins_on": "週の始まり：",
    "sunday": "日曜日",
    "monday": "月曜日",
    "saturday": "土曜日",
    "select_language": "アプリの言語を選択",
    "select_region": "地域を選択",
    "choose_date_format": "日付の形式を選択",
    "search_languages": "言語を検索...",
    "search_region": "国または地域を検索...",
    "today": "今日",
    "welcome_greeting": "Bunkmatesへようこそ",
    "settings": "設定",
    "appearance": "外観",
    "back": "戻る",
  },
  // Chinese Simplified (简体中文)
  "zh-CN": {
    "language_region_title": "语言与地区",
    "locale_section": "区域设置",
    "app_language": "应用语言",
    "region": "地区",
    "system_formats_section": "系统格式",
    "date_format": "日期格式",
    "time_format_24": "24小时制",
    "time_format_desc": "使用24小时制代替12小时制",
    "first_day_of_week": "每周第一天",
    "live_preview": "实时动态预览",
    "week_begins_on": "每周开始于",
    "sunday": "星期日",
    "monday": "星期一",
    "saturday": "星期六",
    "select_language": "选择应用语言",
    "select_region": "选择地区",
    "choose_date_format": "选择日期格式",
    "search_languages": "搜索语言...",
    "search_region": "搜索国家或地区...",
    "today": "今天",
    "welcome_greeting": "欢迎使用 Bunkmates",
    "settings": "设置",
    "appearance": "外观",
    "back": "返回",
  },
  // Portuguese (Português)
  "pt-BR": {
    "language_region_title": "Idioma e Região",
    "locale_section": "LOCAL",
    "app_language": "Idioma do Aplicativo",
    "region": "Região",
    "system_formats_section": "FORMATOS DO SISTEMA",
    "date_format": "Formato de Data",
    "time_format_24": "Formato de Hora (24h)",
    "time_format_desc": "Usar relógio de 24 horas em vez de 12 horas",
    "first_day_of_week": "Primeiro Dia da Semana",
    "live_preview": "PRÉ-VISUALIZAÇÃO AO VIVO",
    "week_begins_on": "A semana começa no(a)",
    "sunday": "Domingo",
    "monday": "Segunda-feira",
    "saturday": "Sábado",
    "select_language": "Selecionar Idioma do App",
    "select_region": "Selecionar Região",
    "choose_date_format": "Escolher Formato de Data",
    "search_languages": "Pesquisar idiomas...",
    "search_region": "Pesquisar país ou região...",
    "today": "Hoje",
    "welcome_greeting": "Bem-vindo ao Bunkmates",
    "settings": "Configurações",
    "appearance": "Aparência",
    "back": "Voltar",
  },
  // Italian (Italiano)
  "it": {
    "language_region_title": "Lingua e zona",
    "locale_section": "IMPOSTAZIONI REGIONALI",
    "app_language": "Lingua dell'app",
    "region": "Paese",
    "system_formats_section": "FORMATI DI SISTEMA",
    "date_format": "Formato data",
    "time_format_24": "Formato 24 ore",
    "time_format_desc": "Usa orologio a 24 ore anziché a 12 ore",
    "first_day_of_week": "Primo giorno della settimana",
    "live_preview": "ANTEPRIMA DAL VIVO",
    "week_begins_on": "La settimana inizia di",
    "sunday": "Domenica",
    "monday": "Lunedì",
    "saturday": "Sabato",
    "select_language": "Seleziona lingua dell'app",
    "select_region": "Seleziona paese",
    "choose_date_format": "Scegli formato data",
    "search_languages": "Cerca lingue...",
    "search_region": "Cerca paese...",
    "today": "Oggi",
    "welcome_greeting": "Benvenuto su Bunkmates",
    "settings": "Impostazioni",
    "appearance": "Aspetto",
    "back": "Indietro",
  },
  // Arabic (العربية)
  "ar": {
    "language_region_title": "اللغة والمنطقة",
    "locale_section": "الإعدادات المحلية",
    "app_language": "لغة التطبيق",
    "region": "المنطقة",
    "system_formats_section": "تنسيقات النظام",
    "date_format": "تنسيق التاريخ",
    "time_format_24": "تنسيق الوقت (24 ساعة)",
    "time_format_desc": "استخدام نظام 24 ساعة بدلاً من 12 ساعة",
    "first_day_of_week": "أول يوم في الأسبوع",
    "live_preview": "معاينة حية ومباشرة",
    "week_begins_on": "يبدأ الأسبوع يوم",
    "sunday": "الأحد",
    "monday": "الإثنين",
    "saturday": "السبت",
    "select_language": "اختر لغة التطبيق",
    "select_region": "اختر المنطقة",
    "choose_date_format": "اختر تنسيق التاريخ",
    "search_languages": "البحث عن لغات...",
    "search_region": "البحث عن دولة أو منطقة...",
    "today": "اليوم",
    "welcome_greeting": "مرحبًا بك في بانكميتس",
    "settings": "الإعدادات",
    "appearance": "المظهر",
    "back": "رجوع",
  },
  // Russian (Русский)
  "ru": {
    "language_region_title": "Язык и регион",
    "locale_section": "ЛОКАЛЬ",
    "app_language": "Язык приложения",
    "region": "Регион",
    "system_formats_section": "СИСТЕМНЫЕ ФОРМАТЫ",
    "date_format": "Формат даты",
    "time_format_24": "Формат времени (24 ч)",
    "time_format_desc": "Использовать 24-часовой формат вместо 12-часового",
    "first_day_of_week": "Первый день недели",
    "live_preview": "ЖИВОЙ ПРОСМОТР",
    "week_begins_on": "Неделя начинается в",
    "sunday": "Воскресенье",
    "monday": "Понедельник",
    "saturday": "Суббота",
    "select_language": "Выберите язык приложения",
    "select_region": "Выберите регион",
    "choose_date_format": "Выберите формат даты",
    "search_languages": "Поиск языков...",
    "search_region": "Поиск страны или региона...",
    "today": "Сегодня",
    "welcome_greeting": "Добро пожаловать в Bunkmates",
    "settings": "Настройки",
    "appearance": "Внешний вид",
    "back": "Назад",
  },
  // Korean (한국어)
  "ko": {
    "language_region_title": "언어 및 지역",
    "locale_section": "로캘",
    "app_language": "앱 언어",
    "region": "지역",
    "system_formats_section": "시스템 형식",
    "date_format": "날짜 형식",
    "time_format_24": "시간 형식 (24시간)",
    "time_format_desc": "12시간 대신 24시간 형식 사용",
    "first_day_of_week": "한 주의 시작 요일",
    "live_preview": "실시간 미리보기",
    "week_begins_on": "한 주의 시작:",
    "sunday": "일요일",
    "monday": "월요일",
    "saturday": "토요일",
    "select_language": "앱 언어 선택",
    "select_region": "지역 선택",
    "choose_date_format": "날짜 형식 선택",
    "search_languages": "언어 검색...",
    "search_region": "국가 또는 지역 검색...",
    "today": "오늘",
    "welcome_greeting": "Bunkmates에 오신 것을 환영합니다",
    "settings": "설정",
    "appearance": "화면 설정",
    "back": "뒤로",
  },
  // Dutch (Nederlands)
  "nl": {
    "language_region_title": "Taal & Regio",
    "locale_section": "LOCALE",
    "app_language": "App-taal",
    "region": "Regio",
    "system_formats_section": "SYSTEEMINDELING",
    "date_format": "Datumnotatie",
    "time_format_24": "24-uursnotatie",
    "time_format_desc": "Gebruik 24-uursklok in plaats van 12-uursklok",
    "first_day_of_week": "Eerste dag van de week",
    "live_preview": "LIVE VOORBEELD",
    "week_begins_on": "Week begint op",
    "sunday": "Zondag",
    "monday": "Maandag",
    "saturday": "Zaterdag",
    "select_language": "Kies app-taal",
    "select_region": "Kies regio",
    "choose_date_format": "Kies datumnotatie",
    "search_languages": "Zoek talen...",
    "search_region": "Zoek land of regio...",
    "today": "Vandaag",
    "welcome_greeting": "Welkom bij Bunkmates",
    "settings": "Instellingen",
    "appearance": "Weergave",
    "back": "Terug",
  },
  // Bengali (বাংলা)
  "bn": {
    "language_region_title": "ভাষা এবং অঞ্চল",
    "locale_section": "লোকেল",
    "app_language": "অ্যাপের ভাষা",
    "region": "অঞ্চল",
    "system_formats_section": "সিস্টেম ফরম্যাট",
    "date_format": "তারিখের ফরম্যাট",
    "time_format_24": "সময় ফরম্যাট (২৪ ঘণ্টা)",
    "time_format_desc": "১২ ঘণ্টার বদলে ২৪ ঘণ্টার ঘড়ি ব্যবহার করুন",
    "first_day_of_week": "সপ্তাহের প্রথম দিন",
    "live_preview": "লাইভ প্রিভিউ",
    "week_begins_on": "সপ্তাহ শুরু হয়",
    "sunday": "রবিবার",
    "monday": "সোমবার",
    "saturday": "শনিবার",
    "select_language": "অ্যাপ ভাষা নির্বাচন করুন",
    "select_region": "অঞ্চল নির্বাচন করুন",
    "choose_date_format": "তারিখ ফরম্যাট নির্বাচন করুন",
    "search_languages": "ভাষা খুঁজুন...",
    "search_region": "দেশ বা অঞ্চল খুঁজুন...",
    "today": "আজ",
    "welcome_greeting": "বাঙ্কমেইটসে স্বাগতম",
    "settings": "সেটিংস",
    "appearance": "উপস্থিতি",
    "back": "ফিরে যান",
  },
};

interface LanguageContextType {
  language: string;
  languageCode: LanguageCode;
  changeLanguage: (name: string, code: LanguageCode) => Promise<void>;
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return safe fallback if not wrapped
    return {
      language: "English (US)",
      languageCode: "en-US" as LanguageCode,
      changeLanguage: async () => {},
      t: (key: string, defaultText?: string) => {
        const en = TRANSLATIONS["en-US"];
        return (en && en[key]) || defaultText || key;
      },
    };
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [language, setLanguageState] = useState<string>("English (US)");
  const [languageCode, setLanguageCodeState] = useState<LanguageCode>("en-US");
  const [user, setUser] = useState<any>(null);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Restore cached language
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_locale_preferences");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.language) setLanguageState(parsed.language);
          if (parsed.languageCode) setLanguageCodeState(parsed.languageCode);
        }
      } catch (e) {
        console.log("LanguageContext restore error:", e);
      }
    })();

    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const lp = d.localePreferences;
        if (lp) {
          if (lp.language) setLanguageState(lp.language);
          if (lp.languageCode) setLanguageCodeState(lp.languageCode);
        }
      }
    });

    return () => unsub();
  }, [user]);

  const changeLanguage = useCallback(
    async (name: string, code: LanguageCode) => {
      setLanguageState(name);
      setLanguageCodeState(code);

      try {
        const cached = await AsyncStorage.getItem("@bunkmates_locale_preferences");
        const existing = cached ? JSON.parse(cached) : {};
        const updated = { ...existing, language: name, languageCode: code };
        await AsyncStorage.setItem("@bunkmates_locale_preferences", JSON.stringify(updated));
      } catch (e) {
        console.log("LanguageContext save error:", e);
      }

      if (user) {
        try {
          const ref = doc(db, "users", user.uid);
          await updateDoc(ref, {
            "localePreferences.language": name,
            "localePreferences.languageCode": code,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.log("LanguageContext firestore write error:", e);
        }
      }
    },
    [user]
  );

  const t = useCallback(
    (key: string, defaultText?: string): string => {
      const dict = TRANSLATIONS[languageCode] || TRANSLATIONS["en-US"];
      if (dict && dict[key]) {
        return dict[key];
      }
      const fallback = TRANSLATIONS["en-US"];
      if (fallback && fallback[key]) {
        return fallback[key];
      }
      return defaultText || key;
    },
    [languageCode]
  );

  return (
    <LanguageContext.Provider value={{ language, languageCode, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
