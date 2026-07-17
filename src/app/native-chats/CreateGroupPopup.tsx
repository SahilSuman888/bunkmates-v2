import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createGroup } from "../../lib/native-chats/firebaseService";
import type { User } from "../../lib/native-chats/types";

type Props = { visible: boolean; onClose: () => void; onCreated?: (id: string) => void };

const CreateGroupPopup: React.FC<Props> = ({ visible, onClose, onCreated }) => {
  const [name, setName] = useState('');

  const handleCreate = async () => {
    const id = await createGroup(name.trim() || 'New Group', [] as User[]);
    onCreated?.(id);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Create Group</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Group name" style={styles.input} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity onPress={onClose} style={styles.btn}> <Text>Cancel</Text> </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={[styles.btn, styles.primary]}> <Text style={{ color: '#fff' }}>Create</Text> </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#eee', padding: 10, borderRadius: 6, marginBottom: 12 },
  btn: { padding: 10, marginLeft: 8 },
  primary: { backgroundColor: '#007AFF', borderRadius: 6, paddingHorizontal: 14 },
});

export default CreateGroupPopup;
