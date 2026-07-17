import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listenToChatrooms } from "../../lib/native-chats/firebaseService";
import type { ChatRoom } from "../../lib/native-chats/types";

type Props = { navigation: any };

const ChatroomsList: React.FC<Props> = ({ navigation }) => {
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);

  useEffect(() => {
    const unsub = listenToChatrooms(setRooms as any);
    return () => unsub();
  }, []);

  if (!rooms) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Chatroom', { roomId: item.id, name: item.name, isGroup: !!item.isGroup })}
          >
            <Image source={item?.members?.[0]?.avatar ? { uri: item.members[0].avatar } : undefined} style={styles.avatar} />
            <View style={styles.info}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.subtitle}>{(item.lastMessage as any)?.text ?? 'No messages yet'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd' },
  info: { marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#666', marginTop: 4 },
});

export default ChatroomsList;
