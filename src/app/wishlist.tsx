import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { auth, db } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import Animated from "./reanimatedShim";
// ...existing code...
import { MotiView } from "moti";

interface WishlistItem {
  name: string;
  email: string;
  reason: string;
}

export default function WishlistScreen() {
  const [formData, setFormData] = useState<WishlistItem>({
    name: "",
    email: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof WishlistItem, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.reason.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "wishlist"), {
        name: formData.name,
        email: formData.email,
        reason: formData.reason,
        submittedAt: serverTimestamp(),
        userId: auth.currentUser?.uid || "anonymous",
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ name: "", email: "", reason: "" });
      }, 3000);

      Alert.alert("Success", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting wishlist:", error);
      Alert.alert("Error", "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerSub}>Share your ideas</Text>
            <Text style={styles.headerTitle}>Wishlist</Text>
          </View>

          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <MotiView
              from={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "timing", duration: 600 }}
            >
              <View style={styles.illustration}>
                <MaterialCommunityIcons
                  name="star"
                  size={64}
                  color="#00f721"
                />
              </View>
            </MotiView>
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Have a Feature Idea?</Text>
            <Text style={styles.infoText}>
              Share your feature requests and suggestions. We'd love to hear
              from you and make Bunkmates even better!
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="account"
                  size={18}
                  color="#888"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#666"
                  value={formData.name}
                  onChangeText={(value) => handleChange("name", value)}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons
                  name="email"
                  size={18}
                  color="#888"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#666"
                  keyboardType="email-address"
                  value={formData.email}
                  onChangeText={(value) => handleChange("email", value)}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Reason Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Feature Idea</Text>
              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <MaterialCommunityIcons
                  name="lightbulb"
                  size={18}
                  color="#888"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your idea..."
                  placeholderTextColor="#666"
                  multiline={true}
                  numberOfLines={5}
                  value={formData.reason}
                  onChangeText={(value) => handleChange("reason", value)}
                  editable={!loading}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {loading ? "Submitting..." : "Submit Feedback"}
              </Text>
            </Pressable>
          </View>

          {/* Success Modal */}
          {submitted && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={styles.successOverlay}
            >
              <View style={styles.successCard}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={64}
                  color="#00f721"
                />
                <Text style={styles.successTitle}>Thank You!</Text>
                <Text style={styles.successText}>
                  Your feedback has been submitted
                </Text>
              </View>
            </MotiView>
          )}

          {/* Footer Info */}
          <View style={styles.footerContainer}>
            <Icon name="lock-check" text="Your data is private" />
            <Icon name="bell-check" text="We'll notify you on updates" />
            <Icon name="heart" text="Your feedback matters" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════
// ICON INFO COMPONENT
// ════════════════════════════════════════════════════════════════

function Icon({ name, text }: { name: string; text: string }) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: "timing", duration: 500 }}
      style={styles.iconInfo}
    >
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name={name} size={20} color="#00f721" />
      </View>
      <Text style={styles.iconText}>{text}</Text>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  container: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },

  header: {
    paddingVertical: 16,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#BDBDBD",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },

  illustrationContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0,247,33,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(0,247,33,0.3)",
  },

  infoContainer: {
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#BDBDBD",
    lineHeight: 20,
    textAlign: "center",
  },

  formContainer: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#BDBDBD",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  textAreaWrapper: {
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 14,
    fontFamily: "System",
  },
  textArea: {
    paddingVertical: 8,
    maxHeight: 140,
  },

  submitButton: {
    backgroundColor: "#00f721",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  successOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  successCard: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,247,33,0.3)",
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: "#BDBDBD",
  },

  footerContainer: {
    gap: 12,
  },
  iconInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,247,33,0.05)",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#00f721",
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(0,247,33,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#fff",
    flex: 1,
  },
});
