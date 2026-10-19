import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import useUnreadNotifications from '../hooks/useUnreadNotifications';
import { useThemeToggle } from '../contexts/ThemeContext';

export default function NotificationBell({ style, color }: { style?: any; color?: string }) {
  const unread = useUnreadNotifications();
  const router = useRouter();
  const { themeColors, accentColor, onAccentTextColor } = useThemeToggle();

  const bellColor = color || themeColors?.text || '#ffffff';
  const badgeBg = accentColor || '#ff4d4d';
  const badgeText = onAccentTextColor || '#ffffff';

  return (
    <Pressable
      style={[styles.container, style]}
      onPress={() => router.push('/notifications')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Notifications, ${unread} unread`}
    >
      <Feather name="bell" size={22} color={bellColor} />
      {unread > 0 && (
        <View style={[styles.dot, { backgroundColor: badgeBg, borderColor: themeColors?.background || '#000000' }]}>
          <Text style={[styles.count, { color: badgeText }]}>{unread > 99 ? '99+' : String(unread)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 6, position: 'relative' },
  dot: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  count: { fontSize: 10, fontWeight: '800' },
});
