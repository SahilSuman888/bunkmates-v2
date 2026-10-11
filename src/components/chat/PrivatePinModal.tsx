import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";
import { BlurView } from "../ui/AppBlurView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface PrivatePinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionTitle?: string;
  mode?: "verify" | "set" | "auto";
  inline?: boolean;
}

export default function PrivatePinModal({
  visible,
  onClose,
  onSuccess,
  actionTitle,
  mode = "auto",
  inline = false,
}: PrivatePinModalProps) {
  const { user } = useUser();

  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [step, setStep] = useState<"verify" | "create" | "confirm">("verify");
  const [secretCode, setSecretCode] = useState<string>("");
  const [tempCode, setTempCode] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const handleShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      if (h > 0) {
        setKeyboardHeight(h);
      }
    };
    const handleHide = () => {
      setKeyboardHeight(0);
    };

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

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      Keyboard.dismiss();
    }
  }, [visible]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Check biometric support
  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometrics(compatible && enrolled);
      } catch (e) {
        setHasBiometrics(false);
      }
    };
    checkBiometrics();
  }, []);

  // Load existing code on open
  useEffect(() => {
    if (!visible || !user?.uid) return;

    // Reset state
    setSecretCode("");
    setTempCode("");
    setErrorMsg("");
    setShowPassword(false);
    setIsFocused(true);

    const fetchCode = async () => {
      let existingCode: string | null = null;
      try {
        const cached = await AsyncStorage.getItem(`@bunkmates_private_pin_${user.uid}`);
        if (cached && cached.trim().length > 0) {
          existingCode = cached.trim();
        }
      } catch (e) {}

      if (!existingCode) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.privateChatPin) {
              const codeStr = String(data.privateChatPin).trim();
              existingCode = codeStr;
              AsyncStorage.setItem(`@bunkmates_private_pin_${user.uid}`, codeStr).catch(() => {});
            }
          }
        } catch (e) {}
      }

      setSavedCode(existingCode);

      const targetStep = mode === "set" || (!existingCode && mode === "auto") ? "create" : "verify";
      setStep(targetStep);

      // If verifying and device has fingerprint/biometrics, automatically prompt for fingerprint!
      if (targetStep === "verify") {
        setTimeout(() => {
          triggerFingerprintAuth();
        }, 350);
      }
    };

    fetchCode();
  }, [visible, user?.uid, mode]);

  // Handle Entrance / Exit animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 22,
          stiffness: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        inputRef.current?.focus();
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.95);
    }
  }, [visible]);

  // Fingerprint / Biometric authentication
  const triggerFingerprintAuth = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) return;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Private Chats",
        fallbackLabel: "Use Secret Code",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
        onSuccess();
        onClose();
      }
    } catch (err) {
      // User cancelled or biometric failed, continue with secret code input
    }
  };

  const triggerShake = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {}
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleContinue = async () => {
    const code = secretCode.trim();
    if (!code) return;
    if (!user?.uid) return;

    if (step === "create") {
      if (code.length < 4) {
        triggerShake();
        setErrorMsg("Secret code must be at least 4 characters");
        return;
      }
      try {
        Haptics.selectionAsync();
      } catch (e) {}
      setTempCode(code);
      setSecretCode("");
      setErrorMsg("");
      setStep("confirm");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else if (step === "confirm") {
      if (code === tempCode) {
        // Success: Secret code created & verified
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}

        try {
          await updateDoc(doc(db, "users", user.uid), {
            privateChatPin: code,
          });
          await AsyncStorage.setItem(`@bunkmates_private_pin_${user.uid}`, code);
          setSavedCode(code);
        } catch (err) {
          console.error("Error saving secret code:", err);
        }

        onSuccess();
        onClose();
      } else {
        triggerShake();
        setErrorMsg("Secret codes do not match. Please try again.");
        setSecretCode("");
        setTempCode("");
        setStep("create");
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } else if (step === "verify") {
      if (code === savedCode) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
        onSuccess();
        onClose();
      } else {
        triggerShake();
        setErrorMsg("Incorrect secret code. Please try again.");
        setSecretCode("");
      }
    }
  };

  const handleResetCode = () => {
    Alert.alert(
      "Reset Secret Code?",
      "You will be asked to set a new secret code for your locked chats.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Code",
          style: "destructive",
          onPress: () => {
            setSecretCode("");
            setTempCode("");
            setErrorMsg("");
            setStep("create");
            setTimeout(() => {
              inputRef.current?.focus();
            }, 100);
          },
        },
      ]
    );
  };

  if (!visible) return null;

  const getHeaderTitle = () => {
    if (step === "create") return "Create a secret code";
    if (step === "confirm") return "Confirm your secret code";
    return "Enter your secret code";
  };

  const getLabelText = () => {
    if (step === "create") return "Enter a new secret code";
    if (step === "confirm") return "Confirm secret code";
    return "Enter your secret code";
  };

  const isContinueActive = secretCode.trim().length > 0;

  const modalBody = (
    <View style={styles.overlayContainer}>
        {/* Dim & Frosted Blur Backdrop */}
        <BlurView
          intensity={Platform.OS === "ios" ? 80 : 95}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(9, 13, 17, 0.78)" }]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Bottom Sheet Card adhering to WhatsApp UI (Image 1) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.keyboardAvoid,
            { paddingBottom: Platform.OS === "android" ? keyboardHeight : 0 },
          ]}
        >
          <Animated.View
            style={[
              styles.sheetCard,
              keyboardHeight > 0 && { paddingTop: 10, paddingBottom: 14 },
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                  { translateX: shakeAnim },
                ],
              },
            ]}
          >
            {/* Top Sheet Drag Handle */}
            <View style={styles.sheetHandle} />

            {/* Header Close button */}
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
            </Pressable>

            {/* WhatsApp-Style Center Circular Badge (Hidden when keyboard is open to preserve vertical space) */}
            {keyboardHeight === 0 ? (
              <View style={styles.centerBadge}>
                <Ionicons name="lock-closed" size={26} color="#ffffff" />
              </View>
            ) : null}

            {/* Main Title */}
            <Text style={[styles.titleText, keyboardHeight > 0 && { fontSize: 17, marginBottom: 14 }]}>
              {getHeaderTitle()}
            </Text>

            {/* WhatsApp Outlined Input Box (Image 1) */}
            <View
              style={[
                styles.outlinedBox,
                isFocused && styles.outlinedBoxFocused,
                !!errorMsg && styles.outlinedBoxError,
              ]}
            >
              {/* Floating Top Label Notch */}
              <View style={styles.floatingLabelContainer}>
                <Text
                  style={[
                    styles.floatingLabelText,
                    isFocused && styles.floatingLabelTextFocused,
                    !!errorMsg && styles.floatingLabelTextError,
                  ]}
                >
                  {getLabelText()}
                </Text>
              </View>

              {/* TextInput Field */}
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={secretCode}
                onChangeText={(val) => {
                  setSecretCode(val);
                  setErrorMsg("");
                }}
                secureTextEntry={!showPassword}
                placeholder=""
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                selectionColor="#ffffff"
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Eye Toggle Icon Button */}
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  setShowPassword(!showPassword);
                }}
                style={styles.eyeBtn}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </Pressable>
            </View>

            {/* Error Message */}
            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : (
              <View style={keyboardHeight > 0 ? { height: 10 } : styles.errorSpacer} />
            )}

            {/* Primary "Continue" Button (WhatsApp Style in White/Black) */}
            <Pressable
              style={({ pressed }) => [
                styles.continueBtn,
                isContinueActive ? styles.continueBtnActive : styles.continueBtnDisabled,
                pressed && isContinueActive && styles.continueBtnPressed,
                keyboardHeight > 0 && { marginBottom: 8 },
              ]}
              onPress={handleContinue}
              disabled={!isContinueActive}
            >
              <Text
                style={[
                  styles.continueBtnText,
                  isContinueActive
                    ? styles.continueBtnTextActive
                    : styles.continueBtnTextDisabled,
                ]}
              >
                Continue
              </Text>
            </Pressable>

            {/* Fingerprint / Biometric Option (Only shown when keyboard is dismissed) */}
            {keyboardHeight === 0 && step === "verify" && hasBiometrics && (
              <Pressable
                style={styles.fingerprintBtn}
                onPress={triggerFingerprintAuth}
              >
                <Ionicons name="finger-print" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.fingerprintText}>Unlock with fingerprint</Text>
              </Pressable>
            )}

            {/* Forgot Secret Code Link */}
            {step === "verify" && savedCode && (
              <Pressable style={styles.forgotBtn} onPress={handleResetCode}>
                <Text style={styles.forgotText}>Forgot secret code?</Text>
              </Pressable>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
  );

  if (!visible) return null;

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
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
    >
      {modalBody}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    height: "100%",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  keyboardAvoid: {
    width: "100%",
  },
  sheetCard: {
    width: "100%",
    backgroundColor: "#11141c",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 28,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 20,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginBottom: 16,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  titleText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 24,
    textAlign: "center",
  },
  outlinedBox: {
    width: "100%",
    height: 58,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  outlinedBoxFocused: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  outlinedBoxError: {
    borderColor: "#ef4444",
  },
  floatingLabelContainer: {
    position: "absolute",
    top: -10,
    left: 14,
    backgroundColor: "#11141c",
    paddingHorizontal: 6,
  },
  floatingLabelText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "600",
  },
  floatingLabelTextFocused: {
    color: "#ffffff",
    fontWeight: "700",
  },
  floatingLabelTextError: {
    color: "#ef4444",
  },
  textInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 17,
    letterSpacing: 1.2,
    fontWeight: "600",
    height: "100%",
  },
  eyeBtn: {
    padding: 6,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 10,
    textAlign: "center",
  },
  errorSpacer: {
    height: 16,
  },
  continueBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  continueBtnActive: {
    backgroundColor: "#ffffff",
  },
  continueBtnDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  continueBtnPressed: {
    opacity: 0.88,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  continueBtnTextActive: {
    color: "#000000",
  },
  continueBtnTextDisabled: {
    color: "rgba(255, 255, 255, 0.35)",
  },
  fingerprintBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    marginBottom: 10,
  },
  fingerprintText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  forgotBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  forgotText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
