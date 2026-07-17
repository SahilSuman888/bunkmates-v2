import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { BlurView } from "expo-blur";

export default function TimelineDrawer({
  timelineDrawerOpen,
  setTimelineDrawerOpen,
  timelineDrafts = [],
  newEvent = {},
  setNewEvent = () => {},
  addTimelineEvent = () => {},
  addEmptyTimelineDraft = () => {},
  addAllTimelineEvents = () => {},
  updateTimelineDraft = () => {},
  removeTimelineDraft = () => {},
  mode = "dark",
}: any) {
  const isDark = mode === "dark";

  return (
    <Modal visible={timelineDrawerOpen} animationType="slide" transparent onRequestClose={() => setTimelineDrawerOpen(false)}>
      {/* Background Blur */}
      <BlurView intensity={20} tint={isDark ? "dark" : "light"} style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setTimelineDrawerOpen(false)} />
      </BlurView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.bottomWrapper}>
        <View style={[styles.drawer, { backgroundColor: isDark ? "#000" : "#fff" }]}>
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>Trip Timeline</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Add Event */}
            <Text style={styles.subtitle}>Add Timeline Event</Text>

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, color: isDark ? "#fff" : "#000" }]}
                placeholder="Event Title"
                placeholderTextColor={isDark ? "#888" : "#aaa"}
                value={newEvent.title}
                onChangeText={(text) => setNewEvent((prev: any) => ({ ...prev, title: text }))}
              />

              <TextInput
                style={[styles.input, { width: 110, color: isDark ? "#fff" : "#000" }]}
                placeholder="Time"
                placeholderTextColor={isDark ? "#888" : "#aaa"}
                value={newEvent.time}
                onChangeText={(text) => setNewEvent((prev: any) => ({ ...prev, time: text }))}
              />
            </View>

            <TextInput
              style={[styles.input, { color: isDark ? "#fff" : "#000" }]}
              placeholder="Note (optional)"
              placeholderTextColor={isDark ? "#888" : "#aaa"}
              value={newEvent.note || ""}
              onChangeText={(text) => setNewEvent((prev: any) => ({ ...prev, note: text }))}
            />

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: isDark ? "#fff" : "#000" }]} onPress={addTimelineEvent}>
              <Text style={{ color: isDark ? "#000" : "#fff", fontWeight: "bold" }}>Add Event</Text>
            </TouchableOpacity>

            {/* Draft Events */}
            <Text style={styles.subtitle}>Draft Events</Text>

            {timelineDrafts.length === 0 ? (
              <Text style={{ color: isDark ? "#888" : "#666", textAlign: "center", marginTop: 10 }}>No draft events yet.</Text>
            ) : (
              timelineDrafts.map((draft: any, idx: number) => (
                <View key={idx} style={styles.draftRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: isDark ? "#fff" : "#000" }]}
                    value={draft.title}
                    onChangeText={(text) => updateTimelineDraft(idx, { ...draft, title: text })}
                    placeholder="Title"
                    placeholderTextColor={isDark ? "#888" : "#aaa"}
                  />

                  <TextInput
                    style={[styles.input, { width: 90, color: isDark ? "#fff" : "#000" }]}
                    value={draft.time}
                    onChangeText={(text) => updateTimelineDraft(idx, { ...draft, time: text })}
                    placeholder="Time"
                    placeholderTextColor={isDark ? "#888" : "#aaa"}
                  />

                  <TouchableOpacity style={styles.deleteButton} onPress={() => removeTimelineDraft(idx)}>
                    <Text style={{ color: "#e53935" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: isDark ? "#222" : "#eee" }]} onPress={addEmptyTimelineDraft}>
              <Text style={{ color: isDark ? "#fff" : "#000" }}>Add Empty Draft</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: isDark ? "#fff" : "#000" }]} onPress={addAllTimelineEvents}>
              <Text style={{ color: isDark ? "#000" : "#fff", fontWeight: "bold" }}>Add All Drafts</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  bottomWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },

  drawer: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
  },

  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },

  subtitle: {
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 18,
  },

  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },

  secondaryButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },

  primaryButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },

  deleteButton: {
    paddingHorizontal: 8,
  },

});
