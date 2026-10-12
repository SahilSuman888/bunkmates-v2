import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ImageBackground,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView,
  PanResponder,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { BlurView } from "../ui/AppBlurView";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  wallpaperList,
  DEFAULT_WALLPAPER_ASSET,
  getWallpaperSource,
} from "../../contexts/ChatSettingsContext";

export const THEME_COLOR_PRESETS = [
  { id: "mint", color: "#00e6b0", label: "Mint Glow" },
  { id: "purple", color: "#5b47d6", label: "Royal Indigo" },
  { id: "violet", color: "#8b5cf6", label: "Neon Violet" },
  { id: "ocean", color: "#2563eb", label: "Electric Ocean" },
  { id: "sky", color: "#0284c7", label: "Sky Blue" },
  { id: "teal", color: "#0d9488", label: "Deep Teal" },
  { id: "emerald", color: "#10b981", label: "Emerald" },
  { id: "coral", color: "#f43f5e", label: "Sunset Coral" },
  { id: "amber", color: "#f59e0b", label: "Amber Sun" },
  { id: "magenta", color: "#d946ef", label: "Cyber Magenta" },
  { id: "rose", color: "#ec4899", label: "Neon Rose" },
  { id: "slate", color: "#334155", label: "Obsidian Slate" },
];

export interface WallpaperThemePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  friendName: string;
  initialWallpaperUri: string | null;
  onApply: (wallpaperUri: string | null, bubbleColor: string, dimLevel: number) => void;
  inline?: boolean;
}

const SLIDER_MAX_DIM = 0.80;

export default function WallpaperThemePreviewModal({
  visible,
  onClose,
  chatId,
  friendName,
  initialWallpaperUri,
  onApply,
  inline = false,
}: WallpaperThemePreviewModalProps) {
  const insets = useSafeAreaInsets();

  // Filter available preset wallpapers
  const presets = wallpaperList.filter((w) => w.id !== "default");

  const [currentWallpaperUri, setCurrentWallpaperUri] = useState<string>(
    initialWallpaperUri || presets[0]?.uri || "local:chatbg:1"
  );
  const [selectedBubbleColor, setSelectedBubbleColor] = useState<string>("#2563eb");
  const [dimLevel, setDimLevel] = useState<number>(0.10); // 0.0 (100% bright) to 0.80 (20% bright)
  const [brightnessPercent, setBrightnessPercent] = useState<number>(88);
  const [fallbackToDefault, setFallbackToDefault] = useState<boolean>(false);

  // Load existing stored preferences on open
  useEffect(() => {
    if (!visible) return;

    setFallbackToDefault(false);
    if (initialWallpaperUri) {
      setCurrentWallpaperUri(initialWallpaperUri);
    } else {
      setCurrentWallpaperUri(presets[0]?.uri || "local:chatbg:1");
    }

    if (chatId) {
      AsyncStorage.getItem(`@bunkmates_custom_chat_bubble_color_${chatId}`).then((c) => {
        if (c) setSelectedBubbleColor(c);
        else setSelectedBubbleColor("#2563eb");
      });

      AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_dim_${chatId}`).then((d) => {
        if (d !== null && d !== undefined) {
          const parsed = parseFloat(d);
          const validDim = isNaN(parsed) ? 0.10 : parsed;
          setDimLevel(validDim);
          setBrightnessPercent(Math.max(20, Math.min(100, Math.round((1 - validDim / SLIDER_MAX_DIM) * 100))));
        } else {
          setDimLevel(0.10);
          setBrightnessPercent(88);
        }
      });
    }
  }, [visible, chatId, initialWallpaperUri]);

  // Gallery Picker directly in this modal
  const handlePickFromGalleryInModal = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Required", "Please allow photo access to select custom chat wallpaper.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const pickedUri = result.assets[0].uri;
        setFallbackToDefault(false);
        setCurrentWallpaperUri(pickedUri);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      }
    } catch (e) {
      console.error("Error picking photo from gallery:", e);
    }
  };

  // Slider change handler
  const handleSliderChange = (val: number) => {
    const rounded = Math.round(val);
    setBrightnessPercent(rounded);
    const newDim = Number(((100 - rounded) / 100 * SLIDER_MAX_DIM).toFixed(2));
    setDimLevel(newDim);
  };

  const handleMoonPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setBrightnessPercent(40);
    const newDim = Number(((100 - 40) / 100 * SLIDER_MAX_DIM).toFixed(2));
    setDimLevel(newDim);
  };

  const handleSunPress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setBrightnessPercent(100);
    setDimLevel(0.0);
  };

  // Horizontal Swipe PanResponder on chat preview area to switch wallpapers
  const chatSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 40;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          switchPresetRelative(1);
        } else if (gestureState.dx > 50) {
          switchPresetRelative(-1);
        }
      },
    })
  ).current;

  const switchPresetRelative = (direction: number) => {
    if (presets.length === 0) return;
    const currentIdx = presets.findIndex(
      (p) => p.uri === currentWallpaperUri || p.id === currentWallpaperUri
    );
    let nextIdx = (currentIdx + direction) % presets.length;
    if (nextIdx < 0) nextIdx = presets.length - 1;
    handleSelectPreset(presets[nextIdx].uri);
  };

  const handleSelectPreset = (uriOrId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setFallbackToDefault(false);
    setCurrentWallpaperUri(uriOrId);
  };

  // Confirm and save locally
  const handleConfirmAndApply = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    if (chatId) {
      if (currentWallpaperUri && currentWallpaperUri !== "default") {
        await AsyncStorage.setItem(`@bunkmates_custom_chat_wallpaper_${chatId}`, currentWallpaperUri);
      } else {
        await AsyncStorage.removeItem(`@bunkmates_custom_chat_wallpaper_${chatId}`);
      }

      await AsyncStorage.setItem(`@bunkmates_custom_chat_bubble_color_${chatId}`, selectedBubbleColor);
      await AsyncStorage.setItem(`@bunkmates_custom_chat_wallpaper_dim_${chatId}`, String(dimLevel));
    }

    onApply(currentWallpaperUri, selectedBubbleColor, dimLevel);
    onClose();
  };

  if (!visible) return null;

  const topPad = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : Math.max(insets.top, 20) + 10;
  const bgSource = fallbackToDefault
    ? DEFAULT_WALLPAPER_ASSET
    : getWallpaperSource(currentWallpaperUri);

  const isGallerySelected =
    currentWallpaperUri?.startsWith("file:") ||
    currentWallpaperUri?.startsWith("content:") ||
    currentWallpaperUri?.startsWith("data:");

  const renderContent = () => (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* ── BACKGROUND IMAGE (Always behind via ImageBackground) ── */}
      <ImageBackground
        source={bgSource}
        style={styles.bgImageFull}
        resizeMode="cover"
        onError={() => setFallbackToDefault(true)}
      >
        {/* Dynamic Brightness / Dimming Layer (Updates in Real-Time!) */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: "#000000",
              opacity: dimLevel,
            },
          ]}
          pointerEvents="none"
        />

        {/* ── FOREGROUND CONTENT (Normal Flex Column, Always Visible!) ── */}
        <View style={styles.foregroundLayout}>
          {/* ── 1. TOP NAVIGATION BAR ── */}
          <View style={[styles.topNavWrap, { paddingTop: topPad }]}>
            {Platform.OS === "ios" && (
              <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            )}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(13, 17, 26, 0.96)" }]} pointerEvents="none" />

            <View style={styles.topNavInner}>
              {/* Back Button */}
              <Pressable style={styles.navBackBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color="#ffffff" />
              </Pressable>

              {/* Header Title Info */}
              <View style={styles.navTitleCol}>
                <View style={styles.navTitleRow}>
                  <Ionicons name="sparkles" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.navMainTitle}>Customize Chat</Text>
                </View>
                <Text style={styles.navSubTitle} numberOfLines={1}>
                  Theme & Wallpaper for {friendName}
                </Text>
              </View>

              {/* High-Contrast White Save Button (Unmissable!) */}
              <Pressable
                style={styles.topSavePill}
                onPress={handleConfirmAndApply}
                hitSlop={12}
              >
                <Ionicons name="checkmark" size={17} color="#000000" />
                <Text style={styles.topSavePillText}>Save</Text>
              </Pressable>
            </View>
          </View>

          {/* ── 2. LIVE INTERACTIVE CHAT PREVIEW CANVAS ── */}
          <View style={styles.chatPreviewArea} {...chatSwipeResponder.panHandlers}>
            {/* Travel Date Pill */}
            <View style={styles.datePill}>
              <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.9)" style={{ marginRight: 5 }} />
              <Text style={styles.datePillText}>Trip Chat Preview</Text>
            </View>

            {/* Incoming Message (From Friend) */}
            <View style={styles.incomingBubbleWrap}>
              <View style={styles.incomingBubble}>
                <Text style={styles.incomingBubbleText}>
                  Pack your bags! Heading to the mountains this weekend 🏔️🎒
                </Text>
                <View style={styles.bubbleMetaRow}>
                  <Text style={styles.incomingTimestamp}>10:42 AM</Text>
                </View>
              </View>
            </View>

            {/* Outgoing Message (In User's Selected Bubble Color Live!) */}
            <View style={styles.outgoingBubbleWrap}>
              <View style={[styles.outgoingBubble, { backgroundColor: selectedBubbleColor }]}>
                <Text style={styles.outgoingBubbleText}>
                  All set! This new theme looks incredible on our chat 🔥✨
                </Text>
                <View style={styles.bubbleMetaRow}>
                  <Text style={styles.outgoingTimestamp}>10:43 AM</Text>
                  <Ionicons name="checkmark-done" size={13} color="#ffffff" style={{ marginLeft: 3 }} />
                </View>
              </View>
            </View>

            {/* Swipe Hint Pill */}
            <View style={styles.swipeHintBadge}>
              <Feather name="arrow-left" size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.swipeHintText}>Swipe preview to switch wallpapers</Text>
              <Feather name="arrow-right" size={11} color="rgba(255,255,255,0.7)" />
            </View>
          </View>

          {/* Spacer pushing control dock to bottom */}
          <View style={{ flex: 1 }} pointerEvents="none" />

          {/* ── 3. LUXURY CREATIVE STUDIO BOTTOM DOCK (Solid High-Contrast Card) ── */}
          <View style={[styles.controlDock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            {/* SECTION 1: WALLPAPER SELECTOR CAROUSEL (Presets + Gallery Button) */}
            <View style={styles.dockSectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Feather name="image" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.dockSectionTitle}>WALLPAPER</Text>
              </View>
              <Text style={styles.dockSectionHint}>Tap preset or gallery</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wallpaperScrollList}
            >
              {/* Gallery Upload Card as First Item */}
              <Pressable
                style={[
                  styles.wallpaperThumbCard,
                  styles.galleryUploadCard,
                  isGallerySelected && styles.wallpaperThumbCardSelected,
                ]}
                onPress={handlePickFromGalleryInModal}
              >
                <View style={styles.galleryCardInner}>
                  <Ionicons name="images-outline" size={20} color="#ffffff" />
                  <Text style={styles.galleryCardText}>Gallery</Text>
                </View>
                {isGallerySelected && (
                  <View style={styles.wallpaperActiveBadge}>
                    <Ionicons name="checkmark" size={12} color="#000000" />
                  </View>
                )}
              </Pressable>

              {/* Curated Presets */}
              {presets.map((item) => {
                const isSelected =
                  !isGallerySelected &&
                  (currentWallpaperUri === item.uri || currentWallpaperUri === item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.wallpaperThumbCard,
                      isSelected && styles.wallpaperThumbCardSelected,
                    ]}
                    onPress={() => handleSelectPreset(item.uri)}
                  >
                    <Image source={item.asset} style={styles.wallpaperThumbImg} />
                    {isSelected && (
                      <View style={styles.wallpaperActiveBadge}>
                        <Ionicons name="checkmark" size={12} color="#000000" />
                      </View>
                    )}
                    <View style={styles.wallpaperLabelOverlay}>
                      <Text style={styles.wallpaperLabelText} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* SECTION 2: BUBBLE ACCENT COLOR PALETTE */}
            <View style={[styles.dockSectionHeader, { marginTop: 10 }]}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="color-palette-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.dockSectionTitle}>BUBBLE COLOR</Text>
              </View>
              <View
                style={[styles.activeColorIndicator, { backgroundColor: selectedBubbleColor }]}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorPaletteScroll}
            >
              {THEME_COLOR_PRESETS.map((p) => {
                const isSelected = selectedBubbleColor.toLowerCase() === p.color.toLowerCase();
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.colorSwatchBtn,
                      { backgroundColor: p.color },
                      isSelected && styles.colorSwatchBtnSelected,
                    ]}
                    onPress={() => {
                      try {
                        Haptics.selectionAsync();
                      } catch (e) {}
                      setSelectedBubbleColor(p.color);
                    }}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* SECTION 3: BRIGHTNESS SLIDER (Real Hardware Accelerated Slider!) */}
            <View style={[styles.dockSectionHeader, { marginTop: 10 }]}>
              <View style={styles.sectionTitleRow}>
                <Feather name="sun" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.dockSectionTitle}>BRIGHTNESS</Text>
              </View>
              <View style={styles.brightnessValueBadge}>
                <Text style={styles.brightnessValueText}>{brightnessPercent}%</Text>
              </View>
            </View>

            <View style={styles.sliderControlRow}>
              {/* Low brightness / Moon Icon */}
              <Pressable
                style={styles.sliderIconBtn}
                onPress={handleMoonPress}
              >
                <Feather name="moon" size={15} color="#ffffff" />
              </Pressable>

              {/* Native Hardware-Accelerated Slider */}
              <Slider
                style={styles.nativeSlider}
                minimumValue={20}
                maximumValue={100}
                step={1}
                value={brightnessPercent}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="rgba(255, 255, 255, 0.22)"
                thumbTintColor="#ffffff"
                onValueChange={handleSliderChange}
              />

              {/* Full brightness / Sun Icon */}
              <Pressable
                style={styles.sliderIconBtn}
                onPress={handleSunPress}
              >
                <Ionicons name="sunny" size={17} color="#ffffff" />
              </Pressable>
            </View>

            {/* Primary Full-Width Save Button (High-Contrast White Pill) */}
            <Pressable
              style={styles.dockSaveFullBtn}
              onPress={handleConfirmAndApply}
            >
              <Ionicons name="checkmark-circle" size={19} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.dockSaveFullText}>Save Theme</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );

  if (inline) {
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 999999, elevation: 999999, width: "100%", height: "100%" }]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onClose}
    >
      {renderContent()}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#080b11",
  },
  bgImageFull: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  foregroundLayout: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "space-between",
  },
  topNavWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
    elevation: 25,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
  },
  topNavInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitleCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  navTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  navMainTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  navSubTitle: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11.5,
    marginTop: 1,
  },
  topSavePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  topSavePillText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 3,
  },
  chatPreviewArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  datePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(10, 14, 22, 0.80)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  datePillText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
  incomingBubbleWrap: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    marginBottom: 10,
  },
  incomingBubble: {
    backgroundColor: "rgba(20, 26, 38, 0.95)",
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  incomingBubbleText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
  },
  outgoingBubbleWrap: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    marginBottom: 10,
  },
  outgoingBubble: {
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  outgoingBubbleText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  bubbleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 3,
  },
  incomingTimestamp: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10.5,
  },
  outgoingTimestamp: {
    color: "rgba(255, 255, 255, 0.90)",
    fontSize: 10.5,
  },
  swipeHintBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(10, 14, 22, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginTop: 4,
  },
  swipeHintText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  controlDock: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    backgroundColor: "#0d111a", // SOLID DARK HIGH-CONTRAST CARD! Never washed out!
    paddingTop: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 25,
  },
  dockSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dockSectionTitle: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  dockSectionHint: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10.5,
  },
  wallpaperScrollList: {
    gap: 10,
    paddingRight: 10,
    paddingBottom: 2,
  },
  galleryUploadCard: {
    backgroundColor: "rgba(28, 36, 50, 0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryCardInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  galleryCardText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  wallpaperThumbCard: {
    width: 58,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.18)",
    position: "relative",
  },
  wallpaperThumbCardSelected: {
    borderColor: "#ffffff",
    borderWidth: 2.5,
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  wallpaperThumbImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  wallpaperActiveBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  wallpaperLabelOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.80)",
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  wallpaperLabelText: {
    color: "#ffffff",
    fontSize: 9,
    textAlign: "center",
    fontWeight: "600",
  },
  activeColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  colorPaletteScroll: {
    gap: 10,
    paddingRight: 10,
    paddingVertical: 2,
  },
  colorSwatchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  colorSwatchBtnSelected: {
    borderColor: "#ffffff",
    borderWidth: 2.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  brightnessValueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  brightnessValueText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  sliderControlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
    paddingBottom: 4,
  },
  sliderIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  nativeSlider: {
    flex: 1,
    height: 38,
  },
  dockSaveFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  dockSaveFullText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
