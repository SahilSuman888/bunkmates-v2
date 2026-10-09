// src/app/chat-settings.tsx
// Enterprise-Grade Chat Settings for Bunkmates
// Manages application-wide chat preferences: wallpaper, enter is send, read receipts,
// typing indicators, media auto-download, disappearing messages, and archive management.
// Redundant settings (Theme, Font Size) are removed and centralized in Appearance.

import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Image,
  Dimensions,
  Appearance,
  ScrollView,
  Switch,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useChatSettings,
  wallpaperList,
  WallpaperOption,
  DisappearingTimer,
} from "../contexts/ChatSettingsContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppSettings } from "../contexts/AppSettingsContext";
import { SettingsActionModal } from "../components/ui/SettingsActionModal";

const { width } = Dimensions.get("window");
const WALLPAPER_COLUMNS = 3;
const WALLPAPER_ITEM_SIZE = (width - 32 - 16) / WALLPAPER_COLUMNS;

const DISAPPEARING_OPTIONS: { id: DisappearingTimer; label: string; desc: string }[] = [
  { id: "off", label: "Off", desc: "Messages will never auto-delete" },
  { id: "24h", label: "24 Hours", desc: "Messages disappear 24 hours after being sent" },
  { id: "7d", label: "7 Days", desc: "Messages disappear 7 days after being sent" },
  { id: "30d", label: "30 Days", desc: "Messages disappear 30 days after being sent" },
  { id: "90d", label: "90 Days", desc: "Messages disappear 90 days after being sent" },
];

export default function ChatSettingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { triggerHaptic } = useAppSettings();

  const {
    wallpaper,
    enterIsSend,
    readReceipts,
    typingIndicator,
    autoDownloadMedia,
    saveToGallery,
    linkPreviews,
    disappearingTimer,
    keepArchived,
    setWallpaper,
    setEnterIsSend,
    setReadReceipts,
    setTypingIndicator,
    setAutoDownloadMedia,
    setSaveToGallery,
    setLinkPreviews,
    setDisappearingTimer,
    setKeepArchived,
    clearAllChats,
    deleteAllChats,
    resetChatPreferences,
  } = useChatSettings();

  // Modals
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Floating Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToastMessage(null));
  }, [toastOpacity]);

  // Theme resolution
  let themeMode: "dark" | "light" | "system" = "system";
  let activeAccent = "#FF5A5F";
  try {
    const themeContext = useThemeToggle();
    if (themeContext?.mode) themeMode = themeContext.mode;
    if (themeContext?.accentColor) activeAccent = themeContext.accentColor;
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(() => ({
    bg: isDark ? "#000000" : "#F1F1F1",
    card: isDark ? "#161618" : "#FFFFFF",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#8E95A2" : "#7E8590",
    sectionHeader: isDark ? "#8E95A2" : "#7E8590",
    greyishWhite: isDark ? "#E2E8F0" : "#4B5563",
    iconBoxBg: isDark ? "#202024" : "#F4F5F7",
    chevron: isDark ? "#555860" : "#B4B9C2",
    insetBg: isDark ? "#202024" : "#F4F5F7",
    modalOverlay: "rgba(0, 0, 0, 0.65)",
    switchActive: activeAccent || (isDark ? "#34C759" : "#10B981"),
    switchInactive: isDark ? "#2A2D36" : "#E5E7EB",
    activeRowBg: isDark ? "#202024" : "#F4F5F7",
    toastBg: isDark ? "#1F2937" : "#111827",
    toastText: "#F9FAFB",
    destructive: "#FF5A5F",
    destructiveBg: isDark ? "rgba(255, 90, 95, 0.12)" : "#FFF1F0",
  }), [isDark, activeAccent]);

  const activeWallpaperItem = useMemo(() => {
    return wallpaperList.find((w) => w.id === wallpaper) || wallpaperList[0];
  }, [wallpaper]);

  const activeDisappearingLabel = useMemo(() => {
    return DISAPPEARING_OPTIONS.find((o) => o.id === disappearingTimer)?.label || "Off";
  }, [disappearingTimer]);

  // Handlers
  const handleToggleEnterIsSend = (val: boolean) => {
    setEnterIsSend(val);
    triggerToast(val ? "Enter key sends messages" : "Enter key inserts new line");
    triggerHaptic("selection");
  };

  const handleToggleReadReceipts = (val: boolean) => {
    setReadReceipts(val);
    triggerToast(val ? "Read receipts enabled" : "Read receipts disabled");
    triggerHaptic("selection");
  };

  const handleToggleTypingIndicator = (val: boolean) => {
    setTypingIndicator(val);
    triggerToast(val ? "Typing indicator enabled" : "Typing indicator disabled");
    triggerHaptic("selection");
  };

  const handleToggleAutoDownload = (val: boolean) => {
    setAutoDownloadMedia(val);
    triggerToast(val ? "Auto-download media on" : "Auto-download media off");
    triggerHaptic("selection");
  };

  const handleToggleSaveToGallery = (val: boolean) => {
    setSaveToGallery(val);
    triggerToast(val ? "Save to gallery enabled" : "Save to gallery disabled");
    triggerHaptic("selection");
  };

  const handleToggleLinkPreviews = (val: boolean) => {
    setLinkPreviews(val);
    triggerToast(val ? "Link previews enabled" : "Link previews disabled");
    triggerHaptic("selection");
  };

  const handleToggleKeepArchived = (val: boolean) => {
    setKeepArchived(val);
    triggerToast(val ? "Chats stay archived on new message" : "Archived chats unarchive on new message");
    triggerHaptic("selection");
  };

  const handleSelectWallpaper = (item: WallpaperOption) => {
    setWallpaper(item.id);
    setShowWallpaperModal(false);
    triggerToast(`Wallpaper set to ${item.name}`);
    triggerHaptic("success");
  };

  const handleSelectDisappearing = (opt: typeof DISAPPEARING_OPTIONS[0]) => {
    setDisappearingTimer(opt.id);
    setShowDisappearingModal(false);
    triggerToast(`Disappearing timer set to ${opt.label}`);
    triggerHaptic("success");
  };

  const handleConfirmClearChats = async () => {
    await clearAllChats();
    setShowClearModal(false);
    triggerToast("All chat messages cleared");
    triggerHaptic("warning");
  };

  const handleConfirmDeleteChats = async () => {
    await deleteAllChats();
    setShowDeleteModal(false);
    triggerToast("All chats permanently deleted");
    triggerHaptic("warning");
  };

  const handleConfirmReset = async () => {
    await resetChatPreferences();
    setShowResetModal(false);
    triggerToast("Chat settings reset to default");
    triggerHaptic("warning");
  };

  const renderWallpaperCell = ({ item }: { item: WallpaperOption }) => {
    const isSelected = wallpaper === item.id;
    return (
      <Pressable
        style={styles.wallpaperCell}
        onPress={() => handleSelectWallpaper(item)}
        accessible={true}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${item.name} wallpaper`}
      >
        {item.id === "default" ? (
          <View style={[styles.wallpaperImage, { backgroundColor: colors.insetBg, justifyContent: "center", alignItems: "center" }]}>
            <Ionicons name="sparkles-outline" size={24} color={colors.textPrimary} />
            <Text style={[styles.defaultWpText, { color: colors.textPrimary }]}>Default</Text>
          </View>
        ) : (
          <Image
            source={{ uri: `${item.uri}?w=260&h=380&fit=crop` }}
            style={styles.wallpaperImage}
          />
        )}
        <View style={styles.wallpaperCellLabelWrap}>
          <Text style={[styles.wallpaperCellLabel, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.selectedWallpaperBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top"]}>
      {/* Floating Action Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBox,
            { backgroundColor: colors.toastBg, opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={17} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: colors.toastText }]}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.card },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t("Chat Settings")}</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ========================================================
            1. CHAT DISPLAY & WALLPAPER
        ========================================================= */}
        <Text style={[styles.sectionTitle, { color: colors.sectionHeader }]}>
          {t("CHAT DISPLAY & WALLPAPER", "CHAT DISPLAY & WALLPAPER")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* Chat Wallpaper Row */}
          <Pressable
            style={styles.settingItem}
            onPress={() => setShowWallpaperModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Chat Wallpaper, currently ${activeWallpaperItem.name}`}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="image-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Chat Wallpaper")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {activeWallpaperItem.name}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              {wallpaper !== "default" && (
                <Image
                  source={{ uri: `${activeWallpaperItem.uri}?w=80&h=80&fit=crop` }}
                  style={styles.wallpaperMiniThumb}
                />
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Enter is Send */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="return-down-forward-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Enter is Send")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Enter key on keyboard will send message")}
              </Text>
            </View>
            <Switch
              value={enterIsSend}
              onValueChange={handleToggleEnterIsSend}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Link Previews */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="link-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Link Previews")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Show rich preview cards for web links")}
              </Text>
            </View>
            <Switch
              value={linkPreviews}
              onValueChange={handleToggleLinkPreviews}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ========================================================
            2. PRIVACY & RECEIPTS
        ========================================================= */}
        <Text style={[styles.sectionTitle, { color: colors.sectionHeader, marginTop: 24 }]}>
          {t("PRIVACY & RECEIPTS", "PRIVACY & RECEIPTS")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* Read Receipts */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="checkmark-done-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Read Receipts")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Show double checkmarks when messages are seen")}
              </Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={handleToggleReadReceipts}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Typing Indicator */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Typing Indicator")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Share typing status while composing a message")}
              </Text>
            </View>
            <Switch
              value={typingIndicator}
              onValueChange={handleToggleTypingIndicator}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Disappearing Messages */}
          <Pressable
            style={styles.settingItem}
            onPress={() => setShowDisappearingModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Disappearing messages timer, currently ${activeDisappearingLabel}`}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="timer-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Disappearing Messages")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Default auto-delete timer for conversations")}
              </Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                {activeDisappearingLabel}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            3. MEDIA AUTO-DOWNLOAD
        ========================================================= */}
        <Text style={[styles.sectionTitle, { color: colors.sectionHeader, marginTop: 24 }]}>
          {t("MEDIA AUTO-DOWNLOAD", "MEDIA AUTO-DOWNLOAD")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* Auto Download Media */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Auto-Download Media")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Automatically download photos and audio")}
              </Text>
            </View>
            <Switch
              value={autoDownloadMedia}
              onValueChange={handleToggleAutoDownload}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Save to Gallery */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="albums-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Save to Gallery")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Save incoming photos and videos to device gallery")}
              </Text>
            </View>
            <Switch
              value={saveToGallery}
              onValueChange={handleToggleSaveToGallery}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ========================================================
            4. CHAT STORAGE & MANAGEMENT
        ========================================================= */}
        <Text style={[styles.sectionTitle, { color: colors.sectionHeader, marginTop: 24 }]}>
          {t("CHATS & STORAGE MANAGEMENT", "CHATS & STORAGE MANAGEMENT")}
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: colors.card }]}>
          {/* Keep Chats Archived */}
          <View style={styles.settingItem}>
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="archive-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Keep Chats Archived")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Archived chats remain hidden when a new message arrives")}
              </Text>
            </View>
            <Switch
              value={keepArchived}
              onValueChange={handleToggleKeepArchived}
              trackColor={{ false: colors.switchInactive, true: colors.switchActive }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Clear All Messages */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && { opacity: 0.7 }]}
            onPress={() => setShowClearModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear all chat messages"
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <MaterialCommunityIcons name="broom" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Clear all messages")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Deletes message history while keeping conversation threads")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Delete All Chats */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && { opacity: 0.7 }]}
            onPress={() => setShowDeleteModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Delete all chats permanently"
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.destructiveBg }]}>
              <Ionicons name="trash-outline" size={20} color={colors.destructive} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.destructive }]}>{t("Delete all chats")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Permanently wipe all conversations and attachments")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.insetBg }]} />

          {/* Reset Chat Settings */}
          <Pressable
            style={({ pressed }) => [styles.settingItem, pressed && { opacity: 0.7 }]}
            onPress={() => setShowResetModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reset chat preferences to default"
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.iconBoxBg }]}>
              <Ionicons name="refresh-outline" size={20} color={colors.greyishWhite} />
            </View>
            <View style={styles.settingText}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t("Reset Chat Settings")}</Text>
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
                {t("Restore standard chat configurations")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================================
          MODAL: WALLPAPER PICKER
      ========================================================= */}
      <Modal
        transparent
        visible={showWallpaperModal}
        animationType="slide"
        onRequestClose={() => setShowWallpaperModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowWallpaperModal(false)}
          />
          <View style={[styles.wallpaperModalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.modalSheetTitle, { color: colors.textPrimary }]}>
                {t("Choose Chat Wallpaper")}
              </Text>
              <Pressable
                onPress={() => setShowWallpaperModal(false)}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <FlatList
              data={wallpaperList}
              keyExtractor={(item) => item.id}
              renderItem={renderWallpaperCell}
              numColumns={WALLPAPER_COLUMNS}
              contentContainerStyle={styles.wallpaperGrid}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL: DISAPPEARING MESSAGES TIMER PICKER
      ========================================================= */}
      <Modal
        transparent
        visible={showDisappearingModal}
        animationType="slide"
        onRequestClose={() => setShowDisappearingModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowDisappearingModal(false)}
          />
          <View style={[styles.bottomSheetModal, { backgroundColor: colors.card }]}>
            <View style={[styles.handle, { backgroundColor: colors.chevron }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.modalSheetTitle, { color: colors.textPrimary }]}>
                {t("Disappearing Messages")}
              </Text>
              <Pressable
                onPress={() => setShowDisappearingModal(false)}
                hitSlop={8}
                style={({ pressed }) => pressed && { opacity: 0.6 }}
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={[styles.modalSheetSubtitle, { color: colors.textSecondary }]}>
              {t("When turned on, new messages sent in chats will automatically disappear after the selected duration.")}
            </Text>

            <View style={{ marginTop: 12 }}>
              {DISAPPEARING_OPTIONS.map((opt) => {
                const isSelected = disappearingTimer === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [
                      styles.modalOptionRow,
                      isSelected && { backgroundColor: colors.insetBg },
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() => handleSelectDisappearing(opt)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionTitle, { color: colors.textPrimary, fontWeight: isSelected ? "700" : "500" }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.modalOptionSubtitle, { color: colors.textSecondary }]}>
                        {opt.desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* 1. Clear All Messages Modal */}
      <SettingsActionModal
        visible={showClearModal}
        onClose={() => setShowClearModal(false)}
        iconType="trash"
        title={t("Clear All Messages?")}
        message={t("This will delete message contents across all chats. Conversation threads will remain in your chat list.")}
        confirmLabel={t("Clear Messages")}
        cancelLabel={t("Cancel")}
        confirmColor={colors.destructive}
        onConfirm={async () => {
          await clearAllChats();
          triggerToast("All chat messages cleared");
          triggerHaptic("warning");
        }}
        successTitle={t("Messages Cleared")}
        successMessage={t("All conversation message histories have been cleared successfully.")}
      />

      {/* 2. Delete All Chats Modal */}
      <SettingsActionModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        iconType="danger"
        title={t("Delete All Chats?")}
        message={t("This action is permanent and cannot be undone. All conversations, voice notes, and shared attachments will be permanently removed.")}
        confirmLabel={t("Delete Everything")}
        cancelLabel={t("Cancel")}
        confirmColor={colors.destructive}
        onConfirm={async () => {
          await deleteAllChats();
          triggerToast("All chats permanently deleted");
          triggerHaptic("warning");
        }}
        successTitle={t("All Chats Deleted")}
        successMessage={t("All chat conversations and attachments have been permanently deleted.")}
      />

      {/* 3. Reset Chat Settings Modal */}
      <SettingsActionModal
        visible={showResetModal}
        onClose={() => setShowResetModal(false)}
        iconType="warning"
        title={t("Reset Chat Settings?")}
        message={t("This will restore default wallpaper, enable read receipts, enable typing indicators, and reset disappearing message timers.")}
        confirmLabel={t("Reset Defaults")}
        cancelLabel={t("Cancel")}
        confirmColor={colors.switchActive}
        onConfirm={async () => {
          await resetChatPreferences();
          triggerToast("Chat settings reset to default");
          triggerHaptic("warning");
        }}
        successTitle={t("Settings Restored")}
        successMessage={t("Chat configurations have been reset to default values.")}
      />
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
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6,
    textTransform: "uppercase",
  },
  cardGroup: {
    borderRadius: 24,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingText: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  valueText: {
    fontSize: 14,
    fontWeight: "500",
  },
  wallpaperMiniThumb: {
    width: 26,
    height: 26,
    borderRadius: 6,
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
  bottomSheetModal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  wallpaperModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    maxHeight: "82%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  wallpaperGrid: {
    paddingVertical: 12,
  },
  wallpaperCell: {
    width: WALLPAPER_ITEM_SIZE,
    margin: 4,
    borderRadius: 16,
    overflow: "hidden",
  },
  wallpaperImage: {
    width: "100%",
    height: WALLPAPER_ITEM_SIZE * 1.35,
    borderRadius: 16,
  },
  defaultWpText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  wallpaperCellLabelWrap: {
    paddingVertical: 6,
    alignItems: "center",
  },
  wallpaperCellLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  selectedWallpaperBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
  },
  modalOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  modalOptionTitle: {
    fontSize: 15,
  },
  modalOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmCard: {
    marginHorizontal: 24,
    marginBottom: "auto",
    marginTop: "auto",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
  },
  confirmIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmBtnSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
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
