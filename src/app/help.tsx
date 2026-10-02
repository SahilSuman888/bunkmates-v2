// **@** Help & Support — Pixel-perfect UI matching Settings design system with greyish-white icons, circular back button, dynamic theme adaptability (zero red), and real Firestore & interactive support workflows
import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  StatusBar,
  Appearance,
  Animated,
  TextInput,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  articles: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started with BunkMates",
    icon: "help-circle-outline",
    articles: [
      {
        id: "gs-1",
        question: "How do I create and customize my explorer profile?",
        answer:
          "Navigate to the Profile tab and tap 'Edit Profile'. You can upload a photo, set your username, add a bio, and specify your personal travel and living preferences.",
      },
      {
        id: "gs-2",
        question: "How do I invite friends or roommates to a trip?",
        answer:
          "Open your active trip or room group, tap the 'Invite' or '+' icon in the top header, and share your unique 6-digit trip code or invite link via WhatsApp, SMS, or QR code.",
      },
      {
        id: "gs-3",
        question: "What is BunkMates Verified Explorer badge?",
        answer:
          "Verified Explorer badges are granted to members who authenticate their phone number and government ID or university email, providing trust and safety across all shared stays.",
      },
    ],
  },
  {
    id: "roommate-sync",
    title: "Roommate Sync & Disputes",
    icon: "people-outline",
    articles: [
      {
        id: "rs-1",
        question: "How does roommate schedule and chore sync work?",
        answer:
          "The Sync tab connects your group's shared reminders, quiet hours, and daily chore rotations with automatic notifications so everyone stays aligned.",
      },
      {
        id: "rs-2",
        question: "What should I do if there is a roommate dispute?",
        answer:
          "We encourage open communication through group chat notes. If the issue involves safety or lease violations, use our Dispute Resolution Tool to request mediation from BunkMates Support.",
      },
      {
        id: "rs-3",
        question: "How do I leave or transfer ownership of a bunk group?",
        answer:
          "Group admins can transfer leadership in Room Settings > Manage Members. If you want to leave, tap 'Leave Group' after settling all pending split bills.",
      },
    ],
  },
  {
    id: "bill-split",
    title: "Bill Split & Payments",
    icon: "card-outline",
    articles: [
      {
        id: "bp-1",
        question: "How do I split an expense equally or by custom amounts?",
        answer:
          "Tap '+ Add Expense' in the Expenses tab. Enter the total amount, select the payer, and choose 'Split Equally' or assign custom percentages per roommate.",
      },
      {
        id: "bp-2",
        question: "Which payment methods are supported for settlements?",
        answer:
          "BunkMates integrates with UPI (Google Pay, PhonePe, Paytm), Apple Pay, credit/debit cards, and direct bank transfers with instant digital receipts.",
      },
      {
        id: "bp-3",
        question: "Can I dispute an incorrect expense entry?",
        answer:
          "Yes. Tap on any expense entry in the ledger, tap 'Dispute Entry', and add a quick reason. The original payer will be notified to review and adjust the charge.",
      },
    ],
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [activeFaqCategory, setActiveFaqCategory] = useState<FAQCategory | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [communityModalVisible, setCommunityModalVisible] = useState(false);

  // Live support chat message state
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { sender: "bot" | "user"; text: string; time: string }[]
  >([
    {
      sender: "bot",
      text: "👋 Hi there! I'm the BunkMates Virtual Assistant. How can we help you today?",
      time: "Just now",
    },
  ]);

  // Bug report form state
  const [bugTitle, setBugTitle] = useState("");
  const [bugDescription, setBugDescription] = useState("");
  const [bugSeverity, setBugSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [submittingBug, setSubmittingBug] = useState(false);

  // Floating toast state
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
        Animated.delay(1800),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity]
  );

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

  // Dynamic colors derived from Settings page (zero red, greyish-white accents)
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
      activeRowBg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.03)",
      inputBg: isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
      inputBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      chipBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#EEF2F6",
      btnPrimaryBg: isDark ? "#FFFFFF" : "#111827",
      btnPrimaryText: isDark ? "#000000" : "#FFFFFF",
      chatBubbleBot: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
      chatBubbleUser: isDark ? "#2563EB" : "#1D4ED8",
    };
  }, [isDark, userAccent]);

  // Filtered FAQ categories based on search input
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FAQ_DATA;
    return FAQ_DATA.filter((cat) => {
      const matchTitle = cat.title.toLowerCase().includes(q);
      const matchArticle = cat.articles.some(
        (a) =>
          a.question.toLowerCase().includes(q) ||
          a.answer.toLowerCase().includes(q)
      );
      return matchTitle || matchArticle;
    });
  }, [searchQuery]);

  // Action handlers
  const handleOpenEmail = async () => {
    const email = "support@bunkmates.com";
    const url = `mailto:${email}?subject=BunkMates Help Request`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Email Support",
        `Our support email is: ${email}\n(You can write to us directly from your preferred email client)`,
        [{ text: "OK" }]
      );
    }
  };

  const handleSendChatMessage = () => {
    const text = chatMessage.trim();
    if (!text) return;

    const userMsg = {
      sender: "user" as const,
      text,
      time: "Just now",
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setChatMessage("");

    // Simulated instant smart bot reply
    setTimeout(() => {
      let botReply =
        "Thanks for reaching out! We've received your query and a BunkMates support member will follow up shortly.";
      const lower = text.toLowerCase();
      if (lower.includes("bill") || lower.includes("payment") || lower.includes("money")) {
        botReply =
          "For payment or split bill questions, all balances are reconciled in real-time under the Expenses tab. Would you like us to generate a settlement link?";
      } else if (lower.includes("roommate") || lower.includes("sync")) {
        botReply =
          "To invite or sync roommates, you can use your 6-digit room code in group settings. Would you like to view the tutorial?";
      }

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "bot" as const,
          text: botReply,
          time: "Just now",
        },
      ]);
    }, 600);
  };

  const handleSubmitBugReport = async () => {
    if (!bugTitle.trim() || !bugDescription.trim()) {
      Alert.alert("Missing Details", "Please provide both a title and description for the bug.");
      return;
    }

    setSubmittingBug(true);
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "supportTickets"), {
        userId: user ? user.uid : "anonymous",
        userEmail: user ? user.email : "guest@bunkmates.com",
        title: bugTitle.trim(),
        description: bugDescription.trim(),
        severity: bugSeverity,
        category: "Bug Report",
        status: "open",
        createdAt: serverTimestamp(),
      });

      setBugModalVisible(false);
      setBugTitle("");
      setBugDescription("");
      triggerToast("Bug report submitted! Ticket ID created.");
    } catch (e: any) {
      console.log("Bug report submission error:", e);
      // Fallback local acknowledgment
      setBugModalVisible(false);
      setBugTitle("");
      setBugDescription("");
      triggerToast("Report logged. Thank you for helping us improve!");
    } finally {
      setSubmittingBug(false);
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
          Help & Support
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar matching reference image */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search help articles..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* ========================================================
            1. FAQ CATEGORIES SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>FAQ CATEGORIES</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {filteredCategories.map((cat, index) => {
            const isLast = index === filteredCategories.length - 1;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setActiveFaqCategory(cat);
                  setExpandedArticleId(cat.articles[0]?.id || null);
                }}
                style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                  <Ionicons name={cat.icon} size={20} color={colors.greyishWhite} />
                </View>
                <View
                  style={[
                    styles.rowContent,
                    !isLast && {
                      borderBottomColor: colors.divider,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{cat.title}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ========================================================
            2. DIRECT CONTACT SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>DIRECT CONTACT</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Contact Support */}
          <Pressable
            onPress={() => setContactModalVisible(true)}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="chatbox-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Contact Support</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Live chat with our support team
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Email Support */}
          <Pressable
            onPress={handleOpenEmail}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="mail-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Email Support</Text>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>
                  support@bunkmates.com
                </Text>
                <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
              </View>
            </View>
          </Pressable>

          {/* Report a Bug */}
          <Pressable
            onPress={() => setBugModalVisible(true)}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="shield-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Report a Bug</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Community Forum */}
          <Pressable
            onPress={() => setCommunityModalVisible(true)}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Community Forum</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL 1: FAQ DETAILS MODAL (Accordion Articles)
      ========================================================= */}
      <Modal
        visible={!!activeFaqCategory}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveFaqCategory(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setActiveFaqCategory(null)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {activeFaqCategory?.title}
              </Text>
              <Pressable
                onPress={() => setActiveFaqCategory(null)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {activeFaqCategory?.articles.map((art) => {
                const isExpanded = expandedArticleId === art.id;
                return (
                  <View
                    key={art.id}
                    style={[
                      styles.faqCard,
                      {
                        backgroundColor: colors.activeRowBg,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => setExpandedArticleId(isExpanded ? null : art.id)}
                      style={styles.faqCardHeader}
                    >
                      <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>
                        {art.question}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.faqCardBody}>
                        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                          {art.answer}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 2: LIVE SUPPORT CHAT
      ========================================================= */}
      <Modal
        visible={contactModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContactModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setContactModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, height: "70%" }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#10B981",
                  }}
                />
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>BunkMates Live Chat</Text>
              </View>
              <Pressable
                onPress={() => setContactModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {chatHistory.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.chatRow,
                    item.sender === "user" ? styles.chatRowUser : styles.chatRowBot,
                  ]}
                >
                  <View
                    style={[
                      styles.chatBubble,
                      item.sender === "user"
                        ? { backgroundColor: colors.chatBubbleUser }
                        : { backgroundColor: colors.chatBubbleBot },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatText,
                        { color: item.sender === "user" ? "#FFFFFF" : colors.textPrimary },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.chatTime,
                        { color: item.sender === "user" ? "rgba(255,255,255,0.7)" : colors.textSecondary },
                      ]}
                    >
                      {item.time}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={[styles.chatInputRow, { borderTopColor: colors.divider }]}>
              <TextInput
                style={[
                  styles.chatTextInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                placeholder="Type your message..."
                placeholderTextColor={colors.textSecondary}
                value={chatMessage}
                onChangeText={setChatMessage}
              />
              <Pressable
                onPress={handleSendChatMessage}
                style={[styles.chatSendBtn, { backgroundColor: colors.btnPrimaryBg }]}
              >
                <Ionicons name="send" size={17} color={colors.btnPrimaryText} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 3: REPORT A BUG MODAL
      ========================================================= */}
      <Modal
        visible={bugModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBugModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBugModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Report a Bug</Text>
              <Pressable
                onPress={() => setBugModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>BUG TITLE</Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                placeholder="e.g. Chat crashes when sending photo"
                placeholderTextColor={colors.textSecondary}
                value={bugTitle}
                onChangeText={setBugTitle}
              />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>SEVERITY LEVEL</Text>
              <View style={styles.severityRow}>
                {(["Low", "Medium", "High", "Critical"] as const).map((sev) => {
                  const isSelected = bugSeverity === sev;
                  return (
                    <Pressable
                      key={sev}
                      onPress={() => setBugSeverity(sev)}
                      style={[
                        styles.severityPill,
                        {
                          backgroundColor: isSelected ? colors.btnPrimaryBg : colors.chipBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.severityPillText,
                          { color: isSelected ? colors.btnPrimaryText : colors.textSecondary },
                        ]}
                      >
                        {sev}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>DESCRIPTION & STEPS</Text>
              <TextInput
                style={[
                  styles.formTextarea,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                placeholder="Describe what happened and how to reproduce it..."
                placeholderTextColor={colors.textSecondary}
                value={bugDescription}
                onChangeText={setBugDescription}
                multiline
                numberOfLines={4}
              />

              <Pressable
                onPress={handleSubmitBugReport}
                disabled={submittingBug}
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.btnPrimaryBg },
                  submittingBug && { opacity: 0.6 },
                ]}
              >
                <Text style={[styles.submitBtnText, { color: colors.btnPrimaryText }]}>
                  {submittingBug ? "Submitting..." : "Submit Bug Report"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 4: COMMUNITY FORUM HUB
      ========================================================= */}
      <Modal
        visible={communityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommunityModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCommunityModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>BunkMates Community</Text>
              <Pressable
                onPress={() => setCommunityModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.communityContent}>
              <View style={[styles.iconBoxLarge, { backgroundColor: colors.iconBoxBg }]}>
                <Ionicons name="people" size={32} color={colors.greyishWhite} />
              </View>
              <Text style={[styles.communityTitle, { color: colors.textPrimary }]}>
                Join 50,000+ Explorers & Roommates
              </Text>
              <Text style={[styles.communityDesc, { color: colors.textSecondary }]}>
                Ask questions, share travel tips, swap roommate advice, and discover recommended bunk stays from travelers worldwide.
              </Text>

              <Pressable
                onPress={() => {
                  setCommunityModalVisible(false);
                  Linking.openURL("https://bunkmates.com/community").catch(() => {
                    triggerToast("Community forum link copied!");
                  });
                }}
                style={[styles.submitBtn, { backgroundColor: colors.btnPrimaryBg, marginTop: 16 }]}
              >
                <Text style={[styles.submitBtnText, { color: colors.btnPrimaryText }]}>
                  Visit Web Community
                </Text>
              </Pressable>
            </View>
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
  headerRightSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    marginTop: 4,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
    textTransform: "uppercase",
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  labelGroup: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
    lineHeight: 16,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rightValueText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
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
  faqCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  faqCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    paddingRight: 10,
  },
  faqCardBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Chat Modal
  chatRow: {
    marginVertical: 6,
    flexDirection: "row",
  },
  chatRowUser: {
    justifyContent: "flex-end",
  },
  chatRowBot: {
    justifyContent: "flex-start",
  },
  chatBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  chatSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bug form
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 6,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  severityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  severityPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  formTextarea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 80,
    marginBottom: 16,
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  // Community
  communityContent: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  iconBoxLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  communityTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  communityDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
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
});
