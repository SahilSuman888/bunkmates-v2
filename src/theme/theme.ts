// theme/theme.ts
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

const lightTheme: ThemeColors = {
  primary: '#00f721',
  secondary: '#6366f1',
  background: '#ffffff',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e5e5e5',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

const darkTheme: ThemeColors = {
  primary: '#00f721',
  secondary: '#818cf8',
  background: '#0c0c0c',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: 'rgba(255,255,255,0.1)',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export const ACCENT_COLORS = {
  blue: '#1976d2',
  green: '#43a047',
  orange: '#f9971f',
  turquoise: '#00bcd6',
  skyblue: '#009de6',
  yellow: '#fbc02d',
  coral: '#ff7043',
  red: '#d32f2f',
  aqua: '#00897b',
  lime: '#afb42b',
};

import { Appearance } from 'react-native';

export const getTheme = (mode: 'dark' | 'light' | 'system'): ThemeColors => {
  let effective = mode;
  if (mode === 'system') {
    const cs = Appearance.getColorScheme();
    effective = cs === 'light' ? 'light' : 'dark';
  }
  return effective === 'dark' ? darkTheme : lightTheme;
};

export const PRIORITY_COLORS = {
  high: {
    bg: '#fecaca',
    icon: '#dc2626',
    label: 'High',
  },
  medium: {
    bg: '#fcd34d',
    icon: '#d97706',
    label: 'Medium',
  },
  low: {
    bg: '#a7f3d0',
    icon: '#059669',
    label: 'Low',
  },
};

export const AQI_SCALE = [
  { max: 50, label: 'Good', color: '#ffffff' },
  { max: 100, label: 'Moderate', color: '#009E73' },
  { max: 150, label: 'Unhealthy', color: '#E69F00' },
  { max: 200, label: 'Very Unhealthy', color: '#D55E00' },
  { max: 300, label: 'Severe', color: '#f0300e' },
  { max: Infinity, label: 'Hazardous', color: '#7F0000' },
];
