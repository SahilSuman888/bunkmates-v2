import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../lib/firebase";
import { useSessionGradient, AuthRadialBackground } from "../../contexts/GradientContext";


const { width, height } = Dimensions.get("window");

type Step = "input" | "sending" | "sent" | "error";

export default function ForgotPassword() {
  const router = useRouter();
  const { gradient: bgGradient } = useSessionGradient();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [errorMsg, setErrorMsg] = useState("");

  /* ---------- animations ---------- */
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  /* ---------- entrance animation ---------- */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /* ---------- pulse loop for icon ---------- */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  /* ---------- success bounce ---------- */
  const triggerSuccessBounce = () => {
    Animated.spring(successScale, {
      toValue: 1,
      tension: 100,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  /* ---------- send reset email ---------- */
  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg("Please enter your email address.");
      setStep("error");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg("That doesn't look like a valid email.");
      setStep("error");
      return;
    }

    Keyboard.dismiss();
    setStep("sending");
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setStep("sent");
      triggerSuccessBounce();
    } catch (err: any) {
      const code: string = err?.code ?? "";
      if (code === "auth/user-not-found") {
        // Still show success so we don't leak which emails are registered
        setStep("sent");
        triggerSuccessBounce();
      } else if (code === "auth/invalid-email") {
        setErrorMsg("That email address isn't valid.");
        setStep("error");
      } else if (code === "auth/too-many-requests") {
        setErrorMsg("Too many attempts. Please try again later.");
        setStep("error");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
        setStep("error");
      }
    }
  };

  const handleTryAgain = () => {
    setStep("input");
    setErrorMsg("");
    setEmail("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* RADIAL BACKGROUND (Matches bunk-mates-master) */}
      <AuthRadialBackground />

      {/* INVISIBLE TOUCHABLE - dismiss keyboard when tapping background */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => Keyboard.dismiss()}
      />

      {/* Decorative floating circle */}
      <Animated.View
        style={[
          styles.floatingCircle,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.03)"]}
          style={styles.floatingCircleInner}
        />
      </Animated.View>

      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ========== INPUT STATE ========== */}
          {(step === "input" || step === "error") && (
            <>
              {/* Icon */}
              <View style={styles.iconWrapper}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.05)"]}
                  style={styles.iconBadge}
                >
                  <Text style={styles.iconEmoji}>🔑</Text>
                </LinearGradient>
              </View>

              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter the email linked to your account. We'll send you a link to
                get back in.
              </Text>

              {/* Email input */}
              <View
                style={[
                  styles.inputWrapper,
                  step === "error" && styles.inputWrapperError,
                ]}
              >
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (step === "error") setStep("input");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                />
              </View>

              {/* Error message */}
              {step === "error" && errorMsg ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Send button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSend}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,1)", "rgba(220,220,220,1)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryText}>Send Reset Link</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Back to login */}
              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ========== SENDING STATE ========== */}
          {step === "sending" && (
            <View style={styles.centeredState}>
              <View style={styles.iconWrapper}>
                <LinearGradient
                  colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0.05)"]}
                  style={styles.iconBadge}
                >
                  <ActivityIndicator color="#fff" size="large" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Sending Link…</Text>
              <Text style={styles.subtitle}>
                Hang tight, we're sending your reset link right now.
              </Text>
            </View>
          )}

          {/* ========== SUCCESS STATE ========== */}
          {step === "sent" && (
            <View style={styles.centeredState}>
              <Animated.View
                style={[
                  styles.iconWrapper,
                  { transform: [{ scale: successScale }] },
                ]}
              >
                <LinearGradient
                  colors={["rgba(74,222,128,0.3)", "rgba(74,222,128,0.08)"]}
                  style={styles.iconBadge}
                >
                  <Text style={styles.iconEmoji}>✉️</Text>
                </LinearGradient>
              </Animated.View>

              <Text style={styles.title}>Check your inbox!</Text>
              <Text style={styles.subtitle}>
                We've sent a reset link to{"\n"}
                <Text style={styles.emailHighlight}>{email}</Text>
                {"\n\n"}Follow the link in the email to create a new password.
              </Text>

              {/* Tip card */}
              <View style={styles.tipCard}>
                <Text style={styles.tipIcon}>💡</Text>
                <Text style={styles.tipText}>
                  Can't find it? Check your spam or promotions folder.
                </Text>
              </View>

              {/* Try different email */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleTryAgain}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,1)", "rgba(220,220,220,1)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryText}>Try a Different Email</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---- STYLES ---- */

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 24,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  backArrow: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  floatingCircle: {
    position: "absolute",
    top: height * 0.12,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: "hidden",
  },
  floatingCircleInner: {
    flex: 1,
    borderRadius: 110,
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  centeredState: {
    alignItems: "center",
  },
  iconWrapper: {
    alignSelf: "center",
    marginBottom: 20,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  iconEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  emailHighlight: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputWrapperError: {
    borderColor: "rgba(255,100,100,0.6)",
    backgroundColor: "rgba(255,80,80,0.05)",
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,80,80,0.12)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.25)",
    gap: 8,
  },
  errorIcon: {
    fontSize: 15,
  },
  errorText: {
    color: "#ff8080",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 4,
    width: "100%",
  },
  primaryGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  backToLoginBtn: {
    marginTop: 18,
    alignItems: "center",
  },
  backToLoginText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "500",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 10,
    width: "100%",
  },
  tipIcon: {
    fontSize: 16,
  },
  tipText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
