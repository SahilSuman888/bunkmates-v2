import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
  Share,
  Alert,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Trip {
  name?: string;
}

interface Props {
  shareDrawerOpen: boolean;
  setShareDrawerOpen: (v: boolean) => void;
  inviteLink: string;
  trip?: Trip;
  mode: "light" | "dark";
  generateSharePoster?: () => void;
  setSnackbar: (v: { open: boolean; message: string }) => void;
}

const ShareDrawer: React.FC<Props> = ({
  shareDrawerOpen,
  setShareDrawerOpen,
  inviteLink,
  trip,
  mode,
  setSnackbar,
}) => {
  const isDark = mode === "dark";

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setSnackbar({ open: true, message: "Copied invite link!" });
  };

  const shareDevice = async () => {
    try {
      await Share.share({
        title: `Join my trip "${trip?.name}"`,
        message: `Join our trip "${trip?.name}" 🚀\n${inviteLink}`,
      });
      setSnackbar({ open: true, message: "Shared successfully!" });
    } catch (err) {
      console.log("Share cancelled:", err);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <Modal
      visible={shareDrawerOpen}
      animationType="slide"
      transparent
      onRequestClose={() => setShareDrawerOpen(false)}
    >
      <BlurView
        intensity={40}
        tint={isDark ? "dark" : "light"}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => setShareDrawerOpen(false)}
        />
      </BlurView>

      <View
        style={[
          styles.drawer,
          {
            backgroundColor: isDark
              ? "rgba(0,0,0,0.8)"
              : "rgba(255,255,255,0.9)",
          },
        ]}
      >
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isDark ? "#fff" : "#000" },
            ]}
          >
            Share Trip Invite
          </Text>

          <TouchableOpacity
            onPress={() => setShareDrawerOpen(false)}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* QR Code */}
          <View style={styles.qrContainer}>
            <QRCode
              value={inviteLink}
              size={200}
              backgroundColor="#fff"
              color="#000"
            />
          </View>

          {/* Invite Link */}
          <View style={styles.linkRow}>
            <TextInput
              value={inviteLink}
              editable={false}
              multiline
              style={[
                styles.linkInput,
                {
                  backgroundColor: isDark ? "#111" : "#f3f3f3",
                  color: isDark ? "#fff" : "#000",
                },
              ]}
            />

            <TouchableOpacity onPress={copyLink}>
              <MaterialCommunityIcons
                name="content-copy"
                size={20}
                color={isDark ? "#fff" : "#000"}
              />
            </TouchableOpacity>
          </View>

          {/* Native Share */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: isDark ? "#fff" : "#000",
              },
            ]}
            onPress={shareDevice}
          >
            <MaterialCommunityIcons
              name="share"
              size={18}
              color={isDark ? "#000" : "#fff"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{
                color: isDark ? "#000" : "#fff",
                fontWeight: "600",
              }}
            >
              Share via Device
            </Text>
          </TouchableOpacity>

          {/* Social Buttons */}
          <View style={styles.socialRow}>
            <SocialButton
              icon="whatsapp"
              color="#25D366"
              onPress={() =>
                openLink(
                  `https://wa.me/?text=${encodeURIComponent(
                    `Join "${trip?.name}" 🚀\n${inviteLink}`
                  )}`
                )
              }
            />

            <SocialButton
              icon="send"
              color="#229ED9"
              onPress={() =>
                openLink(
                  `https://t.me/share/url?url=${encodeURIComponent(
                    inviteLink
                  )}`
                )
              }
            />

            <SocialButton
              icon="at"
              color="#1DA1F2"
              onPress={() =>
                openLink(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Join "${trip?.name}" 🌍 ${inviteLink}`
                  )}`
                )
              }
            />

            <SocialButton
              icon="camera"
              color="#E1306C"
              onPress={copyLink}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export default ShareDrawer;

/* ---------------- Social Button ---------------- */

const SocialButton = ({
  icon,
  color,
  onPress,
}: {
  icon: any;
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.socialButton,
      { backgroundColor: color },
    ]}
  >
    <MaterialCommunityIcons name={icon} size={22} color="#fff" />
  </TouchableOpacity>
);

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderRadius: 12,
    padding: 20,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#888",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 16,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  linkInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
  },
  primaryButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  socialButton: {
    padding: 16,
    borderRadius: 50,
  },
});