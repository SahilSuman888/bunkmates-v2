// components/ui/SkeletonLoadingScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
  Platform,
  ViewStyle,
} from 'react-native';
import { useThemeToggle } from '../../contexts/ThemeContext';
import { getDesignTokens } from '../../theme/designSystem';

interface SkeletonBoneProps {
  style?: ViewStyle | ViewStyle[];
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  animatedOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  baseColor?: string;
}

export const SkeletonBone: React.FC<SkeletonBoneProps> = ({
  style,
  width,
  height,
  borderRadius = 8,
  animatedOpacity,
  baseColor,
}) => {
  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: baseColor,
          opacity: animatedOpacity || 1,
        },
        style,
      ]}
    />
  );
};

export interface SkeletonLoadingScreenProps {
  title?: string;
  showAvatarCard?: boolean;
  itemCount?: number;
}

export const SkeletonLoadingScreen: React.FC<SkeletonLoadingScreenProps> = ({
  title = 'BunkMates',
  showAvatarCard = true,
  itemCount = 4,
}) => {
  const { isDark, themeColors, accentColor, scaleFont, background, reduceAnimations } = useThemeToggle();
  const isAtmosphere = background.mode !== 'solid';
  const skeletonBase = isDark ? '#222226' : '#E2E5EA';

  // Smooth shimmer animation loop (paused when reduceAnimations/reduceMotion is active)
  const pulseAnim = useRef(new Animated.Value(reduceAnimations ? 0.6 : 0.4)).current;

  useEffect(() => {
    if (reduceAnimations) {
      pulseAnim.setValue(0.6);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim, reduceAnimations]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isAtmosphere ? 'transparent' : themeColors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      {/* Screen Title Header */}
      {!!title && (
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text, fontSize: scaleFont(17) }]}>{title}</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Top User/Profile Card Skeleton */}
        {showAvatarCard && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: themeColors.card,
                borderRadius: 24,
                borderWidth: 0,
              },
            ]}
          >
            {/* Avatar Circle */}
            <SkeletonBone
              width={64}
              height={64}
              borderRadius={999}
              animatedOpacity={pulseAnim}
              baseColor={skeletonBase}
            />

            {/* Avatar Meta lines */}
            <View style={styles.cardLines}>
              <SkeletonBone
                width="65%"
                height={15}
                borderRadius={7}
                animatedOpacity={pulseAnim}
                baseColor={skeletonBase}
              />
              <SkeletonBone
                width="40%"
                height={12}
                borderRadius={6}
                animatedOpacity={pulseAnim}
                baseColor={skeletonBase}
                style={{ marginTop: 8 }}
              />
            </View>
          </View>
        )}

        {/* Section title placeholder line */}
        <View style={styles.sectionHeaderPlaceholder}>
          <SkeletonBone
            width={85}
            height={12}
            borderRadius={6}
            animatedOpacity={pulseAnim}
            baseColor={skeletonBase}
          />
        </View>

        {/* Grouped List Items Skeleton */}
        <View
          style={[
            styles.listContainer,
            {
              backgroundColor: themeColors.card,
              borderRadius: 24,
              borderWidth: 0,
            },
          ]}
        >
          {Array.from({ length: itemCount }).map((_, index) => (
            <React.Fragment key={index}>
              <View style={styles.itemRow}>
                {/* Rounded square icon */}
                <SkeletonBone
                  width={34}
                  height={34}
                  borderRadius={10}
                  animatedOpacity={pulseAnim}
                  baseColor={skeletonBase}
                />

                {/* Two text lines */}
                <View style={styles.itemTextLines}>
                  <SkeletonBone
                    width="55%"
                    height={13}
                    borderRadius={6}
                    animatedOpacity={pulseAnim}
                    baseColor={skeletonBase}
                  />
                  <SkeletonBone
                    width="85%"
                    height={11}
                    borderRadius={5}
                    animatedOpacity={pulseAnim}
                    baseColor={skeletonBase}
                    style={{ marginTop: 7 }}
                  />
                </View>
              </View>

              {/* Clean divider between rows (no hard borders) */}
              {index < itemCount - 1 && (
                <View style={[styles.divider, { backgroundColor: isDark ? '#202024' : '#F0F2F5' }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SkeletonLoadingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 0,
    // Subtle shadow for elevated surface without hard border
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 1px 6px rgba(0,0,0,0.03)',
      },
    }),
  },
  cardLines: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  sectionHeaderPlaceholder: {
    marginTop: 22,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  listContainer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemTextLines: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 4,
    marginLeft: 48,
    borderWidth: 0,
  },
});
