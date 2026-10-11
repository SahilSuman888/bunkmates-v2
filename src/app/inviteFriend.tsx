import React, { useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Appearance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeToggle } from "../contexts/ThemeContext";

const DOWNLOAD_LINK = "https://bunkmateshome.vercel.app/bm-install";

interface ShareButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  showLabel?: boolean;
  onPress: () => void;
  colors: any;
}

function ShareButton({ icon, label, showLabel = false, onPress, colors }: ShareButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.shareButton,
        { backgroundColor: colors.buttonBg },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
      {showLabel && label && (
        <Text style={[styles.shareButtonText, { color: colors.textPrimary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export default function InviteFriendScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  let themeMode: "dark" | "light" | "system" = "system";
  let activeAccent = "";
  try {
    const themeContext = useThemeToggle();
    if (themeContext && themeContext.mode) themeMode = themeContext.mode;
    if (themeContext && themeContext.accentColor) activeAccent = themeContext.accentColor;
  } catch (e) {}

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && Appearance.getColorScheme() === "dark");

  const colors = useMemo(() => ({
    bg: isDark ? "#000000" : "#F1F1F1",
    card: isDark ? "#161618" : "#FFFFFF",
    textPrimary: isDark ? "#FFFFFF" : "#11141A",
    textSecondary: isDark ? "#8E95A2" : "#7E8590",
    buttonBg: isDark ? "#202024" : "#F4F5F7",
    primaryBtnBg: activeAccent || (isDark ? "#FFFFFF" : "#000000"),
    primaryBtnText: activeAccent ? "#FFFFFF" : (isDark ? "#000000" : "#FFFFFF"),
    inputBg: isDark ? "#202024" : "#F4F5F7",
  }), [isDark, activeAccent]);

  const qrSize = Math.min(width * 0.44, 200);

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(DOWNLOAD_LINK);
      Alert.alert("Copied!", "BunkMates download link copied.");
    } catch (error) {
      console.error("Copy link error:", error);
    }
  };

  const handleWhatsApp = async () => {
    const message = encodeURIComponent(`Join me on BunkMates using this link: ${DOWNLOAD_LINK}`);
    const whatsappUrl = `whatsapp://send?text=${message}`;
    const whatsappWebUrl = `https://wa.me/?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Linking.openURL(whatsappWebUrl);
      }
    } catch {
      Linking.openURL(whatsappWebUrl).catch(() => {
        Alert.alert("WhatsApp", "Unable to open WhatsApp.");
      });
    }
  };

  const handleEmail = async () => {
    const subject = encodeURIComponent("Join me on BunkMates");
    const body = encodeURIComponent(`Join using this BunkMates download link:\n\n${DOWNLOAD_LINK}`);
    const emailUrl = `mailto:?subject=${subject}&body=${body}`;

    try {
      const supported = await Linking.canOpenURL(emailUrl);
      if (supported) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert("Email", "No email application is available.");
      }
    } catch (error) {
      console.error("Email share error:", error);
    }
  };

  const handleTelegram = async () => {
    const text = encodeURIComponent("Connect with me on BunkMates!");
    const url = encodeURIComponent(DOWNLOAD_LINK);
    const telegramUrl = `tg://msg_url?url=${url}&text=${text}`;
    const telegramWebUrl = `https://t.me/share/url?url=${url}&text=${text}`;

    try {
      const supported = await Linking.canOpenURL(telegramUrl);
      if (supported) {
        await Linking.openURL(telegramUrl);
      } else {
        await Linking.openURL(telegramWebUrl);
      }
    } catch {
      Linking.openURL(telegramWebUrl).catch(() => {
        Alert.alert("Telegram", "Unable to open Telegram.");
      });
    }
  };

  const handleMore = async () => {
    try {
      await Share.share({
        message: `Join me on BunkMates: ${DOWNLOAD_LINK}`,
        url: DOWNLOAD_LINK,
        title: "BunkMates Download Link",
      });
    } catch (error) {
      console.error("More share error:", error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/ProfileSettings" as any);
          }}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t("Invite a Friend", "Invite & Download")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t("Share BunkMates with your friends and explore together!", "Share the BunkMates App")}
        </Text>

        {/* QR Card */}
        <View style={[styles.qrCard, { backgroundColor: colors.card }]}>
          <View style={[styles.qrWrapper, { width: qrSize + 24, height: qrSize + 24 }]}>
            <QRCode
              value={DOWNLOAD_LINK}
              size={qrSize}
              color="#000000"
              backgroundColor="#FFFFFF"
              ecl="H"
            />
          </View>

          <Text style={[styles.qrDescription, { color: colors.textSecondary }]}>
            {t("Scan QR Code", "Scan the QR or share this download link:")}
          </Text>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            App Download Link
          </Text>

          <View style={[styles.linkBox, { backgroundColor: colors.inputBg }]}>
            <Text
              style={[styles.linkText, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {DOWNLOAD_LINK}
            </Text>
          </View>

          <Pressable
            onPress={handleCopyLink}
            style={({ pressed }) => [
              styles.copyButton,
              { backgroundColor: colors.primaryBtnBg },
              pressed && styles.copyPressed,
            ]}
          >
            <Text style={[styles.copyButtonText, { color: colors.primaryBtnText }]}>
              Copy Download Link
            </Text>
          </Pressable>
        </View>

        {/* Share Section */}
        <Text style={[styles.shareTitle, { color: colors.textSecondary }]}>
          Share Invite Link via
        </Text>

        <View style={styles.shareRow}>
          <ShareButton icon="logo-whatsapp" onPress={handleWhatsApp} colors={colors} />
          <ShareButton icon="mail" onPress={handleEmail} colors={colors} />
          <ShareButton icon="paper-plane" onPress={handleTelegram} colors={colors} />
          <ShareButton icon="share-social" label="More" showLabel onPress={handleMore} colors={colors} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  qrCard: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 0,
    padding: 24,
    alignItems: "center",
    marginBottom: 28,
  },
  qrWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    padding: 12,
  },
  qrDescription: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },
  inputLabel: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  linkBox: {
    width: "100%",
    height: 46,
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 16,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "500",
  },
  copyButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  copyPressed: {
    opacity: 0.8,
  },
  shareTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shareButton: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  shareButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});