import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpressiveTheme } from '../../constants/authTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Exact Framer Motion spring config from bunk-mates-master AuthPage.jsx:
// const springTransition = { type: "spring", stiffness: 230, damping: 27, mass: 0.9 };
const springTransition = {
  stiffness: 230,
  damping: 27,
  mass: 0.9,
};

interface AuthHeroProps {
  activeTheme: ExpressiveTheme;
  slogan?: string;
  subtitle?: string;
  title?: string;
  mode?: 'welcome' | 'login' | 'signup' | 'recovery' | 'continue';
  isKeyboardVisible?: boolean;
}

export const AuthHero: React.FC<AuthHeroProps> = ({
  activeTheme,
  slogan,
  subtitle,
  title,
  mode = 'welcome',
  isKeyboardVisible = false,
}) => {
  const insets = useSafeAreaInsets();
  const textColor = activeTheme.light.text;
  const bgColor = activeTheme.light.bg;

  const getHeroHeight = () => {
    switch (mode) {
      case 'welcome':
        return Math.max(380, Math.round(SCREEN_HEIGHT * 0.55));
      case 'login':
        return Math.max(260, Math.round(SCREEN_HEIGHT * 0.38));
      case 'continue':
        return Math.max(260, Math.round(SCREEN_HEIGHT * 0.33));
      case 'signup':
        return Math.max(125, Math.round(SCREEN_HEIGHT * 0.165));
      case 'recovery':
        return Math.max(290, Math.round(SCREEN_HEIGHT * 0.452));
      default:
        return 220;
    }
  };

  const getKeyboardHeroHeight = () => {
    switch (mode) {
      case 'login':
        return Math.max(130, Math.round(SCREEN_HEIGHT * 0.16));
      case 'recovery':
        return Math.max(110, Math.round(SCREEN_HEIGHT * 0.13));
      case 'signup':
        return Math.max(85, Math.round(SCREEN_HEIGHT * 0.10));
      default:
        return 0;
    }
  };

  const isRoundedBottom = mode === 'welcome' || mode === 'continue';
  const isTopAligned = mode === 'recovery' || mode === 'signup';

  const animatedHeight = useSharedValue(getHeroHeight());
  const animatedRadius = useSharedValue(isRoundedBottom ? 36 : 0);
  const animatedHeroOpacity = useSharedValue(1);

  useEffect(() => {
    if (isKeyboardVisible) {
      animatedHeight.value = withSpring(getKeyboardHeroHeight(), springTransition);
      animatedRadius.value = withSpring(0, springTransition);
      animatedHeroOpacity.value = withTiming(1, { duration: 200 });
    } else {
      animatedHeight.value = withSpring(getHeroHeight(), springTransition);
      animatedRadius.value = withSpring(isRoundedBottom ? 36 : 0, springTransition);
      animatedHeroOpacity.value = withTiming(1, { duration: 250 });
    }
  }, [mode, isKeyboardVisible]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    borderBottomLeftRadius: animatedRadius.value,
    borderBottomRightRadius: animatedRadius.value,
    opacity: animatedHeroOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: Math.max(insets.top + (isKeyboardVisible ? 6 : 14), 28),
          paddingBottom: isKeyboardVisible ? 12 : 28,
          justifyContent: isTopAligned ? 'flex-start' : 'flex-end',
        },
        animatedContainerStyle,
      ]}
    >
      <View style={styles.content}>
        {subtitle && title ? (
          <Animated.View
            key={`title-${subtitle}-${title}`}
            entering={FadeInDown.duration(350).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
            exiting={FadeOutUp.duration(250).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
          >
            <Text style={[styles.subtitle, { color: textColor }]}>
              {subtitle}
            </Text>
            <Text style={[styles.brandTitle, { color: textColor }]}>
              {title}
            </Text>
          </Animated.View>
        ) : slogan ? (
          <Animated.View
            key={slogan}
            entering={FadeInDown.duration(450).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
            exiting={FadeOutUp.duration(300).easing(Easing.bezier(0.25, 0.1, 0.25, 1))}
          >
            <Text
              style={[
                styles.slogan,
                { color: textColor },
                mode === 'login' && styles.sloganLogin,
                isKeyboardVisible && styles.sloganKeyboard,
              ]}
            >
              {slogan}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 26,
    paddingBottom: 28,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  content: {
    justifyContent: 'flex-end',
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
    opacity: 0.85,
    fontFamily: Platform.select({ ios: 'System', default: 'normal' }),
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
    fontFamily: Platform.select({ ios: 'System', default: 'normal' }),
  },
  slogan: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 40,
    fontFamily: Platform.select({ ios: 'System', default: 'normal' }),
  },
  sloganLogin: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 38,
  },
  sloganKeyboard: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
});

export default AuthHero;
