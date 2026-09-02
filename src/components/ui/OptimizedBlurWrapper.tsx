import React, { useMemo } from "react";
import { View, StyleSheet, Platform, StyleProp, ViewStyle, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Attempt to load Skia safely with try/catch fallback
let SkiaCanvas: any = null;
let BackdropFilter: any = null;
let Blur: any = null;
let Fill: any = null;

try {
  const skia = require("@shopify/react-native-skia");
  SkiaCanvas = skia.Canvas;
  BackdropFilter = skia.BackdropFilter;
  Blur = skia.Blur;
  Fill = skia.Fill;
} catch (e) {
  // Skia native bindings not active in this environment (e.g. standard Expo Go)
}

export interface OptimizedBlurWrapperProps extends ViewProps {
  intensity?: number; // 0 to 100
  tint?: "dark" | "light" | "default" | "prominent";
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  borderHighlight?: boolean;
}

/**
 * OptimizedBlurWrapper: GPU-accelerated backdrop blur using @shopify/react-native-skia
 * with hardware-accelerated frosted glassmorphism fallback on Android and native backdrop-filter on Web.
 */
export function OptimizedBlurWrapper({
  intensity = 50,
  tint = "dark",
  borderRadius = 0,
  style,
  children,
  borderHighlight = false,
  ...rest
}: OptimizedBlurWrapperProps) {
  const isDark = tint === "dark" || tint === "default" || tint === "prominent";
  const blurRadius = Math.max(Math.round((intensity / 100) * 20), 4);
  const opacityFactor = Math.min(Math.max(intensity / 100, 0.45), 0.94);

  const fallbackBgColor = isDark
    ? `rgba(10, 16, 24, ${opacityFactor * 0.88})`
    : `rgba(255, 255, 255, ${opacityFactor * 0.85})`;

  const borderColor = isDark
    ? "rgba(0, 230, 176, 0.2)"
    : "rgba(255, 255, 255, 0.4)";

  // Skia hardware-accelerated GPU pipeline
  const canUseSkia = SkiaCanvas && BackdropFilter && Blur && Platform.OS === "android";

  const webStyle: any =
    Platform.OS === "web"
      ? {
          backdropFilter: `blur(${blurRadius}px)`,
          WebkitBackdropFilter: `blur(${blurRadius}px)`,
          backgroundColor: fallbackBgColor,
        }
      : {};

  if (canUseSkia) {
    return (
      <View
        style={[
          styles.container,
          { borderRadius, borderColor },
          style,
        ]}
        {...rest}
      >
        <SkiaCanvas style={[StyleSheet.absoluteFill, { borderRadius }]}>
          <BackdropFilter
            filter={<Blur blur={blurRadius} mode="clamp" />}
            clip={{
              rect: {
                x: 0,
                y: 0,
                width: 2000,
                height: 2000,
              },
              rx: borderRadius,
              ry: borderRadius,
            }}
          >
            <Fill
              color={
                isDark
                  ? `rgba(10, 16, 24, ${opacityFactor * 0.65})`
                  : `rgba(255, 255, 255, ${opacityFactor * 0.6})`
              }
            />
          </BackdropFilter>
        </SkiaCanvas>

        {borderHighlight && (
          <LinearGradient
            colors={
              isDark
                ? ["rgba(0, 230, 176, 0.4)", "rgba(0, 230, 176, 0.06)", "transparent"]
                : ["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.2)", "transparent"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.highlightLine, { borderRadius }]}
            pointerEvents="none"
          />
        )}

        {children}
      </View>
    );
  }

  // Graceful hardware-accelerated frosted glass container
  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor: fallbackBgColor,
          borderColor,
        },
        webStyle,
        style,
      ]}
      {...rest}
    >
      {borderHighlight && (
        <LinearGradient
          colors={
            isDark
              ? ["rgba(0, 230, 176, 0.4)", "rgba(0, 230, 176, 0.06)", "transparent"]
              : ["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.2)", "transparent"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.highlightLine, { borderRadius }]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

export default OptimizedBlurWrapper;

const styles = StyleSheet.create({
  container: {
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
