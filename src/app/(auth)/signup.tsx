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

/* ---------------- Gradient Variants ---------------- */

const GRADIENT_VARIANTS = [
  ["#ff8d1a", "#ff0000", "#000000"],
  ["#a848ec", "#8402ff", "#000000"],
  ["#22d3ee", "#3b83f6", "#000000"],
  ["#fbbf24", "#f97316", "#000000"],
];

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
  const [bgGradient, setBgGradient] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  /* Random gradient on mount */
  useEffect(() => {
    const random =
      GRADIENT_VARIANTS[
        Math.floor(Math.random() * GRADIENT_VARIANTS.length)
      ];
    setBgGradient(random);
  }, []);

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
    <View 
      style={{ flex: 1, backgroundColor: "#000" }}
    >
      {/* GRADIENT BACKGROUND - TOUCHABLE TO DISMISS KEYBOARD */}
      <TouchableOpacity 
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={() => Keyboard.dismiss()}
      >
        <LinearGradient
          colors={bgGradient.length > 0 ? bgGradient : ["#000", "#000"] as any}
          start={{ x: 0.7, y: 0.1 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </TouchableOpacity>

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
                placeholder="Name"
                placeholderTextColor="rgba(170,170,170,0.8)"
                style={styles.input}
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
              />

              {/* Mobile Field */}
              <TextInput
                placeholder="Mobile"
                placeholderTextColor="rgba(170,170,170,0.8)"
                style={styles.input}
                keyboardType="phone-pad"
                value={formData.mobile}
                onChangeText={(text) =>
                  setFormData({ ...formData, mobile: text })
                }
              />

              {/* Email Field */}
              <TextInput
                placeholder="Email"
                placeholderTextColor="rgba(170,170,170,0.8)"
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
                  placeholder="Username"
                  placeholderTextColor="rgba(170,170,170,0.8)"
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
                  placeholder="Password"
                  placeholderTextColor="rgba(170,170,170,0.8)"
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
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
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
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(170,170,170,0.8)"
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
                  <Text style={styles.passwordToggleText}>
                    {showConfirm ? "Hide" : "Show"}
                  </Text>
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
                  <Text style={styles.signupButtonText}>Sign Up</Text>
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
    paddingVertical: 40,
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    padding: 14,
    color: "#fff",
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  usernameContainer: {
    position: "relative",
    marginBottom: 8,
  },
  usernameLoader: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  usernameStatus: {
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    color: "#fff",
    fontSize: 15,
  },
  passwordToggle: {
    paddingRight: 12,
  },
  passwordToggleText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
  },
  rulesContainer: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  ruleText: {
    fontSize: 12,
  },
  strengthSection: {
    marginBottom: 16,
  },
  strengthBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 10,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  signupButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  signupButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
  },
  loginLinkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  loginLinkText: {
    color: "#fff",
    fontSize: 14,
  },
  loginLink: {
    color: "#00BFA6",
    fontSize: 14,
    fontWeight: "600",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  dialogContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 320,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  dialogMessage: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 16,
  },
  dialogInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  dialogButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  dialogButtonText: {
    color: "#fff",
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