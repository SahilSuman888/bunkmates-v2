import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  confirmDeleteOpen: boolean;
  setConfirmDeleteOpen: (value: boolean) => void;
  handleDeleteTrip: () => Promise<void> | void; // allow async
  mode: "light" | "dark";
}

const ConfirmDeleteDialog: React.FC<Props> = ({
  confirmDeleteOpen,
  setConfirmDeleteOpen,
  handleDeleteTrip,
  mode,
}) => {
  const isDark = mode === "dark";

  const [loading, setLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (confirmDeleteOpen) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      iconScale.setValue(0.8);
    }
  }, [confirmDeleteOpen]);

  // ✅ HANDLE DELETE
  const onDeletePress = async () => {
    try {
      setLoading(true);

      await handleDeleteTrip(); // delete from firebase

      setConfirmDeleteOpen(false); // close modal
    } catch (error) {
      console.log("Delete Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={confirmDeleteOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmDeleteOpen(false)}
    >
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setConfirmDeleteOpen(false)}
        />
      </BlurView>

      <View style={styles.centerContainer}>
        <Animated.View
          style={[
            styles.dialog,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(20,20,20,0.9)", "rgba(40,40,40,0.85)"]
                : ["rgba(255,255,255,0.95)", "rgba(240,240,240,0.9)"]
            }
            style={styles.gradient}
          >
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [{ scale: iconScale }],
                  backgroundColor: isDark
                    ? "rgba(255,50,50,0.1)"
                    : "rgba(255,100,100,0.15)",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={42}
                color="#ff4444"
              />
            </Animated.View>

            <Text
              style={[
                styles.title,
                { color: isDark ? "#fff" : "#000" },
              ]}
            >
              Confirm Delete
            </Text>

            <Text
              style={[
                styles.message,
                { color: isDark ? "#ccc" : "#555" },
              ]}
            >
              Are you sure you want to permanently delete this trip?
            </Text>

            <Text style={styles.warningText}>
              This action cannot be undone.
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                disabled={loading}
                onPress={() => setConfirmDeleteOpen(false)}
                style={[
                  styles.cancelButton,
                  { borderColor: isDark ? "#888" : "#aaa" },
                ]}
              >
                <Text
                  style={{
                    color: isDark ? "#fff" : "#000",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onDeletePress}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#ff4e4e", "#d32f2f"]}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteText}>
                    {loading ? "Deleting..." : "Delete"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default ConfirmDeleteDialog;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  gradient: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  warningText: {
    marginTop: 10,
    color: '#ff6666',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 18,
    width: '100%',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
  },
});