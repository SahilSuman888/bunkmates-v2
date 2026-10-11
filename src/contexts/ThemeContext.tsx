// contexts/ThemeContext.tsx
import React, {
  createContext,
  useState,
  useMemo,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { getTheme, ACCENT_COLORS, ThemeColors } from '../theme/theme';
import { getDesignTokens } from '../theme/designSystem';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAppSettings } from './AppSettingsContext';

export type BackgroundMode = 'solid' | 'gradient' | 'mesh';
export type LocationMode = 'auto' | 'manual';
export type FontSize = 'Small' | 'Medium' | 'Large';

export interface BackgroundSettings {
  mode: BackgroundMode;
  color: string; // hex
  category: 'neutral' | 'cool' | 'warm' | 'vibrant';
}

export interface ThemeContextType {
  mode: 'dark' | 'light' | 'system';
  isDark: boolean;
  setMode: (mode: 'dark' | 'light' | 'system') => void;
  accent: string;
  setAccent: (accent: string) => void;
  accentColor: string;
  toggleTheme: () => void;
  background: BackgroundSettings;
  setBackground: (bg: BackgroundSettings) => void;
  locationMode: LocationMode;
  setLocationMode: (mode: LocationMode) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontScale: number;
  scaleFont: (size: number) => number;
  reduceAnimations: boolean;
  setReduceAnimations: (val: boolean) => void;
  themeColors: ThemeColors;
  tokens: ReturnType<typeof getDesignTokens>;
  accentBg: string;
  highContrastMode: boolean;
  colorBlindMode: string;
  largeTouchTargets: boolean;
}

const ThemeToggleContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeToggleProviderProps {
  children: ReactNode;
}

export const ThemeToggleProvider = ({ children }: ThemeToggleProviderProps) => {
  const [mode, setModeState] = useState<'dark' | 'light' | 'system'>('system');
  const [accent, setAccentState] = useState('coral');
  const [background, setBackgroundState] = useState<BackgroundSettings>({
    mode: 'solid',
    color: '#000000',
    category: 'neutral',
  });
  const [locationMode, setLocationModeState] = useState<LocationMode>('auto');
  const [fontSize, setFontSizeState] = useState<FontSize>('Medium');
  const [reduceAnimations, setReduceAnimationsState] = useState<boolean>(false);

  // Track system appearance changes
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  // Compute effective dark mode state
  const isDark = useMemo(() => {
    if (mode === 'system') {
      return systemColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  // Load from AsyncStorage on startup
  useEffect(() => {
    const loadSavedPreferences = async () => {
      try {
        const [
          savedTheme,
          savedAccent,
          savedBg,
          savedLoc,
          savedTypography,
        ] = await Promise.all([
          AsyncStorage.getItem('theme'),
          AsyncStorage.getItem('accent'),
          AsyncStorage.getItem('background'),
          AsyncStorage.getItem('locationMode'),
          AsyncStorage.getItem('@bunkmates_appearance_typography'),
        ]);

        if (savedTheme) setModeState(savedTheme as 'dark' | 'light' | 'system');
        if (savedAccent) setAccentState(savedAccent);
        if (savedBg) {
          try {
            setBackgroundState(JSON.parse(savedBg));
          } catch {}
        }
        if (savedLoc) setLocationModeState(savedLoc as LocationMode);
        if (savedTypography) {
          try {
            const parsed = JSON.parse(savedTypography);
            if (parsed.fontSize) setFontSizeState(parsed.fontSize);
            if (parsed.reduceAnimations !== undefined)
              setReduceAnimationsState(parsed.reduceAnimations);
          } catch {}
        }
      } catch (error) {
        console.log('Error loading appearance preferences:', error);
      }
    };
    loadSavedPreferences();
  }, []);

  // Listen to Auth & sync with Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          const uData = snap.data();
          const prefs = uData.appearancePreferences;
          if (prefs) {
            if (prefs.theme) {
              setModeState(prefs.theme);
              AsyncStorage.setItem('theme', prefs.theme).catch(() => {});
            }
            if (prefs.accent) {
              setAccentState(prefs.accent);
              AsyncStorage.setItem('accent', prefs.accent).catch(() => {});
            }
            if (prefs.background) {
              setBackgroundState(prefs.background);
              AsyncStorage.setItem('background', JSON.stringify(prefs.background)).catch(() => {});
            }
            if (prefs.locationMode) {
              setLocationModeState(prefs.locationMode);
              AsyncStorage.setItem('locationMode', prefs.locationMode).catch(() => {});
            }
            if (prefs.fontSize) {
              setFontSizeState(prefs.fontSize);
            }
            if (prefs.reduceAnimations !== undefined) {
              setReduceAnimationsState(prefs.reduceAnimations);
            }
          }
        }
      } catch (err) {
        console.log('Firestore appearance sync error:', err);
      }
    });
    return () => unsub();
  }, []);

  // Performance-optimized debounced Firestore sync
  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefsRef = React.useRef<{ [key: string]: any }>({});

  const saveToFirestore = React.useCallback((key: string, val: any) => {
    pendingPrefsRef.current[key] = val;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      const updates = { ...pendingPrefsRef.current };
      pendingPrefsRef.current = {};
      const payload: any = { updatedAt: new Date() };
      Object.keys(updates).forEach((k) => {
        payload[`appearancePreferences.${k}`] = updates[k];
      });
      updateDoc(doc(db, 'users', currentUid), payload).catch(() => {});
    }, 600);
  }, []);

  const setMode = React.useCallback((newMode: 'dark' | 'light' | 'system') => {
    setModeState(newMode);
    AsyncStorage.setItem('theme', newMode).catch(() => {});
    saveToFirestore('theme', newMode);
  }, [saveToFirestore]);

  const setAccent = React.useCallback((newAccent: string) => {
    setAccentState(newAccent);
    AsyncStorage.setItem('accent', newAccent).catch(() => {});
    saveToFirestore('accent', newAccent);
  }, [saveToFirestore]);

  const setBackground = React.useCallback((bg: BackgroundSettings) => {
    setBackgroundState(bg);
    AsyncStorage.setItem('background', JSON.stringify(bg)).catch(() => {});
    saveToFirestore('background', bg);
  }, [saveToFirestore]);

  const setLocationMode = React.useCallback((modeVal: LocationMode) => {
    setLocationModeState(modeVal);
    AsyncStorage.setItem('locationMode', modeVal).catch(() => {});
    saveToFirestore('locationMode', modeVal);
  }, [saveToFirestore]);

  const setFontSize = React.useCallback((size: FontSize) => {
    setFontSizeState(size);
    AsyncStorage.getItem('@bunkmates_appearance_typography').then((raw) => {
      let redAnim = false;
      if (raw) {
        try { redAnim = JSON.parse(raw).reduceAnimations ?? false; } catch {}
      }
      AsyncStorage.setItem(
        '@bunkmates_appearance_typography',
        JSON.stringify({ fontSize: size, reduceAnimations: redAnim })
      ).catch(() => {});
    }).catch(() => {});
    saveToFirestore('fontSize', size);
  }, [saveToFirestore]);

  const setReduceAnimations = React.useCallback((val: boolean) => {
    setReduceAnimationsState(val);
    AsyncStorage.getItem('@bunkmates_appearance_typography').then((raw) => {
      let fSize: FontSize = 'Medium';
      if (raw) {
        try { fSize = JSON.parse(raw).fontSize || 'Medium'; } catch {}
      }
      AsyncStorage.setItem(
        '@bunkmates_appearance_typography',
        JSON.stringify({ fontSize: fSize, reduceAnimations: val })
      ).catch(() => {});
    }).catch(() => {});
    saveToFirestore('reduceAnimations', val);
  }, [saveToFirestore]);

  const toggleTheme = React.useCallback(() => {
    setModeState((prev) => {
      let next: 'dark' | 'light' | 'system';
      if (prev === 'dark') next = 'light';
      else if (prev === 'light') next = 'dark';
      else next = 'system';
      AsyncStorage.setItem('theme', next).catch(() => {});
      saveToFirestore('theme', next);
      return next;
    });
  }, [saveToFirestore]);

  // Font scale helper: Small = 0.85x, Medium = 1.0x, Large = 1.18x
  const fontScale = useMemo(() => {
    switch (fontSize) {
      case 'Small':
        return 0.85;
      case 'Large':
        return 1.18;
      case 'Medium':
      default:
        return 1.0;
    }
  }, [fontSize]);

  const scaleFont = React.useCallback((size: number) => {
    if (fontScale === 1.0) return size;
    return Math.round(size * fontScale);
  }, [fontScale]);

  const resolvedAccentKey = accent === 'default' ? 'coral' : accent;
  const accentColor = useMemo(() => {
    return (ACCENT_COLORS as Record<string, string>)[resolvedAccentKey] || ACCENT_COLORS.coral;
  }, [resolvedAccentKey]);

  let appSettingsHighContrast = false;
  let appSettingsReduceMotion = false;
  let appSettingsColorBlind = "Off";
  let appSettingsLargeTouch = true;
  try {
    const appSettings = useAppSettings();
    if (appSettings) {
      appSettingsHighContrast = appSettings.highContrastMode;
      appSettingsReduceMotion = appSettings.reduceMotion;
      appSettingsColorBlind = appSettings.colorBlindMode;
      appSettingsLargeTouch = appSettings.largeTouchTargets;
    }
  } catch (e) {}

  const themeColors = useMemo(() => {
    return getTheme(isDark ? 'dark' : 'light', resolvedAccentKey, appSettingsHighContrast, appSettingsColorBlind);
  }, [isDark, resolvedAccentKey, appSettingsHighContrast, appSettingsColorBlind]);

  const tokens = useMemo(() => {
    return getDesignTokens(isDark ? 'dark' : 'light', appSettingsHighContrast);
  }, [isDark, appSettingsHighContrast]);

  const effectiveReduceAnimations = reduceAnimations || appSettingsReduceMotion;

  const contextValue = useMemo<ThemeContextType>(() => ({
    mode,
    isDark,
    setMode,
    accent,
    setAccent,
    accentColor,
    accentBg: themeColors.accentBg,
    toggleTheme,
    background,
    setBackground,
    locationMode,
    setLocationMode,
    fontSize,
    setFontSize,
    fontScale,
    scaleFont,
    reduceAnimations: effectiveReduceAnimations,
    setReduceAnimations,
    themeColors,
    tokens,
    highContrastMode: appSettingsHighContrast,
    colorBlindMode: appSettingsColorBlind,
    largeTouchTargets: appSettingsLargeTouch,
  }), [
    mode,
    isDark,
    setMode,
    accent,
    setAccent,
    accentColor,
    themeColors,
    toggleTheme,
    background,
    setBackground,
    locationMode,
    setLocationMode,
    fontSize,
    setFontSize,
    fontScale,
    scaleFont,
    effectiveReduceAnimations,
    setReduceAnimations,
    tokens,
    appSettingsHighContrast,
    appSettingsColorBlind,
    appSettingsLargeTouch,
  ]);

  return (
    <ThemeToggleContext.Provider value={contextValue}>
      {children}
    </ThemeToggleContext.Provider>
  );
};

export const useThemeToggle = () => {
  const context = useContext(ThemeToggleContext);
  if (context === undefined) {
    throw new Error('useThemeToggle must be used within a ThemeToggleProvider');
  }
  return context;
};
