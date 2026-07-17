import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchGroupInvites } from "../../lib/native-chats/firebaseService";

type Props = { userId: string; navigation: any };

const GroupInvite: React.FC<Props> = ({ userId, navigation }) => {
  const [invites, setInvites] = useState<any[]>([]);

  useEffect(() => {
    const unsub = fetchGroupInvites(userId, setInvites as any);
    return () => unsub();
  }, [userId]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={invites}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>Invite to group</Text>
            <TouchableOpacity onPress={() => navigation.navigate('GroupChat', { roomId: item.groupId })} style={styles.btn}><Text>Join</Text></TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { padding: 12, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 16 },
  btn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 6 },
});

export default GroupInvite;
