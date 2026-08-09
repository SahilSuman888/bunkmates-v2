import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { auth, db } from "../lib/firebase";

import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";

export default function FeedbackScreen() {
  const { width, height } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 390, 0.88), 1.12);
  const horizontalPadding = Math.max(18, width * 0.055);
  const contentPaddingBottom = Math.max(40, height * 0.04);
  const buttonHeight = Math.max(44, Math.round(36 * scale));
  const titleFontSize = Math.round(18 * scale);
  const bodyFontSize = Math.max(12, Math.round(12 * scale));
  const labelFontSize = Math.max(10, Math.round(10 * scale));

  const [feedback, setFeedback] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [userName, setUserName] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      const user = auth.currentUser;

      if (!user) return;

      // Default values from Firebase Auth
      setUserName(user.displayName || "");
      setFeedbackEmail(user.email || "");

      // Get latest user data from Firestore
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();

          setUserName(
            data.name ||
              user.displayName ||
              ""
          );

          setFeedbackEmail(
            data.email ||
              user.email ||
              ""
          );
        }
      } catch (error) {
        console.log(
          "Error loading user data:",
          error
        );
      }
    };

    loadUserData();
  }, []);

  // ==========================================
  // SUBMIT FEEDBACK
  // ==========================================

  const handleSubmit = async () => {
    const message = feedback.trim();

    if (!message) {
      return;
    }

    setLoading(true);
    setSuccess(false);

    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const name =
      userName ||
      user.displayName ||
      "";

    const email =
      feedbackEmail.trim() ||
      user.email ||
      "";

    const uid = user.uid;

    try {
      // ========================================
      // 1. SAVE FEEDBACK TO FIRESTORE
      // ========================================

      await addDoc(
        collection(db, "feedback"),
        {
          appVersion: "Beta_3.0.08.100",
          createdAt: serverTimestamp(),
          email: email,
          message: message,
          name: name,
          uid: uid,
        }
      );

      // ========================================
      // 2. CREATE NOTIFICATION
      // ========================================

      await addDoc(
        collection(db, "notifications"),
        {
          admin_content:
            `${name} has submitted a Feedback.`,

          content:
            `Hi ${name}, We've received your Feedback and are thrilled to assist you. ` +
            `Here's a copy of your submission: ` +
            `<br> <b>Name:</b> ${name}` +
            `<br> <b>Email:</b> ${email}` +
            `<br> <b>Message:</b> ${message}` +
            `<br> Our support team will reach out to you shortly if needed. ` +
            `Thank you for connecting with BunkMates!`,

          read: false,

          timestamp: serverTimestamp(),

          title:
            "📩 Your Feedback is submitted successfully!",

          type: "feedback",

          uid: uid,
        }
      );

      // ========================================
      // 3. RESET FORM
      // ========================================

      setFeedback("");
      setFeedbackEmail("");

      // Show success message
      setSuccess(true);

    } catch (error) {
      console.error(
        "Failed to send feedback:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: Math.round(24 * scale),
            paddingBottom: contentPaddingBottom,
          },
        ]}
      >
        {/* ================================== */}
        {/* BACK BUTTON */}
        {/* ================================== */}

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft
            size={15}
            color="#d8d8d8"
          />

          <Text style={styles.backText}>
            BACK
          </Text>
        </Pressable>

        {/* ================================== */}
        {/* TITLE */}
        {/* ================================== */}

        <Text style={[styles.title, { fontSize: titleFontSize, marginBottom: Math.round(12 * scale) }]}> 
          Report & Feedback
        </Text>

        {/* ================================== */}
        {/* DESCRIPTION */}
        {/* ================================== */}

        <Text style={[styles.description, { fontSize: bodyFontSize, lineHeight: Math.round(18 * scale), marginBottom: Math.round(18 * scale) }]}> 
          We value your feedback! Please let us know if you have any suggestions, feature requests, or want to report a bug.
        </Text>

        {/* ================================== */}
        {/* EMAIL */}
        {/* ================================== */}

        <TextInput
          value={feedbackEmail}
          onChangeText={(text) => {
            setFeedbackEmail(text);
            setSuccess(false);
          }}
          placeholder="Your Email (optional)"
          placeholderTextColor="#777"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { fontSize: bodyFontSize, minHeight: Math.max(42, Math.round(42 * scale)) }]}
        />

        {/* ================================== */}
        {/* FEEDBACK */}
        {/* ================================== */}

        <TextInput
          value={feedback}
          onChangeText={(text) => {
            setFeedback(text);
            setSuccess(false);
          }}
          placeholder="Your Feedback *"
          placeholderTextColor="#777"
          multiline
          textAlignVertical="top"
          style={[
            styles.input,
            styles.feedbackInput,
            { fontSize: bodyFontSize, minHeight: Math.max(110, Math.round(110 * scale)), paddingTop: Math.round(12 * scale) },
          ]}
        />

        {/* ================================== */}
        {/* SUBMIT BUTTON */}
        {/* ================================== */}

        <Pressable
          onPress={handleSubmit}
          disabled={
            loading ||
            !feedback.trim()
          }
          style={({ pressed }) => [
            styles.submitButton,
            {
              height: buttonHeight,
              borderRadius: Math.round(10 * scale),
            },
            (!feedback.trim() || loading) && styles.submitDisabled,
            pressed && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#000"
            />
          ) : (
            <Text
              style={[styles.submitText, { fontSize: Math.max(12, Math.round(12 * scale)) }]}
            >
              SUBMIT FEEDBACK
            </Text>
          )}
        </Pressable>

        {/* ================================== */}
        {/* SUCCESS MESSAGE */}
        {/* ================================== */}

        {success && (
          <Text
            style={styles.successText}
          >
            Thank you for your feedback!
          </Text>
        )}

        {/* ================================== */}
        {/* SUPPORT EMAIL */}
        {/* ================================== */}

        <View
          style={
            styles.supportContainer
          }
        >
          <Text
            style={styles.supportText}
          >
            For urgent issues, email us at
          </Text>

          <Text
            style={styles.emailText}
          >
            team.bunkmates@gmail.com
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  content: {
    paddingHorizontal: 17,
    paddingTop: 48,
    paddingBottom: 40,
  },

  // ==========================================
  // BACK BUTTON
  // ==========================================

  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#191919",
    marginBottom: 18,
  },

  backText: {
    color: "#d8d8d8",
    fontSize: 10,
    fontWeight: "500",
  },

  // ==========================================
  // TITLE
  // ==========================================

  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
  },

  description: {
    color: "#a5a5a5",
    fontSize: 11.5,
    lineHeight: 17,
    marginBottom: 17,
  },

  // ==========================================
  // INPUT
  // ==========================================

  input: {
    width: "100%",
    minHeight: 37,

    borderWidth: 1,
    borderColor: "#292929",

    backgroundColor: "#070707",

    borderRadius: 8,

    paddingHorizontal: 12,

    color: "#ffffff",

    fontSize: 11,

    marginBottom: 10,
  },

  feedbackInput: {
    height: 81,
    paddingTop: 11,
  },

  // ==========================================
  // SUBMIT
  // ==========================================

  submitButton: {
    height: 23,

    borderRadius: 7,

    backgroundColor: "#eeeeee",

    alignItems: "center",
    justifyContent: "center",

    marginTop: 10,
  },

  submitDisabled: {
    opacity: 0.55,
  },

  submitText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "600",
  },

  // ==========================================
  // SUCCESS
  // ==========================================

  successText: {
    color: "#36d85f",
    fontSize: 10,
    marginTop: 17,
  },

  // ==========================================
  // SUPPORT
  // ==========================================

  supportContainer: {
    marginTop: 22,
  },

  supportText: {
    color: "#777777",
    fontSize: 10,
    lineHeight: 15,
  },

  emailText: {
    color: "#999999",
    fontSize: 10,
    textDecorationLine: "underline",
    marginTop: 1,
  },

  // ==========================================
  // PRESS EFFECT
  // ==========================================

  pressed: {
    opacity: 0.7,
  },
});