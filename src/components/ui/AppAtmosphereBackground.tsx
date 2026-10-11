// components/ui/AppAtmosphereBackground.tsx
import React from 'react';
import { View, StyleSheet, Dimensions, Platform, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useThemeToggle } from '../../contexts/ThemeContext';

export const AppAtmosphereBackground: React.FC = React.memo(() => {
  const { background, isDark, themeColors, highContrastMode } = useThemeToggle();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  // Solid background mode or High Contrast Mode: clean solid base color handled directly by root/screen backgrounds
  if (background.mode === 'solid' || highContrastMode) {
    return null;
  }

  const baseBg = themeColors.background;
  const atmosphereColor = background.color || (isDark ? '#003566' : '#d0e1fd');

  // Web rendering
  if (Platform.OS === 'web') {
    const webBackground =
      background.mode === 'gradient'
        ? `radial-gradient(circle at 80% 20%, ${atmosphereColor}55 0%, ${baseBg} 70%)`
        : `radial-gradient(circle at 80% 15%, ${atmosphereColor}44 0%, transparent 60%), radial-gradient(circle at 15% 85%, ${atmosphereColor}33 0%, ${baseBg} 70%)`;

    return (
      <View
        pointerEvents="none"
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundColor: baseBg,
              background: webBackground,
            } as any,
          ]
        }
      />
    );
  }

  // Native rendering using SVG Radial Gradients
  const cx1 = SCREEN_WIDTH * 0.8;
  const cy1 = SCREEN_HEIGHT * 0.15;
  const r1 = SCREEN_WIDTH * 0.85;

  const cx2 = SCREEN_WIDTH * 0.15;
  const cy2 = SCREEN_HEIGHT * 0.8;
  const r2 = SCREEN_WIDTH * 0.75;

  const glowOpacity = isDark ? 0.45 : 0.28;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg height={SCREEN_HEIGHT} width={SCREEN_WIDTH} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="atmosphereGlow1"
            cx={cx1}
            cy={cy1}
            r={r1}
            fx={cx1}
            fy={cy1}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={atmosphereColor} stopOpacity={glowOpacity} />
            <Stop offset="50%" stopColor={atmosphereColor} stopOpacity={glowOpacity * 0.45} />
            <Stop offset="100%" stopColor={baseBg} stopOpacity={0} />
          </RadialGradient>

          {background.mode === 'mesh' && (
            <RadialGradient
              id="atmosphereGlow2"
              cx={cx2}
              cy={cy2}
              r={r2}
              fx={cx2}
              fy={cy2}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={atmosphereColor} stopOpacity={glowOpacity * 0.75} />
              <Stop offset="60%" stopColor={baseBg} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>

        {/* Base Canvas */}
        <Rect x="0" y="0" width="100%" height="100%" fill={baseBg} />

        {/* Primary Atmosphere Glow */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#atmosphereGlow1)" />

        {/* Secondary Mesh Glow for mesh mode */}
        {background.mode === 'mesh' && (
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#atmosphereGlow2)" />
        )}
      </Svg>
    </View>
  );
});

export interface AtmospherePreviewBoxProps {
  mode: 'solid' | 'gradient' | 'mesh';
  color: string;
  isDark: boolean;
  style?: ViewStyle;
}

export const AtmospherePreviewBox: React.FC<AtmospherePreviewBoxProps> = React.memo(({
  mode,
  color,
  isDark,
  style,
}) => {
  const baseBg = isDark ? '#000000' : '#F1F1F1';

  if (mode === 'solid') {
    return (
      <View
        style={[
          {
            backgroundColor: color || baseBg,
            borderRadius: 16,
            overflow: 'hidden',
          },
          style,
        ]}
      />
    );
  }

  const atmosphereColor = color || (isDark ? '#003566' : '#d0e1fd');
  const glowOpacity = isDark ? 0.6 : 0.45;

  return (
    <View
      style={[
        {
          backgroundColor: baseBg,
          borderRadius: 16,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="previewGlow1"
            cx="85%"
            cy="20%"
            r="80%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={atmosphereColor} stopOpacity={glowOpacity} />
            <Stop offset="60%" stopColor={atmosphereColor} stopOpacity={glowOpacity * 0.3} />
            <Stop offset="100%" stopColor={baseBg} stopOpacity={0} />
          </RadialGradient>
          {mode === 'mesh' && (
            <RadialGradient
              id="previewGlow2"
              cx="15%"
              cy="80%"
              r="70%"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor={atmosphereColor} stopOpacity={glowOpacity * 0.8} />
              <Stop offset="70%" stopColor={baseBg} stopOpacity={0} />
            </RadialGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={baseBg} />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#previewGlow1)" />
        {mode === 'mesh' && (
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#previewGlow2)" />
        )}
      </Svg>
    </View>
  );
});

export default AppAtmosphereBackground;
