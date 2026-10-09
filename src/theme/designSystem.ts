// theme/designSystem.ts
// Direct implementation of BUNKMATES_DESIGN_SYSTEM.md specifications

import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export const BUNKMATES_TOKENS = {
  colors: {
    dark: {
      background: '#000000',
      card: '#161618',
      cardElevated: '#1A1A1E',
      cardSolid: '#161618',
      textPrimary: '#FFFFFF',
      textSecondary: '#A0A0A0',
      textMuted: '#707070',
      actionPrimary: '#FFFFFF',
      onActionPrimary: '#000000',
      skeletonBase: '#222226',
      skeletonHighlight: '#2A2A30',
      errorBadgeBg: 'rgba(255, 90, 95, 0.15)',
      errorAccent: '#FF5A5F',
      divider: '#242428',
    },
    light: {
      background: '#F1F1F1',
      card: '#FFFFFF',
      cardElevated: '#FFFFFF',
      cardSolid: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#666666',
      textMuted: '#8E8E93',
      actionPrimary: '#000000',
      onActionPrimary: '#FFFFFF',
      skeletonBase: '#E2E5EA',
      skeletonHighlight: '#ECEEF2',
      errorBadgeBg: 'rgba(255, 90, 95, 0.09)',
      errorAccent: '#FF5A5F',
      divider: '#E6E7EB',
    },
  },

  radius: {
    chip: 22,
    button: 26,
    input: 26,
    card: 30,
    panel: 32,
    full: 9999,
  },

  // Reflections as defined in design system (no borders allowed anywhere)
  reflection: {
    dark: {
      small: Platform.select({
        web: {
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)',
        },
        default: {},
      }),
      large: Platform.select({
        web: {
          boxShadow:
            'inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0, 0, 0, 0.1)',
        },
        default: {},
      }),
    },
    light: {
      small: Platform.select({
        web: {
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(0, 0, 0, 0.1)',
        },
        default: {},
      }),
      large: Platform.select({
        web: {
          boxShadow:
            'inset 0 1px 1px rgba(255, 255, 255, 0.8), inset 0 -1px 1px rgba(0, 0, 0, 0.1), 0 1px 0px rgba(0, 0, 0, 0.1)',
        },
        default: {},
      }),
    },
  },
};

export const getDesignTokens = (mode: ThemeMode = 'light', isHighContrast: boolean = false) => {
  const isDark = mode === 'dark';
  const baseColors = isDark ? BUNKMATES_TOKENS.colors.dark : BUNKMATES_TOKENS.colors.light;

  const colors = isHighContrast
    ? {
        ...baseColors,
        background: isDark ? '#000000' : '#FFFFFF',
        card: isDark ? '#121214' : '#FFFFFF',
        cardElevated: isDark ? '#16161A' : '#FFFFFF',
        cardSolid: isDark ? '#121214' : '#FFFFFF',
        textPrimary: isDark ? '#FFFFFF' : '#000000',
        textSecondary: isDark ? '#E5E7EB' : '#1F2937',
        textMuted: isDark ? '#CBD5E1' : '#4B5563',
        divider: isDark ? '#333338' : '#D1D5DB',
      }
    : baseColors;

  return {
    isDark,
    isHighContrast,
    colors,
    radius: BUNKMATES_TOKENS.radius,
    reflection: isDark ? BUNKMATES_TOKENS.reflection.dark : BUNKMATES_TOKENS.reflection.light,
  };
};
