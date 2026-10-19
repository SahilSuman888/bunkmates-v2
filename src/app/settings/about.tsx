// **@** About BunkMates — Pixel-perfect UI matching Settings design system
// Features: Dynamic theme adaptability, Hero brand section with app version easter egg,
// Official Legal Links (Terms & Condition, Privacy Policy redirecting to official URLs),
// Active Social Media redirects (LinkedIn, YouTube, Instagram), Open Source Licenses, and copyright footer.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  Animated,
  Linking,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { SwipeableDrawer } from "./_components/SwipeableDrawer";

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

const SOCIAL_LINKS = [
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "logo-linkedin" as const,
    color: "#0A66C2",
    url: "https://www.linkedin.com/company/bunkmates/?viewAsMember=true",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "logo-youtube" as const,
    color: "#FF0000",
    url: "https://www.youtube.com/@Team_BunkMates",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "logo-instagram" as const,
    color: "#E4405F",
    url: "https://www.instagram.com/bunkmates.app/",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { themeColors, accentColor, isDark } = useThemeToggle();

  // Modals state
  const [licensesModalVisible, setLicensesModalVisible] = useState(false);

  // License search
  const [licenseSearch, setLicenseSearch] = useState("");

  // Developer mode state & tap counter
  const [tapCount, setTapCount] = useState(0);
  const [showDevDialog, setShowDevDialog] = useState(false);
  const [enteredKey, setEnteredKey] = useState("");
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync developer mode from storage
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem("isDeveloper").then((val) => {
      if (isMounted && val === "true") {
        setIsDeveloper(true);
      }
    });
    return () => {
      isMounted = false;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  // Animated floating toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpacity] = useState(() => new Animated.Value(0));

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

  // Robust External URL Opener with Haptics and Clipboard Fallback
  const handleOpenUrl = useCallback(
    async (url: string, title?: string) => {
      try {
        Haptics.selectionAsync().catch(() => {});
      } catch (e) {}

      try {
        await Linking.openURL(url);
      } catch (err) {
        console.log(`Failed to open URL ${url}:`, err);
        try {
          await Clipboard.setStringAsync(url);
          triggerToast(title ? `${title} link copied to clipboard!` : `Link copied to clipboard!`);
        } catch (e) {}
      }
    },
    [triggerToast]
  );

  // Handle verify developer passkey against Firestore
  const handleVerifyDevKey = async () => {
    if (!enteredKey.trim()) {
      Alert.alert("Required", "Please enter the developer key.");
      return;
    }

    try {
      setVerifyingKey(true);
      const keyDoc = await getDoc(doc(db, "secret", "devkey"));
      const validKey = keyDoc.exists() ? keyDoc.data().key : null;

      if (enteredKey.trim() === validKey) {
        setIsDeveloper(true);
        await AsyncStorage.setItem("isDeveloper", "true");
        setShowDevDialog(false);
        setEnteredKey("");
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } catch (e) {}
        Alert.alert(
          "Developer Mode",
          "🧑‍💻 Developer Mode Unlocked!",
          [
            {
              text: "Open Developer Tools",
              onPress: () => router.push("/settings/developers" as any),
            },
            { text: "OK" },
          ]
        );
      } else {
        Alert.alert("Invalid Developer Key", "The developer key is incorrect.");
      }
    } catch (error) {
      console.error("Error verifying developer key:", error);
      Alert.alert("Error", "Could not verify the developer key. Try again later.");
    } finally {
      setVerifyingKey(false);
    }
  };

  // Handle version tap easter egg — 5 taps prompts for Developer Key!
  const handleVersionTap = () => {
    try {
      Haptics.selectionAsync().catch(() => {});
    } catch (e) {}

    if (isDeveloper) {
      router.push("/settings/developers" as any);
      return;
    }

    const next = tapCount + 1;
    setTapCount(next);

    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapCount(0), 1500);

    if (next >= 5) {
      setTapCount(0);
      setEnteredKey("");
      setShowDevDialog(true);
    } else if (next >= 2) {
      const remaining = 5 - next;
      triggerToast(`Tap ${remaining} more time${remaining === 1 ? "" : "s"} to unlock Developer Mode`);
    }
  };

  // Theme-aware colors
  const colors = useMemo(() => {
    const greyishWhite = isDark ? "#E2E8F0" : "#4B5563";
    const activeText = accentColor || "#FF5A5F";

    return {
      bg: themeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: themeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardBorder: "transparent",
      divider: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      textPrimary: themeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      greyishWhite,
      iconBoxBg: isDark ? "#202024" : "#F4F5F7",
      chevron: isDark ? "#555860" : "#B4B9C2",
      activeText,
      activeBorder: "transparent",
      brandBoxBg: isDark ? "#FFFFFF" : "#000000",
      brandBoxIcon: isDark ? "#000000" : "#FFFFFF",
      socialBtnBg: isDark ? "#202024" : "#F4F5F7",
      socialBtnBorder: "transparent",
      modalOverlay: "rgba(0, 0, 0, 0.65)",
      toastBg: isDark ? "#1F2937" : "#111827",
      toastText: "#F9FAFB",
      chipBg: isDark ? "#202024" : "#EEF2F6",
      badgeBg: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5",
      badgeText: isDark ? "#34D399" : "#065F46",
      inputBg: isDark ? "#202024" : "#FFFFFF",
      inputBorder: "transparent",
      devAccent: "#00e6b0",
      devAccentBg: "rgba(0, 230, 176, 0.12)",
    };
  }, [isDark, accentColor, themeColors]);

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

  const renderDeveloperPasskeyModal = () => (
    <SwipeableDrawer
      visible={showDevDialog}
      onClose={() => {
        setShowDevDialog(false);
        setEnteredKey("");
      }}
      sheetStyle={styles.devModalCard}
      handleColor="#555"
    >
      <View style={{ paddingTop: 4, paddingBottom: 16 }}>
        <Text style={styles.devModalTitle}>Enter Developer Passkey</Text>
        <Text style={styles.devModalSubtitle}>
          This access is restricted to authorized developers only.
        </Text>

        <TextInput
          autoFocus
          value={enteredKey}
          onChangeText={setEnteredKey}
          placeholder="Developer Key"
          placeholderTextColor="#777"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleVerifyDevKey}
          style={styles.devModalInput}
        />

        <View style={styles.devModalActions}>
          <Pressable
            onPress={() => {
              setShowDevDialog(false);
              setEnteredKey("");
            }}
            style={styles.devCancelButton}
          >
            <Text style={styles.devCancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleVerifyDevKey}
            disabled={verifyingKey}
            style={styles.devVerifyButton}
          >
            {verifyingKey ? (
              <ActivityIndicator color="#00140f" size="small" />
            ) : (
              <Text style={styles.devVerifyText}>Verify</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SwipeableDrawer>
  );

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
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/settings" as any);
          }}
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
          {t("About BunkMates", "About BunkMates")}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================
            HERO BRAND SECTION
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
          <Pressable onPress={handleVersionTap} hitSlop={12} style={styles.versionTapWrapper}>
            <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
              Version 3.4.1 (Build 4108)
            </Text>
          </Pressable>

          {/* Developer Active Pill Badge */}
          {isDeveloper && (
            <Pressable
              onPress={() => router.replace({ pathname: "/settings", params: { page: "developers" } } as any)}
              style={({ pressed }) => [
                styles.devHeroBadge,
                { backgroundColor: colors.devAccentBg, borderColor: "rgba(0,230,176,0.3)" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="code-slash" size={13} color={colors.devAccent} style={{ marginRight: 5 }} />
              <Text style={[styles.devHeroBadgeText, { color: colors.devAccent }]}>
                🧑‍💻 Developer Mode Active
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.devAccent} style={{ marginLeft: 3 }} />
            </Pressable>
          )}
        </View>

        {/* ========================================================
            DEVELOPER OPTIONS (APPEARS WHEN DEVELOPER MODE IS UNLOCKED)
        ========================================================= */}
        {isDeveloper && (
          <>
            <Text style={[styles.sectionHeading, { color: colors.devAccent }]}>
              DEVELOPER OPTIONS
            </Text>
            <View
              style={[
                styles.cardGroup,
                {
                  backgroundColor: colors.card,
                  borderColor: "rgba(0,230,176,0.25)",
                  borderWidth: 1,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  try {
                    Haptics.selectionAsync().catch(() => {});
                  } catch (e) {}
                  router.replace({ pathname: "/settings", params: { page: "developers" } } as any);
                }}
                style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.devAccentBg }]}>
                  <Ionicons name="code-slash" size={20} color={colors.devAccent} />
                </View>
                <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                        Developer Tools & Sandbox
                      </Text>
                      <View style={[styles.activeMiniPill, { backgroundColor: colors.devAccentBg }]}>
                        <Text style={[styles.activeMiniPillText, { color: colors.devAccent }]}>ACTIVE</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Testing features, route sandboxes & internal debug tools
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
                </View>
              </Pressable>
            </View>
          </>
        )}

        {/* ========================================================
            1. LEGAL AGREEMENTS SECTION (WITH ACTIVE REDIRECTS)
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("LEGAL AGREEMENTS", "LEGAL AGREEMENTS")}
        </Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Terms & Condition (Redirects to https://app.bunkmates.xyz/terms) */}
          <Pressable
            onPress={() => handleOpenUrl("https://app.bunkmates.xyz/terms", "Terms & Condition")}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
            accessibilityRole="link"
            accessibilityLabel="Terms and Condition"
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Terms & Condition", "Terms & Condition")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  app.bunkmates.xyz/terms
                </Text>
              </View>
              <Ionicons name="open-outline" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Privacy Policy (Redirects to https://app-beta.bunkmates.xyz/privacy-policy) */}
          <Pressable
            onPress={() =>
              handleOpenUrl("https://app-beta.bunkmates.xyz/privacy-policy", "Privacy Policy")
            }
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Privacy Policy", "Privacy Policy")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  app-beta.bunkmates.xyz/privacy-policy
                </Text>
              </View>
              <Ionicons name="open-outline" size={17} color={colors.chevron} />
            </View>
          </Pressable>

          {/* Open Source Licenses */}
          <Pressable
            onPress={() => {
              try {
                Haptics.selectionAsync().catch(() => {});
              } catch (e) {}
              setLicensesModalVisible(true);
            }}
            style={({ pressed }) => [styles.rowItem, pressed && styles.rowPressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="receipt-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={[styles.rowContent, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  {t("Open Source Licenses", "Open Source Licenses")}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Third-party libraries & acknowledgments
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            2. SOCIAL MEDIA SECTION (ACTIVE REDIRECTS)
        ========================================================= */}
        <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
          {t("CONNECT WITH US", "CONNECT WITH US")}
        </Text>
        <View style={[styles.socialCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {SOCIAL_LINKS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleOpenUrl(item.url, item.name)}
              style={({ pressed }) => [
                styles.socialBtn,
                {
                  backgroundColor: colors.socialBtnBg,
                  borderColor: colors.socialBtnBorder,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel={item.name}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Ionicons name={item.icon} size={22} color={colors.greyishWhite} />
            </Pressable>
          ))}
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
          DRAWER: OPEN SOURCE LICENSES
      ========================================================= */}
      <SwipeableDrawer
        visible={licensesModalVisible}
        onClose={() => setLicensesModalVisible(false)}
        sheetStyle={[
          styles.bottomSheet,
          { backgroundColor: colors.card, borderColor: colors.cardBorder, maxHeight: "80%" },
        ]}
      >
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

        {/* Search Bar inside Licenses Modal */}
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="search" size={17} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={licenseSearch}
            onChangeText={setLicenseSearch}
            placeholder="Search libraries or licenses..."
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {licenseSearch.length > 0 && (
            <Pressable onPress={() => setLicenseSearch("")} hitSlop={6}>
              <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
          {filteredLicenses.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No libraries match your search.</Text>
            </View>
          ) : (
            filteredLicenses.map((lib, i) => (
              <Pressable
                key={i}
                onPress={() => handleOpenUrl(lib.url, lib.name)}
                style={[styles.licenseCard, { backgroundColor: colors.iconBoxBg }]}
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
            ))
          )}
        </ScrollView>
      </SwipeableDrawer>

      {/* Developer Passkey Modal */}
      {renderDeveloperPasskeyModal()}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  modernHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginLeft: 14,
    flex: 1,
  },
  headerSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  // Hero Section
  heroSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  versionTapWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  appVersion: {
    fontSize: 13,
    fontWeight: "500",
  },
  devHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  devHeroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  // Section Headings
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  // Card Groups
  cardGroup: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 26,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
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
  activeMiniPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeMiniPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // Social Media Card
  socialCard: {
    borderRadius: 24,
    borderWidth: 0,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 32,
  },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 0,
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
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
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
  // Search in Licenses
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 0,
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
    borderRadius: 20,
    borderWidth: 0,
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
  devModalCard: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#161618",
    borderWidth: 0,
  },
  devModalTitle: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  devModalSubtitle: {
    color: "#8f8f8f",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  devModalInput: {
    height: 50,
    borderWidth: 0,
    borderRadius: 20,
    backgroundColor: "#090909",
    color: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  devModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  devCancelButton: {
    minWidth: 90,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  devCancelText: {
    color: "#999999",
    fontSize: 13,
    fontWeight: "500",
  },
  devVerifyButton: {
    minWidth: 100,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00c99a",
  },
  devVerifyText: {
    color: "#00140f",
    fontSize: 13,
    fontWeight: "700",
  },
});