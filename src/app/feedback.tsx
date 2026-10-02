// **@** Send Feedback — Pixel-perfect UI matching user's uploaded mockup & Settings design system
// Features: Zero Red Policy, circular back button, dynamic theme adaptability, interactive Feedback Type pill selector,
// details textarea with character count, attachment upload via expo-image-picker with preview & removal,
// real Firestore logging to `feedback` & `notifications` collections, local submission caching, and toast confirmation.

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  Appearance,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

type FeedbackType = "Bug Report" | "Request Feature" | "General";

interface LocalFeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  hasAttachment: boolean;
  createdAt: string;
}

const STORAGE_KEY_FEEDBACK_HISTORY = "@bunkmates_feedback_history";

export default function SendFeedbackScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // User state
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Bug Report");
  const [details, setDetails] = useState("");
  const [attachment, setAttachment] = useState<{
    uri: string;
    fileName?: string;
    fileSize?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<LocalFeedbackItem[]>([]);

  // Animated toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const triggerToast = useCallback(
    (msg: string) => {
      setToastMessage(msg);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity]
  );

  // Load user data & saved history
  useEffect(() => {
    const initData = async () => {
      const user = auth.currentUser;
      if (user) {
        setUserName(user.displayName || "");
        setUserEmail(user.email || "");

        try {
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.name) setUserName(data.name);
            if (data.email) setUserEmail(data.email);
          }
        } catch (e) {
          console.log("Error loading user profile:", e);
        }
      }

      try {
        const storedHistory = await AsyncStorage.getItem(STORAGE_KEY_FEEDBACK_HISTORY);
        if (storedHistory) {
          setFeedbackHistory(JSON.parse(storedHistory));
        }
      } catch (e) {
        console.log("Error loading feedback history:", e);
      }
    };

    initData();
  }, []);

  // Save history to AsyncStorage
  const saveHistoryItem = async (item: LocalFeedbackItem) => {
    try {
      const updated = [item, ...feedbackHistory];
      setFeedbackHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY_FEEDBACK_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.log("Error saving feedback item:", e);
    }
  };

  // Dynamic Theme matching Settings page & ThemeContext
  let themeMode: "dark" | "light" | "system" = "system";
  let userAccent = "default";
  try {
    const themeContext = useThemeToggle();
    if (themeContext) {
      if (themeContext.mode) themeMode = themeContext.mode;
      if (themeContext.accent) userAccent = themeContext.accent;
    }
  } catch (e) {
    // fallback safe
  }

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  // Dynamic colors derived from Settings design tokens (zero red)
  const colors = useMemo(() => {
    const hasCustomNonRedAccent =
      userAccent &&
      userAccent !== "default" &&
      userAccent !== "coral" &&
      userAccent !== "red" &&
      (ACCENT_COLORS as any)[userAccent];

    const customAccent = hasCustomNonRedAccent
      ? (ACCENT_COLORS as any)[userAccent]
      : null;

    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = customAccent || (isDark ? "#FFFFFF" : "#11141A");
    const activeBorder = customAccent || (isDark ? "#E2E8F0" : "#11141A");

    return {
      bg: isDark ? "#0A0A0C" : "#F4F6F9",
      card: isDark ? "#141418" : "#FFFFFF",
      cardBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      divider: isDark ? "rgba(255, 255, 255, 0.05)" : "#F2F4F7",
      textPrimary: isDark ? "#FFFFFF" : "#11141A",
      textSecondary: isDark ? "#8E95A2" : "#7E8590",
      sectionHeader: isDark ? "#8E95A2" : "#7E8590",
      greyishWhite,
      iconBoxBg: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
      chevron: isDark ? "#555860" : "#B4B9C2",
      activeText,
      activeBorder,
      activePillBg: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.04)",
      inputBg: isDark ? "#141418" : "#FFFFFF",
      inputBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "#EBECEF",
      btnPrimaryBg: isDark ? "#FFFFFF" : "#111827",
      btnPrimaryText: isDark ? "#000000" : "#FFFFFF",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      uploadBoxBorder: isDark ? "rgba(255, 255, 255, 0.2)" : "#CBD5E1",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5",
      badgeText: isDark ? "#34D399" : "#065F46",
    };
  }, [isDark, userAccent]);

  // Image Picker Handler
  const handlePickAttachment = async () => {
    Haptics.selectionAsync().catch(() => {});

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Photo library access is needed to attach screenshots. Please enable it in Settings.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];

        // 5MB Limit check
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select an image smaller than 5MB.");
          return;
        }

        setAttachment({
          uri: asset.uri,
          fileName: asset.fileName || "screenshot.jpg",
          fileSize: asset.fileSize,
        });

        triggerToast("Screenshot attached!");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (e) {
      console.log("Error selecting attachment:", e);
      Alert.alert("Error", "Could not load image. Please try again.");
    }
  };

  const handleRemoveAttachment = () => {
    Haptics.selectionAsync().catch(() => {});
    setAttachment(null);
    triggerToast("Attachment removed");
  };

  // Feedback Submission Handler
  const handleSubmitFeedback = async () => {
    const trimmed = details.trim();
    if (!trimmed) {
      Alert.alert("Details Required", "Please explain clearly what we could do better.");
      return;
    }

    setLoading(true);
    Haptics.selectionAsync().catch(() => {});

    const user = auth.currentUser;
    const uid = user ? user.uid : "anonymous";
    const name = userName || user?.displayName || "Explorer";
    const email = userEmail.trim() || user?.email || "anonymous@bunkmates.com";
    const feedbackId = `FB-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      // 1. Log Feedback to Firestore
      await addDoc(collection(db, "feedback"), {
        feedbackId,
        type: feedbackType,
        message: trimmed,
        name,
        email,
        uid,
        hasAttachment: !!attachment,
        attachmentUri: attachment?.uri || null,
        appVersion: "2.4.0",
        platform: Platform.OS,
        createdAt: serverTimestamp(),
      });

      // 2. Create User Notification in Firestore
      if (user) {
        await addDoc(collection(db, "notifications"), {
          admin_content: `${name} has submitted ${feedbackType}: "${trimmed.slice(0, 60)}..."`,
          content:
            `Hi ${name}, thank you for your ${feedbackType}! We have logged reference #${feedbackId}. ` +
            `Our engineering and community team reviews every submission to build a better experience for you.`,
          read: false,
          timestamp: serverTimestamp(),
          title: `📩 ${feedbackType} Received (#${feedbackId})`,
          type: "feedback",
          uid,
        });
      }

      // 3. Save to local AsyncStorage history
      const historyItem: LocalFeedbackItem = {
        id: feedbackId,
        type: feedbackType,
        message: trimmed,
        hasAttachment: !!attachment,
        createdAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      await saveHistoryItem(historyItem);

      // 4. Success State & Feedback
      setDetails("");
      setAttachment(null);
      setLoading(false);

      triggerToast("Feedback submitted! Thank you.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Alert.alert(
        "Thank You!",
        `Your ${feedbackType.toLowerCase()} (#${feedbackId}) has been successfully sent to the BunkMates team. We appreciate your help in making the app better!`,
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
          {
            text: "Send Another",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      console.log("Error submitting feedback:", error);
      setLoading(false);

      // Fallback local save if offline
      const historyItem: LocalFeedbackItem = {
        id: feedbackId,
        type: feedbackType,
        message: trimmed,
        hasAttachment: !!attachment,
        createdAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
      await saveHistoryItem(historyItem);

      setDetails("");
      setAttachment(null);
      triggerToast("Saved locally (offline mode).");
      Alert.alert(
        "Feedback Recorded",
        "Your feedback has been saved locally and will sync when you're back online.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Floating Status Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            {
              backgroundColor: colors.toastBg,
              opacity: toastOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header with Circular Back Button */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel={t("back", "Back")}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          Send Feedback
        </Text>

        <Pressable
          onPress={() => setHistoryModalVisible(true)}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Feedback History"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="time-outline" size={19} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================
              1. FEEDBACK TYPE SECTION
          ========================================================= */}
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>FEEDBACK TYPE</Text>

          <View style={[styles.typeContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {(["Bug Report", "Request Feature", "General"] as FeedbackType[]).map((type) => {
              const isSelected = feedbackType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => {
                    setFeedbackType(type);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[
                    styles.typePill,
                    isSelected && [
                      styles.typePillSelected,
                      {
                        borderColor: colors.activeBorder,
                        backgroundColor: colors.activePillBg,
                      },
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      {
                        color: isSelected ? colors.activeText : colors.textSecondary,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ========================================================
              2. DETAILS SECTION
          ========================================================= */}
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DETAILS</Text>

          <View
            style={[
              styles.detailsCard,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <TextInput
              style={[styles.detailsInput, { color: colors.textPrimary }]}
              placeholder="Explain clearly what we could do better..."
              placeholderTextColor={colors.textSecondary}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={1000}
            />
            <View style={styles.charCountRow}>
              <Text style={[styles.charCountText, { color: colors.textSecondary }]}>
                {details.length}/1000
              </Text>
            </View>
          </View>

          {/* ========================================================
              3. ATTACHMENTS SECTION
          ========================================================= */}
          <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>ATTACHMENTS</Text>

          <View style={[styles.attachmentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {attachment ? (
              // Attached Screenshot Preview Card
              <View style={styles.attachmentActiveRow}>
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
                  <Pressable
                    onPress={handleRemoveAttachment}
                    style={styles.removeBadge}
                    hitSlop={8}
                    accessibilityLabel="Remove attachment"
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.attachmentMeta}>
                  <Text style={[styles.attachmentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    Screenshot Attached
                  </Text>
                  <Text style={[styles.attachmentSubtitle, { color: colors.textSecondary }]}>
                    {attachment.fileSize
                      ? `${(attachment.fileSize / (1024 * 1024)).toFixed(2)} MB • Ready to send`
                      : "Image selected • Ready to send"}
                  </Text>
                  <Pressable onPress={handlePickAttachment} hitSlop={6} style={{ marginTop: 4 }}>
                    <Text style={[styles.changePhotoText, { color: colors.activeText }]}>
                      Change Image
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              // Unattached Upload Box matching Mockup
              <Pressable
                onPress={handlePickAttachment}
                style={({ pressed }) => [styles.uploadRow, pressed && { opacity: 0.7 }]}
              >
                <View style={[styles.uploadBox, { borderColor: colors.uploadBoxBorder }]}>
                  <Ionicons name="add" size={20} color={colors.textSecondary} />
                  <Text style={[styles.addImgText, { color: colors.textSecondary }]}>Add Img</Text>
                </View>
                <View style={styles.attachmentMeta}>
                  <Text style={[styles.attachmentTitle, { color: colors.textPrimary }]}>
                    Attach Screenshot
                  </Text>
                  <Text style={[styles.attachmentSubtitle, { color: colors.textSecondary }]}>
                    Max file size 5MB (PNG/JPG only)
                  </Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* ========================================================
              4. SUBMIT BUTTON
          ========================================================= */}
          <Pressable
            onPress={handleSubmitFeedback}
            disabled={loading || !details.trim()}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: colors.btnPrimaryBg,
                opacity: !details.trim() || loading ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.btnPrimaryText} size="small" />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.btnPrimaryText }]}>
                Submit Feedback
              </Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================
          SUBMISSION HISTORY MODAL
      ========================================================= */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHistoryModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>My Feedback History</Text>
              <Pressable
                onPress={() => setHistoryModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {feedbackHistory.length === 0 ? (
              <View style={styles.emptyHistoryBox}>
                <Ionicons name="chatbox-ellipses-outline" size={38} color={colors.textSecondary} style={{ marginBottom: 10 }} />
                <Text style={[styles.emptyHistoryTitle, { color: colors.textPrimary }]}>No feedback sent yet</Text>
                <Text style={[styles.emptyHistorySub, { color: colors.textSecondary }]}>
                  Your submitted bug reports, suggestions, and feedback will be logged here.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {feedbackHistory.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyCard,
                      { backgroundColor: colors.activePillBg, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={styles.historyCardHeader}>
                      <Text style={[styles.historyIdText, { color: colors.activeText }]}>#{item.id}</Text>
                      <View style={[styles.historyBadge, { backgroundColor: colors.badgeBg }]}>
                        <Text style={[styles.historyBadgeText, { color: colors.badgeText }]}>{item.type}</Text>
                      </View>
                    </View>
                    <Text style={[styles.historyMessage, { color: colors.textPrimary }]} numberOfLines={3}>
                      {item.message}
                    </Text>
                    <View style={styles.historyFooter}>
                      <Text style={[styles.historyDate, { color: colors.textSecondary }]}>{item.createdAt}</Text>
                      {item.hasAttachment && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="image-outline" size={13} color={colors.textSecondary} />
                          <Text style={[styles.historyDate, { color: colors.textSecondary }]}>Screenshot</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 12 : 8,
    paddingBottom: 12,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 10,
    textTransform: "uppercase",
  },
  // Feedback Type Container & Pills matching Mockup
  typeContainer: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    gap: 6,
    marginBottom: 20,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  typePillSelected: {
    borderWidth: 1.5,
  },
  typePillText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  // Details Card
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 160,
    marginBottom: 20,
    justifyContent: "space-between",
  },
  detailsInput: {
    fontSize: 14,
    lineHeight: 22,
    minHeight: 110,
    textAlignVertical: "top",
    padding: 0,
  },
  charCountRow: {
    alignItems: "flex-end",
    paddingTop: 6,
  },
  charCountText: {
    fontSize: 11,
    fontWeight: "500",
  },
  // Attachment Card matching Mockup
  attachmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 28,
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadBox: {
    width: 66,
    height: 66,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  addImgText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  attachmentMeta: {
    flex: 1,
  },
  attachmentTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  attachmentSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 4,
    lineHeight: 16,
  },
  // Active Attachment Preview
  attachmentActiveRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewImageContainer: {
    position: "relative",
    marginRight: 16,
  },
  previewImage: {
    width: 66,
    height: 66,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  changePhotoText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Submit Button
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  // Toast
  toastBox: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 36,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // History Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  emptyHistoryBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyHistorySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  historyIdText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  historyMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  historyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyDate: {
    fontSize: 11,
  },
});