import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword } from "firebase/auth";
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

import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { db } from "../../lib/firebase";

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

const GRADIENT_VARIANTS = [
  ["#ff8d1a", "#ff0000", "#000000"],
  ["#a848ec", "#8402ff", "#000000"],
  ["#22d3ee", "#3b83f6", "#000000"],
  ["#fbbf24", "#f97316", "#000000"],
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

  const [bgGradient, setBgGradient] = useState<string[]>([]);

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

  /* RANDOM GRADIENT */
  useEffect(() => {
    const random =
      GRADIENT_VARIANTS[
        Math.floor(Math.random() * GRADIENT_VARIANTS.length)
      ];
    setBgGradient(random);
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
      const userCredential = await signInWithCredential(auth, credential);

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
    } catch (e) {
      console.log(e);
      setError("Google Sign-In failed");
    } finally {
      setLoading(false);
    }
  };

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
                <Text style={styles.subtitle}>Welcome to</Text>
                <Text style={styles.brand}>BunkMates</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setPage("email")}
              >
                <Text style={styles.primaryText}>
                  Continue with Email
                </Text>
              </TouchableOpacity>

              {/* Google Sign-in */}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: "#fff", marginTop: 8 }]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Text style={[styles.primaryText, { color: "#000" }]}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/signup")}
              >
                <Text style={styles.secondaryText}>
                  Create New Account
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ========== EMAIL LOGIN PAGE ========== */}
          {!success && page === "email" && (
            <>
              <Text style={styles.loginTitle}>Login to BunkMates</Text>

              <TextInput
                placeholder="Email"
                placeholderTextColor="#aaa"
                style={styles.input}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
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

              <TouchableOpacity style={styles.forgotLink}>
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
                  <Text style={styles.primaryText}>Login</Text>
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
                <Text style={styles.backText}>Back</Text>
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
    top: height * 0.3,
    left: 40,
    right: 40,
    zIndex: 5,
  },
  topText: {
    fontSize: 40,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 48,
  },
  card: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 28,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  brand: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 15,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    color: "#fff",
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: "#fff",
    fontSize: 16,
  },
  passwordToggle: {
    paddingRight: 12,
  },
  passwordToggleText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
  },
  forgotLink: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  forgotText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  primaryText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    color: "#ff6b6b",
    textAlign: "center",
    marginVertical: 12,
    fontSize: 14,
  },
  backText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 15,
    fontSize: 14,
  },
  successContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  greetingSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  userDetailsSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  userDetailsLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  microCopy: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 16,
  },
});