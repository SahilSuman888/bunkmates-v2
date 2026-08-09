import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Props {
  checklistViewAllOpen: boolean;
  setChecklistViewAllOpen: (value: boolean) => void;
  checklist: ChecklistItem[];
  toggleTask: (task: ChecklistItem) => void;
  mode?: "light" | "dark";
}

const ChecklistViewAllDrawer: React.FC<Props> = ({
  checklistViewAllOpen,
  setChecklistViewAllOpen,
  checklist,
  toggleTask,
  mode = "dark",
}) => {
  const isDark = mode === "dark";

  return (
    <Modal
      visible={checklistViewAllOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setChecklistViewAllOpen(false)}
    >
      {/* Blur Backdrop */}
      <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => setChecklistViewAllOpen(false)} />
      </BlurView>

      {/* Drawer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.drawer, { backgroundColor: isDark ? "#0e0e10" : "#fff" }]}
      >
        {/* Drag Indicator */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>
            Full Checklist
          </Text>
          <TouchableOpacity onPress={() => setChecklistViewAllOpen(false)} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>
        </View>

        {/* Checklist List */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }}>
          {checklist.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => toggleTask(task)}
              style={[
                styles.listItem,
                {
                  backgroundColor: task.completed
                    ? isDark ? "rgba(255,255,255,0.03)" : "transparent"
                    : isDark ? "#1c1c1c" : "#f0f0f0",
                },
              ]}
            >
              {/* Custom checkbox using Ionicons */}
              <Ionicons
                name={task.completed ? "checkbox" : "square-outline"}
                size={22}
                color={task.completed ? "#4caf50" : isDark ? "#888" : "#999"}
                style={{ marginRight: 10 }}
              />

              <Text
                style={[
                  styles.taskText,
                  {
                    textDecorationLine: task.completed ? "line-through" : "none",
                    color: task.completed ? "#888" : isDark ? "#fff" : "#000",
                  },
                ]}
              >
                {task.text}
              </Text>
            </Pressable>
          ))}

          {checklist.length === 0 && (
            <Text style={[styles.emptyText, { color: isDark ? "#888" : "#666" }]}>
              No checklist items yet.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChecklistViewAllDrawer;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
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
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  taskText: {
    marginLeft: 4,
    flex: 1,
    fontSize: 15,
  },
  emptyText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
  },
});