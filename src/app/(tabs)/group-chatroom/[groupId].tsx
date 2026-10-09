import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Alert,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useUser } from "../../../contexts/UserContext";
import { useGroupChat } from "../../../hooks/useGroupChat";
import { useChatSettings, wallpaperList } from "../../../contexts/ChatSettingsContext";
import * as Sharing from "expo-sharing";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { MaterialCommunityIcons, Ionicons, Feather, AntDesign } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { SafeAreaView as SafeAreaViewContext } from "react-native-safe-area-context";
import GroupInfoDrawer from "../../../components/group_chat/GroupInfoDrawer";
import UserProfileModal from "../../../components/UserProfileModal";
import { useThemeToggle } from "../../../contexts/ThemeContext";


export default function GroupChatroom() {
  const { groupId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const { themeColors, isDark, accentColor, scaleFont, background } = useThemeToggle();

  const {
    wallpaper,
    fontSize,
    enterIsSend,
    autoDownloadMedia,
    saveToGallery,
    linkPreviews,
    disappearingTimer,
    clearedAt,
  } = useChatSettings();

  const selectedWallpaper = wallpaperList.find((w) => w.id === wallpaper);
  const isCustomWallpaper = wallpaper !== "default" && !!selectedWallpaper?.uri;
  
  const { messages, loading: messagesLoading } = useGroupChat(groupId as string || null);
  
  const [groupData, setGroupData] = useState<any>(null);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string } | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [memberDetailsMap, setMemberDetailsMap] = useState<{ [key: string]: any }>({});
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [downloadedMediaMap, setDownloadedMediaMap] = useState<{ [id: string]: boolean }>({});
  
  const flatListRef = useRef<any>(null);

  // Fetch group data
  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(doc(db, "groupChats", groupId as string), (snap) => {
      if (snap.exists()) {
        setGroupData(snap.data());
      }
    });
    return () => unsub();
  }, [groupId]);

  // Disappearing messages expiration calculator
  const getDisappearingExpiresAt = () => {
    const now = Date.now();
    switch (disappearingTimer) {
      case "24h":
        return now + 24 * 60 * 60 * 1000;
      case "7d":
        return now + 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return now + 30 * 24 * 60 * 60 * 1000;
      case "90d":
        return now + 90 * 24 * 60 * 60 * 1000;
      default:
        return null;
    }
  };

  // Filter messages using clearedAt and disappearing messages expiry
  const displayMessages = React.useMemo(() => {
    return messages.filter((msg: any) => {
      if (clearedAt) {
        const ms = msg.timestamp?.toMillis
          ? msg.timestamp.toMillis()
          : msg.timestamp?.seconds
          ? msg.timestamp.seconds * 1000
          : 0;
        if (ms > 0 && ms <= clearedAt) return false;
      }
      if (msg.expiresAt && msg.expiresAt <= Date.now()) {
        return false;
      }
      return true;
    });
  }, [messages, clearedAt]);

  // Scroll to bottom when messages update
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [displayMessages]);

  const handleSaveImageToDevice = async (imageUrl: string | null) => {
    if (!imageUrl) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imageUrl);
      } else {
        Alert.alert("Saved", "Image URL copied / ready to share.");
      }
    } catch (err: any) {
      console.error("Save group image error:", err);
      Alert.alert("Notice", err?.message || "Could not open share/save modal");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !pendingImage) return;
    if (!groupId || !user) return;

    const messageText = input;
    setInput("");
    setReplyTo(null);

    try {
      let imageUrl = null;

      // Upload image if present
      if (pendingImage) {
        setUploading(true);
        const storage = getStorage();
        const storageRef = ref(storage, `group-messages/${groupId}/${Date.now()}`);
        const uploadTask = await uploadString(storageRef, pendingImage.base64, "base64", {
          contentType: "image/jpeg",
        });
        imageUrl = await getDownloadURL(uploadTask.ref);
        setPendingImage(null);
      }

      // Add message to Firestore with expiresAt
      await addDoc(collection(db, "groupChats", groupId as string, "messages"), {
        text: messageText || "",
        imageUrl: imageUrl || null,
        senderId: user.uid,
        senderName: user.displayName || "Anonymous",
        senderAvatar: user.photoURL || null,
        timestamp: serverTimestamp(),
        expiresAt: getDisappearingExpiresAt(),
        replyTo: replyTo ? { text: replyTo.text, senderId: replyTo.senderId, senderName: replyTo.senderName } : null,
      });

      setUploading(false);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Allow access to your camera roll to send images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPendingImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64 || "",
        });
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const renderMessage = ({ item }: any) => {
    const isOwnMessage = item.senderId === user?.uid;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Pressable
            onPress={() => {
              setSelectedProfileId(item.senderId);
              setShowProfileModal(true);
            }}
          >
            <Image
              source={{ uri: item.senderAvatar || "https://via.placeholder.com/40" }}
              style={styles.avatar}
            />
          </Pressable>
        )}
        
        <Pressable
          onLongPress={() => {
            Alert.alert("Options", "Reply", [
              {
                text: "Reply",
                onPress: () => setReplyTo(item),
              },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
          style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}
        >
          {!isOwnMessage && (
            <Pressable
              onPress={() => {
                setSelectedProfileId(item.senderId);
                setShowProfileModal(true);
              }}
            >
              <Text style={styles.senderName}>{item.senderName}</Text>
            </Pressable>
          )}

          {item.replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyText} numberOfLines={1}>
                {item.replyTo.senderName}: {item.replyTo.text}
              </Text>
            </View>
          )}

          {item.imageUrl && (
            autoDownloadMedia || downloadedMediaMap[item.id] || isOwnMessage ? (
              <Pressable onPress={() => setSelectedImage(item.imageUrl)}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.messageImage}
                />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setDownloadedMediaMap((prev) => ({ ...prev, [item.id]: true }))}
                style={styles.dataSaverMediaCard}
              >
                <Ionicons name="arrow-down-circle-outline" size={26} color="#FFFFFF" />
                <Text style={styles.dataSaverMediaText}>Tap to load photo • Data Saver</Text>
              </Pressable>
            )
          )}

          {item.text && <Text style={[styles.messageText, { fontSize }]}>{item.text}</Text>}

          {linkPreviews && item.text && (() => {
            const urlMatch = item.text.match(/https?:\/\/[^\s]+/i);
            if (!urlMatch) return null;
            const linkUrl = urlMatch[0];
            let hostname = "Link";
            try {
              hostname = linkUrl.replace(/https?:\/\//i, "").split("/")[0];
            } catch {}
            return (
              <Pressable
                style={styles.linkCard}
                onPress={() => Linking.openURL(linkUrl).catch(() => {})}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="link" size={13} color="#38BDF8" />
                  <Text style={styles.linkDomainText} numberOfLines={1}>
                    {hostname}
                  </Text>
                  <Ionicons name="open-outline" size={12} color="#94A3B8" />
                </View>
                <Text style={styles.linkUrlText} numberOfLines={1}>
                  {linkUrl}
                </Text>
              </Pressable>
            );
          })()}

          <Text style={styles.timestamp}>
            {item.timestamp?.toDate
              ? item.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : item.timestamp?.seconds
              ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : ""}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (messagesLoading || !groupData) {
    return (
      <View style={[styles.center, { backgroundColor: background.mode === "solid" ? themeColors.background : "transparent" }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  const renderContent = () => (
    <>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={themeColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setShowGroupInfo(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12 }}>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupData?.name || "Group Chat"}
              </Text>
              {disappearingTimer !== "off" && (
                <View style={styles.timerPill}>
                  <Ionicons name="timer-outline" size={10} color="#10B981" />
                  <Text style={styles.timerPillText}>{disappearingTimer}</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberCount}>
              {groupData?.members?.length || 1} members
            </Text>
          </View>
          <Image
            source={{ uri: groupData?.iconURL || "https://via.placeholder.com/50" }}
            style={styles.headerIcon}
          />
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyingTo}>
            <View style={styles.replyingContent}>
              <Text style={styles.replyingLabel}>Replying to {replyTo.senderName}</Text>
              <Text style={styles.replyingText} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Feather name="x" size={20} color="#888" />
            </Pressable>
          </View>
        )}

        {/* Image Preview */}
        {pendingImage && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
            <Pressable
              style={styles.removeImageBtn}
              onPress={() => setPendingImage(null)}
            >
              <AntDesign name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Pressable onPress={pickImage} disabled={uploading}>
              <MaterialCommunityIcons
                name="image-plus"
                size={24}
                color={uploading ? "#666" : "#b36a22"}
              />
            </Pressable>

            <TextInput
              style={[styles.input, { fontSize }]}
              placeholder="Message..."
              placeholderTextColor="#888"
              value={input}
              onChangeText={setInput}
              multiline={!enterIsSend}
              blurOnSubmit={enterIsSend}
              onSubmitEditing={enterIsSend ? sendMessage : undefined}
              returnKeyType={enterIsSend ? "send" : "default"}
              maxLength={1000}
              editable={!uploading}
            />

            <Pressable
              onPress={sendMessage}
              disabled={uploading || (!input.trim() && !pendingImage)}
              style={[
                styles.sendBtn,
                (uploading || (!input.trim() && !pendingImage)) && styles.sendBtnDisabled,
              ]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>

            <GroupInfoDrawer
              visible={showGroupInfo}
              onClose={() => setShowGroupInfo(false)}
              groupId={groupId as string}
              currentUser={user}
              memberInfo={memberDetailsMap}
            />

            <UserProfileModal
              userId={selectedProfileId}
              visible={showProfileModal}
              onClose={() => setShowProfileModal(false)}
              onStartChat={(id) => {
                setShowProfileModal(false);
                router.push(`/chat/${id}` as any);
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* FULL SCREEN IMAGE VIEWER */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalTopBar}>
            {saveToGallery && selectedImage ? (
              <Pressable
                style={styles.downloadModalButton}
                onPress={() => handleSaveImageToDevice(selectedImage)}
              >
                <Ionicons name="download-outline" size={24} color="white" />
              </Pressable>
            ) : <View />}
            <Pressable style={styles.closeModalButton} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close" size={28} color="white" />
            </Pressable>
          </View>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </>
  );

  if (isCustomWallpaper && selectedWallpaper?.uri) {
    return (
      <ImageBackground
        source={{ uri: selectedWallpaper.uri }}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <SafeAreaViewContext style={[styles.container, { backgroundColor: "rgba(14, 14, 14, 0.75)" }]}>
          {renderContent()}
        </SafeAreaViewContext>
      </ImageBackground>
    );
  }

  return (
    <SafeAreaViewContext style={[styles.container, { backgroundColor: background.mode === "solid" ? themeColors.background : "transparent" }]}>
      {renderContent()}
    </SafeAreaViewContext>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0e",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0e0e0e",
  },
  header: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    gap: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  memberCount: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
    gap: 8,
  },
  ownMessage: {
    justifyContent: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 12,
  },
  ownBubble: {
    backgroundColor: "#b36a22",
  },
  otherBubble: {
    backgroundColor: "#2a2a2a",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b36a22",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: "#fff",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 4,
    textAlign: "right",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: "#b36a22",
    paddingLeft: 8,
    marginBottom: 6,
    backgroundColor: "rgba(179, 106, 34, 0.1)",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  replyText: {
    fontSize: 12,
    color: "#ccc",
    fontStyle: "italic",
  },
  inputContainer: {
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#333",
    padding: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: "#b36a22",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#666",
    opacity: 0.5,
  },
  replyingTo: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    padding: 10,
    marginHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyingContent: {
    flex: 1,
    marginRight: 10,
  },
  replyingLabel: {
    fontSize: 12,
    color: "#b36a22",
    fontWeight: "600",
  },
  replyingText: {
    fontSize: 12,
    color: "#ccc",
    marginTop: 2,
  },
  imagePreview: {
    marginHorizontal: 12,
    marginBottom: 10,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timerPillText: {
    color: "#10B981",
    fontSize: 9.5,
    fontWeight: "700",
  },
  dataSaverMediaCard: {
    width: 220,
    height: 140,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    gap: 6,
    paddingHorizontal: 10,
  },
  dataSaverMediaText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  linkCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  linkDomainText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  linkUrlText: {
    color: "#94A3B8",
    fontSize: 10,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 30) + 10,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  closeModalButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  downloadModalButton: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
  fullScreenImage: {
    width: "100%",
    height: "80%",
  },
});
