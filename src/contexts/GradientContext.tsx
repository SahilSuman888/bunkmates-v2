// contexts/GradientContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';

export interface GradientVariant {
  id: string;
  css: string;
  colors: [string, string, string];
}

export const GRADIENT_VARIANTS: GradientVariant[] = [
  // 1. 🔥 Red / Orange dominant
  {
    id: 'red-orange',
    css: `radial-gradient(circle at 75% 15%, #ff8d1a 0%, #ff0000 25%, #000000 65%, #000000 100%)`,
    colors: ['#ff8d1a', '#ff0000', '#000000'],
  },

  // 2. 💜 Purple / Pink dominant
  {
    id: 'purple-pink',
    css: `radial-gradient(circle at 75% 15%, #a848ec 0%, #8402ff 25%, #000000 65%, #000000 100%)`,
    colors: ['#a848ec', '#8402ff', '#000000'],
  },

  // 3. 🔵 Blue / Cyan dominant (Screenshots 1 & 3)
  {
    id: 'blue-cyan',
    css: `radial-gradient(circle at 75% 15%, #22d3ee 0%, #3b83f6 25%, #000000 65%, #000000 100%)`,
    colors: ['#22d3ee', '#3b83f6', '#000000'],
  },

  // 4. 🌅 Warm sunset gold / orange (Screenshot 2)
  {
    id: 'warm-sunset',
    css: `radial-gradient(circle at 75% 15%, #fbbf24 0%, #f97316 25%, #000000 65%, #000000 100%)`,
    colors: ['#fbbf24', '#f97316', '#000000'],
  },
];

// Pick once per app session (on cold start)
const SESSION_VARIANT =
  GRADIENT_VARIANTS[Math.floor(Math.random() * GRADIENT_VARIANTS.length)];

interface GradientContextType {
  gradient: [string, string, string];
  sessionVariant: GradientVariant;
}

const GradientContext = createContext<GradientContextType>({
  gradient: SESSION_VARIANT.colors,
  sessionVariant: SESSION_VARIANT,
});

export const useSessionGradient = () => useContext(GradientContext);

export const GradientProvider = ({ children }: { children: ReactNode }) => (
  <GradientContext.Provider
    value={{
      gradient: SESSION_VARIANT.colors,
      sessionVariant: SESSION_VARIANT,
    }}
  >
    {children}
  </GradientContext.Provider>
);

export function AuthRadialBackground() {
  const { sessionVariant } = useSessionGradient();

  if (Platform.OS === 'web') {
    return (
      <View
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: sessionVariant.css,
            backgroundSize: '140% 140%',
            zIndex: 0,
          } as any
        }
      />
    );
  }

  // Native Rendering using exact screen dimensions for radial glow
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const cx = SCREEN_WIDTH * 0.75;
  const cy = SCREEN_HEIGHT * 0.15;
  const r = SCREEN_WIDTH * 0.95;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg height={SCREEN_HEIGHT} width={SCREEN_WIDTH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadialGradient
            id="authRadialGlow"
            cx={cx}
            cy={cy}
            r={r}
            fx={cx}
            fy={cy}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={sessionVariant.colors[0]} stopOpacity={0.95} />
            <Stop offset="25%" stopColor={sessionVariant.colors[0]} stopOpacity={0.75} />
            <Stop offset="50%" stopColor={sessionVariant.colors[1]} stopOpacity={0.45} />
            <Stop offset="80%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="#000000" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#authRadialGlow)" />
      </Svg>
    </View>
  );
}
