import React, { useMemo } from "react";
import { StyleSheet, View, Platform, StatusBar, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SettingsHeaderGradientMaskProps {
  backgroundColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  zIndex?: number;
  position?: "top" | "bottom";
}

const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  if (hex.startsWith("rgb")) {
    // If already rgba or rgb string, extract or adjust
    if (hex.startsWith("rgba")) {
      return hex.replace(/[\d\.]+\)$/g, `${alpha})`);
    }
    return hex.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  const cleanHex = hex.replace("#", "");
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;
  const r = parseInt(fullHex.substring(0, 2), 16) || 0;
  const g = parseInt(fullHex.substring(2, 4), 16) || 0;
  const b = parseInt(fullHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * SettingsHeaderGradientMask — Matches the exact 6-stop dissolve mask
 * used in chat messages (`chat/[friendId].tsx`). Supports both "top" (header)
 * and "bottom" (footer) dissolving with exact inverted mirror stops.
 */
export const SettingsHeaderGradientMask: React.FC<SettingsHeaderGradientMaskProps> = React.memo(
  ({ backgroundColor = "#000000", height, style, zIndex = 15, position = "top" }) => {
    let insets = { top: 0, bottom: 0 };
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      insets = useSafeAreaInsets();
    } catch {
      // safe fallback if outside provider
    }

    const computedHeight = useMemo(() => {
      if (height !== undefined && height !== null) return height;
      if (position === "bottom") {
        const bottomInset = insets.bottom > 0 ? insets.bottom : Platform.OS === "android" ? 16 : 24;
        return bottomInset + 64;
      }
      const topInset = insets.top > 0 ? insets.top : Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 44;
      return topInset + 64;
    }, [height, position, insets.top, insets.bottom]);

    const isBottom = position === "bottom";

    if (isBottom) {
      return (
        <LinearGradient
          colors={[
            "transparent",
            hexToRgba(backgroundColor, 0.02),
            hexToRgba(backgroundColor, 0.16),
            hexToRgba(backgroundColor, 0.50),
            hexToRgba(backgroundColor, 0.90),
            hexToRgba(backgroundColor, 0.98),
          ]}
          locations={[0, 0.25, 0.45, 0.62, 0.78, 1.0]}
          pointerEvents="none"
          style={[
            styles.bottomMask,
            {
              height: computedHeight,
              zIndex,
            },
            style,
          ]}
        />
      );
    }

    return (
      <LinearGradient
        colors={[
          hexToRgba(backgroundColor, 0.98),
          hexToRgba(backgroundColor, 0.90),
          hexToRgba(backgroundColor, 0.50),
          hexToRgba(backgroundColor, 0.16),
          hexToRgba(backgroundColor, 0.02),
          "transparent",
        ]}
        locations={[0, 0.22, 0.38, 0.55, 0.75, 1.0]}
        pointerEvents="none"
        style={[
          styles.topMask,
          {
            height: computedHeight,
            zIndex,
          },
          style,
        ]}
      />
    );
  }
);
SettingsHeaderGradientMask.displayName = "SettingsHeaderGradientMask";

const styles = StyleSheet.create({
  topMask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  bottomMask: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default SettingsHeaderGradientMask;
