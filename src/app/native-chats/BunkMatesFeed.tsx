import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

type Props = { navigation: any };

const demoPosts = [
  { id: '1', title: 'Best cafe in town', chatRoomId: 'room1' },
  { id: '2', title: 'Trip this weekend', chatRoomId: 'room2' },
];

const BunkMatesFeed: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={demoPosts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chatroom', { roomId: item.chatRoomId, name: item.title })} style={styles.btn}>
              <Text style={{ color: '#fff' }}>Open Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { padding: 12, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16 },
  btn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 6 },
});

export default BunkMatesFeed;
