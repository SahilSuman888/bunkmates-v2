import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export interface ExpressiveTheme {
  accent: string;
  light: {
    bg: string;
    text: string;
    container: string;
    onContainer: string;
    badgeBg: string;
  };
  dark: {
    bg: string;
    text: string;
    container: string;
    onContainer: string;
    badgeBg: string;
  };
}

export const M3_EXPRESSIVE_PALETTE: Record<string, ExpressiveTheme> = {
  amber: {
    accent: "#f5d397",
    light: { bg: "#FFDEA5", text: "#271900", container: "#FFF2D9", onContainer: "#765B00", badgeBg: "#F0CA85" },
    dark: { bg: "#ffefbe", text: "#271900", container: "#fff5e2", onContainer: "#d99f17", badgeBg: "#594300" },
  },
  blue: {
    accent: "#88b7f0",
    light: { bg: "#D7E3FF", text: "#001B3F", container: "#EEF2FF", onContainer: "#004785", badgeBg: "#BACDF8" },
    dark: { bg: "#d3e7ff", text: "#203362", container: "#e2f0ff", onContainer: "#457ed8", badgeBg: "#003F7D" },
  },
  purple: {
    accent: "#c8b6ff",
    light: { bg: "#EBDCFF", text: "#25005A", container: "#F6EEFF", onContainer: "#6940A5", badgeBg: "#D4BFF2" },
    dark: { bg: "#e2d1ff", text: "#44236f", container: "#ecdeff", onContainer: "#a473ff", badgeBg: "#422271" },
  },
  emerald: {
    accent: "#8cefcb",
    light: { bg: "#A6F5BA", text: "#00210E", container: "#DBFCE3", onContainer: "#006D37", badgeBg: "#8CE3A3" },
    dark: { bg: "#b6ffd7", text: "#21542e", container: "#e4fff0", onContainer: "#17c14d", badgeBg: "#005228" },
  },
  orange: {
    accent: "#ffd6b4",
    light: { bg: "#FFDBCA", text: "#341000", container: "#FFECE2", onContainer: "#984013", badgeBg: "#F6C1A7" },
    dark: { bg: "#ffdac5", text: "#703e26", container: "#ffeae2", onContainer: "#fb712c", badgeBg: "#772F03" },
  },
};

export const PALETTE_KEYS = ["amber", "blue", "purple", "emerald", "orange"] as const;

export const AUTH_SLOGANS = [
  "Travel Smarter\nBuild Memories\nEverywhere",
  "Explore\nTogether\nAlways",
  "Squad Trips\nSimplified\nTogether",
  "Adventure\nStarts\nHere",
];

export const haptic = (strength: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    if (Platform.OS !== 'web') {
      if (strength === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (strength === 'heavy') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else if (typeof window !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate(strength === 'medium' ? 20 : 15);
    }
  } catch {
    // Ignore fallback
  }
};

export const checkPasswordRules = (pwd: string) => ({
  length: pwd.length >= 8,
  uppercase: /[A-Z]/.test(pwd),
  number: /[0-9]/.test(pwd),
  symbol: /[^A-Za-z0-9]/.test(pwd),
});

export const getDicebearAvatar = (seed: string) => {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed)}&radius=50`;
};
