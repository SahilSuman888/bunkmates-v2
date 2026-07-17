import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import Checkbox from "@react-native-community/checkbox";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
  mode: "light" | "dark";
}

const ChecklistViewAllDrawer: React.FC<Props> = ({
  checklistViewAllOpen,
  setChecklistViewAllOpen,
  checklist,
  toggleTask,
  mode,
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
      <BlurView
        intensity={25}
        tint={isDark ? "dark" : "light"}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setChecklistViewAllOpen(false)}
        />
      </BlurView>

      {/* Drawer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.drawer,
          { backgroundColor: isDark ? "#000" : "#fff" },
        ]}
      >
        {/* Drag Indicator */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isDark ? "#fff" : "#000" },
            ]}
          >
            Full Checklist
          </Text>

          <TouchableOpacity
            onPress={() => setChecklistViewAllOpen(false)}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Checklist List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: "80%" }}
        >
          {checklist.map((task) => (
            <TouchableOpacity
              key={task.id}
              onPress={() => toggleTask(task)}
              style={[
                styles.listItem,
                {
                  backgroundColor: task.completed
                    ? isDark
                      ? "#00000011"
                      : "transparent"
                    : isDark
                    ? "#f1f1f111"
                    : "#0000000d",
                },
              ]}
            >
              <Checkbox
                value={task.completed}
                onValueChange={() => toggleTask(task)}
                tintColors={{
                  true: "#4caf50",
                  false: "#999",
                }}
              />

              <Text
                style={[
                  styles.taskText,
                  {
                    textDecorationLine: task.completed
                      ? "line-through"
                      : "none",
                    color: task.completed
                      ? "#888"
                      : isDark
                      ? "#fff"
                      : "#000",
                  },
                ]}
              >
                {task.text}
              </Text>
            </TouchableOpacity>
          ))}

          {checklist.length === 0 && (
            <Text
              style={[
                styles.emptyText,
                { color: isDark ? "#888" : "#666" },
              ]}
            >
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    opacity: 0.5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  taskText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 15,
  },
  emptyText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
  },
});