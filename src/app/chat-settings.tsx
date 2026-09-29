import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useChatSettings } from "../contexts/ChatSettingsContext";
import { useThemeToggle } from "../contexts/ThemeContext";
import { getTheme } from "../theme/theme";
// the slider component is provided by the community package; install via
// `expo install @react-native-community/slider` or
// `npm install @react-native-community/slider` if you don't already have it.
// if you prefer not to add a dependency you can replace this with a
// simple +/- stepper, but the design uses a slider knob.
// @ts-ignore: may not be installed in this template
import Slider from "@react-native-community/slider";

const { width } = Dimensions.get("window");
const ITEM_PADDING = 8;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (width - ITEM_PADDING * 2 - 20) / NUM_COLUMNS; // subtract some margin

import { wallpaperList } from "../contexts/ChatSettingsContext";

const wallpapers = wallpaperList; // alias for convenience

export default function ChatSettings() {
  const router = useRouter();
  const { themeColors, accentColor } = useThemeToggle();

  const { theme: chatTheme, setTheme, wallpaper, setWallpaper, fontSize, setFontSize } = useChatSettings();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);

  // we no longer need local load/save effects; the provider handles persistence
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (chatTheme === "system") {
        // trigger re-render when system theme changes
        setTheme("system");
      }
    });
    return () => sub.remove();
  }, [chatTheme]);

  const displayTheme = () => chatTheme.charAt(0).toUpperCase() + chatTheme.slice(1);

  const renderWallpaperCell = ({ item }: { item: typeof wallpapers[0] }) => (
    <Pressable
      style={styles.wallpaperItem}
      onPress={() => {
        setWallpaper(item.id);
        setShowWallpaperModal(false);
      }}
    >
      {item.id === "default" ? (
        <View style={[styles.wallpaperImage, styles.defaultWallpaper]}>
          <Feather name="check" size={24} color="#fff" />
          <Text style={styles.defaultLabel}>Default</Text>
        </View>
      ) : (
        <Image
          source={{ uri: item.uri + "?w=200&h=200&fit=crop" }}
          style={styles.wallpaperImage}
        />
      )}
      {wallpaper === item.id && (
        <View style={[styles.selectedOverlay, { borderColor: accentColor, backgroundColor: 'rgba(0,0,0,0.12)' }]}>
          <Feather name="check" size={24} color={accentColor} />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.background }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Chat Settings</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>
        <Pressable
          style={styles.settingItem}
          onPress={() => setShowThemeModal(true)}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="theme-light-dark" size={22} color={themeColors.text} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: themeColors.text }]}>Theme</Text>
          </View>
          <View style={styles.valueContainer}>
            <View style={styles.dropdown}>
              <Text style={styles.valueText}>{displayTheme()}</Text>
              <Feather name="chevron-down" size={18} color={themeColors.textSecondary} />
            </View>
          </View>
        </Pressable>

        <Pressable
          style={styles.settingItem}
          onPress={() => setShowWallpaperModal(true)}
        >
          <View style={styles.iconContainer}>
            <Feather name="image" size={22} color="#fff" />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Chat wallpaper</Text>
            <Text style={styles.settingSubtitle}>Choose a background for your chats</Text>
          </View>
          <View style={styles.valueContainer}>
            {wallpaper !== "default" && (
              <Image
                source={{
                  uri:
                    wallpaperList.find((w) => w.id === wallpaper)?.uri ??
                    undefined,
                }}
                style={styles.wallpaperPreview}
              />
            )}
            <Feather name="chevron-right" size={18} color="#888" />
          </View>
        </Pressable>

        <Pressable
          style={styles.settingItem}
          onPress={() => setShowFontModal(true)}
        >
          <View style={styles.iconContainer}>
            <Feather name="type" size={22} color="#fff" />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Font Size</Text>
          </View>
          <View style={styles.valueContainer}>
            <Text style={styles.valueText}>{fontSize}px</Text>
          </View>
        </Pressable>

        {/* chat history actions */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Chat History</Text>
        <Pressable
          style={styles.settingItem}
          onPress={() => alert('All chat messages have been cleared (stub)')}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="delete-outline" size={22} color="#fff" />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Clear all chats</Text>
            <Text style={styles.settingSubtitle}>Deletes all messages from every chat</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.settingItem}
          onPress={() => alert('All chats and messages permanently removed (stub)')}
        >
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Delete all chats</Text>
            <Text style={styles.settingSubtitle}>Permanently removes all chats and messages</Text>
          </View>
        </Pressable>
      </View>

      {/* Theme picker modal */}
      <Modal transparent visible={showThemeModal} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowThemeModal(false)}
        />
        <View style={styles.modalContent}>
          {(["system", "light", "dark"] as const).map((opt) => (
            <Pressable
              key={opt}
              style={styles.modalItem}
              onPress={() => {
                setTheme(opt);
                setShowThemeModal(false);
              }}
            >
              <Text
                style={[
                  styles.modalItemText,
                  chatTheme === opt && { fontWeight: "bold" },
                ]}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Wallpaper picker modal */}
      <Modal transparent visible={showWallpaperModal} animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWallpaperModal(false)}
        />
        <View style={styles.wallpaperModalContent}>
          <View style={styles.handle} />
          <FlatList
            data={wallpapers}
            keyExtractor={(item) => item.id}
            renderItem={renderWallpaperCell}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={{ padding: 10 }}
          />
        </View>
      </Modal>

      {/* Font size picker modal */}
      <Modal transparent visible={showFontModal} animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFontModal(false)}
        />
        <View style={styles.fontModalContent}>
          <View style={styles.handle} />
          <Text style={[styles.fontPreview, { color: themeColors.text }]}>Preview</Text>
          <View style={styles.fontPreviewBox}>
            <Text style={[styles.fontPreviewText, { fontSize, color: themeColors.text }]}>The quick brown fox jumps over the lazy dog.</Text>
          </View>
          <View style={styles.sliderContainer}>
            <Slider
              style={{ flex: 1 }}
              minimumValue={10}
              maximumValue={30}
              step={1}
              value={fontSize}
              minimumTrackTintColor="#ffb347"
              maximumTrackTintColor="#444"
              thumbTintColor="#ffb347"
              onValueChange={(v) => setFontSize(v)}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>S</Text>
              <Text style={styles.sliderLabel}>M</Text>
              <Text style={styles.sliderLabel}>L</Text>
            </View>
          </View>
          <Text style={styles.sliderHelp}>Adjust the slider to see how text size changes.</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  content: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { color: "#aaa", fontSize: 12, marginBottom: 10 },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  iconContainer: { width: 40, alignItems: "center" },
  settingText: { flex: 1, marginLeft: 10 },
  settingTitle: { fontSize: 16, fontWeight: "600", color: "#fff" },
  settingSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 },
  valueContainer: { flexDirection: "row", alignItems: "center" },
  wallpaperPreview: { width: 40, height: 40, borderRadius: 8, marginRight: 8 },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    backgroundColor: "#1c1c1e",
  },
  valueText: { color: "#888", marginRight: 5 },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111",
    paddingVertical: 20,
  },
  modalItem: { paddingVertical: 15, paddingHorizontal: 20 },
  modalItemText: { color: "#fff", fontSize: 16 },
  wallpaperModalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#555",
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 10,
  },
  wallpaperItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_PADDING / 2,
  },
  wallpaperImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  defaultWallpaper: {
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent", // will be overridden inline to accentColor
  },
  defaultLabel: {
    position: "absolute",
    bottom: 6,
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  fontModalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  fontPreview: { color: "#fff", fontSize: 14, fontWeight: "600" },
  fontPreviewBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    marginVertical: 10,
    padding: 15,
  },
  fontPreviewText: { color: "#fff" },
  sliderContainer: { marginTop: 20 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sliderLabel: { color: "#888", fontSize: 12 },
  sliderHelp: { color: "#888", fontSize: 12, textAlign: "center", marginTop: 8 },
});
