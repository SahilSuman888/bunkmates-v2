import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationCard({
  group,
  onOpen,
  onDelete,
  onRead,
}: any) {
  const latest = group.latest;

  const renderRightActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.readBtn} onPress={() => onRead(group)}>
        <Ionicons name="checkmark-done" size={22} color="#0f0" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => onDelete(latest.id)}
      >
        <Ionicons name="trash" size={22} color="#ff4d4d" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity
        style={[styles.card, !group.isSeen && styles.unread]}
        onPress={() => onOpen(group)}
      >
        <Image
          source={{
            uri:
              latest.pic ||
              "https://ui-avatars.com/api/?name=N",
          }}
          style={styles.avatar}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{latest.title || "Notification"}</Text>

          <Text style={styles.message} numberOfLines={1}>
            {latest.content || latest.message}
          </Text>
        </View>

        {!group.isSeen && <View style={styles.dot} />}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#15161c",
    marginBottom: 10,
  },

  unread: {
    borderLeftWidth: 3,
    borderLeftColor: "#4f7cff",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },

  title: {
    color: "#fff",
    fontWeight: "600",
  },

  message: {
    color: "#aaa",
    fontSize: 13,
  },

  dot: {
    width: 8,
    height: 8,
    backgroundColor: "#4f7cff",
    borderRadius: 4,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
  },

  readBtn: {
    backgroundColor: "#1c1f28",
    padding: 16,
  },

  deleteBtn: {
    backgroundColor: "#1c1f28",
    padding: 16,
  },
});