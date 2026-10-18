import React from "react";
import { StyleSheet, View, Platform, StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export interface SettingsHeaderGradientMaskProps {
  backgroundColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  zIndex?: number;
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
 * used in chat messages (`chat/[friendId].tsx`).
 * 
 * Portions & Transparencies:
 * - 0% to 38% (~0px - 45px): 2% to 10% transparency (98% -> 90% solid background) — hides content under top edge and status bar
 * - 38% to 62% (~45px - 72px): 10% to 35% transparency (90% -> 65% opacity) — active dissolve begins right below header buttons
 * - 62% to 80% (~72px - 95px): 35% to 70% transparency (65% -> 30% opacity) — visible feathering / softening
 * - 80% to 92% (~95px - 110px): 70% to 92% transparency (30% -> 8% opacity) — translucent fog transition
 * - 92% to 100% (~110px - 120px): 92% to 100% transparency (8% -> transparent) — smoothly exits into crystal clear list content
 */
export const SettingsHeaderGradientMask: React.FC<SettingsHeaderGradientMaskProps> = React.memo(
  ({ backgroundColor = "#000000", height = 110, style, zIndex = 15 }) => {
    return (
      <LinearGradient
        colors={[
          hexToRgba(backgroundColor, 0.98),
          hexToRgba(backgroundColor, 0.90),
          hexToRgba(backgroundColor, 0.65),
          hexToRgba(backgroundColor, 0.30),
          hexToRgba(backgroundColor, 0.08),
          "transparent",
        ]}
        locations={[0, 0.38, 0.62, 0.80, 0.92, 1.0]}
        pointerEvents="none"
        style={[
          styles.mask,
          {
            height,
            zIndex,
          },
          style,
        ]}
      />
    );
  }
);

const styles = StyleSheet.create({
  mask: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});

export default SettingsHeaderGradientMask;
