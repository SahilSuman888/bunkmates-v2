import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Pressable,
  StyleProp,
  ViewStyle,
  Platform,
  Appearance,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { isBrightColor } from "../../theme/theme";

// Dimensions matching iOS/Material modern toggle
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const TRACK_RADIUS = 15;
const KNOB_HEIGHT = 24;
const KNOB_REST_WIDTH = 24;
const KNOB_MAX_WIDTH = 35; // Squash & Stretch expansion width
const PADDING = 3;
const TRAVEL_DISTANCE = TRACK_WIDTH - KNOB_REST_WIDTH - PADDING * 2; // 22px

export interface BunkmatesAnimatedSwitchProps {
  value: boolean;
  onValueChange?: (nextValue: boolean) => void;
  disabled?: boolean;
  activeTrackColor?: string;
  inactiveTrackColor?: string;
  thumbColor?: string;
  pointerEvents?: "none" | "auto" | "box-none";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function BunkmatesAnimatedSwitch({
  value,
  onValueChange,
  disabled = false,
  activeTrackColor,
  inactiveTrackColor,
  thumbColor = "#FFFFFF",
  pointerEvents,
  style,
  accessibilityLabel,
  testID,
}: BunkmatesAnimatedSwitchProps) {
  // Theme context for dynamic fallback colors
  let isDark = true;
  let dynamicAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      isDark =
        themeContext.mode === "dark" ||
        (themeContext.mode === "system" && Appearance.getColorScheme() === "dark");
      if (themeContext.accentColor) {
        dynamicAccent = themeContext.accentColor;
      }
    }
  } catch {}

  // Zero-Red: Pure #FF0000 is forbidden
  const effectiveActiveTrack =
    activeTrackColor && activeTrackColor.toLowerCase() !== "#ff0000" && activeTrackColor.toLowerCase() !== "red"
      ? activeTrackColor
      : dynamicAccent || "#FF5A5F";

  const effectiveInactiveTrack =
    inactiveTrackColor || (isDark ? "#242428" : "#E2E8F0");

  const isBrightTrack = isBrightColor(effectiveActiveTrack);

  // If track is white/bright and default white thumb is used, ensure knob contrasts with track when active
  const targetKnobActiveColor =
    thumbColor !== "#FFFFFF"
      ? thumbColor
      : isBrightTrack
      ? (isDark ? "#161618" : "#11141A")
      : "#FFFFFF";

  // Reanimated Shared Values
  const progress = useSharedValue(value ? 1 : 0);

  // Direction: 1 = turning ON (left to right), -1 = turning OFF (right to left)
  const direction = useSharedValue(value ? 1 : -1);

  // Ref to track initial mount (prevent initial haptic trigger)
  const isFirstRender = useRef(true);

  // Watch `value` prop changes
  useEffect(() => {
    direction.value = value ? 1 : -1;

    // Elastic Knob Movement with Spring Physics (damping: 15, stiffness: 180)
    progress.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 180,
      mass: 0.8,
    });

    if (!isFirstRender.current) {
      // Instant light impact haptic feedback
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
    } else {
      isFirstRender.current = false;
    }
  }, [value]);

  // Handle direct tap on the switch
  const handlePress = () => {
    if (disabled || !onValueChange) return;
    onValueChange(!value);
  };

  // 1. Animated Track Style
  const animatedTrackStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      progress.value,
      [0, 1],
      [effectiveInactiveTrack, effectiveActiveTrack]
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      ["transparent", isBrightTrack && !isDark ? "rgba(0, 0, 0, 0.16)" : "transparent"]
    );
    return {
      backgroundColor: bg,
      borderColor: borderColor,
      borderWidth: isBrightTrack && !isDark ? 1 : 0,
    };
  });

  // 2. Animated Elastic Knob Style (Squash & Stretch with High Contrast Knob)
  const animatedKnobStyle = useAnimatedStyle(() => {
    // Width expands horizontally (~24px to ~35px) during middle of transition
    const width = interpolate(
      progress.value,
      [0, 0.45, 0.55, 1],
      [KNOB_REST_WIDTH, KNOB_MAX_WIDTH, KNOB_MAX_WIDTH, KNOB_REST_WIDTH],
      Extrapolation.CLAMP
    );

    let translateX: number;
    if (direction.value >= 0) {
      // Turning ON (0 -> 1)
      translateX = interpolate(
        progress.value,
        [0, 0.5, 1],
        [0, 4.5, TRAVEL_DISTANCE],
        Extrapolation.CLAMP
      );
    } else {
      // Turning OFF (1 -> 0)
      translateX = interpolate(
        progress.value,
        [0, 0.5, 1],
        [0, 12.5, TRAVEL_DISTANCE],
        Extrapolation.CLAMP
      );
    }

    const knobBg = interpolateColor(
      progress.value,
      [0, 1],
      [thumbColor, targetKnobActiveColor]
    );

    return {
      width,
      backgroundColor: knobBg,
      transform: [{ translateX }],
    };
  });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || pointerEvents === "none"}
      pointerEvents={pointerEvents}
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.container, disabled && styles.disabled, style]}
    >
      {/* Pill Track */}
      <Animated.View style={[styles.track, animatedTrackStyle]}>
        {/* Elastic Rubber / Liquid Knob */}
        <Animated.View
          style={[
            styles.knob,
            animatedKnobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export default BunkmatesAnimatedSwitch;

const styles = StyleSheet.create({
  container: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    padding: PADDING,
    justifyContent: "center",
  },
  knob: {
    height: KNOB_HEIGHT,
    borderRadius: KNOB_HEIGHT / 2, // Keeps pill shape when stretched
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0.28,
    shadowRadius: 3,
    elevation: 3,
  },
});
