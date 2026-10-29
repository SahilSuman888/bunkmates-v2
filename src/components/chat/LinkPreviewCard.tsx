// src/components/chat/LinkPreviewCard.tsx
// Rich link preview card for URLs in chat bubbles when linkPreviews is enabled

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface LinkPreviewCardProps {
  text?: string;
  isOwn?: boolean;
  accentColor?: string;
  isDark?: boolean;
}

export const extractFirstUrl = (text?: string): string | null => {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
};

export const getHostname = (url: string): string => {
  try {
    const parts = url.split("://");
    const domain = (parts[1] || parts[0]).split("/")[0].split("?")[0];
    return domain.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export default function LinkPreviewCard({
  text,
  isOwn = false,
  accentColor = "#00e6b0",
  isDark = true,
}: LinkPreviewCardProps) {
  const url = useMemo(() => extractFirstUrl(text), [text]);

  if (!url) return null;

  const hostname = getHostname(url);

  const handleOpenLink = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn("Failed to open URL:", url, e);
    }
  };

  return (
    <Pressable
      onPress={handleOpenLink}
      style={({ pressed }) => [
        styles.cardContainer,
        {
          backgroundColor: isOwn
            ? "rgba(0, 0, 0, 0.18)"
            : isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.05)",
          borderColor: isOwn
            ? "rgba(255, 255, 255, 0.25)"
            : isDark
            ? "rgba(255, 255, 255, 0.12)"
            : "rgba(0, 0, 0, 0.08)",
        },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="link"
      accessibilityLabel={`Open link to ${hostname}`}
    >
      <View style={styles.iconCircle}>
        <Ionicons
          name="globe-outline"
          size={14}
          color={isOwn ? "#ffffff" : isDark ? "#ffffff" : "#111827"}
        />
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.hostnameText,
            { color: isOwn ? "#ffffff" : isDark ? "#ffffff" : "#111827" },
          ]}
          numberOfLines={1}
        >
          {hostname}
        </Text>
        <Text
          style={[
            styles.urlSubtext,
            { color: isOwn ? "rgba(255, 255, 255, 0.75)" : isDark ? "#9ca3af" : "#6b7280" },
          ]}
          numberOfLines={1}
        >
          {url}
        </Text>
      </View>

      <Ionicons
        name="open-outline"
        size={14}
        color={isOwn ? "rgba(255, 255, 255, 0.85)" : isDark ? "#9ca3af" : "#6b7280"}
        style={{ marginLeft: 6 }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(128, 128, 128, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  hostnameText: {
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  urlSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
});
