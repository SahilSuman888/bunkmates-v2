import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeToggle } from "../contexts/ThemeContext";
import { ACCENT_COLORS } from "../theme/theme";

// background color swatches grouped by category
const BACKGROUND_SWATCHES = {
  neutral: ["#0c0c0c", "#1c1c1e", "#2c2c2e", "#3a3a3c", "#48484a", "#575759"],
  cool: ["#001f3f", "#003566", "#00557f", "#0077b6", "#0096c7", "#00b4d8"],
  warm: ["#482314", "#6d3b20", "#8c4b2f", "#a55c3f", "#c16f51", "#d88b6c"],
  vibrant: ["#d500f9", "#c51162", "#aa00ff", "#6200ea", "#304ffe", "#2962ff"],
};

const MODE_OPTIONS: Array<"solid" | "gradient" | "mesh"> = [
  "solid",
  "gradient",
  "mesh",
];

export default function GeneralSettings() {
  const router = useRouter();
  const {
    mode,
    setMode,
    accent,
    setAccent,
    background,
    setBackground,
    locationMode,
    setLocationMode,
    themeColors,
  } = useThemeToggle();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAccentModal, setShowAccentModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);

  const displayTheme = () => mode.charAt(0).toUpperCase() + mode.slice(1);
  const displayLocation = () => locationMode.charAt(0).toUpperCase() + locationMode.slice(1);
  const displayBackground = () => {
    const cat = background.category || "cool";
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `${background.mode.charAt(0).toUpperCase() + background.mode.slice(1)} • ${label}`;
  };

  const pickBackgroundColor = (cat: keyof typeof BACKGROUND_SWATCHES, color: string) => {
    setBackground({ mode: background.mode, color, category: cat });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }] }>
      <View style={[styles.header, { backgroundColor: themeColors.background }] }>
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
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>General Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>

        {/* theme row */}
        <Pressable style={styles.settingItem} onPress={() => setShowThemeModal(true)}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="theme-light-dark" size={22} color={themeColors.text} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: themeColors.text }]}>Theme</Text>
          </View>
          <View style={styles.valueContainer}>
            <View style={styles.dropdown}>
              <Text style={styles.valueText}>{displayTheme()}</Text>
              <Feather name="chevron-down" size={18} color="#888" />
            </View>
          </View>
        </Pressable>

        {/* accent color row */}
        <Pressable style={styles.settingItem} onPress={() => setShowAccentModal(true)}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="palette" size={22} color={themeColors.text} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: themeColors.text }]}>Accent Color</Text>
            <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>{accent.charAt(0).toUpperCase() + accent.slice(1)}</Text>
          </View>
          <View style={styles.valueContainer}>
            <View style={[styles.bgCircle, { backgroundColor: ACCENT_COLORS[accent] || '#fff', borderWidth: 0 }]} />
            <Feather name="chevron-right" size={18} color="#888" />
          </View>
        </Pressable>

        {/* location row */}
        <Pressable style={styles.settingItem} onPress={() => setShowLocationModal(true)}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="map-marker" size={22} color={themeColors.text} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: themeColors.text }]}>Location</Text>
            <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>{displayLocation()}</Text>
          </View>
          <View style={styles.valueContainer}>
            <View style={styles.dropdown}>
              <Text style={styles.valueText}>{displayLocation()}</Text>
              <Feather name="chevron-down" size={18} color="#888" />
            </View>
          </View>
        </Pressable>

        {/* background row */}
        <Pressable style={styles.settingItem} onPress={() => setShowBackgroundModal(true)}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.bgCircle,
                { backgroundColor: background.color || '#1c1c1e' },
              ]}
            />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: themeColors.text }]}>Background</Text>
            <Text style={[styles.settingSubtitle, { color: themeColors.textSecondary }]}>{displayBackground()}</Text>
          </View>
          <View style={styles.valueContainer}>
            <Feather name="chevron-right" size={18} color="#888" />
          </View>
        </Pressable>
      </ScrollView>

      {/* --- Theme modal --- */}
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
                setMode(opt as 'dark' | 'light' | 'system');
                setShowThemeModal(false);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name={
                    opt === 'dark' ? 'moon-waning-crescent' : opt === 'light' ? 'white-balance-sunny' : 'cellphone-settings'
                  }
                  size={20}
                  color={themeColors.text}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    mode === opt && { fontWeight: "bold" },
                  ]}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* accent picker bottom sheet */}
      <Modal transparent visible={showAccentModal} animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAccentModal(false)}
        />
        <View style={styles.accentModalContent}>
          <View style={styles.handle} />
          <View style={[styles.accentPreview, { backgroundColor: ACCENT_COLORS[accent] || "#fff" }]}
          >
            <Text style={styles.accentPreviewText}>THIS IS THE ACCENT PREVIEW</Text>
          </View>
          <FlatList
            data={Object.entries(ACCENT_COLORS)}
            keyExtractor={([key]) => key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: 10 }}
            renderItem={({ item }) => {
              const [key, color] = item;
              return (
                <Pressable
                  onPress={() => {
                    setAccent(key);
                    setShowAccentModal(false);
                  }}
                  style={[
                    styles.accentSwatch,
                    { backgroundColor: color },
                    accent === key && styles.accentSelected,
                  ]}
                />
              );
            }}
          />
        </View>
      </Modal>

      {/* location modal */}
      <Modal transparent visible={showLocationModal} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLocationModal(false)}
        />
        <View style={styles.modalContent}>
          {( ["auto","manual"] as const).map((opt) => (
            <Pressable
              key={opt}
              style={styles.modalItem}
              onPress={() => {
                setLocationMode(opt as any);
                setShowLocationModal(false);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name={opt === 'auto' ? 'crosshairs-gps' : 'map-marker'}
                  size={20}
                  color={themeColors.text}
                  style={{ marginRight: 10 }}
                />
                <Text
                  style={[
                    styles.modalItemText,
                    locationMode === opt && { fontWeight: "bold" },
                  ]}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* background modal */}
      <Modal transparent visible={showBackgroundModal} animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBackgroundModal(false)}
        />
        <View style={styles.backgroundModalContent}>
          <View style={styles.handle} />
          <View style={styles.modePicker}>
            {MODE_OPTIONS.map((m) => (
              <Pressable
                key={m}
                style={[
                  styles.modeButton,
                  background.mode === m && styles.modeButtonActive,
                ]}
                onPress={() => setBackground({ ...background, mode: m })}
              >
                <Text
                  style={
                    background.mode === m
                      ? styles.modeButtonTextActive
                      : styles.modeButtonText
                  }
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.swatchGroups}>
            {Object.entries(BACKGROUND_SWATCHES).map(([cat, colors]) => (
              <View key={cat} style={styles.swatchRow}>
                <Text style={styles.swatchLabel}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                <View style={styles.swatchList}>
                  {colors.map((col) => (
                    <Pressable
                      key={col}
                      style={[
                        styles.swatch,
                        { backgroundColor: col },
                        background.color === col && styles.swatchSelected,
                      ]}
                      onPress={() => pickBackgroundColor(cat as any, col)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
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
  valueText: { color: "#888", marginRight: 5 },
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
  bgCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
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
  accentModalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#555",
    borderRadius: 3,
    alignSelf: "center",
    marginVertical: 10,
  },
  accentPreview: {
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  accentPreviewText: { color: "#000", fontWeight: "bold" },
  accentSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  accentSelected: {
    borderWidth: 2,
    borderColor: "#ffb347",
  },
  backgroundModalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    backgroundColor: "#111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modePicker: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  modeButtonActive: {
    backgroundColor: "#ffb347",
  },
  modeButtonText: { color: "#fff" },
  modeButtonTextActive: { color: "#000", fontWeight: "bold" },
  swatchGroups: { flex: 1 },
  swatchRow: { marginBottom: 15 },
  swatchLabel: { color: "#aaa", marginBottom: 6 },
  swatchList: { flexDirection: "row" },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  swatchSelected: {
    borderColor: "#ffb347",
    borderWidth: 2,
  },
});
