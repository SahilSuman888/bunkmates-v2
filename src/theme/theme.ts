// theme/theme.ts
// Solid dynamic design system implementation matching BUNKMATES_DESIGN_SYSTEM.md
import { Appearance } from 'react-native';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  cardSolid: string;
  cardBorder: string;
  inputBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  accent: string;
  accentBg: string;
  actionPrimary: string;
  onActionPrimary: string;
  isHighContrast: boolean;
  colorBlindMode: string;
}

export const ACCENT_COLORS = {
  coral: '#FF5A5F',
  blue: '#1976d2',
  green: '#43a047',
  orange: '#f9971f',
  purple: '#7c3aed',
  turquoise: '#00bcd6',
  skyblue: '#009de6',
  yellow: '#fbc02d',
  red: '#d32f2f',
  aqua: '#00897b',
  lime: '#afb42b',
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 255;
  const g = parseInt(full.substring(2, 4), 16) || 90;
  const b = parseInt(full.substring(4, 6), 16) || 95;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getCvdSemanticColors = (isDark: boolean, colorBlindMode: string = 'Off') => {
  switch (colorBlindMode) {
    case 'Protanopia':
      return {
        success: '#0284C7', // accessible vivid cyan/blue distinguishable from warm vermilion
        error: '#EA580C',   // warm vermilion/amber replacing red
        warning: '#EAB308',
        info: '#6366F1',
      };
    case 'Deuteranopia':
      return {
        success: '#2563EB', // cobalt blue distinguishable from crimson
        error: '#DC2626',   // deep crimson
        warning: '#D97706',
        info: '#0284C7',
      };
    case 'Tritanopia':
      return {
        success: '#059669', // pure emerald
        error: '#E11D48',   // rose/red
        warning: '#D97706',
        info: '#0D9488',    // deep teal
      };
    case 'Monochromacy':
      return {
        success: isDark ? '#E5E7EB' : '#1F2937',
        error: isDark ? '#FFFFFF' : '#111827',
        warning: isDark ? '#9CA3AF' : '#4B5563',
        info: isDark ? '#CBD5E1' : '#374151',
      };
    default:
      return {
        success: '#10b981',
        error: '#FF5A5F',
        warning: '#f59e0b',
        info: '#3b82f6',
      };
  }
};

const lightThemeBase = {
  secondary: '#6366f1',
  background: '#F1F1F1', // BUNKMATES_DESIGN_SYSTEM.md Section 2.1
  card: '#FFFFFF', // Solid dynamic pure white card
  cardSolid: '#FFFFFF',
  cardBorder: 'transparent',
  inputBg: '#E9EAEF',
  text: '#11141A',
  textSecondary: '#6B7280',
  textMuted: '#8E8E93',
  border: 'transparent', // Zero Border Policy
  divider: '#E6E7EB',
  actionPrimary: '#000000',
  onActionPrimary: '#FFFFFF',
};

const darkThemeBase = {
  secondary: '#818cf8',
  background: '#000000', // BUNKMATES_DESIGN_SYSTEM.md Section 2.1
  card: '#161618', // Solid dynamic deep dark card
  cardSolid: '#161618',
  cardBorder: 'transparent',
  inputBg: '#202024',
  text: '#FFFFFF',
  textSecondary: '#8E95A2',
  textMuted: '#707070',
  border: 'transparent', // Zero Border Policy
  divider: '#242428',
  actionPrimary: '#FFFFFF',
  onActionPrimary: '#000000',
};

export const getTheme = (
  mode: 'dark' | 'light' | 'system',
  accentKey: string = 'coral',
  isHighContrast: boolean = false,
  colorBlindMode: string = 'Off'
): ThemeColors => {
  let effective = mode;
  if (mode === 'system') {
    const cs = Appearance.getColorScheme();
    effective = cs === 'light' ? 'light' : 'dark';
  }

  const resolvedAccent =
    (ACCENT_COLORS as Record<string, string>)[accentKey] || ACCENT_COLORS.coral;

  const isDark = effective === 'dark';
  const base = isDark ? darkThemeBase : lightThemeBase;
  const semantic = getCvdSemanticColors(isDark, colorBlindMode);

  if (isHighContrast) {
    return {
      ...base,
      ...semantic,
      background: isDark ? '#000000' : '#FFFFFF',
      card: isDark ? '#121214' : '#FFFFFF',
      cardSolid: isDark ? '#121214' : '#FFFFFF',
      cardBorder: isDark ? '#38383E' : '#D1D5DB',
      text: isDark ? '#FFFFFF' : '#000000',
      textSecondary: isDark ? '#E5E7EB' : '#1F2937',
      textMuted: isDark ? '#CBD5E1' : '#4B5563',
      border: isDark ? '#38383E' : '#D1D5DB',
      divider: isDark ? '#333338' : '#D1D5DB',
      primary: resolvedAccent,
      accent: resolvedAccent,
      accentBg: hexToRgba(resolvedAccent, isDark ? 0.22 : 0.14),
      isHighContrast: true,
      colorBlindMode,
    };
  }

  return {
    ...base,
    ...semantic,
    primary: resolvedAccent,
    accent: resolvedAccent,
    accentBg: hexToRgba(resolvedAccent, isDark ? 0.16 : 0.10),
    isHighContrast: false,
    colorBlindMode,
  };
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
