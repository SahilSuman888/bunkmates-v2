import React, { ReactNode } from 'react';
import { Modal, View, StyleSheet, TouchableWithoutFeedback } from 'react-native';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function AppDrawer({ visible, onClose, children }: AppDrawerProps) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      <View style={styles.drawer}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
});
