import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "../ui/AppBlurView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PrivateLockSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  type?: "locked" | "unlocked";
  chatName?: string;
  onViewPrivateTab?: () => void;
  inline?: boolean;
}

export default function PrivateLockSuccessModal({
  visible,
  onClose,
  type = "locked",
  chatName,
  onViewPrivateTab,
  inline = false,
}: PrivateLockSuccessModalProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, [visible]);

  if (!visible) return null;

  const isLocked = type === "locked";

  const modalBody = (
    <View style={styles.overlay}>
        {/* Dim & Frosted Blur backdrop */}
        <BlurView
          intensity={Platform.OS === "ios" ? 80 : 95}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(9, 13, 17, 0.78)" }]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Dialog card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Icon Badge */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={isLocked ? "lock-closed" : "lock-open"}
                size={30}
                color="#ffffff"
              />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.titleText}>
            {isLocked ? "Chat Locked" : "Chat Unlocked"}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitleText}>
            {isLocked
              ? `${chatName ? `"${chatName}"` : "This chat"} is set as private and moved to your secure private safe.`
              : `${chatName ? `"${chatName}"` : "This chat"} has been restored to your main chat feeds.`}
          </Text>

          {/* Instruction Card (Swipe right instruction for Locked) */}
          {isLocked && (
            <View style={styles.instructionBox}>
              <View style={styles.instructionIconRow}>
                <View style={styles.swipeIconCircle}>
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.instructionTitle}>How to find it:</Text>
                  <Text style={styles.instructionBody}>
                    In the top tabs, <Text style={styles.highlightText}>swipe right</Text> to access the <Text style={styles.highlightText}>Private</Text> tab.
                  </Text>
                </View>
              </View>

              <View style={styles.tabsIllustrationRow}>
                <View style={styles.demoTabDim}>
                  <Text style={styles.demoTabTextDim}>All</Text>
                </View>
                <View style={styles.demoTabDim}>
                  <Text style={styles.demoTabTextDim}>Unread</Text>
                </View>
                <Ionicons name="arrow-forward" size={13} color="rgba(255, 255, 255, 0.4)" />
                <View style={styles.demoTabActive}>
                  <Ionicons name="lock-closed" size={10} color="#000000" style={{ marginRight: 3 }} />
                  <Text style={styles.demoTabTextActive}>Private</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {isLocked && onViewPrivateTab ? (
              <>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (e) {}
                    onClose();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>CLOSE</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch (e) {}
                    onClose();
                    onViewPrivateTab();
                  }}
                >
                  <Text style={styles.primaryBtnText}>VIEW PRIVATE TAB</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  onClose();
                }}
              >
                <Text style={styles.primaryBtnText}>GOT IT</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
  );

  if (inline) {
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 999999, elevation: 30, width: "100%", height: "100%" }]}>
        {modalBody}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {modalBody}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    width: "100%",
    height: "100%",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#11141c",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitleText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  instructionBox: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    padding: 14,
    marginBottom: 20,
  },
  instructionIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  swipeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  instructionTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  instructionBody: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12.5,
    lineHeight: 18,
  },
  highlightText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tabsIllustrationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  demoTabDim: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  demoTabTextDim: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    fontWeight: "600",
  },
  demoTabActive: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  demoTabTextActive: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  primaryBtn: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#000000",
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
