// contexts/ThemeContext.tsx
import React, { createContext, useState, useMemo, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { getTheme, ACCENT_COLORS } from '../theme/theme';

export type BackgroundMode = 'solid' | 'gradient' | 'mesh';
export type LocationMode = 'auto' | 'manual';

export interface BackgroundSettings {
  mode: BackgroundMode;
  color: string; // hex
  category: 'neutral' | 'cool' | 'warm' | 'vibrant';
}

export interface ThemeContextType {
  mode: 'dark' | 'light' | 'system';
  setMode: (mode: 'dark' | 'light' | 'system') => void;
  accent: string;
  setAccent: (accent: string) => void;
  toggleTheme: () => void;
  background: BackgroundSettings;
  setBackground: (bg: BackgroundSettings) => void;
  locationMode: LocationMode;
  setLocationMode: (mode: LocationMode) => void;
  themeColors: ReturnType<typeof getTheme>;
  accentColor: string;
}

const ThemeToggleContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeToggleProviderProps {
  children: ReactNode;
}

export const ThemeToggleProvider = ({ children }: ThemeToggleProviderProps) => {
  const [mode, setModeState] = useState<'dark' | 'light' | 'system'>('system');
  const [accent, setAccentState] = useState('default');
  const [background, setBackgroundState] = useState<BackgroundSettings>({
    mode: 'solid',
    color: '#1c1c1e',
    category: 'cool',
  });
  const [locationMode, setLocationModeState] = useState<LocationMode>('auto');

  // Track system appearance changes - declare before useMemo
  const systemScheme = Appearance.getColorScheme();
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>(
    systemScheme === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        const savedAccent = await AsyncStorage.getItem('accent');
        const savedBg = await AsyncStorage.getItem('background');
        const savedLocation = await AsyncStorage.getItem('locationMode');
        if (savedTheme) setModeState(savedTheme as 'dark' | 'light' | 'system');
        if (savedAccent) setAccentState(savedAccent);
        if (savedBg) {
          try {
            setBackgroundState(JSON.parse(savedBg));
          } catch {}
        }
        if (savedLocation) setLocationModeState(savedLocation as LocationMode);
      } catch (error) {
        console.log('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  const setMode = (newMode: 'dark' | 'light' | 'system') => {
    setModeState(newMode);
    AsyncStorage.setItem('theme', newMode).catch(e => console.error('Failed to save theme:', e));
  };

  const setAccent = (newAccent: string) => {
    setAccentState(newAccent);
    AsyncStorage.setItem('accent', newAccent).catch(e => console.error('Failed to save accent:', e));
  };

  const themeColors = React.useMemo(() => {
    if (mode === 'system') {
      return getTheme(systemColorScheme);
    }
    return getTheme(mode);
  }, [mode, systemColorScheme]);
  const accentColor = ACCENT_COLORS[accent as keyof typeof ACCENT_COLORS] || ACCENT_COLORS.coral;

  const setBackground = (bg: BackgroundSettings) => {
    setBackgroundState(bg);
    AsyncStorage.setItem('background', JSON.stringify(bg));
  };

  const setLocationMode = (mode: LocationMode) => {
    setLocationModeState(mode);
    AsyncStorage.setItem('locationMode', mode);
  };

  const toggleTheme = () => {
    let newMode: 'dark' | 'light' | 'system';
    if (mode === 'dark') newMode = 'light';
    else if (mode === 'light') newMode = 'dark';
    else newMode = 'system';
    setMode(newMode);
  };

  // re-trigger when system color scheme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const cs = colorScheme === 'light' ? 'light' : 'dark';
      setSystemColorScheme(cs);
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeToggleContext.Provider
      value={{
        mode,
        setMode,
        accent,
        setAccent,
        toggleTheme,
        background,
        setBackground,
        locationMode,
        setLocationMode,
        themeColors,
        accentColor,
      }}
    >
      {children}
    </ThemeToggleContext.Provider>
  );
};

export const useThemeToggle = () => {
  const context = useContext(ThemeToggleContext);
  if (context === undefined) {
    throw new Error("useThemeToggle must be used within a ThemeToggleProvider");
  }
  return context;
};
