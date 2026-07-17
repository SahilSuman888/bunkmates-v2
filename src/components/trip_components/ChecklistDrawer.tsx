
 import React, { useState } from "react";
  import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
  } from "react-native";
  import { BlurView } from "expo-blur";
  import * as DocumentPicker from "expo-document-picker";
  import { MaterialCommunityIcons } from "@expo/vector-icons";
  import { addDoc, collection, serverTimestamp } from "firebase/firestore";
  import { db } from "../../lib/firebase";

  interface ChecklistDrawerProps {
    visible?: boolean;
    onClose?: () => void;
    tripId?: string;
    checklist?: any[];
    mode?: "light" | "dark";
  }

  const ChecklistDrawer: React.FC<ChecklistDrawerProps> = ({
    visible = false,
    onClose,
    tripId,
    checklist = [],
    mode = "dark",
  }) => {
    const isDark = mode === "dark";

    const [checklistDrafts, setChecklistDrafts] = useState<string[]>([]);
    const [newTask, setNewTask] = useState("");
    const [uploadingBatch, setUploadingBatch] = useState(false);

    const closeDrawer = () => {
      setChecklistDrafts([]);
      setNewTask("");
      onClose && onClose();
    };

    const handleChecklistFileUpload = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["text/plain", "text/markdown"],
        });

        // DocumentPicker returns different shapes on platforms; guard accordingly
        const uri = (result as any)?.uri || (result as any)?.assets?.[0]?.uri;
        if (!uri) return;

        const response = await fetch(uri);
        const text = await response.text();

        const items = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        setChecklistDrafts(items);
      } catch (e) {
        console.warn("Checklist file upload failed", e);
      }
    };

    const addTask = async () => {
      if (!newTask.trim()) return;
      // if tripId provided, persist immediately
      if (tripId) {
        try {
          await addDoc(collection(db, "trips", tripId, "checklist"), { title: newTask.trim(), completed: false, createdAt: serverTimestamp() });
        } catch (e) { console.error('addTask error', e); }
      } else {
        setChecklistDrafts((s) => [...s, newTask.trim()]);
      }

      setNewTask("");
    };

    const addEmptyChecklistDraft = () => setChecklistDrafts((s) => [...s, ""]);

    const addAllChecklistItems = async () => {
      if (checklistDrafts.length === 0) return;
      setUploadingBatch(true);
      try {
        if (tripId) {
          const adds = checklistDrafts.map((text) => addDoc(collection(db, "trips", tripId, "checklist"), { title: text.trim(), completed: false, createdAt: serverTimestamp() }));
          await Promise.all(adds);
        }

        setChecklistDrafts([]);
        closeDrawer();
      } catch (e) {
        console.warn("Checklist batch upload failed", e);
      } finally {
        setUploadingBatch(false);
      }
    };

    const updateChecklistDraft = (index: number, value: string) => {
      setChecklistDrafts((s) => s.map((it, i) => (i === index ? value : it)));
    };

    const removeChecklistDraft = (index: number) => {
      setChecklistDrafts((s) => s.filter((_, i) => i !== index));
    };

    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={closeDrawer}>
        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} />
        </BlurView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.drawer, { backgroundColor: isDark ? "#000" : "#fff" }]}
        >
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>Add Checklist Items</Text>

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: isDark ? "#ffffff10" : "#00000010" }]}
                onPress={handleChecklistFileUpload}
              >
                <Text style={{ color: isDark ? "#fff" : "#000" }}>Upload Checklist</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: isDark ? "#ffffff10" : "#00000010" }]}
                onPress={addEmptyChecklistDraft}
              >
                <Text style={{ color: isDark ? "#fff" : "#000" }}>Add Multiple</Text>
              </TouchableOpacity>
            </View>

            {checklistDrafts.length > 0 && (
              <>
                <Text style={[styles.subtitle, { color: isDark ? "#bbb" : "#666" }]}>Preview & Edit Items to Add</Text>

                {checklistDrafts.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <TextInput
                      value={item}
                      onChangeText={(text) => updateChecklistDraft(index, text)}
                      placeholder={`Item ${index + 1}`}
                      placeholderTextColor={isDark ? "#bbb" : "#666"}
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
                          borderColor: isDark ? "#555" : "#c1c1c1",
                          color: isDark ? "#eee" : "#222",
                        },
                      ]}
                    />

                    <TouchableOpacity onPress={() => removeChecklistDraft(index)} style={styles.deleteButton}>
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={[styles.secondaryButton, { marginTop: 12 }]} onPress={addEmptyChecklistDraft}>
                  <Text style={{ color: isDark ? "#fff" : "#000" }}>+ Add More Items</Text>
                </TouchableOpacity>
              </>
            )}

            {checklistDrafts.length === 0 && (
              <>
                <TextInput
                  value={newTask}
                  onChangeText={setNewTask}
                  placeholder="New Checklist Item"
                  placeholderTextColor={isDark ? "#bbb" : "#666"}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
                      borderColor: isDark ? "#555" : "#c1c1c1",
                      color: isDark ? "#eee" : "#222",
                      marginTop: 10,
                    },
                  ]}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: isDark ? "#fff" : "#000", opacity: !newTask.trim() ? 0.5 : 1 }]}
                  disabled={!newTask.trim()}
                  onPress={addTask}
                >
                  <Text style={{ color: isDark ? "#000" : "#fff" }}>Add Checklist Item</Text>
                </TouchableOpacity>
              </>
            )}

            {checklistDrafts.length > 0 && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: isDark ? "#fff" : "#000", opacity: uploadingBatch ? 0.6 : 1 }]}
                disabled={uploadingBatch}
                onPress={addAllChecklistItems}
              >
                {uploadingBatch ? <ActivityIndicator color={isDark ? "#000" : "#fff"} /> : <Text style={{ color: isDark ? "#000" : "#fff" }}>Add Checklist Item(s)</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  export default ChecklistDrawer;

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
      maxHeight: "80%",
    },
    handle: {
      width: 40,
      height: 5,
      backgroundColor: "#888",
      opacity: 0.5,
      borderRadius: 2.5,
      alignSelf: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 16,
    },
    subtitle: {
      marginTop: 10,
      marginBottom: 6,
      fontSize: 14,
    },
    row: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
    },
    deleteButton: {
      padding: 8,
    },
    secondaryButton: {
      padding: 10,
      borderRadius: 8,
    },
    primaryButton: {
      marginTop: 16,
      padding: 14,
      borderRadius: 8,
      alignItems: "center",
    },
  });