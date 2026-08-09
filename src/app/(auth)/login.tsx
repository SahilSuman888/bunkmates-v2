import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { auth } from "../../lib/firebase";

import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { db } from "../../lib/firebase";
import { useSessionGradient, AuthRadialBackground } from "../../contexts/GradientContext";


let GoogleSignin: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch (error) {
  console.warn("Google Sign-In native module unavailable in this environment:", error);
}
// ...existing code...

const { width, height } = Dimensions.get("window");

/* ---------------- SEASON ENGINE ---------------- */

const getSeason = () => {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 6) return "summer";
  if (m >= 7 && m <= 9) return "monsoon";
  if (m >= 10 && m <= 11) return "autumn";
  return "winter";
};

const seasonalLines: any = {
  summer: [
    "Summer Trips Loading",
    "Sun Sand Squad",
    "Beach Days Calling",
    "Heat Waves Memories",
    "Summer Squad Mode",
  ],
  monsoon: [
    "Rain Roads Calling",
    "Cloudy Trips Mood",
    "Monsoon Memories Flow",
    "Stormy Drives Vibes",
    "Rainy Adventures Begin",
  ],
  autumn: [
    "Golden Hour Trips",
    "Cozy Travel Season",
    "Fall Colors Calling",
    "Autumn Squad Energy",
    "Chill Weather Travels",
  ],
  winter: [
    "Cold Air Adventures",
    "Snow Squad Energy",
    "Winter Trips Mode",
    "Mountain Vibes Activated",
    "Cold Roads Calling",
  ],
};

const coreSlogans = [
  "Plan Travel Repeat",
  "Squad Trips Simplified",
  "Travel Smarter Together",
  "Build Memories Together",
  "Trips Without Chaos",
  "Explore Together Always",
  "Friends Trips Memories",
  "Adventure Starts Here",
  "Your Trip Companion",
  "Moments Over Maps",
];

const ctaOptions = [
  "Let's Hit the Road",
  "Start the Adventure",
  "Let's Roll",
  "Trip Time!",
  "Onward 🚀",
  "Time to Explore",
  "Let's Go Places",
  "Ready, Set, Trip",
];


const getGradientAvatar = (seed: string) => {
  const s = seed || Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(
    s
  )}&backgroundType=gradientLinear&radius=50&size=150`;
};

/* ---------------- TYPEWRITER ---------------- */

const useTypewriter = (text: string, speed = 40) => {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplay(text.slice(0, index + 1));
      index++;
      if (index === text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text]);

  return display;
};

/* ---------------- MAIN ---------------- */

export default function Login() {
  const router = useRouter();
  const { gradient: bgGradient } = useSessionGradient();

  const ctaText = useMemo(() => {
    return ctaOptions[Math.floor(Math.random() * ctaOptions.length)];
  }, []);

  const season = getSeason();
  const sloganPool = useMemo(
    () => [...seasonalLines[season], ...coreSlogans],
    [season]
  );

  const [currentLine, setCurrentLine] = useState(sloganPool[0]);
  const typedText = useTypewriter(currentLine);

  const [page, setPage] = useState<"main" | "email">("main");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Configure react-native-google-signin when available
  useEffect(() => {
    if (!GoogleSignin || typeof GoogleSignin.configure !== "function") {
      return;
    }

    GoogleSignin.configure({
      webClientId:
        "37810808180-4su0afr7ht944vfpf4naiptfh9ldbfqs.apps.googleusercontent.com",
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
  }, []);

  /* ROTATING SLOGAN */
  useEffect(() => {
    let index = 0;
    const rotate = () => {
      setCurrentLine(sloganPool[index % sloganPool.length]);
      index++;
    };
    rotate();
    const interval = setInterval(rotate, 2300);
    return () => clearInterval(interval);
  }, [sloganPool]);

  /* AUTO-NAVIGATE TO HOME ON SUCCESS */
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.replace({
  pathname: "/(tabs)/home",
});
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  /* LOGIN */
  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      setCurrentUser(userCredential.user);
      setSuccess(true);
    } catch (err: any) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  /* GOOGLE LOGIN */
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      let userCredential: any;

      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      } else {
        if (!GoogleSignin || typeof GoogleSignin.hasPlayServices !== "function" || typeof GoogleSignin.signIn !== "function") {
          throw new Error("Google Sign-In is not available in this environment");
        }

        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
        const response = await GoogleSignin.signIn();

        const idToken =
          response.idToken ??
          response.data?.idToken;

        if (!idToken) {
          throw new Error("No ID Token received");
        }

        const credential = GoogleAuthProvider.credential(idToken);
        userCredential = await signInWithCredential(auth, credential);
      }

      const userRef = doc(db, "users", userCredential.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          name: userCredential.user.displayName,
          email: userCredential.user.email,
          photoURL: userCredential.user.photoURL,
          provider: "google",
          createdAt: serverTimestamp(),
        });
      }

      setCurrentUser(userCredential.user);
      setSuccess(true);
    } catch (e: any) {
      console.log(e);
      setError("Google Sign-In failed");
    } finally {
      setLoading(false);
    }
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

      {/* TYPEWRITER TEXT */}
      <View style={styles.topTextContainer}>
        <Text style={styles.topText}>
          {typedText}
          <Text style={{ opacity: 0.4 }}>|</Text>
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Animated.View
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(300)}
          style={styles.card}
        >
          {/* ========== MAIN PAGE ========== */}
          {!success && page === "main" && (
            <>
              <View style={styles.headerSection}>
                <Text style={styles.subtitle}>WELCOME TO</Text>
                <Text style={styles.brand}>BunkMates</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setPage("email")}
              >
                <View style={styles.buttonRow}>
                  <Ionicons name="mail-outline" size={18} color="#000000" style={{ marginRight: 10 }} />
                  <Text style={styles.primaryText}>CONTINUE WITH EMAIL</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 10 }]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <View style={styles.buttonRow}>
                  <Ionicons name="logo-google" size={18} color="#000000" style={{ marginRight: 10 }} />
                  <Text style={styles.primaryText}>
                    {loading ? "SIGNING IN..." : "SIGN IN WITH GOOGLE"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/signup")}
              >
                <View style={styles.buttonRow}>
                  <Ionicons name="mail-outline" size={18} color="#ffffff" style={{ marginRight: 10 }} />
                  <Text style={styles.secondaryText}>CREATE NEW ACCOUNT</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* ========== EMAIL LOGIN PAGE ========== */}
          {!success && page === "email" && (
            <>
              <Text style={styles.loginTitle}>Login to BunkMates</Text>

              <TextInput
                placeholder="Email*"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Password*"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
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

              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => router.push("/(auth)/forgot-password")}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.primaryText}>LOGIN</Text>
                )}
              </TouchableOpacity>

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  setPage("main");
                  setError("");
                }}
              >
                <Text style={styles.backText}>BACK</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ========== SUCCESS PAGE ========== */}
          {success && (
            <>
              <View style={styles.successContainer}>
                {/* Avatar */}
                {currentUser?.uid && (
                  <Image
                    source={{
                      uri: getGradientAvatar(currentUser.uid),
                    }}
                    style={styles.avatar}
                  />
                )}

                {/* Greeting */}
                <View style={styles.greetingSection}>
                  <Text style={styles.greetingTitle}>
                    Hey {currentUser?.displayName || "Explorer"}!
                  </Text>
                  <Text style={styles.greetingSubtitle}>
                    You're in. Bags packed. Vibes set.
                  </Text>
                </View>

                {/* User Details */}
                <View style={styles.userDetailsSection}>
                  <Text style={styles.userDetailsLabel}>Signed in as</Text>
                  <Text style={styles.userEmail}>{currentUser?.email}</Text>
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.replace("/(tabs)/home")}
                >
                  <Text style={styles.primaryText}>{ctaText}</Text>
                </TouchableOpacity>

                {/* Micro copy */}
                <Text style={styles.microCopy}>
                  Pro tip: trips are better with friends 😉
                </Text>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  topTextContainer: {
    position: "absolute",
    top: height * 0.24,
    left: 28,
    right: 28,
    zIndex: 5,
  },
  topText: {
    fontSize: 34,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 44,
    letterSpacing: -0.3,
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 24,
    paddingTop: 28,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 44,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerSection: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  brand: {
    fontSize: 38,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 14,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 20,
    letterSpacing: -0.3,
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
    borderColor: "rgba(255,255,255,0.15)",
    fontWeight: "400",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 10,
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
  forgotLink: {
    alignItems: "flex-end",
    marginBottom: 18,
    marginTop: 4,
  },
  forgotText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  primaryText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  secondaryButton: {
    marginVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.8,
  },
  errorText: {
    color: "#ff6b6b",
    textAlign: "center",
    marginVertical: 10,
    fontSize: 13,
    fontWeight: "500",
  },
  backText: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 18,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
  successContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  greetingSection: {
    alignItems: "center",
    marginBottom: 14,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  userDetailsSection: {
    alignItems: "center",
    marginBottom: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  userDetailsLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 4,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  userEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  microCopy: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 18,
    fontStyle: "italic",
  },
});