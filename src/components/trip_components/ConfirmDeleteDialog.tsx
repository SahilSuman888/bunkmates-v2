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
  confirmDeleteOpen?: boolean;
  setConfirmDeleteOpen?: (value: boolean) => void;
  visible?: boolean;
  onClose?: () => void;
  handleDeleteTrip?: () => Promise<void> | void;
  onConfirm?: () => Promise<void> | void;
  tripName?: string;
  mode?: "light" | "dark";
}

const ConfirmDeleteDialog: React.FC<Props> = ({
  confirmDeleteOpen,
  setConfirmDeleteOpen,
  visible,
  onClose,
  handleDeleteTrip,
  onConfirm,
  tripName,
  mode = "dark",
}) => {
  const isDark = mode === "dark";
  const isOpen = visible !== undefined ? visible : !!confirmDeleteOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (setConfirmDeleteOpen) {
      setConfirmDeleteOpen(false);
    }
  };

  const handleAction = onConfirm || handleDeleteTrip;

  const [loading, setLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  const onDeletePress = async () => {
    if (!handleAction) return;
    try {
      setLoading(true);
      await handleAction();
      handleClose();
    } catch (error) {
      console.log("Delete Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={handleClose}
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
                ? ["rgba(20,20,20,0.95)", "rgba(40,40,40,0.9)"]
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
              {tripName
                ? `Are you sure you want to permanently delete "${tripName}"?`
                : "Are you sure you want to permanently delete this trip?"}
            </Text>

            <Text style={styles.warningText}>
              This action cannot be undone.
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                disabled={loading}
                onPress={handleClose}
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
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  gradient: {
    padding: 22,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 6,
  },
  warningText: {
    color: "#ff4444",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    flex: 1,
    minWidth: 110,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});