// **@** About BunkMates — Pixel-perfect UI matching user's uploaded mockup & Settings design system
// Features: Zero Red Policy, circular back button, dynamic theme adaptability, Hero brand section with app version easter egg,
// Legal Agreements (Terms of Service, Privacy Policy, Open Source Licenses with search & license viewers),
// Social Media integrations (Twitter/X, Instagram, GitHub with real Linking & clipboard fallbacks), and copyright footer.

import React, { useState, useMemo, useCallback, useRef } from "react";
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
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { ACCENT_COLORS } from "../theme/theme";

interface OpenSourceLib {
  name: string;
  version: string;
  license: string;
  description: string;
  url: string;
}

const OPEN_SOURCE_LIBRARIES: OpenSourceLib[] = [
  {
    name: "react-native",
    version: "0.86.3",
    license: "MIT",
    description: "A framework for building native applications using React",
    url: "https://github.com/facebook/react-native",
  },
  {
    name: "expo",
    version: "57.0.26",
    license: "MIT",
    description: "The universal React ecosystem platform",
    url: "https://github.com/expo/expo",
  },
  {
    name: "firebase",
    version: "12.16.0",
    license: "Apache-2.0",
    description: "Real-time backend, authentication and cloud Firestore",
    url: "https://firebase.google.com",
  },
  {
    name: "react-native-reanimated",
    version: "4.5.1",
    license: "MIT",
    description: "React Native's Animated library reimplemented",
    url: "https://github.com/software-mansion/react-native-reanimated",
  },
  {
    name: "@shopify/react-native-skia",
    version: "2.6.2",
    license: "MIT",
    description: "High-performance 2D Graphics for React Native",
    url: "https://github.com/Shopify/react-native-skia",
  },
  {
    name: "lucide-react-native",
    version: "1.24.0",
    license: "ISC",
    description: "Beautiful & consistent icons made by the community",
    url: "https://lucide.dev",
  },
  {
    name: "@react-native-async-storage/async-storage",
    version: "2.2.0",
    license: "MIT",
    description: "Asynchronous, persistent key-value storage for React Native",
    url: "https://github.com/react-native-async-storage/async-storage",
  },
  {
    name: "expo-image-picker",
    version: "57.0.20",
    license: "MIT",
    description: "Provides access to the system's image library and camera",
    url: "https://docs.expo.dev/versions/latest/sdk/imagepicker",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // Modals state
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [licensesModalVisible, setLicensesModalVisible] = useState(false);

  // License search
  const [licenseSearch, setLicenseSearch] = useState("");

  // Developer mode easter egg tap counter
  const [tapCount, setTapCount] = useState(0);

  // Animated floating toast
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
        Animated.delay(2000),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity]
  );

  // Handle version tap easter egg
  const handleVersionTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    Haptics.selectionAsync().catch(() => {});

    if (next >= 5) {
      setTapCount(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      triggerToast("🎉 Developer Build 4108 Active!");
    } else if (next >= 3) {
      triggerToast(`${5 - next} more taps for Dev Mode`);
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

  // Dynamic colors derived from Settings design system (zero red)
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
      brandBoxBg: isDark ? "#FFFFFF" : "#111827",
      brandBoxIcon: isDark ? "#000000" : "#FFFFFF",
      socialBtnBg: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
      socialBtnBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      chipBg: isDark ? "rgba(255, 255, 255, 0.08)" : "#EEF2F6",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5",
      badgeText: isDark ? "#34D399" : "#065F46",
      inputBg: isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
      inputBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "#E2E8F0",
    };
  }, [isDark, userAccent]);

  // Social link opener with clipboard fallback
  const handleOpenSocial = async (platform: "twitter" | "instagram" | "github") => {
    Haptics.selectionAsync().catch(() => {});

    const urls = {
      twitter: "https://x.com/bunkmates",
      instagram: "https://instagram.com/bunkmates",
      github: "https://github.com/SahilSuman888/bunkmates-v2",
    };

    const targetUrl = urls[platform];

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        await Clipboard.setStringAsync(targetUrl);
        triggerToast(`Copied ${platform} link to clipboard!`);
      }
    } catch {
      await Clipboard.setStringAsync(targetUrl);
      triggerToast(`Copied ${platform} link to clipboard!`);
    }
  };

  // Filtered open-source dependencies
  const filteredLicenses = useMemo(() => {
    const q = licenseSearch.trim().toLowerCase();
    if (!q) return OPEN_SOURCE_LIBRARIES;
    return OPEN_SOURCE_LIBRARIES.filter(
      (lib) =>
        lib.name.toLowerCase().includes(q) ||
        lib.description.toLowerCase().includes(q) ||
        lib.license.toLowerCase().includes(q)
    );
  }, [licenseSearch]);

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
          About BunkMates
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            HERO BRAND SECTION MATCHING MOCKUP
        ========================================================= */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.appIconContainer,
              {
                backgroundColor: colors.brandBoxBg,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.4 : 0.15,
                shadowRadius: 12,
                elevation: 6,
              },
            ]}
          >
            <Ionicons name="home-outline" size={38} color={colors.brandBoxIcon} />
          </View>

          <Text style={[styles.appName, { color: colors.textPrimary }]}>BunkMates</Text>

          <Pressable onPress={handleVersionTap} hitSlop={10}>
            <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
              Version 3.4.1 (Build 4108)
            </Text>
          </Pressable>
        </View>

        {/* ========================================================
            1. LEGAL AGREEMENTS SECTION
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>LEGAL AGREEMENTS</Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Terms of Service */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTermsModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setPrivacyModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View
              style={[
                styles.rowContent,
                { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Open Source Licenses */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setLicensesModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="receipt-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Open Source Licenses</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            2. SOCIAL MEDIA SECTION MATCHING MOCKUP
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>SOCIAL MEDIA</Text>

        <View style={[styles.socialCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Twitter / X */}
          <Pressable
            onPress={() => handleOpenSocial("twitter")}
            style={({ pressed }) => [
              styles.socialBtn,
              {
                backgroundColor: colors.socialBtnBg,
                borderColor: colors.socialBtnBorder,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Twitter / X"
            hitSlop={8}
          >
            <Ionicons name="logo-twitter" size={20} color={colors.textPrimary} />
          </Pressable>

          {/* Instagram */}
          <Pressable
            onPress={() => handleOpenSocial("instagram")}
            style={({ pressed }) => [
              styles.socialBtn,
              {
                backgroundColor: colors.socialBtnBg,
                borderColor: colors.socialBtnBorder,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="Instagram"
            hitSlop={8}
          >
            <Ionicons name="logo-instagram" size={20} color={colors.textPrimary} />
          </Pressable>

          {/* GitHub */}
          <Pressable
            onPress={() => handleOpenSocial("github")}
            style={({ pressed }) => [
              styles.socialBtn,
              {
                backgroundColor: colors.socialBtnBg,
                borderColor: colors.socialBtnBorder,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityLabel="GitHub"
            hitSlop={8}
          >
            <Ionicons name="logo-github" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* ========================================================
            COPYRIGHT FOOTER
        ========================================================= */}
        <View style={styles.footerContainer}>
          <Text style={[styles.copyrightText, { color: colors.textSecondary }]}>
            © 2026 BunkMates Inc. All rights reserved.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL 1: TERMS OF SERVICE
      ========================================================= */}
      <Modal
        visible={termsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTermsModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Terms of Service</Text>
              <Pressable
                onPress={() => setTermsModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={[styles.legalIntro, { color: colors.textSecondary }]}>
                Last updated: October 2026. By accessing or using BunkMates, you agree to be bound by these Terms of Service.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>1. Acceptance of Terms</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                These Terms govern your use of the BunkMates application, websites, and related software. If you disagree with any part of these terms, you may not access our services.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>2. Explorer Profiles & Safety</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                Users must provide truthful identity details. You are responsible for safeguarding your credentials and all activities occurring under your authenticated profile.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>3. Bill Splitting & Ledger Reconciliations</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                BunkMates facilitates shared expense calculations between roommates and travel groups. BunkMates is not a bank and is not liable for unsettled personal liabilities between bunkmates.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>4. Community Standards</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                Harassment, discrimination, or deceptive representations are grounds for immediate account suspension without refund.
              </Text>

              <Pressable
                onPress={() => {
                  setTermsModalVisible(false);
                  triggerToast("Terms acknowledged.");
                }}
                style={[styles.modalActionBtn, { backgroundColor: colors.brandBoxBg }]}
              >
                <Text style={[styles.modalActionBtnText, { color: colors.brandBoxIcon }]}>
                  I Understand
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 2: PRIVACY POLICY
      ========================================================= */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPrivacyModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Privacy Policy</Text>
              <Pressable
                onPress={() => setPrivacyModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={[styles.legalIntro, { color: colors.textSecondary }]}>
                BunkMates prioritizes your data privacy and control. We believe in transparency and robust encryption.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>1. Information We Collect</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                We collect information you provide directly, including name, email address, profile picture, travel preferences, and roommate split transactions.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>2. How Your Data is Used</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                Data is strictly utilized to authenticate accounts, synchronize live group ledgers, and dispatch chore rotation notifications. We never sell your personal data to third-party data brokers.
              </Text>

              <Text style={[styles.legalHeading, { color: colors.textPrimary }]}>3. Encrypted Cloud Storage</Text>
              <Text style={[styles.legalBody, { color: colors.textSecondary }]}>
                Your data is stored across secure Google Cloud & Firebase databases with end-to-end TLS 1.3 transit encryption.
              </Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable
                  onPress={() => {
                    setPrivacyModalVisible(false);
                    router.push("/privacy");
                  }}
                  style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.socialBtnBg, borderWidth: 1, borderColor: colors.cardBorder }]}
                >
                  <Text style={[styles.modalActionBtnText, { color: colors.textPrimary }]}>
                    Full Privacy Settings
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPrivacyModalVisible(false)}
                  style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.brandBoxBg }]}
                >
                  <Text style={[styles.modalActionBtnText, { color: colors.brandBoxIcon }]}>
                    Close
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 3: OPEN SOURCE LICENSES
      ========================================================= */}
      <Modal
        visible={licensesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLicensesModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLicensesModalVisible(false)} />
          <View style={[styles.bottomSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, maxHeight: "80%" }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Open Source Licenses</Text>
              <Pressable
                onPress={() => setLicensesModalVisible(false)}
                style={({ pressed }) => [styles.sheetCloseBtn, pressed && { opacity: 0.6 }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* License Search Bar */}
            <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Filter dependencies..."
                placeholderTextColor={colors.textSecondary}
                value={licenseSearch}
                onChangeText={setLicenseSearch}
              />
              {licenseSearch.length > 0 && (
                <Pressable onPress={() => setLicenseSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {filteredLicenses.map((lib) => (
                <Pressable
                  key={lib.name}
                  onPress={() => {
                    Linking.openURL(lib.url).catch(() => {
                      triggerToast(`License: ${lib.name} (${lib.license})`);
                    });
                  }}
                  style={({ pressed }) => [
                    styles.licenseCard,
                    {
                      backgroundColor: colors.socialBtnBg,
                      borderColor: colors.cardBorder,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.licenseCardTop}>
                    <Text style={[styles.libName, { color: colors.textPrimary }]}>{lib.name}</Text>
                    <View style={[styles.licenseBadge, { backgroundColor: colors.badgeBg }]}>
                      <Text style={[styles.licenseBadgeText, { color: colors.badgeText }]}>{lib.license}</Text>
                    </View>
                  </View>
                  <Text style={[styles.libVersion, { color: colors.textSecondary }]}>v{lib.version}</Text>
                  <Text style={[styles.libDesc, { color: colors.textSecondary }]}>{lib.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
  headerSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  // Hero Brand Section
  heroSection: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 28,
  },
  appIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    fontWeight: "500",
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
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  // Social Media Card
  socialCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 32,
  },
  socialBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Footer
  footerContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  copyrightText: {
    fontSize: 12,
    fontWeight: "400",
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
  // Modals
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
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  legalIntro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  legalHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  legalBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  modalActionBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  modalActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  // Search in Licenses
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  licenseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  licenseCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  libName: {
    fontSize: 14,
    fontWeight: "700",
  },
  licenseBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  licenseBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  libVersion: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  libDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
