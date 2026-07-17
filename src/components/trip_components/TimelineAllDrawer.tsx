import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import Checkbox from "@react-native-community/checkbox";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  mode: "light" | "dark";
}

const TimelineAllDrawer: React.FC<Props> = ({
  timelineAllDrawerOpen,
  setTimelineAllDrawerOpen,
  timeline,
  toggleEventCompleted,
  mode,
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
      <View
        style={[
          styles.drawer,
          { backgroundColor: isDark ? "#000" : "#fff" },
        ]}
      >
        {/* HANDLE */}
        <View style={styles.handle} />

        {/* HEADER */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isDark ? "#fff" : "#000" },
            ]}
          >
            Full Trip Timeline
          </Text>

          <TouchableOpacity
            onPress={() => setTimelineAllDrawerOpen(false)}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        {timeline?.length === 0 ? (
          <Text
            style={[
              styles.emptyText,
              { color: isDark ? "#888" : "#666" },
            ]}
          >
            No events added yet.
          </Text>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: "80%" }}
          >
            {timeline.map((item) => {
              const itemTime = new Date(item.time);
              const isCompleted = item.completed;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: isCompleted
                        ? isDark
                          ? "#00000011"
                          : "transparent"
                        : isDark
                        ? "#1c1c1c"
                        : "#f0f0f0",
                    },
                  ]}
                >
                  <Checkbox
                    value={isCompleted}
                    onValueChange={() =>
                      toggleEventCompleted(item)
                    }
                    tintColors={{
                      true: "#4caf50",
                      false: "#999",
                    }}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: isCompleted
                          ? "400"
                          : "600",
                        color: isCompleted
                          ? "#888"
                          : isDark
                          ? "#fff"
                          : "#000",
                        textDecorationLine: isCompleted
                          ? "line-through"
                          : "none",
                      }}
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? "#aaa" : "#666",
                        marginTop: 2,
                      }}
                    >
                      {itemTime.toLocaleString()}
                      {item.note ? ` — ${item.note}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default TimelineAllDrawer;

/* ---------------- STYLES ---------------- */

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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: "90%",
  },

  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    opacity: 0.5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
  },

  emptyText: {
    textAlign: "center",
    fontSize: 14,
  },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
});