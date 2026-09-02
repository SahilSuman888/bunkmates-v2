import React from "react";
import { View, StyleSheet, Platform, ViewProps, StyleProp, ViewStyle } from "react-native";
import { BlurView as ExpoBlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export type BlurTint =
  | "dark"
  | "light"
  | "default"
  | "prominent"
  | "systemUltraThinMaterial"
  | "systemThinMaterial"
  | "systemMaterial"
  | "systemThickMaterial"
  | "systemChromeMaterial"
  | "systemUltraThinMaterialLight"
  | "systemThinMaterialLight"
  | "systemMaterialLight"
  | "systemThickMaterialLight"
  | "systemChromeMaterialLight"
  | "systemUltraThinMaterialDark"
  | "systemThinMaterialDark"
  | "systemMaterialDark"
  | "systemThickMaterialDark"
  | "systemChromeMaterialDark";

export interface AppBlurViewProps extends ViewProps {
  intensity?: number;
  tint?: BlurTint;
  experimentalBlurMethod?: "none" | "dimezisBlurView";
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  borderHighlight?: boolean;
}

/**
 * AppBlurView: High-performance, universal blur & glassmorphism component.
 * - iOS: Native UIVisualEffectView via expo-blur.
 * - Android: Hardware-accelerated frosted glass surface tuned to prevent black-screen/opaque glitches.
 * - Web: CSS backdrop-filter with smooth fallbacks.
 */
import { OptimizedBlurWrapper } from "./OptimizedBlurWrapper";

export { OptimizedBlurWrapper };

export function AppBlurView({
  intensity = 60,
  tint = "dark",
  experimentalBlurMethod,
  style,
  children,
  borderHighlight = false,
  ...rest
}: AppBlurViewProps) {
  if (Platform.OS === "ios") {
    return (
      <ExpoBlurView
        intensity={intensity}
        tint={tint as any}
        style={style}
        {...rest}
      >
        {children}
      </ExpoBlurView>
    );
  }

  // Android & Web: Skia GPU-accelerated or frosted glass blur wrapper
  return (
    <OptimizedBlurWrapper
      intensity={intensity}
      tint={tint === "light" ? "light" : "dark"}
      style={style}
      borderHighlight={borderHighlight}
      {...rest}
    >
      {children}
    </OptimizedBlurWrapper>
  );
}

// Named and default export for maximum compatibility
export { AppBlurView as BlurView };
export default AppBlurView;

const styles = StyleSheet.create({
  androidContainer: {
    overflow: "hidden",
  },
  highlightLine: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    height: 1.5,
  },
});
