import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { listenToRoomMessages, sendMessage } from "../../lib/native-chats/firebaseService";
import type { Message, User } from "../../lib/native-chats/types";

type Props = { route: any; navigation: any; currentUser?: User };

const Chatroom: React.FC<Props> = ({ route, currentUser, navigation }) => {
  const { roomId, name } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<any>(null);

  useEffect(() => {
    navigation.setOptions({ title: name });
    const unsub = listenToRoomMessages(roomId, setMessages as any);
    return () => unsub();
  }, [roomId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage(roomId, text.trim(), currentUser || { id: 'me', name: 'Me' });
    setText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.user.id === (currentUser?.id || 'me') ? styles.myMsg : styles.theirMsg]}>
            <Text style={styles.msgText}>{item.text}</Text>
            <Text style={styles.msgTime}>{new Date(item.createdAt?.seconds ? item.createdAt.seconds * 1000 : item.createdAt).toLocaleTimeString()}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Write a message" />
        <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
          <Text style={{ color: '#fff' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  msgRow: { margin: 8, padding: 10, borderRadius: 8, maxWidth: '80%' },
  myMsg: { backgroundColor: '#0b93f6', alignSelf: 'flex-end' },
  theirMsg: { backgroundColor: '#eee', alignSelf: 'flex-start' },
  msgText: { color: '#000' },
  msgTime: { fontSize: 10, color: '#666', marginTop: 6 },
  footer: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f6f6f6', padding: 10, borderRadius: 20, marginRight: 8 },
  sendBtn: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
});

export default Chatroom;
