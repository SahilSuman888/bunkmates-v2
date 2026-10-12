import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ExpressiveTheme, getDicebearAvatar } from '../../constants/authTheme';

interface UserProfileCardProps {
  user: {
    name?: string;
    username?: string;
    email?: string;
    photoURL?: string | null;
  };
  activeTheme: ExpressiveTheme;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({ user, activeTheme }) => {
  const avatarUrl =
    user.photoURL || getDicebearAvatar(user.username || user.email || 'bunker');

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(150)}
      style={styles.card}
    >
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatar, { borderColor: activeTheme.light.bg }]}
      />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name || 'BunkMate Member'}
          </Text>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        </View>
        <Text style={styles.subtext} numberOfLines={1}>
          {user.username ? `@${user.username}` : user.email}
        </Text>
      </View>

      <Ionicons name="checkmark-circle" size={19} color="#4ade80" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    marginRight: 10,
  },
  info: {
    flex: 1,
    marginRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  verifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  verifiedText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '800',
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
  },
});

export default UserProfileCard;
