import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import useUnreadNotifications from '../hooks/useUnreadNotifications';

export default function NotificationBell({ style }: { style?: any }) {
  const unread = useUnreadNotifications();
  const router = useRouter();

  return (
    <Pressable style={[styles.container, style]} onPress={() => router.push('/notifications')}>
      <Feather name="bell" size={22} color="#fff" />
      {unread > 0 && (
        <View style={styles.dot}>
          <Text style={styles.count}>{unread > 99 ? '99+' : String(unread)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 6 },
  dot: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff4d4d',
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  count: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
