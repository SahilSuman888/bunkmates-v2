import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dim Quarter Circle radius covering the top quarter cleanly
const AURA_RADIUS = Math.round(SCREEN_WIDTH * 1.08);

export interface ProfileQuarterAmbientAuraProps {
  avatarUri?: string;
  isDark?: boolean;
  backgroundColor?: string;
  extractedColor?: string;
}

export const ProfileQuarterAmbientAura = React.memo(function ProfileQuarterAmbientAura({
  avatarUri,
  isDark = true,
  backgroundColor = '#000000',
  extractedColor,
}: ProfileQuarterAmbientAuraProps) {
  // Only show glow on dark theme for AMOLED contrast
  if (!isDark) return null;

  // Single dominant color from profile picture (fallback to curated warm coral from image)
  const glowColor = useMemo(() => {
    if (extractedColor) return extractedColor;
    return '#E04E38'; // Sahil's dominant jacket/lighting warm tone
  }, [extractedColor]);

  return (
    <View pointerEvents="none" style={styles.absoluteContainer}>
      <Svg width={AURA_RADIUS} height={AURA_RADIUS} style={styles.svgQuarter}>
        <Defs>
          {/* Radial Gradient originating from top-left (cx="0%", cy="0%") */}
          <RadialGradient
            id="quarterAuraGradient"
            cx="0%"
            cy="0%"
            rx="100%"
            ry="100%"
            fx="0%"
            fy="0%"
          >
            {/* Soft inner quarter core */}
            <Stop offset="0%" stopColor={glowColor} stopOpacity="0.38" />
            <Stop offset="25%" stopColor={glowColor} stopOpacity="0.32" />
            <Stop offset="50%" stopColor={glowColor} stopOpacity="0.20" />
            <Stop offset="70%" stopColor={glowColor} stopOpacity="0.10" />
            <Stop offset="88%" stopColor={glowColor} stopOpacity="0.04" />
            {/* Seamless 0% dissolve into AMOLED black background */}
            <Stop offset="100%" stopColor={backgroundColor} stopOpacity="0.0" />
          </RadialGradient>
        </Defs>

        <Rect
          x="0"
          y="0"
          width={AURA_RADIUS}
          height={AURA_RADIUS}
          fill="url(#quarterAuraGradient)"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1, // Behind the scrollable content, above base background
  },
  svgQuarter: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default ProfileQuarterAmbientAura;