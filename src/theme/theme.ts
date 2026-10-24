// theme/theme.ts
// Solid dynamic design system implementation matching BUNKMATES_DESIGN_SYSTEM.md
import { Appearance } from 'react-native';

/**
 * Calculates WCAG 2.1 relative luminance of a hex color.
 */
export function getRelativeLuminance(hex: string): number {
  if (!hex || typeof hex !== 'string') return 0;
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.length >= 6
      ? clean.substring(0, 6)
      : '000000';
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;

  const aR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const aG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const aB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * aR + 0.7152 * aG + 0.0722 * aB;
}

/**
 * Returns true if the color has high relative luminance (> 0.45), e.g. white, yellow, light pastel.
 */
export function isBrightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.45;
}

/**
 * Returns a high-contrast foreground color (dark or light) for a given background color.
 */
export function getContrastingTextColor(
  bgHex: string,
  darkColor: string = '#000000',
  lightColor: string = '#FFFFFF'
): string {
  return isBrightColor(bgHex) ? darkColor : lightColor;
}

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
  onAccent: string;
  accentText: string;
  accentButtonBg: string;
  onAccentButton: string;
  accentButtonBorder: string;
  accentBorder: string;
  actionPrimary: string;
  onActionPrimary: string;
  placeholder: string;
  disabled: string;
  disabledText: string;
  selectedBg: string;
  selectedText: string;
  active: string;
  pressed: string;
  switchActive: string;
  switchKnobActive: string;
  switchInactive: string;
  isHighContrast: boolean;
  colorBlindMode: string;
  boldText?: boolean;
}

export const ACCENT_COLORS = {
  coral: '#FF5A5F',
  default: '#FF5A5F',
  white: '#FFFFFF',
  navWhite: '#FFFFFF',
  '#FFFFFF': '#FFFFFF',
  '#ffffff': '#FFFFFF',
  orange: '#f9971f',
  green: '#43a047',
  blue: '#1976d2',
  purple: '#7c3aed',
  turquoise: '#00bcd6',
  skyblue: '#009de6',
  yellow: '#fbc02d',
  red: '#d32f2f',
  aqua: '#00897b',
  lime: '#afb42b',
};

export const hexToRgba = (hex: string, alpha: number) => {
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
        error: '#EF4444',
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
  colorBlindMode: string = 'Off',
  boldText: boolean = false
): ThemeColors => {
  let effective = mode;
  if (mode === 'system') {
    const cs = Appearance.getColorScheme();
    effective = cs === 'light' ? 'light' : 'dark';
  }

  const isDark = effective === 'dark';
  const base = isDark ? darkThemeBase : lightThemeBase;
  const semantic = getCvdSemanticColors(isDark, colorBlindMode);

  // Preserve the actual accent color chosen by the user (never replace white with black)
  const resolvedAccent =
    (ACCENT_COLORS as Record<string, string>)[accentKey] ||
    (accentKey.startsWith('#') ? accentKey : ACCENT_COLORS.coral);

  const isBrightAccent = isBrightColor(resolvedAccent);

  // High-contrast foreground for text/icons placed directly on an accent background
  const onAccent = getContrastingTextColor(
    resolvedAccent,
    isDark ? '#000000' : '#11141A',
    '#FFFFFF'
  );

  // When accent is applied to text or icons on standard surfaces:
  // - On dark surfaces (#161618): white/bright accent is crisp and legible (15:1 contrast).
  // - On light surfaces (#FFFFFF): white accent would be invisible, so fallback to #11141A.
  const accentText = isDark
    ? resolvedAccent
    : isBrightAccent
    ? '#11141A'
    : resolvedAccent;

  const accentButtonBg = resolvedAccent;
  const onAccentButton = onAccent;
  const accentButtonBorder =
    isBrightAccent && !isDark ? 'rgba(0, 0, 0, 0.20)' : 'transparent';

  const accentBg = isDark
    ? hexToRgba(resolvedAccent, 0.16)
    : isBrightAccent
    ? 'rgba(0, 0, 0, 0.08)'
    : hexToRgba(resolvedAccent, 0.10);

  const accentBorder =
    isBrightAccent && !isDark ? 'rgba(0, 0, 0, 0.15)' : 'transparent';

  const switchActive = resolvedAccent;
  const switchKnobActive = isBrightAccent ? (isDark ? '#161618' : '#11141A') : '#FFFFFF';
  const switchInactive = isDark ? '#2A2D36' : '#E5E7EB';

  const placeholder = isDark ? '#707070' : '#9CA3AF';
  const disabled = isDark ? '#2A2A30' : '#E5E7EB';
  const disabledText = isDark ? '#555860' : '#9CA3AF';
  const selectedBg = isDark
    ? isBrightAccent
      ? 'rgba(255, 255, 255, 0.14)'
      : hexToRgba(resolvedAccent, 0.20)
    : isBrightAccent
    ? 'rgba(0, 0, 0, 0.08)'
    : hexToRgba(resolvedAccent, 0.12);
  const selectedText = accentText;
  const active = resolvedAccent;
  const pressed = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

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
      onAccent,
      accentText,
      accentButtonBg,
      onAccentButton,
      accentButtonBorder,
      accentBorder,
      placeholder,
      disabled,
      disabledText,
      selectedBg,
      selectedText,
      active,
      pressed,
      switchActive,
      switchKnobActive,
      switchInactive,
      isHighContrast: true,
      colorBlindMode,
      boldText,
    };
  }

  return {
    ...base,
    ...semantic,
    primary: resolvedAccent,
    accent: resolvedAccent,
    accentBg,
    onAccent,
    accentText,
    accentButtonBg,
    onAccentButton,
    accentButtonBorder,
    accentBorder,
    placeholder,
    disabled,
    disabledText,
    selectedBg,
    selectedText,
    active,
    pressed,
    switchActive,
    switchKnobActive,
    switchInactive,
    isHighContrast: false,
    colorBlindMode,
    boldText,
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
