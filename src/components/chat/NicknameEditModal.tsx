import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Animated,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export interface NicknameEditModalProps {
  visible: boolean;
  onClose: () => void;
  currentNickname: string;
  friendName: string;
  onSave: (newNickname: string) => void;
}

export default function NicknameEditModal({
  visible,
  onClose,
  currentNickname,
  friendName,
  onSave,
}: NicknameEditModalProps) {
  const [nicknameText, setNicknameText] = useState(currentNickname || "");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const inputRef = useRef<TextInput>(null);

  // Keyboard listeners for lifting above keyboard on Android
  useEffect(() => {
    const handleShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      if (h > 0) setKeyboardHeight(h);
    };
    const handleHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      handleShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      handleHide
    );

    let androidWillShowSub: any = null;
    let androidWillHideSub: any = null;
    if (Platform.OS === "android") {
      try {
        androidWillShowSub = Keyboard.addListener("keyboardWillShow", handleShow);
        androidWillHideSub = Keyboard.addListener("keyboardWillHide", handleHide);
      } catch (e) {}
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      androidWillShowSub?.remove();
      androidWillHideSub?.remove();
    };
  }, []);

  // Sync state and run entrance animation on open
  useEffect(() => {
    if (visible) {
      setNicknameText(currentNickname || "");
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } else {
      setKeyboardHeight(0);
      Keyboard.dismiss();
    }
  }, [visible, currentNickname]);

  if (!visible) return null;

  const handleSavePress = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
    onSave(nicknameText.trim());
    onClose();
  };

  const handleClear = () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setNicknameText("");
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        {/* Full Screen Hardware Frosted Background Blur */}
        <BlurView
          intensity={Platform.OS === "ios" ? 90 : 100}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(5, 8, 14, 0.82)" },
          ]}
          pointerEvents="none"
        />

        {/* Backdrop tap dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Keyboard Avoiding Container */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.avoidingView,
            { paddingBottom: Platform.OS === "android" ? keyboardHeight : 0 },
          ]}
        >
          {/* Animated Modal Card */}
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Top Close Button */}
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
            </Pressable>

            {/* Glowing Accent Badge */}
            <View style={styles.badgeCircle}>
              <Feather name="edit-3" size={22} color="#00e6b0" />
            </View>

            {/* Card Title & Subtitle */}
            <Text style={styles.cardTitle}>Set Nickname</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              Visible only to you for {friendName}
            </Text>

            {/* Modern Glass Input Box */}
            <View style={styles.inputBox}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color="#00e6b0"
                style={{ marginRight: 10 }}
              />
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Enter nickname..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                value={nicknameText}
                onChangeText={setNicknameText}
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleSavePress}
                selectionColor="#00e6b0"
                autoCapitalize="words"
                autoCorrect={false}
              />
              {nicknameText.length > 0 && (
                <Pressable onPress={handleClear} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.5)" />
                </Pressable>
              )}
            </View>

            {/* Character Count */}
            <Text style={styles.charCount}>
              {nicknameText.length} / 30
            </Text>

            {/* Action Buttons Row */}
            <View style={styles.btnRow}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  onClose();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.saveBtn}
                onPress={handleSavePress}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  avoidingView: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#11151e",
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 30,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  badgeCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18.5,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  cardSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12.5,
    marginBottom: 20,
    textAlign: "center",
  },
  inputBox: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.4)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  textInput: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    fontSize: 15.5,
    fontWeight: "600",
  },
  clearBtn: {
    padding: 4,
  },
  charCount: {
    alignSelf: "flex-end",
    color: "rgba(255, 255, 255, 0.35)",
    fontSize: 11,
    marginTop: 6,
    marginBottom: 18,
    marginRight: 4,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cancelBtnText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00e6b0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00e6b0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 14.5,
    fontWeight: "700",
  },
});
