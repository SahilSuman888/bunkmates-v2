import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface LinkData {
  title: string;
  url: string;
}

interface Props {
  visible?: boolean;
  onClose?: () => void;
  tripId?: string;
  links?: LinkData[];
  mode?: "light" | "dark";
}

const LinkDrawer: React.FC<Props> = ({ visible = false, onClose, tripId, links = [], mode = "dark" }) => {
  const isDark = mode === "dark";

  const [newLink, setNewLink] = useState<LinkData>({ title: "", url: "" });

  const handleAddLink = () => {
    // If tripId is provided, persist to Firestore here. For now, just close.
    console.log("Add link", { tripId, newLink });
    setNewLink({ title: "", url: "" });
    onClose && onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose && onClose()}>
      {/* Blur Backdrop */}
      <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onClose && onClose()} />
      </BlurView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.bottomWrapper}>
        <View style={[styles.drawer, { backgroundColor: isDark ? "#111" : "#fff" }]}>
          {/* Drag Handle */}
          <View style={styles.handle} />

          <Text style={[styles.title, { color: isDark ? "#fff" : "#000" }]}>Add Trip Link</Text>

          {/* Link Title */}
          <TextInput
            placeholder="Link Title"
            placeholderTextColor={isDark ? "#aaa" : "#666"}
            value={newLink.title}
            onChangeText={(text) => setNewLink((prev) => ({ ...prev, title: text }))}
            style={[styles.input, { backgroundColor: isDark ? "#1e1e1e" : "#fafafa", color: isDark ? "#fff" : "#000" }]}
          />

          {/* URL */}
          <TextInput
            placeholder="Paste Link (e.g. Google Drive, YouTube, etc.)"
            placeholderTextColor={isDark ? "#aaa" : "#666"}
            value={newLink.url}
            onChangeText={(text) => setNewLink((prev) => ({ ...prev, url: text }))}
            style={[styles.input, { backgroundColor: isDark ? "#1e1e1e" : "#fafafa", color: isDark ? "#fff" : "#000" }]}
            autoCapitalize="none"
          />

          {/* Add Button */}
          <TouchableOpacity onPress={handleAddLink} style={[styles.button, { backgroundColor: isDark ? "#fff" : "#000" }]}>
            <MaterialCommunityIcons name="link" size={18} color={isDark ? "#000" : "#fff"} style={{ marginRight: 6 }} />
            <Text style={{ color: isDark ? "#000" : "#fff", fontWeight: "bold" }}>Add Link</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default LinkDrawer;

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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    opacity: 0.5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
});