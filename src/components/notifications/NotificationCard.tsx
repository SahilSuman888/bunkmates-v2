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
import { useThemeToggle } from "../../contexts/ThemeContext";

export default function NotificationCard({
  group,
  onOpen,
  onDelete,
  onRead,
}: any) {
  const latest = group.latest;
  const { themeColors, accentColor, isDark, scaleFont } = useThemeToggle();
  const dynamicAccent = accentColor || "#38bdf8";

  const renderRightActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.readBtn, { backgroundColor: isDark ? "#1c1f28" : "#E2E8F0" }]}
        onPress={() => onRead(group)}
      >
        <Ionicons name="checkmark-done" size={22} color={dynamicAccent} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteBtn, { backgroundColor: isDark ? "#1c1f28" : "#E2E8F0" }]}
        onPress={() => onDelete(latest.id)}
      >
        <Ionicons name="trash" size={22} color="#ff4d4d" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: themeColors?.card || (isDark ? "#15161c" : "#FFFFFF"),
            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          },
          !group.isSeen && { borderLeftWidth: 3, borderLeftColor: dynamicAccent },
        ]}
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
          <Text style={[styles.title, { color: themeColors?.text || (isDark ? "#fff" : "#111827"), fontSize: scaleFont(14) }]}>
            {latest.title || "Notification"}
          </Text>

          <Text
            style={[styles.message, { color: themeColors?.textSecondary || (isDark ? "#aaa" : "#6B7280"), fontSize: scaleFont(13) }]}
            numberOfLines={1}
          >
            {latest.content || latest.message}
          </Text>
        </View>

        {!group.isSeen && <View style={[styles.dot, { backgroundColor: dynamicAccent }]} />}
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
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  title: {
    fontWeight: "600",
  },
  message: {
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  readBtn: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});