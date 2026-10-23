// components/ui/NetworkErrorScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useThemeToggle } from '../../contexts/ThemeContext';
import { getDesignTokens } from '../../theme/designSystem';

export interface NetworkErrorScreenProps {
  title?: string;
  message?: string;
  buttonText?: string;
  onRetry?: () => void | Promise<void>;
  isRetrying?: boolean;
}

export const NetworkErrorScreen: React.FC<NetworkErrorScreenProps> = ({
  title = 'Something went wrong',
  message = "We couldn't connect to the server. Please check your internet connection and try again.",
  buttonText = 'Retry Connection',
  onRetry,
  isRetrying: externalRetrying,
}) => {
  const { isDark, themeColors, accentColor, scaleFont, background } = useThemeToggle();
  const isAtmosphere = background.mode !== 'solid';

  const [internalRetrying, setInternalRetrying] = useState(false);
  const loading = externalRetrying !== undefined ? externalRetrying : internalRetrying;

  const handlePressRetry = async () => {
    if (loading || !onRetry) return;
    try {
      setInternalRetrying(true);
      await onRetry();
    } finally {
      setInternalRetrying(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isAtmosphere ? 'transparent' : themeColors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.background}
      />

      <View style={styles.content}>
        {/* Centered Error Details matching Image 2 */}
        <View style={styles.centerContainer}>
          {/* Solid circular badge (zero borders, solid dynamic surface) */}
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: isDark ? '#202024' : '#F4F5F7',
                borderRadius: 999,
                borderWidth: 0,
              },
            ]}
          >
            <WifiOff
              size={36}
              color={accentColor}
              strokeWidth={2.2}
            />
          </View>

          {/* Heading */}
          <Text style={[styles.title, { color: themeColors.text, fontSize: scaleFont(22) }]}>
            {title}
          </Text>

          {/* Subtitle Message */}
          <Text style={[styles.message, { color: themeColors.textSecondary, fontSize: scaleFont(14.5) }]}>
            {message}
          </Text>
        </View>

        {/* Bottom CTA Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handlePressRetry}
            disabled={loading}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: accentColor,
                borderRadius: 26,
                borderWidth: 0,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.retryButtonText, { fontSize: scaleFont(16) }]}>{buttonText}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default NetworkErrorScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: -40,
  },
  iconBadge: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 310,
    letterSpacing: -0.1,
  },
  bottomBar: {
    width: '100%',
    paddingBottom: 8,
  },
  retryButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#FF5A5F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(255, 90, 95, 0.25)',
      },
    }),
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
