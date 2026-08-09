import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

interface TimelineItem {
  id: string;
  title: string;
  time: string;
  note?: string;
  completed: boolean;
}

interface Props {
  timelineAllDrawerOpen: boolean;
  setTimelineAllDrawerOpen: (v: boolean) => void;
  timeline: TimelineItem[];
  toggleEventCompleted: (item: TimelineItem) => void;
  mode?: "light" | "dark";
}

const TimelineAllDrawer: React.FC<Props> = ({
  timelineAllDrawerOpen,
  setTimelineAllDrawerOpen,
  timeline,
  toggleEventCompleted,
  mode = "dark",
}) => {
  const isDark = mode === "dark";

  return (
    <Modal
      visible={timelineAllDrawerOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setTimelineAllDrawerOpen(false)}
    >
      {/* BACKDROP */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setTimelineAllDrawerOpen(false)}
      >
        <BlurView
          intensity={25}
          tint={isDark ? "dark" : "light"}
          style={styles.backdrop}
        />
      </TouchableOpacity>

      {/* DRAWER */}
      <View style={[styles.drawer, { backgroundColor: isDark ? "#0e0e10" : "#fff" }]}>
        {/* HANDLE */}
        <View style={styles.handle} />

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>
            Full Trip Timeline
          </Text>
          <TouchableOpacity onPress={() => setTimelineAllDrawerOpen(false)}>
            <Ionicons name="close" size={22} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        {(!timeline || timeline.length === 0) ? (
          <Text style={[styles.emptyText, { color: isDark ? "#888" : "#666" }]}>
            No timeline events yet.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }}>
            {timeline.map((item) => {
              const itemTime = item.time ? new Date(item.time) : null;
              const isCompleted = !!item.completed;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => toggleEventCompleted(item)}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: isDark
                        ? isCompleted ? "rgba(255,255,255,0.03)" : "#1c1c1c"
                        : isCompleted ? "transparent" : "#f0f0f0",
                    },
                  ]}
                >
                  {/* Custom checkbox using Ionicons */}
                  <Ionicons
                    name={isCompleted ? "checkbox" : "square-outline"}
                    size={22}
                    color={isCompleted ? "#4caf50" : isDark ? "#888" : "#999"}
                    style={{ marginRight: 12 }}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: isCompleted ? "400" : "700",
                        color: isCompleted ? "#888" : isDark ? "#fff" : "#000",
                        textDecorationLine: isCompleted ? "line-through" : "none",
                        fontSize: 14,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: isDark ? "#aaa" : "#666", marginTop: 2 }}>
                      {itemTime ? itemTime.toLocaleString() : item.time}
                      {item.note ? ` — ${item.note}` : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default TimelineAllDrawer;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#888",
    opacity: 0.5,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: 20,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
});