/**
 * AI Settings Screen — bunkmates-v2
 *
 * Exactly mirrors bunk-mates-master/src/components/Profile.js AI section:
 *  1. Real-time Firestore listener to load existing groqApiKey + status
 *  2. "Save & Validate Key" → hits Groq /models endpoint → saves to Firestore
 *  3. "Clear Key" → wipes all AI fields from Firestore
 *  4. Displays validated models list
 *
 * Firestore path: users/{uid}
 * Fields written:
 *   groqApiKey            string
 *   groqApiKeyStatus      "valid" | "invalid" | "idle"
 *   groqApiKeyValidatedAt string (locale timestamp)
 *   groqModels            string[]
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { SettingsActionModal } from "../components/ui/SettingsActionModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BASE_WIDTH = 375;
const SCALE = Math.min(SCREEN_WIDTH / BASE_WIDTH, 1.15);
const rs = (size: number) => Math.round(size * SCALE);

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

type KeyStatus = "idle" | "valid" | "invalid";

export default function AISettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { themeColors, isDark, accentColor, scaleFont, background } = useThemeToggle();
  const isAtmosphere = background.mode !== "solid";
  const uid = auth.currentUser?.uid || null;

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<KeyStatus>("idle");
  const [validatedAt, setValidatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showClearKeyModal, setShowClearKeyModal] = useState(false);

  /* ─── Real-time Firestore listener (same as bunk-mates-master Profile.js) ─── */
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.groqApiKey !== undefined) {
          setApiKey(data.groqApiKey || "");
        }
        if (data.groqApiKeyStatus) {
          setStatus(data.groqApiKeyStatus as KeyStatus);
        }
        if (data.groqApiKeyValidatedAt) {
          setValidatedAt(data.groqApiKeyValidatedAt);
        }
        if (Array.isArray(data.groqModels)) {
          setModels(data.groqModels);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  /* ─── Validate & Save (exact logic from bunk-mates-master Profile.js) ─── */
  const handleValidateAndSaveGroqKey = async () => {
    if (!apiKey || !apiKey.trim()) {
      setError("Please enter a Groq API key.");
      setStatus("invalid");
      return;
    }
    if (!uid) {
      Alert.alert("Error", "You must be signed in to save your API key.");
      return;
    }

    setValidating(true);
    setError("");

    try {
      const response = await fetch(GROQ_MODELS_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = (errData as any)?.error?.message || `API Error (${response.status})`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      const availableModels: string[] = ((data.data || []) as any[]).map((m: any) => m.id);
      const validatedTime = new Date().toLocaleString();

      setStatus("valid");
      setModels(availableModels);
      setValidatedAt(validatedTime);

      /* Save to Firestore — exactly like bunk-mates-master */
      await updateDoc(doc(db, "users", uid), {
        groqApiKey: apiKey.trim(),
        groqApiKeyStatus: "valid",
        groqApiKeyValidatedAt: validatedTime,
        groqModels: availableModels,
      });

      Alert.alert("✅ Success", "Groq API Key validated and saved to your account!");
    } catch (err: any) {
      console.error("Groq key validation error:", err);
      setStatus("invalid");
      setError(err.message || "Failed to validate API key");
      Alert.alert("❌ Validation Failed", err.message || "Failed to validate API key");
    } finally {
      setValidating(false);
    }
  };

  /* ─── Clear Key ─── */
  const handleClearGroqKey = () => {
    if (!uid) return;
    setShowClearKeyModal(true);
  };

  /* ─── Status display helpers ─── */
  const statusText =
    status === "valid"
      ? "✅ Connected"
      : status === "invalid"
      ? "❌ Invalid Key"
      : "⏳ Not Configured";

  const statusPillStyle =
    status === "valid"
      ? styles.statusValid
      : status === "invalid"
      ? styles.statusInvalid
      : styles.statusWaiting;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isAtmosphere ? "transparent" : themeColors.background }]} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { backgroundColor: isDark ? "#202024" : "#F4F5F7" }, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={rs(18)} color={themeColors.text} />
          </Pressable>

          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.sparkle, { color: accentColor }]}>✦</Text>
              <Text style={[styles.title, { color: themeColors.text, fontSize: scaleFont(20) }]}>{t("AI Features")}</Text>
            </View>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary, fontSize: scaleFont(11) }]}>
              {t("Configure Groq API Key & AI settings", "Configure Groq API Key & cross-device AI synchronization")}
            </Text>
          </View>
        </View>

        {/* ── GROQ KEY CARD ── */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="key-variant" size={rs(17)} color={accentColor} />
            <Text style={[styles.cardTitle, { color: themeColors.text, fontSize: scaleFont(15) }]}>{t("Groq API Key")}</Text>
          </View>

          <Text style={[styles.description, { color: themeColors.textSecondary, fontSize: scaleFont(12) }]}>
            Add your Groq API key below. It validates automatically, displays available models and
            usage metrics, and saves directly to Firestore so all your devices use it seamlessly.
          </Text>

          {/* Input */}
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#202024" : "#F4F5F7" }, status === "invalid" && styles.inputError]}>
            <TextInput
              value={apiKey}
              onChangeText={(value) => {
                setApiKey(value);
                if (status !== "idle") setStatus("idle");
                setError("");
              }}
              placeholder="gsk_••••••••••••••••••••••••"
              placeholderTextColor={themeColors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showKey}
              style={[styles.input, { color: themeColors.text }]}
            />
            <Pressable onPress={() => setShowKey((v) => !v)} style={styles.eyeButton} hitSlop={10}>
              <Ionicons
                name={showKey ? "eye-off-outline" : "eye-outline"}
                size={rs(17)}
                color={themeColors.textSecondary}
              />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Buttons row */}
          <View style={styles.btnRow}>
            <Pressable
              onPress={handleValidateAndSaveGroqKey}
              disabled={validating}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: accentColor },
                validating && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              {validating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="creation" size={rs(15)} color="#FFFFFF" />
                  <Text style={[styles.saveText, { color: "#FFFFFF" }]}>{t("Save & Validate Key")}</Text>
                </>
              )}
            </Pressable>

            {apiKey ? (
              <Pressable
                onPress={handleClearGroqKey}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={rs(14)} color="#ff4444" />
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── STATUS CARD ── */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="flash" size={rs(17)} color={themeColors.textSecondary} />
            <Text style={[styles.cardTitle, { color: themeColors.text, fontSize: scaleFont(15) }]}>API Usage & Status</Text>
          </View>

          {/* Status pill */}
          <View style={styles.statusLine}>
            <Text style={[styles.statusLabel, { color: themeColors.textSecondary, fontSize: scaleFont(12) }]}>Key Status:</Text>
            <View style={[styles.statusPill, statusPillStyle]}>
              <Text style={styles.statusPillText}>{statusText}</Text>
            </View>
          </View>

          {/* Validated at */}
          {validatedAt ? (
            <Text style={[styles.validatedAt, { color: themeColors.textSecondary }]}>Last Validated: {validatedAt}</Text>
          ) : null}

          {/* Models */}
          <Text style={[styles.modelsTitle, { color: themeColors.textSecondary, fontSize: scaleFont(12) }]}>
            Available Groq AI Models ({models.length || 0}):
          </Text>

          {models.length > 0 ? (
            <View style={styles.modelList}>
              {models.map((m) => (
                <View key={m} style={[styles.modelChip, { backgroundColor: isDark ? "#202024" : "#F4F5F7" }]}>
                  <MaterialCommunityIcons
                    name="robot-outline"
                    size={rs(11)}
                    color={accentColor}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.modelChipText, { color: themeColors.text }]}>{m}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.statusMessage, { color: themeColors.textSecondary }]}>
              No models loaded. Click "Save & Validate Key" above to fetch your available Groq
              models.
            </Text>
          )}
        </View>

        {/* ── INFO CARD ── */}
        <View style={[styles.infoCard, { backgroundColor: `${accentColor}12` }]}>
          <MaterialCommunityIcons name="information-outline" size={rs(15)} color={accentColor} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>
            Your API key is stored securely in Firestore and synced across all your devices. Get
            your free key at{" "}
            <Text style={[styles.infoLink, { color: accentColor }]}>console.groq.com</Text>
          </Text>
        </View>
      </ScrollView>

      {/* ── REMOVE API KEY CONFIRMATION & SUCCESS FLOW (Matching Image 1 & 2) ── */}
      <SettingsActionModal
        visible={showClearKeyModal}
        onClose={() => setShowClearKeyModal(false)}
        iconType="key"
        title={t("Remove API Key")}
        message={t(
          "Are you sure you want to remove your Groq API Key from all devices? AI itinerary suggestions will be disabled."
        )}
        confirmLabel={t("Remove Key")}
        cancelLabel={t("Cancel")}
        confirmColor="#ff4444"
        onConfirm={async () => {
          if (!uid) return false;
          try {
            setApiKey("");
            setStatus("idle");
            setModels([]);
            setValidatedAt(null);
            setError("");

            await updateDoc(doc(db, "users", uid), {
              groqApiKey: "",
              groqApiKeyStatus: "idle",
              groqApiKeyValidatedAt: null,
              groqModels: [],
            });
            return true;
          } catch (e) {
            console.error("Error clearing key:", e);
            return false;
          }
        }}
        successTitle={t("API Key Removed")}
        successMessage={t(
          "Your Groq API key has been safely removed from your BunkMates profile."
        )}
        successButtonLabel={t("Done")}
        onDone={() => setShowClearKeyModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: rs(20),
    paddingTop: rs(18),
    paddingBottom: rs(60),
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: rs(24),
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerText: { flex: 1, paddingTop: rs(1) },
  titleRow: { flexDirection: "row", alignItems: "center" },
  sparkle: { color: "#00e6b0", fontSize: rs(18), fontWeight: "900", marginRight: rs(4) },
  title: { color: "#eeeeee", fontSize: rs(20), fontWeight: "900" },
  subtitle: { color: "#888", fontSize: rs(11), lineHeight: rs(16), marginTop: rs(4) },

  /* Card */
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 28,
    borderWidth: 0,
    padding: rs(18),
    marginBottom: rs(14),
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: rs(10) },
  cardTitle: { color: "#eee", fontSize: rs(15), fontWeight: "800", marginLeft: rs(7) },
  description: { color: "#888", fontSize: rs(12), lineHeight: rs(18), marginBottom: rs(14) },

  /* Input */
  inputWrapper: {
    height: rs(46),
    borderWidth: 0,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: rs(6),
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  inputError: {
    backgroundColor: "rgba(255, 68, 68, 0.1)",
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#ffffff",
    fontSize: rs(12),
    paddingHorizontal: rs(14),
  },
  eyeButton: {
    width: rs(42),
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#ff4444",
    fontSize: rs(10),
    marginBottom: rs(10),
  },

  /* Buttons */
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: rs(10),
    marginTop: rs(6),
  },
  saveButton: {
    height: rs(40),
    borderRadius: 24,
    backgroundColor: "#00d9a6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(18),
    gap: rs(6),
    borderWidth: 0,
  },
  saveText: { color: "#00110d", fontSize: rs(12), fontWeight: "800" },
  clearButton: {
    height: rs(40),
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: rs(14),
    gap: rs(5),
  },
  clearText: { color: "#ff4444", fontSize: rs(12), fontWeight: "700" },
  disabledButton: { opacity: 0.65 },
  pressed: { opacity: 0.7 },

  /* Status */
  statusLine: { flexDirection: "row", alignItems: "center", marginBottom: rs(10) },
  statusLabel: { color: "#888", fontSize: rs(12), fontWeight: "600", marginRight: rs(8) },
  statusPill: {
    paddingHorizontal: rs(10),
    paddingVertical: rs(4),
    borderRadius: rs(20),
    borderWidth: 0,
  },
  statusWaiting: { backgroundColor: "#1e1e1e" },
  statusValid: { backgroundColor: "#073d2f" },
  statusInvalid: { backgroundColor: "#3d0707" },
  statusPillText: { color: "#ddd", fontSize: rs(11), fontWeight: "700" },
  validatedAt: { color: "#555", fontSize: rs(10), marginBottom: rs(12) },

  /* Models */
  modelsTitle: { color: "#aaa", fontSize: rs(12), fontWeight: "700", marginBottom: rs(8) },
  statusMessage: { color: "#555", fontSize: rs(11), lineHeight: rs(16) },
  modelList: { gap: rs(6) },
  modelChip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: rs(12),
    paddingVertical: rs(8),
    flexDirection: "row",
    alignItems: "center",
  },
  modelChipText: { color: "#bbb", fontSize: rs(11) },

  /* Info */
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,230,176,0.06)",
    borderRadius: 28,
    borderWidth: 0,
    padding: rs(16),
    gap: rs(8),
    marginBottom: rs(20),
  },
  infoText: { flex: 1, color: "#888", fontSize: rs(11), lineHeight: rs(16) },
  infoLink: { color: "#00e6b0", fontWeight: "700" },
});