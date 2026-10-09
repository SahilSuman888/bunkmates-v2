import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listenToChatrooms } from "../../lib/native-chats/firebaseService";
import type { ChatRoom } from "../../lib/native-chats/types";
import { useThemeToggle } from "../../contexts/ThemeContext";

type Props = { navigation: any };

const ChatroomsList: React.FC<Props> = ({ navigation }) => {
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const { themeColors, isDark, accentColor } = useThemeToggle();

  useEffect(() => {
    const unsub = listenToChatrooms(setRooms as any);
    return () => unsub();
  }, []);

  if (!rooms) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background }}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: isDark ? '#202024' : '#F0F2F5', borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('Chatroom', { roomId: item.id, name: item.name, isGroup: !!item.isGroup })}
          >
            <Image source={item?.members?.[0]?.avatar ? { uri: item.members[0].avatar } : undefined} style={styles.avatar} />
            <View style={styles.info}>
              <Text style={[styles.title, { color: themeColors.text }]}>{item.name}</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{(item.lastMessage as any)?.text ?? 'No messages yet'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', padding: 12, alignItems: 'center', borderWidth: 0 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd' },
  info: { marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { marginTop: 4 },
});

export default ChatroomsList;
