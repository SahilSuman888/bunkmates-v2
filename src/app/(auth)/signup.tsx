import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSessionGradient, AuthRadialBackground } from "../../contexts/GradientContext";

import { Ionicons } from "@expo/vector-icons";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const { width, height } = Dimensions.get("window");

/* ---------------- Avatar Generator ---------------- */

const getGradientAvatar = (seed?: string) => {
  const s = seed || Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
    s
  )}&backgroundType=gradientLinear&radius=50&size=150`;
};


/* ---------------- Password Rules Check ---------------- */

const checkPasswordRules = (password: string) => ({
  length: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  number: /[0-9]/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});

/* ---------------- Password Strength Function ---------------- */

const getPasswordStrength = (password: string) => {
  const rules = checkPasswordRules(password);
  const passed = Object.values(rules).filter(Boolean).length;

  if (passed <= 1)
    return { label: "Weak", color: "#ef4444", value: 25 };
  if (passed === 2 || passed === 3)
    return { label: "Moderate", color: "#f59e0b", value: 60 };
  return { label: "Strong", color: "#22c55e", value: 100 };
};

export default function Signup() {
  const { gradient: bgGradient } = useSessionGradient();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    mobile: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  /* Username availability check */
  const handleUsernameChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, username: value }));

    if (value.length >= 3) {
      setCheckingUsername(true);
      setUsernameAvailable(null);

      try {
        const q = query(
          collection(db, "users"),
          where("username", "==", value)
        );
        const snap = await getDocs(q);
        setUsernameAvailable(snap.empty);
      } catch (err) {
        console.error("Username check error:", err);
      }
      setCheckingUsername(false);
    }
  };

  const checkUsernameExists = async (username: string) => {
    const q = query(
      collection(db, "users"),
      where("username", "==", username)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  const handleSignup = async () => {
    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const passwordRules = checkPasswordRules(formData.password);
    const strength = Object.values(passwordRules).filter(Boolean).length;

    if (strength < 3) {
      Alert.alert("Error", "Password is not strong enough");
      return;
    }

    if (usernameAvailable === false) {
      Alert.alert("Error", "Username already taken");
      return;
    }

    try {
      setLoading(true);

      const userCred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const avatarUrl = getGradientAvatar(userCred.user.uid);

      await updateProfile(userCred.user, {
        displayName: formData.name,
        photoURL: avatarUrl,
      });

      await setDoc(doc(db, "users", userCred.user.uid), {
        name: formData.name,
        username: formData.username,
        mobile: formData.mobile,
        email: formData.email,
        type: "Regular",
        photoURL: avatarUrl,
      });

      Alert.alert("Success", "Account created!", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/home"),
        },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = checkPasswordRules(formData.password);
  const passwordStrength = formData.password
    ? getPasswordStrength(formData.password)
    : null;

  const isFormValid =
    formData.name &&
    formData.username &&
    formData.mobile &&
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    formData.password === formData.confirmPassword &&
    usernameAvailable === true &&
    Object.values(passwordRules).filter(Boolean).length >= 3;

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

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.headerSection}>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Join BunkMates and start planning smarter trips
              </Text>
            </View>

            {/* FORM */}
            <View style={styles.formSection}>
              {/* Name Field */}
              <TextInput
                placeholder="Name*"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
              />

              {/* Mobile Field */}
              <TextInput
                placeholder="Mobile*"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                keyboardType="phone-pad"
                value={formData.mobile}
                onChangeText={(text) =>
                  setFormData({ ...formData, mobile: text })
                }
              />

              {/* Email Field */}
              <TextInput
                placeholder="Email*"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) =>
                  setFormData({ ...formData, email: text })
                }
              />

              {/* Username Field with Availability Check */}
              <View style={styles.usernameContainer}>
                <TextInput
                  placeholder="Username*"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                  autoCapitalize="none"
                  value={formData.username}
                  onChangeText={handleUsernameChange}
                  editable={!checkingUsername}
                />
                {checkingUsername && (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={styles.usernameLoader}
                  />
                )}
              </View>

              {formData.username.length >= 3 && (
                <Text
                  style={[
                    styles.usernameStatus,
                    {
                      color:
                        checkingUsername
                          ? "rgba(255,255,255,0.6)"
                          : usernameAvailable === true
                          ? "#22c55e"
                          : "#ef4444",
                    },
                  ]}
                >
                  {checkingUsername
                    ? "Checking availability..."
                    : usernameAvailable === true
                    ? "✔ Username available"
                    : "✕ Username taken"}
                </Text>
              )}

              {/* Password Field */}
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Password*"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(text) =>
                    setFormData({ ...formData, password: text })
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Rules */}
              {formData.password && (
                <View style={styles.rulesContainer}>
                  {[
                    { label: "At least 8 characters", ok: passwordRules.length },
                    { label: "One uppercase letter", ok: passwordRules.uppercase },
                    { label: "One number", ok: passwordRules.number },
                    { label: "One symbol", ok: passwordRules.symbol },
                  ].map((rule) => (
                    <View key={rule.label} style={styles.ruleRow}>
                      <Text
                        style={[
                          styles.ruleIcon,
                          { color: rule.ok ? "#22c55e" : "rgba(255,255,255,0.5)" },
                        ]}
                      >
                        {rule.ok ? "✔" : "○"}
                      </Text>
                      <Text
                        style={[
                          styles.ruleText,
                          { color: rule.ok ? "#22c55e" : "rgba(255,255,255,0.5)" },
                        ]}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Password Strength Bar */}
              {passwordStrength && (
                <View style={styles.strengthSection}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${passwordStrength.value}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={{ color: passwordStrength.color, fontSize: 12 }}>
                    Password strength: {passwordStrength.label}
                  </Text>
                </View>
              )}

              {/* Confirm Password Field */}
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Confirm Password*"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirm}
                  value={formData.confirmPassword}
                  onChangeText={(text) =>
                    setFormData({ ...formData, confirmPassword: text })
                  }
                />
                <TouchableOpacity
                  onPress={() => setShowConfirm(!showConfirm)}
                  style={styles.passwordToggle}
                >
                  <Ionicons
                    name={showConfirm ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Mismatch Warning */}
              {formData.confirmPassword &&
                formData.password !== formData.confirmPassword && (
                  <Text style={styles.errorText}>
                    Passwords do not match
                  </Text>
                )}

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[
                  styles.signupButton,
                  {
                    opacity: isFormValid ? 1 : 0.6,
                  },
                ]}
                onPress={handleSignup}
                disabled={!isFormValid || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.signupButtonText}>SIGN UP</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginLinkContainer}>
                <Text style={styles.loginLinkText}>
                  Already have an account?{" "}
                </Text>
                <TouchableOpacity onPress={() => router.push("/login")}>
                  <Text style={styles.loginLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Username Collision Dialog */}
      <Modal
        visible={openDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenDialog(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>Username Already Taken</Text>
            <Text style={styles.dialogMessage}>
              This username is already taken. Try another one.
            </Text>
            <TextInput
              placeholder="Enter New Username"
              placeholderTextColor="#aaa"
              style={styles.dialogInput}
              value={formData.username}
              onChangeText={(text) =>
                setFormData({ ...formData, username: text })
              }
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogButton}
                onPress={() => setOpenDialog(false)}
              >
                <Text style={styles.dialogButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonPrimary]}
                onPress={() => setOpenDialog(false)}
              >
                <Text style={styles.dialogButtonTextPrimary}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 48,
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerSection: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
    fontWeight: "400",
  },
  formSection: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#fff",
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontWeight: "400",
  },
  usernameContainer: {
    position: "relative",
    marginBottom: 6,
  },
  usernameLoader: {
    position: "absolute",
    right: 14,
    top: 16,
  },
  usernameStatus: {
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    fontWeight: "600",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#fff",
    fontSize: 15,
  },
  passwordToggle: {
    paddingRight: 14,
    paddingLeft: 4,
  },
  passwordToggleText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  rulesContainer: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleIcon: {
    fontSize: 13,
    marginRight: 9,
    width: 16,
  },
  ruleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  strengthSection: {
    marginBottom: 14,
  },
  strengthBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 10,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  signupButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  signupButtonText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  loginLinkText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  loginLink: {
    color: "#22d3ee",
    fontSize: 14,
    fontWeight: "700",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogContent: {
    backgroundColor: "#111115",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  dialogMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 18,
    lineHeight: 20,
  },
  dialogInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 13,
    color: "#fff",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: 15,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  dialogButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  dialogButtonText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "500",
  },
  dialogButtonPrimary: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  dialogButtonTextPrimary: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});