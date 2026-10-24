// **@** Dedicated Settings Search Page — Butter-smooth expanding search bar matching iOS Spotlight / Settings design
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputInstance,
  StatusBar,
  Platform,
  Keyboard,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { SettingsHeaderGradientMask } from "./_components/SettingsHeaderGradientMask";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RESTING_PILL_WIDTH = Math.min(315, SCREEN_WIDTH - 48);
const EXPANDED_PILL_WIDTH = SCREEN_WIDTH - 32;

interface SearchItem {
  id: string;
  category: "ACCOUNT" | "APP SETTINGS" | "TRIP EXPERIENCE" | "SUPPORT" | "DEVELOPER";
  title: string;
  subtitle: string;
  keywords: string[];
  icon: string;
  iconFamily?: "ionicons" | "feather" | "material";
  badge?: string;
  rightText?: string;
  route: string;
}

export default function SettingsSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { themeColors, isDark, mode: themeMode } = useThemeToggle();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<TextInputInstance>(null);

  // **@** Floating bottom rest position
  const BOTTOM_NAV_HEIGHT = 10;
  const BOTTOM_NAV_BASE_OFFSET = Math.max(insets.bottom, 10) + 8;
  const GAP_ABOVE_BOTTOM_NAV = 1;
  const searchBottomOffset = BOTTOM_NAV_BASE_OFFSET + BOTTOM_NAV_HEIGHT + GAP_ABOVE_BOTTOM_NAV;

  // **@** Reanimated shared values for butter-smooth 60/120fps hardware-synced animation
  const expandProgress = useSharedValue(0); // Starts at resting width (315), mixes and merges in 200ms (0.2s)
  const keyboardLift = useSharedValue(0);

  // **@** 0.2s Mix & Merge animation: expand width and smoothly fade in content
  useEffect(() => {
    // 1. Smoothly mix and merge search pill horizontally in exact 0.2s (200ms) with cubic ease
    expandProgress.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });

    // 2. Bring up the keyboard right as transition lands with near-zero latency
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, Platform.OS === "android" ? 50 : 25);

    return () => clearTimeout(timer);
  }, []);

  // **@** Keyboard tracking with native cubic easing
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      const h = e.endCoordinates ? e.endCoordinates.height : 0;
      // Target offset places the search pill 10px above keyboard
      const targetOffset = -Math.max(0, h + 10 - searchBottomOffset);
      const isAndroid = Platform.OS === "android";
      const dur = isAndroid ? 100 : (e.duration || 180);

      keyboardLift.value = withTiming(targetOffset, {
        duration: dur,
        easing: isAndroid ? Easing.out(Easing.quad) : Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      expandProgress.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    };

    const onHide = (e: any) => {
      const dur = Platform.OS === "ios" ? (e?.duration || 180) : 120;
      keyboardLift.value = withTiming(0, {
        duration: dur,
        easing: Easing.out(Easing.cubic),
      });
      // If query is empty, smoothly contract back to resting pill in 0.2s
      if (searchQuery.trim().length === 0) {
        expandProgress.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [insets.bottom, searchBottomOffset, searchQuery]);

  // **@** Animated pill style: expands width horizontally & lifts above keyboard
  const animatedPillStyle = useAnimatedStyle(() => {
    const pillWidth = interpolate(
      expandProgress.value,
      [0, 1],
      [RESTING_PILL_WIDTH, EXPANDED_PILL_WIDTH],
      Extrapolation.CLAMP
    );

    return {
      width: pillWidth,
      transform: [{ translateY: keyboardLift.value }],
    };
  });

  // **@** Page content smooth fade style for seamless 0.2s mix and merge transition
  const pageFadeStyle = useAnimatedStyle(() => {
    const pageOpacity = interpolate(
      expandProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: pageOpacity,
    };
  });

  const colors = useMemo(
    () => ({
      bg: themeColors?.background ?? (isDark ? "#000000" : "#F1F1F1"),
      card: themeColors?.card ?? (isDark ? "#161618" : "#FFFFFF"),
      cardBorder: "transparent",
      textPrimary: themeColors?.text ?? (isDark ? "#FFFFFF" : "#11141A"),
      textSecondary: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      sectionHeader: themeColors?.textSecondary ?? (isDark ? "#8E95A2" : "#7E8590"),
      searchPillBg: "#1C1C1E",
      iconBoxBg: isDark ? "#222226" : "#F3F4F6",
      greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
      chevron: isDark ? "#555860" : "#B4B9C2",
      divider: (themeColors as any)?.divider ?? (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"),
      chipActiveBg: isDark ? "#FFFFFF" : "#11141A",
      chipActiveText: isDark ? "#000000" : "#FFFFFF",
      chipInactiveBg: isDark ? "#1C1C1E" : "#E8EAEE",
      chipInactiveText: isDark ? "#8E95A2" : "#6B7280",
    }),
    [themeColors, isDark]
  );

  const tr = useCallback(
    (key: string, fallback?: string) => {
      try {
        const res = t(key);
        if (res && res !== key) return res;
      } catch (e) {}
      return fallback || key;
    },
    [t]
  );

  const selectedLanguage = useMemo(() => {
    switch (language) {
      case "en":
        return "English";
      case "es":
        return "Español";
      case "fr":
        return "Français";
      case "hi":
        return "हिन्दी";
      case "de":
        return "Deutsch";
      case "it":
        return "Italiano";
      case "pt":
        return "Português";
      case "ja":
        return "日本語";
      case "ko":
        return "한국어";
      case "zh":
        return "中文";
      default:
        return "English";
    }
  }, [language]);

  const allSettings: SearchItem[] = useMemo(
    () => [
      // ACCOUNT
      {
        id: "account-security",
        category: "ACCOUNT",
        title: tr("Account & Security"),
        subtitle: tr("Password, Two-factor auth, session logs"),
        keywords: ["account", "security", "password", "two factor", "2fa", "session", "login", "auth"],
        icon: "shield-checkmark-outline",
        route: "/settings/accounts",
      },
      {
        id: "privacy-data",
        category: "ACCOUNT",
        title: tr("Privacy & Data"),
        subtitle: tr("Profile visibility, location logs"),
        keywords: ["privacy", "data", "visibility", "tracking", "location", "logs"],
        icon: "lock-closed-outline",
        route: "/settings/privacy",
      },
      {
        id: "linked-devices",
        category: "ACCOUNT",
        title: tr("Linked Devices"),
        subtitle: tr("Active sessions, phones & computers"),
        keywords: ["linked devices", "devices", "sessions", "login", "phone", "laptop", "computer", "active sessions"],
        icon: "devices",
        iconFamily: "material",
        route: "/settings/linked-devices",
      },

      // APP SETTINGS
      {
        id: "appearance",
        category: "APP SETTINGS",
        title: tr("Appearance"),
        subtitle: tr("Theme color, dark mode & light mode"),
        keywords: ["appearance", "theme", "dark mode", "light mode", "color", "display"],
        rightText:
          themeMode === "system"
            ? tr("System (Auto)")
            : themeMode === "dark"
            ? tr("Dark Mode")
            : tr("Light Mode"),
        icon: "color-filter-outline",
        route: "/settings/appearance",
      },
      {
        id: "language-region",
        category: "APP SETTINGS",
        title: tr("Language & Region"),
        subtitle: `${selectedLanguage}, ${tr("locale formats")}`,
        keywords: ["language", "region", "country", "english", "locale", "timezone", "hindi", "date", "time"],
        rightText: selectedLanguage,
        icon: "globe-outline",
        route: "/settings/language-region",
      },
      {
        id: "accessibility",
        category: "APP SETTINGS",
        title: tr("Accessibility"),
        subtitle: tr("High contrast, motion, touch targets & color blind filters"),
        keywords: ["accessibility", "font", "contrast", "size", "zoom", "reader", "haptic", "motion", "color blind", "vision"],
        icon: "accessibility-outline",
        route: "/settings/accessibility",
      },
      {
        id: "chats",
        category: "APP SETTINGS",
        title: tr("Chats"),
        subtitle: tr("Theme, Wallpapers, and Chat Settings"),
        keywords: ["chats", "chat", "messages", "wallpaper", "chat theme", "bubbles"],
        icon: "chatbubble-ellipses-outline",
        route: "/settings/chat-settings",
      },
      {
        id: "ai-features",
        category: "APP SETTINGS",
        title: tr("AI Features"),
        subtitle: tr("Configure Groq API Key & AI settings"),
        keywords: ["ai", "groq", "artificial intelligence", "api key", "bot", "assistant", "model", "smart"],
        icon: "sparkles",
        route: "/settings/ai-settings",
      },

      // TRIP EXPERIENCE
      {
        id: "notifications",
        category: "TRIP EXPERIENCE",
        title: tr("Notifications"),
        subtitle: tr("Trip updates, chat pings, alerts"),
        keywords: ["notifications", "alerts", "ping", "updates", "trip notification", "messages"],
        icon: "notifications-outline",
        route: "/settings/notification",
      },
      {
        id: "trip-preferences",
        category: "TRIP EXPERIENCE",
        title: tr("Trip Preferences"),
        subtitle: tr("Dietary rules, accommodation styles, travel pace"),
        keywords: ["preferences", "diet", "food", "accommodation", "hotel", "travel pace", "style"],
        icon: "compass-outline",
        route: "/settings/trip-preference",
      },
      {
        id: "currency-expenses",
        category: "TRIP EXPERIENCE",
        title: tr("Currency & Expenses"),
        subtitle: tr("Default Split bills, home currency USD"),
        keywords: ["currency", "expenses", "split", "bills", "money", "budget", "cost", "dollar", "usd"],
        icon: "cash-outline",
        route: "/settings/currency-expenses",
      },
      {
        id: "offline-downloads",
        category: "TRIP EXPERIENCE",
        title: tr("Offline & Downloads"),
        subtitle: tr("Storage management, offline maps"),
        keywords: ["offline", "downloads", "storage", "cache", "offline maps", "data saving"],
        icon: "cloud-download-outline",
        route: "/settings/offline-downloads",
      },
      {
        id: "maps-navigation",
        category: "TRIP EXPERIENCE",
        title: tr("Maps & Navigation"),
        subtitle: tr("Offline cache, route preferences"),
        keywords: ["maps", "navigation", "routes", "directions", "gps", "travel route"],
        icon: "location-outline",
        route: "/settings/maps-navigation",
      },
      {
        id: "weather-alerts",
        category: "TRIP EXPERIENCE",
        title: tr("Weather Alerts & AQI"),
        subtitle: tr("Local weather forecasts & rain warnings"),
        keywords: ["weather", "alerts", "aqi", "air quality", "rain", "temperature", "forecast"],
        icon: "partly-sunny-outline",
        route: "/settings/weather",
      },
      // SUPPORT
      {
        id: "help-support",
        category: "SUPPORT",
        title: tr("Help & Support"),
        subtitle: tr("Guides, FAQs, 24/7 BunkMates bot"),
        keywords: ["help", "support", "faq", "customer service", "guide", "problem", "ticket"],
        icon: "help-circle-outline",
        route: "/settings/help",
      },
      {
        id: "feedback",
        category: "SUPPORT",
        title: tr("Send Feedback"),
        subtitle: tr("Feature requests, report bugs"),
        keywords: ["feedback", "bug", "issue", "suggestion", "report", "feature request"],
        icon: "megaphone-outline",
        route: "/settings/feedback",
      },
      {
        id: "rate-app",
        category: "SUPPORT",
        title: tr("Rate BunkMates"),
        subtitle: tr("Show us some love on the store"),
        keywords: ["rate", "review", "google play", "store", "star", "feedback"],
        icon: "ribbon-outline",
        route: "/settings/feedback",
      },
      {
        id: "licenses",
        category: "SUPPORT",
        title: tr("Third-Party Licenses"),
        subtitle: tr("Open source software & dependencies"),
        keywords: ["license", "licenses", "open source", "attribution", "third party", "libraries"],
        icon: "document-text-outline",
        iconFamily: "ionicons",
        route: "/settings/licenses",
      },
      {
        id: "invite-friend",
        category: "SUPPORT",
        title: tr("Invite a Friend"),
        subtitle: tr("Share BunkMates with travel companions"),
        keywords: ["invite", "friend", "referral", "share", "refer"],
        icon: "person-add-outline",
        route: "/inviteFriend",
      },
      {
        id: "about-app",
        category: "SUPPORT",
        title: tr("About BunkMates"),
        subtitle: "Version 3.4.1 (Build 4108)",
        keywords: ["about", "version", "build", "info", "release", "bunkmates"],
        icon: "information-circle-outline",
        route: "/settings/about",
      },
      {
        id: "developer-tools",
        category: "DEVELOPER",
        title: tr("Developer Tools & Sandbox"),
        subtitle: tr("Access internal tools, sandboxes, and developer routes"),
        keywords: ["developer", "dev", "tools", "sandbox", "debug"],
        icon: "code-slash-outline",
        badge: "DEV",
        route: "/settings/developers",
      },
    ],
    [themeMode, selectedLanguage, tr]
  );

  const categories = ["ALL", "ACCOUNT", "APP SETTINGS", "TRIP EXPERIENCE", "SUPPORT"];

  // Filter settings based on query and category
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allSettings.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" || item.category === selectedCategory;

      if (!q) return matchesCategory;

      const titleMatch = item.title.toLowerCase().includes(q);
      const subMatch = item.subtitle.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      const keywordMatch = item.keywords.some((k) => k.toLowerCase().includes(q));

      return matchesCategory && (titleMatch || subMatch || catMatch || keywordMatch);
    });
  }, [searchQuery, selectedCategory, allSettings]);

  const handleNavigate = (route: string) => {
    Keyboard.dismiss();
    router.push(route as any);
  };

  const handlePillPress = () => {
    expandProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    searchInputRef.current?.focus();
  };

  const handleBack = () => {
    Keyboard.dismiss();
    expandProgress.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    setTimeout(() => {
      router.back();
    }, 40);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      <Stack.Screen
        options={{
          animation: "fade",
          animationDuration: 200,
        }}
      />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── MIX & MERGE PAGE CONTENT FADE (0.2s) ── */}
      <Animated.View style={[{ flex: 1 }, pageFadeStyle]}>
        {/* ── TOP HEADER (CLEAN BACK BUTTON & TITLE) ── */}
        <View style={styles.topHeader}>
          <Pressable
            onPress={handleBack}
          style={({ pressed }) => [
            styles.backBtn,
            {
              backgroundColor: isDark ? "rgba(22, 22, 22, 1)" : "rgba(230, 230, 230, 1)",
              boxShadow: isDark
                ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)"
                : "inset 0 1px 2px rgba(255, 255, 255, 0.86), 0 0px 0px rgba(0, 0, 0, 0.1)",
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tr("Go back")}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.topHeaderTitle, { color: colors.textPrimary }]}>
          {tr("Search Settings")}
        </Text>
      </View>

      {/* ── CATEGORY FILTER CHIPS ── */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const label = cat === "ALL" ? tr("All") : tr(cat);
            return (
              <Pressable
                key={cat}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? colors.chipActiveBg : colors.chipInactiveBg,
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.chipActiveText : colors.chipInactiveText,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── SETTINGS LIST & RESULTS ── */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: searchBottomOffset + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {filteredList.length > 0 ? (
          <View>
            <Text style={[styles.sectionHeading, { color: colors.sectionHeader }]}>
              {searchQuery.trim().length > 0
                ? `${tr("MATCHING SETTINGS").toUpperCase()} (${filteredList.length})`
                : tr("SUGGESTED SETTINGS").toUpperCase()}
            </Text>

            {/* Results Card matching Screenshot 1 */}
            <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
              {filteredList.map((item, idx) => {
                const isLast = idx === filteredList.length - 1;
                return (
                  <View key={item.id}>
                    <Pressable
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      onPress={() => handleNavigate(item.route)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      {/* Circular Icon Container */}
                      <View style={[styles.iconBox, { backgroundColor: colors.iconBoxBg }]}>
                        {item.iconFamily === "material" ? (
                          <MaterialIcons name={item.icon as any} size={20} color={colors.greyishWhite} />
                        ) : item.iconFamily === "feather" ? (
                          <Feather name={item.icon as any} size={19} color={colors.greyishWhite} />
                        ) : (
                          <Ionicons name={item.icon as any} size={20} color={colors.greyishWhite} />
                        )}
                      </View>

                      {/* Row Content */}
                      <View style={styles.rowContent}>
                        <View style={styles.rowTextGroup}>
                          <View style={styles.rowTitleWrap}>
                            <Text
                              style={[styles.rowTitle, { color: colors.textPrimary }]}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            {item.category && (
                              <View
                                style={[
                                  styles.categoryBadge,
                                  {
                                    backgroundColor: isDark
                                      ? "rgba(255, 255, 255, 0.08)"
                                      : "rgba(0, 0, 0, 0.05)",
                                  },
                                ]}
                              >
                                <Text style={[styles.categoryBadgeText, { color: colors.textSecondary }]}>
                                  {item.category}
                                </Text>
                              </View>
                            )}
                            {item.badge && (
                              <View style={styles.devBadge}>
                                <Text style={styles.devBadgeText}>{item.badge}</Text>
                              </View>
                            )}
                          </View>

                          {item.subtitle ? (
                            <Text
                              style={[styles.rowSubtitle, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.rowRightGroup}>
                          {item.rightText ? (
                            <Text style={[styles.rowRightText, { color: colors.textSecondary }]}>
                              {item.rightText}
                            </Text>
                          ) : null}
                          <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
                        </View>
                      </View>
                    </Pressable>

                    {!isLast && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          /* Empty Search Results matching Screenshot 2 */
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="search-outline" size={34} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {tr("No Results for")} &ldquo;{searchQuery}&rdquo;
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {tr("Check the spelling or try a new search.")}
            </Text>
            <Pressable
              style={[
                styles.emptyClearBtn,
                { backgroundColor: isDark ? "#2C2C30" : "#E5E7EB" },
              ]}
              onPress={() => setSearchQuery("")}
            >
              <Text style={[styles.emptyClearBtnText, { color: colors.textPrimary }]}>
                {tr("Clear Search")}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      </Animated.View>

      {/* ── BOTTOM DISSOLVE GRADIENT MASK ── */}
      <SettingsHeaderGradientMask
        position="bottom"
        backgroundColor={colors.bg}
        height={searchBottomOffset + 50}
        zIndex={20}
      />

      {/* ── FLOATING BOTTOM EXPANDING SEARCH BAR (EXACT MATCH OF USER SCREENSHOT) ── */}
      <View
        style={[
          styles.modernBottomSearchWrapper,
          {
            bottom: searchBottomOffset,
          },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.animatedPillContainer, animatedPillStyle]}>
          <Pressable
            style={styles.pillPressable}
            onPress={handlePillPress}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color="#A1A1AA"
              style={{ marginRight: 8, marginLeft: 2 }}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.modernBottomSearchInput}
              placeholder={tr("Search settings...")}
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setIsFocused(true);
                expandProgress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityRole="search"
              accessibilityLabel={tr("Search settings")}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={10}
                style={styles.clearBtn}
                accessibilityLabel={tr("Clear search")}
              >
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  topHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  chipsContainer: {
    paddingBottom: 8,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: {
    fontSize: 12.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: 6,
  },
  cardGroup: {
    borderRadius: 28,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center",
  },
  rowTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  devBadge: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 6,
  },
  devBadgeText: {
    color: "#00E6B0",
    fontSize: 9.5,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 16,
  },
  rowRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  rowRightText: {
    fontSize: 13,
    marginRight: 6,
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 28,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyClearBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyClearBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.75,
  },

  // ── FLOATING EXPANDING PILL AT THE BOTTOM ──
  modernBottomSearchWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  animatedPillContainer: {
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1C1C1E",
    boxShadow:
      "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0, 0, 0, 0.1)",
    borderWidth: 0,
    overflow: "hidden",
  },
  pillPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  modernBottomSearchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    fontWeight: "400",
    color: "#FFFFFF",
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  clearBtn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
