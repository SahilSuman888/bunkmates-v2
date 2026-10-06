import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
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
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useLanguage } from "../contexts/LanguageContext";

const DOWNLOAD_LINK =
  "https://bunkmateshome.vercel.app/bm-install";

export default function InviteFriendScreen() {
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 390, 0.88), 1.12);
  const horizontalPadding = Math.max(18, width * 0.055);
  const qrSize = Math.min(width * 0.42, 210);
  const copyButtonHeight = Math.max(44, Math.round(38 * scale));
  const shareButtonMinWidth = Math.max(46, Math.round(42 * scale));
  const sectionFontSize = Math.round(12 * scale);
  const titleFontSize = Math.round(18 * scale);
  const smallFontSize = Math.round(10 * scale);
  const buttonFontSize = Math.max(11, Math.round(11 * scale));
  const buttonPaddingHorizontal = Math.max(12, Math.round(11 * scale));
  const shareButtonHeight = Math.max(44, Math.round(34 * scale));

  // ==========================================
  // COPY DOWNLOAD LINK
  // ==========================================

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(DOWNLOAD_LINK);

      Alert.alert(
        "Copied!",
        "BunkMates download link copied."
      );
    } catch (error) {
      console.error("Copy link error:", error);
    }
  };

  // ==========================================
  // WHATSAPP
  // ==========================================

  const handleWhatsApp = async () => {
    const message = encodeURIComponent(
      `Join me on BunkMates using this link: ${DOWNLOAD_LINK}`
    );

    const whatsappUrl = `whatsapp://send?text=${message}`;
    const whatsappWebUrl = `https://wa.me/?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(
        whatsappUrl
      );

      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Linking.openURL(whatsappWebUrl);
      }
    } catch (error) {
      console.error(
        "WhatsApp share error:",
        error
      );

      try {
        await Linking.openURL(
          whatsappWebUrl
        );
      } catch {
        Alert.alert(
          "WhatsApp",
          "Unable to open WhatsApp."
        );
      }
    }
  };

  // ==========================================
  // EMAIL
  // ==========================================

  const handleEmail = async () => {
    const subject = encodeURIComponent(
      "Join me on BunkMates"
    );

    const body = encodeURIComponent(
      `Join using this BunkMates download link:\n\n${DOWNLOAD_LINK}`
    );

    const emailUrl =
      `mailto:?subject=${subject}&body=${body}`;

    try {
      const supported =
        await Linking.canOpenURL(emailUrl);

      if (supported) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert(
          "Email",
          "No email application is available."
        );
      }
    } catch (error) {
      console.error(
        "Email share error:",
        error
      );
    }
  };

  // ==========================================
  // TELEGRAM
  // ==========================================

  const handleTelegram = async () => {
    const text = encodeURIComponent(
      "Connect with me on BunkMates!"
    );

    const url = encodeURIComponent(
      DOWNLOAD_LINK
    );

    const telegramUrl =
      `tg://msg_url?url=${url}&text=${text}`;

    const telegramWebUrl =
      `https://t.me/share/url?url=${url}&text=${text}`;

    try {
      const supported =
        await Linking.canOpenURL(
          telegramUrl
        );

      if (supported) {
        await Linking.openURL(
          telegramUrl
        );
      } else {
        await Linking.openURL(
          telegramWebUrl
        );
      }
    } catch (error) {
      console.error(
        "Telegram share error:",
        error
      );

      try {
        await Linking.openURL(
          telegramWebUrl
        );
      } catch {
        Alert.alert(
          "Telegram",
          "Unable to open Telegram."
        );
      }
    }
  };

  // ==========================================
  // MORE / NATIVE SHARE
  // ==========================================

  const handleMore = async () => {
    try {
      await Share.share({
        title:
          "Connect with me on BunkMates!",
        message:
          `Join me on BunkMates using this link:\n${DOWNLOAD_LINK}`,
      });
    } catch (error: any) {
      if (
        error?.message !==
        "User did not share"
      ) {
        console.error(
          "Native share error:",
          error
        );
      }
    }
  };

  // ==========================================
  // SHARE BUTTON
  // ==========================================

  const ShareButton = ({
    icon,
    label,
    onPress,
    showLabel = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label?: string;
    onPress: () => void;
    showLabel?: boolean;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.shareButton,
          {
            minWidth: shareButtonMinWidth,
            height: shareButtonHeight,
            paddingHorizontal: buttonPaddingHorizontal,
          },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color="#ffffff"
        />

        {showLabel && label ? (
          <Text style={[styles.shareButtonText, { fontSize: buttonFontSize }]}> 
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  // ==========================================
  // SCREEN
  // ==========================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: Math.round(24 * scale),
            paddingBottom: Math.max(40, height * 0.04),
          },
        ]}
      >
        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color="#ffffff"
            />
          </Pressable>

          <Text style={[styles.headerTitle, { fontSize: titleFontSize }]}> 
            {t("Invite a Friend", "Invite & Download")}
          </Text>
        </View>

        {/* ================================= */}
        {/* SHARE APP TITLE */}
        {/* ================================= */}

        <Text style={[styles.sectionTitle, { fontSize: sectionFontSize, marginLeft: 0, marginBottom: 14 }]}> 
          {t("Share BunkMates with your friends and explore together!", "Share the BunkMates App")}
        </Text>

        {/* ================================= */}
        {/* QR CARD */}
        {/* ================================= */}

        <View style={styles.qrCard}>
          {/* QR CODE */}

          <View style={[styles.qrWrapper, { width: qrSize, height: qrSize, borderRadius: Math.round(10 * scale), marginBottom: Math.round(14 * scale) }]}> 
            <QRCode
              value={DOWNLOAD_LINK}
              size={Math.max(140, Math.round(qrSize * 0.92))}
              color="#000000"
              backgroundColor="#ffffff"
              ecl="H"
            />
          </View>

          {/* DESCRIPTION */}

          <Text style={[styles.qrDescription, { fontSize: Math.max(11, Math.round(11 * scale)), marginBottom: Math.round(10 * scale) }]}> 
            {t("Scan QR Code", "Scan the QR or share this download link:")}
          </Text>

          {/* ================================= */}
          {/* DOWNLOAD LINK */}
          {/* ================================= */}

          <Text style={[styles.inputLabel, { fontSize: smallFontSize, marginBottom: 4 }]}> 
            App Download Link
          </Text>

          <View style={styles.linkBox}>
            <Text
              style={[styles.linkText, { fontSize: Math.max(11, Math.round(11 * scale)) }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {DOWNLOAD_LINK}
            </Text>
          </View>

          {/* ================================= */}
          {/* COPY BUTTON */}
          {/* ================================= */}

          <Pressable
            onPress={handleCopyLink}
            style={({ pressed }) => [
              styles.copyButton,
              {
                height: copyButtonHeight,
                borderRadius: Math.round(18 * scale),
              },
              pressed && styles.copyPressed,
            ]}
          >
            <Text style={[styles.copyButtonText, { fontSize: Math.max(11, Math.round(11 * scale)) }]}> 
              Copy Download Link
            </Text>
          </Pressable>
        </View>

        {/* ================================= */}
        {/* DIVIDER */}
        {/* ================================= */}

        <View style={styles.divider} />

        {/* ================================= */}
        {/* SHARE SECTION */}
        {/* ================================= */}

        <Text style={[styles.shareTitle, { fontSize: sectionFontSize, marginLeft: 0, marginBottom: 12 }]}> 
          Share Invite Link via
        </Text>

        {/* ================================= */}
        {/* SHARE BUTTONS */}
        {/* ================================= */}

        <View style={styles.shareRow}>
          {/* WhatsApp */}

          <ShareButton
            icon="logo-whatsapp"
            onPress={handleWhatsApp}
          />

          {/* Email */}

          <ShareButton
            icon="mail"
            onPress={handleEmail}
          />

          {/* Telegram */}

          <ShareButton
            icon="paper-plane"
            onPress={handleTelegram}
          />

          {/* More */}

          <ShareButton
            icon="share-social"
            label="More"
            showLabel
            onPress={handleMore}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 40,
  },

  // ==========================================
  // HEADER
  // ==========================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 29,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: "#191919",

    alignItems: "center",
    justifyContent: "center",

    marginRight: 10,
  },

  headerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },

  // ==========================================
  // SECTION TITLE
  // ==========================================

  sectionTitle: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 10,
    marginBottom: 13,
  },

  // ==========================================
  // QR CARD
  // ==========================================

  qrCard: {
    width: "100%",

    backgroundColor: "#030303",

    borderRadius: 10,

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,

    alignItems: "center",
  },

  qrWrapper: {
    backgroundColor: "#ffffff",

    width: 174,
    height: 174,

    borderRadius: 8,

    alignItems: "center",
    justifyContent: "center",

    marginBottom: 13,
  },

  qrDescription: {
    color: "#bdbdbd",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 7,
  },

  // ==========================================
  // LINK
  // ==========================================

  inputLabel: {
    alignSelf: "flex-start",

    color: "#777777",

    fontSize: 9,

    marginLeft: 2,
    marginBottom: 3,
  },

  linkBox: {
    width: "100%",

    height: 38,

    borderWidth: 1,
    borderColor: "#343434",

    backgroundColor: "#0b0b0b",

    borderRadius: 5,

    paddingHorizontal: 10,

    justifyContent: "center",

    marginBottom: 10,
  },

  linkText: {
    color: "#eeeeee",
    fontSize: 9.5,
  },

  // ==========================================
  // COPY BUTTON
  // ==========================================

  copyButton: {
    width: "100%",

    height: 29,

    borderRadius: 18,

    backgroundColor: "#ff9f1c",

    alignItems: "center",
    justifyContent: "center",
  },

  copyButtonText: {
    color: "#000000",

    fontSize: 9,

    fontWeight: "700",
  },

  copyPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  // ==========================================
  // DIVIDER
  // ==========================================

  divider: {
    height: 1,

    backgroundColor: "#171717",

    marginTop: 29,
    marginBottom: 23,
  },

  // ==========================================
  // SHARE TITLE
  // ==========================================

  shareTitle: {
    color: "#bdbdbd",

    fontSize: 10,

    marginLeft: 10,

    marginBottom: 12,
  },

  // ==========================================
  // SHARE ROW
  // ==========================================

  shareRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "flex-start",

    gap: 9,

    paddingHorizontal: 5,
  },

  // ==========================================
  // SHARE BUTTON
  // ==========================================

  shareButton: {
    minWidth: 42,
    height: 34,

    paddingHorizontal: 11,

    borderWidth: 1,
    borderColor: "#282828",

    borderRadius: 10,

    backgroundColor: "#050505",

    alignItems: "center",
    justifyContent: "center",

    flexDirection: "row",

    gap: 5,
  },

  shareButtonText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "500",
  },

  pressed: {
    opacity: 0.65,
  },
});