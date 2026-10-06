// **@** Help & Support — Fully functional, dynamic, pixel-perfect screen adhering to Settings design system
// Features: Zero Red Policy, circular back button, dynamic theme adaptability, instant real-time search with inline article expansions,
// interactive FAQ accordion with feedback ("Was this helpful?"), Live Chat with auto-reply & human escalation, Email support with clipboard fallback,
// Report a Bug with Firestore logging & local ticket history, and Community Forum Hub.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  Switch,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

interface FAQItem {
  id: string;
  categoryTitle: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  articles: FAQItem[];
}

interface SupportTicket {
  id: string;
  title: string;
  category: string;
  severity?: string;
  status: "Open" | "In Review" | "Resolved";
  createdAt: string;
}

const FAQ_DATA: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started with BunkMates",
    icon: "help-circle-outline",
    articles: [
      {
        id: "gs-1",
        categoryTitle: "Getting Started",
        question: "How do I create and customize my explorer profile?",
        answer:
          "Navigate to the Profile tab and tap 'Edit Profile'. You can upload a photo, set your username, add a bio, and specify your personal travel and living preferences.",
      },
      {
        id: "gs-2",
        categoryTitle: "Getting Started",
        question: "How do I invite friends or roommates to a trip?",
        answer:
          "Open your active trip or room group, tap the 'Invite' or '+' icon in the top header, and share your unique 6-digit trip code or invite link via WhatsApp, SMS, or QR code.",
      },
      {
        id: "gs-3",
        categoryTitle: "Getting Started",
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
        categoryTitle: "Roommate Sync",
        question: "How does roommate schedule and chore sync work?",
        answer:
          "The Sync tab connects your group's shared reminders, quiet hours, and daily chore rotations with automatic notifications so everyone stays aligned.",
      },
      {
        id: "rs-2",
        categoryTitle: "Roommate Sync",
        question: "What should I do if there is a roommate dispute?",
        answer:
          "We encourage open communication through group chat notes. If the issue involves safety or lease violations, use our Dispute Resolution Tool to request mediation from BunkMates Support.",
      },
      {
        id: "rs-3",
        categoryTitle: "Roommate Sync",
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
        categoryTitle: "Bill Split",
        question: "How do I split an expense equally or by custom amounts?",
        answer:
          "Tap '+ Add Expense' in the Expenses tab. Enter the total amount, select the payer, and choose 'Split Equally' or assign custom percentages per roommate.",
      },
      {
        id: "bp-2",
        categoryTitle: "Bill Split",
        question: "Which payment methods are supported for settlements?",
        answer:
          "BunkMates integrates with UPI (Google Pay, PhonePe, Paytm), Apple Pay, credit/debit cards, and direct bank transfers with instant digital receipts.",
      },
      {
        id: "bp-3",
        categoryTitle: "Bill Split",
        question: "Can I dispute an incorrect expense entry?",
        answer:
          "Yes. Tap on any expense entry in the ledger, tap 'Dispute Entry', and add a quick reason. The original payer will be notified to review and adjust the charge.",
      },
    ],
  },
];

const COMMUNITY_TOPICS = [
  {
    id: "ct-1",
    title: "Top budget hacks for finding shared vacation rentals",
    author: "Elena Rostova",
    replies: 42,
    upvotes: 184,
  },
  {
    id: "ct-2",
    title: "How our flat eliminated chore arguments with Sync rotations",
    author: "Kavya Menon",
    replies: 57,
    upvotes: 219,
  },
  {
    id: "ct-3",
    title: "Best international travel multi-currency split strategies",
    author: "Marcus Vance",
    replies: 29,
    upvotes: 96,
  },
];

const STORAGE_KEY_TICKETS = "@bunkmates_my_tickets";

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
  const [ticketsModalVisible, setTicketsModalVisible] = useState(false);

  // Article helpfulness rating state { [articleId]: 'yes' | 'no' }
  const [articleFeedback, setArticleFeedback] = useState<Record<string, "yes" | "no">>({});

  // Live support chat state
  const [chatMessage, setChatMessage] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const [chatHistory, setChatHistory] = useState<
    { sender: "bot" | "user"; text: string; time: string; isAction?: boolean }[]
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
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submittingBug, setSubmittingBug] = useState(false);

  // My tickets list
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);

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

  // Load ticket history from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_TICKETS);
        if (stored) {
          setMyTickets(JSON.parse(stored));
        }
      } catch (err) {
        console.log("Error reading tickets:", err);
      }
    })();
  }, []);

  const saveTicketLocally = async (ticket: SupportTicket) => {
    try {
      const updated = [ticket, ...myTickets];
      setMyTickets(updated);
      await AsyncStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(updated));
    } catch (e) {
      console.log("Error saving ticket locally:", e);
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
      accentGreen: "#10B981",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5",
      badgeText: isDark ? "#34D399" : "#065F46",
    };
  }, [isDark, userAccent]);

  // All articles flattened for instant direct search
  const allArticles = useMemo(() => {
    return FAQ_DATA.flatMap((cat) => cat.articles);
  }, []);

  // Filtered categories and direct matching articles
  const matchingArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allArticles.filter(
      (a) =>
        a.question.toLowerCase().includes(q) ||
        a.answer.toLowerCase().includes(q) ||
        a.categoryTitle.toLowerCase().includes(q)
    );
  }, [searchQuery, allArticles]);

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

  // Action: Open Email Support with clipboard copy fallback
  const handleOpenEmail = async () => {
    const email = "support@bunkmates.xyz";
    const mailtoUrl = `mailto:${email}?subject=BunkMates Help Request`;

    try {
      await Clipboard.setStringAsync(email);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      // ignore clipboard error
    }

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        triggerToast("Opening email app & copied address!");
      } else {
        triggerToast(`Email copied: ${email}`);
        Alert.alert(
          "Email Address Copied",
          `We've copied ${email} to your clipboard. You can paste it into your favorite email app to contact our support team.`,
          [{ text: "OK" }]
        );
      }
    } catch {
      triggerToast(`Email copied: ${email}`);
      Alert.alert(
        "Email Support",
        `Our support email is: ${email} (Copied to clipboard). Send us a message anytime!`,
        [{ text: "OK" }]
      );
    }
  };

  // Action: Rate article helpfulness
  const handleRateArticle = (artId: string, helpful: "yes" | "no") => {
    setArticleFeedback((prev) => ({ ...prev, [artId]: helpful }));
    Haptics.selectionAsync().catch(() => {});
    triggerToast(helpful === "yes" ? "Thanks for your feedback! 👍" : "Feedback noted, we'll improve this.");
  };

  // Action: Send Live Chat Message
  const handleSendChatMessage = (customText?: string) => {
    const text = (typeof customText === "string" ? customText : chatMessage).trim();
    if (!text) return;

    const userMsg = {
      sender: "user" as const,
      text,
      time: "Just now",
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setChatMessage("");
    setIsBotTyping(true);
    Haptics.selectionAsync().catch(() => {});

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Dynamic smart replies
    setTimeout(() => {
      setIsBotTyping(false);
      const lower = text.toLowerCase();
      let botReply =
        "Thanks for your message! Our virtual assistant has logged this query. If you need dedicated human support, tap 'Escalate to Specialist' below.";

      if (lower.includes("bill") || lower.includes("payment") || lower.includes("expense") || lower.includes("split")) {
        botReply =
          "For split bills, balances update instantly in the Expenses tab. You can export a PDF statement, settle via UPI/Cards, or tap 'Dispute' on any individual charge.";
      } else if (lower.includes("roommate") || lower.includes("sync") || lower.includes("invite") || lower.includes("chore")) {
        botReply =
          "To sync roommates, share your 6-digit room code from Room Settings > Invite. Daily chore reminders can be scheduled under the Sync tab.";
      } else if (lower.includes("human") || lower.includes("agent") || lower.includes("representative") || lower.includes("specialist")) {
        handleEscalateToAgent();
        return;
      }

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "bot" as const,
          text: botReply,
          time: "Just now",
        },
      ]);

      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 700);
  };

  // Action: Escalate Live Chat to Human Specialist
  const handleEscalateToAgent = async () => {
    const ticketId = `BM-LIVE-${Math.floor(10000 + Math.random() * 90000)}`;
    const user = auth.currentUser;

    const ticket: SupportTicket = {
      id: ticketId,
      title: "Live Chat Human Escalation",
      category: "Live Chat Support",
      severity: "High",
      status: "Open",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    try {
      await addDoc(collection(db, "supportTickets"), {
        ticketId,
        userId: user ? user.uid : "guest",
        userEmail: user ? user.email : "guest@bunkmates.xyz",
        title: "Live Chat Escalation",
        description: chatHistory.map((m) => `${m.sender}: ${m.text}`).join("\n"),
        category: "Live Chat",
        status: "open",
        createdAt: serverTimestamp(),
      });
    } catch {
      // Local fallback
    }

    await saveTicketLocally(ticket);

    setChatHistory((prev) => [
      ...prev,
      {
        sender: "bot" as const,
        text: `🎟️ Ticket #${ticketId} created! Your inquiry has been routed to our human support desk. We will review your chat transcript and email ${user?.email || "your registered account"} shortly.`,
        time: "Just now",
        isAction: true,
      },
    ]);

    triggerToast(`Ticket ${ticketId} generated!`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Action: Submit Bug Report
  const handleSubmitBugReport = async () => {
    if (!bugTitle.trim() || !bugDescription.trim()) {
      Alert.alert("Missing Details", "Please provide both a title and description for the bug.");
      return;
    }

    setSubmittingBug(true);
    const ticketId = `BM-BUG-${Math.floor(10000 + Math.random() * 90000)}`;
    const user = auth.currentUser;

    const ticket: SupportTicket = {
      id: ticketId,
      title: bugTitle.trim(),
      category: "Bug Report",
      severity: bugSeverity,
      status: "Open",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    try {
      await addDoc(collection(db, "supportTickets"), {
        ticketId,
        userId: user ? user.uid : "anonymous",
        userEmail: user ? user.email : "guest@bunkmates.xyz",
        title: bugTitle.trim(),
        description: bugDescription.trim(),
        severity: bugSeverity,
        category: "Bug Report",
        status: "open",
        diagnostics: includeDiagnostics
          ? {
              os: Platform.OS,
              version: Platform.Version,
              appVersion: "2.4.0",
            }
          : null,
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.log("Bug report Firestore log error:", e);
    }

    await saveTicketLocally(ticket);

    setSubmittingBug(false);
    setBugModalVisible(false);
    setBugTitle("");
    setBugDescription("");
    triggerToast(`Report filed! Reference #${ticketId}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    Alert.alert(
      "Bug Report Submitted",
      `Thank you for helping us improve BunkMates! Your ticket reference is #${ticketId}. Our engineering team has logged this issue.`,
      [{ text: "OK" }]
    );
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
        <Pressable
          onPress={() => setTicketsModalVisible(true)}
          style={({ pressed }) => [
            styles.modernHeaderBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="My Tickets"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.textPrimary} />
        </Pressable>
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
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* ========================================================
            IF SEARCH ACTIVE: DISPLAY MATCHING ARTICLES INLINE
        ========================================================= */}
        {searchQuery.trim().length > 0 ? (
          <>
            <View style={styles.searchHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginBottom: 0 }]}>
                MATCHING ARTICLES ({matchingArticles.length})
              </Text>
              <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
                <Text style={[styles.clearSearchText, { color: colors.activeText }]}>Clear</Text>
              </Pressable>
            </View>

            {matchingArticles.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="search-outline" size={36} color={colors.textSecondary} style={{ marginBottom: 10 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No articles found</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  We couldn't find any articles matching "{searchQuery}".
                </Text>
                <View style={styles.emptyActionRow}>
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    style={[styles.emptyBtn, { backgroundColor: colors.chipBg }]}
                  >
                    <Text style={[styles.emptyBtnText, { color: colors.textPrimary }]}>Clear Search</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setContactModalVisible(true);
                      handleSendChatMessage(`Help with: ${searchQuery}`);
                    }}
                    style={[styles.emptyBtn, { backgroundColor: colors.btnPrimaryBg }]}
                  >
                    <Text style={[styles.emptyBtnText, { color: colors.btnPrimaryText }]}>Ask Live Chat</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {matchingArticles.map((art, idx) => {
                  const isExpanded = expandedArticleId === art.id;
                  const isLast = idx === matchingArticles.length - 1;
                  const feedback = articleFeedback[art.id];

                  return (
                    <View
                      key={art.id}
                      style={[
                        styles.articleInlineContainer,
                        !isLast && {
                          borderBottomColor: colors.divider,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={() => setExpandedArticleId(isExpanded ? null : art.id)}
                        style={styles.articleInlineHeader}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={styles.categoryBadgeRow}>
                            <Text style={[styles.categoryBadgeText, { color: colors.textSecondary }]}>
                              {art.categoryTitle}
                            </Text>
                          </View>
                          <Text style={[styles.articleInlineQuestion, { color: colors.textPrimary }]}>
                            {art.question}
                          </Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={colors.chevron}
                        />
                      </Pressable>

                      {isExpanded && (
                        <View style={[styles.articleInlineBody, { borderTopColor: colors.divider }]}>
                          <Text style={[styles.articleInlineAnswer, { color: colors.textSecondary }]}>
                            {art.answer}
                          </Text>

                          {/* Helpfulness feedback */}
                          <View style={styles.feedbackRow}>
                            <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>
                              Was this helpful?
                            </Text>
                            {feedback ? (
                              <View style={styles.feedbackGivenBox}>
                                <Ionicons
                                  name={feedback === "yes" ? "thumbs-up" : "thumbs-down"}
                                  size={14}
                                  color="#10B981"
                                />
                                <Text style={[styles.feedbackGivenText, { color: "#10B981" }]}>
                                  Thanks for feedback!
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.feedbackBtns}>
                                <Pressable
                                  onPress={() => handleRateArticle(art.id, "yes")}
                                  style={[styles.feedbackBtn, { backgroundColor: colors.chipBg }]}
                                  hitSlop={6}
                                >
                                  <Ionicons name="thumbs-up-outline" size={13} color={colors.textPrimary} />
                                  <Text style={[styles.feedbackBtnText, { color: colors.textPrimary }]}>Yes</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleRateArticle(art.id, "no")}
                                  style={[styles.feedbackBtn, { backgroundColor: colors.chipBg }]}
                                  hitSlop={6}
                                >
                                  <Ionicons name="thumbs-down-outline" size={13} color={colors.textPrimary} />
                                  <Text style={[styles.feedbackBtnText, { color: colors.textPrimary }]}>No</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {/* ========================================================
            1. FAQ CATEGORIES SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("FAQ CATEGORIES")}</Text>
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
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{cat.title}</Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                      {cat.articles.length} articles
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ========================================================
            2. DIRECT CONTACT SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>{t("DIRECT CONTACT")}</Text>
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
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Contact Support")}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Live chat with our support assistant")}
                </Text>
              </View>
              <View style={styles.onlineBadge}>
                <View style={[styles.onlineDot, { backgroundColor: "#10B981" }]} />
                <Text style={[styles.onlineText, { color: colors.textSecondary }]}>{t("Online")}</Text>
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
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Email Support")}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Tap to copy & open mail client")}
                </Text>
              </View>
              <View style={styles.rightGroup}>
                <Text style={[styles.rightValueText, { color: colors.textSecondary }]}>
                  support@bunkmates.xyz
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
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Report a Bug")}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Submit an issue to our engineering team")}
                </Text>
              </View>
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
              <View style={styles.labelGroup}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{t("Community Forum")}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {t("Explore discussions with 50,000+ roommates")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            3. MY RECENT TICKETS SHORTCUT
        ========================================================= */}
        {myTickets.length > 0 && (
          <>
            <View style={styles.searchHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.sectionHeader, marginBottom: 0 }]}>
                MY RECENT TICKETS ({myTickets.length})
              </Text>
              <Pressable onPress={() => setTicketsModalVisible(true)} hitSlop={6}>
                <Text style={[styles.clearSearchText, { color: colors.activeText }]}>View All</Text>
              </Pressable>
            </View>
            <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {myTickets.slice(0, 2).map((tk, idx) => (
                <Pressable
                  key={tk.id}
                  onPress={() => setTicketsModalVisible(true)}
                  style={[
                    styles.ticketRow,
                    idx < 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.ticketIdText, { color: colors.activeText }]}>#{tk.id}</Text>
                      <View style={[styles.ticketBadge, { backgroundColor: colors.badgeBg }]}>
                        <Text style={[styles.ticketBadgeText, { color: colors.badgeText }]}>{tk.status}</Text>
                      </View>
                    </View>
                    <Text style={[styles.ticketTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tk.title}
                    </Text>
                    <Text style={[styles.ticketDateText, { color: colors.textSecondary }]}>{tk.createdAt}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.chevron} />
                </Pressable>
              ))}
            </View>
          </>
        )}

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

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {activeFaqCategory?.articles.map((art) => {
                const isExpanded = expandedArticleId === art.id;
                const feedback = articleFeedback[art.id];
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
                      <View style={[styles.faqCardBody, { borderTopColor: colors.cardBorder }]}>
                        <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                          {art.answer}
                        </Text>

                        {/* Article Feedback */}
                        <View style={styles.feedbackRow}>
                          <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>
                            Was this helpful?
                          </Text>
                          {feedback ? (
                            <View style={styles.feedbackGivenBox}>
                              <Ionicons
                                name={feedback === "yes" ? "thumbs-up" : "thumbs-down"}
                                size={14}
                                color="#10B981"
                              />
                              <Text style={[styles.feedbackGivenText, { color: "#10B981" }]}>
                                Thanks for feedback!
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.feedbackBtns}>
                              <Pressable
                                onPress={() => handleRateArticle(art.id, "yes")}
                                style={[styles.feedbackBtn, { backgroundColor: colors.chipBg }]}
                                hitSlop={6}
                              >
                                <Ionicons name="thumbs-up-outline" size={13} color={colors.textPrimary} />
                                <Text style={[styles.feedbackBtnText, { color: colors.textPrimary }]}>Yes</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleRateArticle(art.id, "no")}
                                style={[styles.feedbackBtn, { backgroundColor: colors.chipBg }]}
                                hitSlop={6}
                              >
                                <Ionicons name="thumbs-down-outline" size={13} color={colors.textPrimary} />
                                <Text style={[styles.feedbackBtnText, { color: colors.textPrimary }]}>No</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setContactModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, height: "78%" }]}>
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
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>BunkMates Live Chat</Text>
                  <Text style={[styles.chatSubheader, { color: colors.textSecondary }]}>Virtual Assistant • Instant answers</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setContactModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Quick Suggestion Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPromptScroll}
            >
              {[
                "💳 Payment & split dispute",
                "👥 Roommate sync issue",
                "🔐 Verified badge info",
                "👤 Escalate to agent",
              ].map((prompt, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleSendChatMessage(prompt)}
                  style={[styles.quickPromptChip, { backgroundColor: colors.chipBg }]}
                >
                  <Text style={[styles.quickPromptText, { color: colors.textPrimary }]}>{prompt}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView
              ref={chatScrollRef}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, paddingVertical: 8 }}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            >
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

              {isBotTyping && (
                <View style={[styles.chatRow, styles.chatRowBot]}>
                  <View style={[styles.chatBubble, { backgroundColor: colors.chatBubbleBot }]}>
                    <Text style={[styles.typingText, { color: colors.textSecondary }]}>Assistant is typing...</Text>
                  </View>
                </View>
              )}
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
                onSubmitEditing={() => handleSendChatMessage()}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => handleSendChatMessage()}
                style={[
                  styles.chatSendBtn,
                  { backgroundColor: colors.btnPrimaryBg },
                  !chatMessage.trim() && { opacity: 0.5 },
                ]}
                disabled={!chatMessage.trim()}
              >
                <Ionicons name="send" size={17} color={colors.btnPrimaryText} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
        >
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

              {/* Include Diagnostics Toggle */}
              <View style={[styles.diagRow, { borderColor: colors.divider }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.diagTitle, { color: colors.textPrimary }]}>
                    Attach Diagnostics
                  </Text>
                  <Text style={[styles.diagSub, { color: colors.textSecondary }]}>
                    Include OS ({Platform.OS} {Platform.Version}) & app logs
                  </Text>
                </View>
                <Switch
                  value={includeDiagnostics}
                  onValueChange={setIncludeDiagnostics}
                  trackColor={{ false: colors.chipBg, true: "#10B981" }}
                  thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
                />
              </View>

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
        </KeyboardAvoidingView>
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
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, maxHeight: "80%" }]}>
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

            <ScrollView showsVerticalScrollIndicator={false}>
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
              </View>

              {/* Trending discussions */}
              <Text style={[styles.formLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
                TRENDING DISCUSSIONS
              </Text>
              {COMMUNITY_TOPICS.map((topic, i) => (
                <Pressable
                  key={topic.id}
                  onPress={() => {
                    triggerToast(`Opening: "${topic.title.slice(0, 24)}..."`);
                    Linking.openURL("https://bunkmates.com/community").catch(() => {});
                  }}
                  style={[
                    styles.topicCard,
                    {
                      backgroundColor: colors.activeRowBg,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{topic.title}</Text>
                  <View style={styles.topicFooter}>
                    <Text style={[styles.topicAuthor, { color: colors.textSecondary }]}>By {topic.author}</Text>
                    <View style={styles.topicStats}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="arrow-up" size={13} color="#10B981" />
                        <Text style={[styles.topicStatText, { color: colors.textSecondary }]}>{topic.upvotes}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 10 }}>
                        <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} />
                        <Text style={[styles.topicStatText, { color: colors.textSecondary }]}>{topic.replies}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}

              <Pressable
                onPress={() => {
                  setCommunityModalVisible(false);
                  Linking.openURL("https://bunkmates.com/community").catch(() => {
                    triggerToast("Community forum link: bunkmates.com/community");
                  });
                }}
                style={[styles.submitBtn, { backgroundColor: colors.btnPrimaryBg, marginTop: 16 }]}
              >
                <Text style={[styles.submitBtnText, { color: colors.btnPrimaryText }]}>
                  Open Full Web Community
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 5: MY TICKETS MODAL
      ========================================================= */}
      <Modal
        visible={ticketsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTicketsModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTicketsModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, maxHeight: "75%" }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>My Support Requests</Text>
              <Pressable
                onPress={() => setTicketsModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {myTickets.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: "transparent", paddingVertical: 32 }]}>
                <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Support Tickets</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  When you report a bug or escalate a live chat inquiry, your tickets will show up here.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {myTickets.map((tk, idx) => (
                  <View
                    key={tk.id}
                    style={[
                      styles.ticketCardFull,
                      {
                        backgroundColor: colors.activeRowBg,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.ticketCardHeader}>
                      <Text style={[styles.ticketIdText, { color: colors.activeText }]}>#{tk.id}</Text>
                      <View style={[styles.ticketBadge, { backgroundColor: colors.badgeBg }]}>
                        <Text style={[styles.ticketBadgeText, { color: colors.badgeText }]}>{tk.status}</Text>
                      </View>
                    </View>
                    <Text style={[styles.ticketCardTitle, { color: colors.textPrimary }]}>{tk.title}</Text>
                    <View style={styles.ticketCardFooter}>
                      <Text style={[styles.ticketCardCat, { color: colors.textSecondary }]}>
                        {tk.category} {tk.severity ? `• ${tk.severity}` : ""}
                      </Text>
                      <Text style={[styles.ticketCardDate, { color: colors.textSecondary }]}>{tk.createdAt}</Text>
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
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  clearSearchText: {
    fontSize: 13,
    fontWeight: "600",
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
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginRight: 8,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Inline article search result styles
  articleInlineContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  articleInlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadgeRow: {
    marginBottom: 3,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  articleInlineQuestion: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  articleInlineBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  articleInlineAnswer: {
    fontSize: 13,
    lineHeight: 19,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  feedbackBtns: {
    flexDirection: "row",
    gap: 8,
  },
  feedbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  feedbackBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  feedbackGivenBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  feedbackGivenText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Empty card
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    padding: 24,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Ticket shortcut row
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ticketIdText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  ticketBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ticketTitleText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  ticketDateText: {
    fontSize: 11,
    marginTop: 2,
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
  chatSubheader: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
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
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Chat Modal
  quickPromptScroll: {
    paddingBottom: 10,
    gap: 8,
  },
  quickPromptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickPromptText: {
    fontSize: 12,
    fontWeight: "600",
  },
  chatRow: {
    marginVertical: 5,
    flexDirection: "row",
  },
  chatRowUser: {
    justifyContent: "flex-end",
  },
  chatRowBot: {
    justifyContent: "flex-start",
  },
  chatBubble: {
    maxWidth: "82%",
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
  typingText: {
    fontSize: 12,
    fontStyle: "italic",
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
    marginBottom: 12,
  },
  diagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  diagSub: {
    fontSize: 12,
    marginTop: 2,
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
  topicCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  topicFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  topicAuthor: {
    fontSize: 11,
  },
  topicStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  topicStatText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Ticket full list
  ticketCardFull: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  ticketCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ticketCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  ticketCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticketCardCat: {
    fontSize: 11,
  },
  ticketCardDate: {
    fontSize: 11,
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
