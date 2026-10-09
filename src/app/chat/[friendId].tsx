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
  StatusBar,
  ActivityIndicator,
  Modal,
  Appearance,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useChatSettings, wallpaperList } from "../../contexts/ChatSettingsContext";
import { useCall } from "../../contexts/CallContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  limit,
} from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import UserProfileModal from "../../components/UserProfileModal";

export default function ChatRoom() {
  const { friendId: rawId } = useLocalSearchParams();
  const router = useRouter();
  const { user, userData } = useUser();
  const { startCall } = useCall();
  const { isDark, themeColors, scaleFont } = useThemeToggle();

  const {
    wallpaper,
    fontSize,
    theme: chatTheme,
    enterIsSend,
    readReceipts,
    typingIndicator,
    autoDownloadMedia,
    saveToGallery,
    linkPreviews,
    disappearingTimer,
    clearedAt,
  } = useChatSettings();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [friendData, setFriendData] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string } | null>(null);
  const [reactionMsg, setReactionMsg] = useState<any | null>(null);

  // Industry-level Chat States: Typing & Data Saver
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [downloadedMediaMap, setDownloadedMediaMap] = useState<Record<string, boolean>>({});
  const typingTimeoutRef = useRef<any>(null);

  let friendId = rawId as string;
  if (friendId?.includes("_") && user) {
    const ids = friendId.split("_");
    friendId = ids.find((id) => id !== user.uid) || friendId;
  }

  const handleStartPhoneCall = () => {
    startCall({
      receiverId: friendId,
      receiverName: friendData?.displayName || friendData?.name || "BunkMate",
      receiverAvatar:
        friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150",
      receiverHandle: friendData?.username || "traveler",
      callType: "audio",
    });
  };

  const handleStartVideoCall = () => {
    startCall({
      receiverId: friendId,
      receiverName: friendData?.displayName || friendData?.name || "BunkMate",
      receiverAvatar:
        friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150",
      receiverHandle: friendData?.username || "traveler",
      callType: "video",
    });
  };

  const flatListRef = useRef<any>(null);

  const chatId = user && friendId ? [user.uid, friendId].sort().join("_") : null;

  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendData(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  // Typing indicator listener
  useEffect(() => {
    if (!chatId || !friendId || !typingIndicator) {
      setIsFriendTyping(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "chats", chatId, "typing", friendId), (snap) => {
      if (snap.exists()) {
        const d: any = snap.data();
        const isRecent = d.updatedAt && Date.now() - d.updatedAt < 4000;
        setIsFriendTyping(!!d.isTyping && isRecent);
      } else {
        setIsFriendTyping(false);
      }
    });
    return () => unsub();
  }, [chatId, friendId, typingIndicator]);

  // Messages real-time listener with clearedAt & disappearing filtering
  useEffect(() => {
    if (!chatId || !user) return;
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"), limit(300));
    const unsub = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const clearedTime = clearedAt ? new Date(clearedAt).getTime() : 0;
      const msgs: any[] = [];

      snapshot.forEach((docSnap) => {
        const data: any = docSnap.data();
        const msgTime = data.timestamp?.seconds ? data.timestamp.seconds * 1000 : now;
        // Filter out cleared messages
        if (clearedTime && msgTime < clearedTime) return;
        // Filter out expired disappearing messages
        if (data.expiresAt && data.expiresAt < now) return;
        msgs.push({ id: docSnap.id, ...data });
      });

      setMessages(msgs);

      // Only mark as read if readReceipts is enabled
      if (readReceipts) {
        msgs.forEach(async (msg) => {
          if (msg.senderId !== user.uid && !msg.isRead) {
            await updateDoc(doc(db, "chats", chatId, "messages", msg.id), { isRead: true }).catch(() => {});
          }
        });
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => unsub();
  }, [chatId, readReceipts, clearedAt]);

  const getDisappearingExpiresAt = () => {
    const nowMs = Date.now();
    if (disappearingTimer === "24h") return nowMs + 24 * 3600 * 1000;
    if (disappearingTimer === "7d") return nowMs + 7 * 24 * 3600 * 1000;
    if (disappearingTimer === "30d") return nowMs + 30 * 24 * 3600 * 1000;
    if (disappearingTimer === "90d") return nowMs + 90 * 24 * 60 * 60 * 1000;
    return null;
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    if (!typingIndicator || !chatId || !user) return;

    setDoc(
      doc(db, "chats", chatId, "typing", user.uid),
      { isTyping: true, updatedAt: Date.now() },
      { merge: true }
    ).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(
        doc(db, "chats", chatId, "typing", user.uid),
        { isTyping: false, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }, 2500);
  };

  const handleSaveImageToDevice = async (imgUri: string | null) => {
    if (!imgUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(imgUri);
      } else {
        Alert.alert("Image Saved", "Image URL copied to clipboard.");
        await Clipboard.setStringAsync(imgUri);
      }
    } catch (e: any) {
      Alert.alert("Notice", e?.message || "Could not open share/save modal");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !chatId || !user) return;
    const messageText = input;
    setInput("");
    setReplyTo(null);

    // Clear typing in Firestore
    if (typingIndicator) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setDoc(
        doc(db, "chats", chatId, "typing", user.uid),
        { isTyping: false, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }

    const expiresAt = getDisappearingExpiresAt();

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: messageText,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        expiresAt,
        replyTo: replyTo
          ? {
              text: replyTo.text,
              senderId: replyTo.senderId,
              senderName: replyTo.senderId === user.uid ? "You" : friendData?.name || friendData?.displayName || "BunkMate",
            }
          : null,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: messageText,
        lastTimestamp: serverTimestamp(),
      }).catch(async () => {
        await setDoc(doc(db, "chats", chatId), {
          participants: [user.uid, friendId],
          lastMessage: messageText,
          lastTimestamp: serverTimestamp(),
        });
      });
    } catch {
      Alert.alert("Error", "Message failed to send");
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!chatId || !user) return;
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", msgId), {
        [`reactions.${user.uid}`]: emoji,
      });
    } catch (e) {
      console.error("Reaction error:", e);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission required", "Allow access to your photo gallery to send images.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
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
  };

  const uploadImage = async () => {
    if (!chatId || !user || !pendingImage) return;

    const base64Data = pendingImage.base64;
    setPendingImage(null);
    setUploading(true);

    const expiresAt = getDisappearingExpiresAt();

    try {
      const storage = getStorage();
      const filename = `chat_images/${chatId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadString(storageRef, base64Data, "base64", {
        contentType: "image/jpeg",
      });

      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "",
        imageUrl: downloadURL,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        expiresAt,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: "📷 Image",
        lastTimestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.error("Upload Error:", error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.seconds) return "";
    const date = new Date(timestamp.seconds * 1000);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const getMessageBorderRadius = (index: number, isOwn: boolean) => {
    const msg = messages[index];
    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];

    const within1Min = (a: any, b: any) =>
      a?.timestamp?.seconds &&
      b?.timestamp?.seconds &&
      Math.abs(a.timestamp.seconds - b.timestamp.seconds) < 60;

    const samePrev = prevMsg && prevMsg.senderId === msg.senderId && within1Min(msg, prevMsg);
    const sameNext = nextMsg && nextMsg.senderId === msg.senderId && within1Min(msg, nextMsg);

    if (isOwn) {
      if (samePrev && sameNext)
        return { borderTopLeftRadius: 18, borderTopRightRadius: 6, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 };
      if (samePrev && !sameNext)
        return { borderTopLeftRadius: 18, borderTopRightRadius: 6, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 };
      if (!samePrev && sameNext)
        return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 };
      return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRight: 4 };
    } else {
      if (samePrev && sameNext)
        return { borderTopLeftRadius: 6, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 18 };
      if (samePrev && !sameNext)
        return { borderTopLeftRadius: 6, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 };
      if (!samePrev && sameNext)
        return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 18 };
      return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 4 };
    }
  };

  const handleMessageLongPress = (item: any) => {
    setReactionMsg(item);
  };

  const renderItem = ({ item, index }: any) => {
    const isOwn = item.senderId === user?.uid;
    const prev = messages[index - 1];
    const showDate = !prev || formatDate(prev.timestamp) !== formatDate(item.timestamp);
    const dynamicCorners = getMessageBorderRadius(index, isOwn);

    // Extract reaction emojis safely
    const getEmojiString = (r: any) => {
      if (typeof r === "string") return r;
      if (r && typeof r === "object") return r.emoji || r.text || "👍";
      return null;
    };
    const reactionEntries = item.reactions ? Object.values(item.reactions) : [];
    const rawLatest = reactionEntries.length > 0 ? reactionEntries[reactionEntries.length - 1] : null;
    const latestReaction = getEmojiString(rawLatest);

    // Call Log Bubble
    if (item.type === "call_log") {
      const isMissed = item.status === "missed" || item.status === "declined";
      const isVideo = item.callType === "video";

      return (
        <View style={{ width: "100%", alignItems: "center", marginVertical: 8 }}>
          <Pressable
            style={styles.callLogCard}
            onPress={() => (isVideo ? handleStartVideoCall() : handleStartPhoneCall())}
          >
            <View
              style={[
                styles.callLogIconWrap,
                isMissed && styles.callLogIconWrapMissed,
              ]}
            >
              <Ionicons
                name={isVideo ? "videocam" : "call"}
                size={16}
                color={isMissed ? "#ff5252" : "#00e6b0"}
              />
            </View>
            <View style={styles.callLogInfo}>
              <Text
                style={[
                  styles.callLogTitle,
                  isMissed && { color: "#ff8080" },
                ]}
              >
                {item.text ||
                  (isMissed
                    ? "Missed Call"
                    : `${isVideo ? "Video" : "Voice"} Call`)}
              </Text>
              <Text style={styles.callLogTime}>
                {item.timestamp?.seconds
                  ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </Text>
            </View>
            <View style={styles.callLogActionBtn}>
              <Text style={styles.callLogActionText}>Call back</Text>
            </View>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ width: "100%" }}>
        {showDate && formatDate(item.timestamp) !== "" && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
          </View>
        )}

        <View style={[styles.row, isOwn ? styles.right : styles.left]}>
          <Pressable onLongPress={() => handleMessageLongPress(item)}>
            <View
              style={[
                styles.bubble,
                dynamicCorners,
                {
                  backgroundColor: isOwn ? "#163934" : "#282a2d",
                },
              ]}
            >
              {item.replyTo && (
                <View style={styles.replyBox}>
                  <Text style={styles.replySenderName}>
                    {item.replyTo.senderName || (item.replyTo.senderId === user?.uid ? "You" : friendData?.name || "BunkMate")}
                  </Text>
                  <Text style={styles.replyText} numberOfLines={1}>
                    {typeof item.replyTo.text === "string"
                      ? item.replyTo.text
                      : typeof item.replyTo.text === "object"
                      ? item.replyTo.text?.text || "📷 Image"
                      : "📷 Image"}
                  </Text>
                </View>
              )}

              {/* Media Image with Auto-Download Data Saver */}
              {item.imageUrl && !item.deleted && (
                autoDownloadMedia || downloadedMediaMap[item.id] || isOwn ? (
                  <Pressable onPress={() => setSelectedImage(item.imageUrl)}>
                    <Image source={{ uri: item.imageUrl }} style={styles.chatImage} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setDownloadedMediaMap((prev) => ({ ...prev, [item.id]: true }))}
                    style={styles.dataSaverMediaCard}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={30} color="#FFFFFF" />
                    <Text style={styles.dataSaverMediaText}>Tap to load photo • Data Saver</Text>
                  </Pressable>
                )
              )}

              {/* Message Text */}
              {item.text || item.deleted ? (
                <Text
                  style={{
                    fontSize,
                    color: "#ffffff",
                    fontWeight: "400",
                    lineHeight: 20,
                  }}
                >
                  {item.deleted ? "🚫 This message was deleted" : item.text}
                </Text>
              ) : null}

              {/* Rich Link Preview Card */}
              {linkPreviews && item.text && !item.deleted && (() => {
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

              <View style={styles.metaRow}>
                <Text style={styles.timeText}>
                  {item.timestamp?.seconds
                    ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : ""}
                </Text>
                {/* Industry-level Read Receipts Checkmark */}
                {isOwn && (
                  <Ionicons
                    name={readReceipts && item.isRead ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={readReceipts && item.isRead ? "#38BDF8" : "#8E8E93"}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>

              {/* REACTION BADGE ON BUBBLE */}
              {latestReaction && (
                <View style={[styles.reactionBadge, isOwn ? styles.reactionOwn : styles.reactionOther]}>
                  <Text style={{ fontSize: 11 }}>{latestReaction}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const selectedWallpaper = wallpaperList.find((w) => w.id === wallpaper);
  const isCustomWallpaper = wallpaper !== "default" && !!selectedWallpaper?.uri;

  const isDarkChat =
    chatTheme === "dark" ||
    (chatTheme === "system" && (isDark ?? Appearance.getColorScheme() === "dark"));

  const chatBgColor = isDarkChat ? "#0b141a" : "#f4f4f4";

  const renderChatContent = () => (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0b141a" translucent={true} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.circleBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </Pressable>

          <Pressable
            style={styles.userPill}
            onPress={() => {
              setSelectedProfileId(friendId);
              setShowProfileModal(true);
            }}
          >
            <Image source={{ uri: friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150" }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {friendData?.displayName || friendData?.name || friendData?.username || "BunkMate"}
              </Text>
              {isFriendTyping ? (
                <Text style={{ color: "#10B981", fontSize: 11.5, fontWeight: "600" }}>typing...</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={styles.userHandle} numberOfLines={1}>
                    @{friendData?.username || "traveler"}
                  </Text>
                  {disappearingTimer !== "off" && (
                    <View style={styles.timerPill}>
                      <Ionicons name="timer-outline" size={10} color="#10B981" />
                      <Text style={styles.timerPillText}>{disappearingTimer}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable style={styles.circleBtn} onPress={handleStartPhoneCall}>
              <Ionicons name="call" size={18} color="white" />
            </Pressable>
            <Pressable style={styles.circleBtn} onPress={handleStartVideoCall}>
              <Ionicons name="videocam" size={18} color="white" />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />

        {replyTo && (
          <View style={styles.replyPreviewBar}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#25d366", fontSize: 12, fontWeight: "bold" }}>
                Replying to {replyTo.senderId === user?.uid ? "yourself" : friendData?.name || "BunkMate"}
              </Text>
              <Text style={{ color: "#ccc", fontSize: 13 }} numberOfLines={1}>
                {replyTo.text || "📷 Image"}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={22} color="#888" />
            </Pressable>
          </View>
        )}

        {/* INPUT BAR */}
        <View style={styles.inputArea}>
          <Pressable style={styles.cameraCircleBtn} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="camera" size={20} color="white" />
            )}
          </Pressable>

          <View style={styles.inputContainer}>
            <TextInput
              value={input}
              onChangeText={handleInputChange}
              placeholder="Type your message..."
              placeholderTextColor="#777777"
              style={styles.textInput}
              multiline={!enterIsSend}
              blurOnSubmit={enterIsSend}
              onSubmitEditing={enterIsSend ? sendMessage : undefined}
              returnKeyType={enterIsSend ? "send" : "default"}
            />
          </View>

          <Pressable
            style={[styles.sendButtonCircle, !input.trim() && { opacity: 0.5 }]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={18} color="#000000" style={{ marginLeft: 2 }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* QUICK REACTION & MESSAGE OPTIONS MODAL */}
      <Modal visible={!!reactionMsg} transparent animationType="fade" onRequestClose={() => setReactionMsg(null)}>
        <Pressable style={styles.reactionOverlay} onPress={() => setReactionMsg(null)}>
          <View style={styles.reactionCard}>
            {/* Quick Emojis Row */}
            <View style={styles.emojiRow}>
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    if (reactionMsg) handleReaction(reactionMsg.id, emoji);
                    setReactionMsg(null);
                  }}
                  style={styles.emojiBtn}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.reactionDivider} />

            {/* Menu Options */}
            <Pressable
              style={styles.reactionMenuItem}
              onPress={() => {
                setReplyTo(reactionMsg);
                setReactionMsg(null);
              }}
            >
              <Ionicons name="arrow-undo-outline" size={18} color="#ffffff" />
              <Text style={styles.reactionMenuText}>Reply</Text>
            </Pressable>

            {reactionMsg?.text && !reactionMsg?.deleted && (
              <Pressable
                style={styles.reactionMenuItem}
                onPress={async () => {
                  await Clipboard.setStringAsync(reactionMsg.text);
                  setReactionMsg(null);
                  Alert.alert("Copied", "Text copied to clipboard!");
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#ffffff" />
                <Text style={styles.reactionMenuText}>Copy Text</Text>
              </Pressable>
            )}

            {reactionMsg?.senderId === user?.uid && !reactionMsg?.deleted && (
              <Pressable
                style={styles.reactionMenuItem}
                onPress={async () => {
                  await updateDoc(doc(db, "chats", chatId!, "messages", reactionMsg.id), { deleted: true });
                  setReactionMsg(null);
                }}
              >
                <Feather name="trash-2" size={18} color="#ff5252" />
                <Text style={[styles.reactionMenuText, { color: "#ff5252" }]}>Delete Message</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

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

      {/* PREVIEW MODAL BEFORE SENDING AN IMAGE */}
      <Modal visible={!!pendingImage} transparent animationType="slide" onRequestClose={() => setPendingImage(null)}>
        <View style={styles.pendingModalContainer}>
          <Pressable style={styles.closeModalButton} onPress={() => setPendingImage(null)}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          {pendingImage && (
            <Image source={{ uri: pendingImage.uri }} style={styles.fullScreenImage} resizeMode="contain" />
          )}

          <View style={styles.pendingControls}>
            <Pressable style={styles.pendingSendButton} onPress={uploadImage}>
              <Text style={styles.pendingSendText}>Send Image</Text>
              <Ionicons name="send" size={18} color="#00140f" style={{ marginLeft: 8 }} />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* IN-CHAT USER PROFILE MODAL */}
      <UserProfileModal
        userId={selectedProfileId || friendId}
        userData={selectedProfileId === friendId ? friendData : null}
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onStartChat={(id) => {
          setShowProfileModal(false);
          if (id !== friendId) {
            router.push(`/chat/${id}` as any);
          }
        }}
      />
    </>
  );

  if (isCustomWallpaper && selectedWallpaper?.uri) {
    return (
      <ImageBackground
        source={{ uri: selectedWallpaper.uri }}
        style={[styles.container, { backgroundColor: chatBgColor }]}
        resizeMode="cover"
      >
        {renderChatContent()}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: chatBgColor }]}>
      {renderChatContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 48,
    paddingBottom: 10,
    backgroundColor: "rgba(11, 20, 26, 0.75)",
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1c2329",
    justifyContent: "center",
    alignItems: "center",
  },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c2329",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 25,
    flex: 0.82,
    gap: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  userName: { color: "white", fontWeight: "bold", fontSize: 13.5 },
  userHandle: { color: "#888888", fontSize: 11 },
  row: { marginVertical: 3, width: "100%" },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 13,
    paddingVertical: 8,
    position: "relative",
  },
  replyBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#25d366",
    paddingLeft: 6,
    marginBottom: 6,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 4,
    paddingVertical: 4,
    paddingRight: 6,
  },
  replySenderName: {
    color: "#25d366",
    fontSize: 11.5,
    fontWeight: "bold",
    marginBottom: 2,
  },
  replyText: {
    color: "#cccccc",
    fontSize: 12,
  },
  chatImage: {
    width: 220,
    height: 280,
    borderRadius: 10,
    marginBottom: 5,
    alignSelf: "center",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 3,
  },
  timeText: { fontSize: 10, color: "#aaaaaa" },
  dateSeparator: {
    alignSelf: "center",
    marginVertical: 14,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: { color: "#cccccc", fontSize: 11, fontWeight: "600" },
  reactionBadge: {
    position: "absolute",
    bottom: -8,
    backgroundColor: "#1e2227",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    elevation: 3,
  },
  reactionOwn: {
    right: 10,
  },
  reactionOther: {
    left: 10,
  },
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c2329",
    marginHorizontal: 12,
    padding: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#25d366",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    gap: 8,
  },
  cameraCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#23262a",
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#1c2329",
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  textInput: {
    color: "#ffffff",
    fontSize: 14,
    maxHeight: 100,
  },
  sendButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 30) + 10,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  fullScreenImage: { width: "100%", height: "80%" },
  pendingModalContainer: {
    flex: 1,
    backgroundColor: "#0e1218",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingControls: { position: "absolute", bottom: 50, width: "100%", alignItems: "center" },
  pendingSendButton: {
    flexDirection: "row",
    backgroundColor: "#00e6b0",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: "center",
    elevation: 5,
  },
  pendingSendText: { color: "#00140f", fontWeight: "bold", fontSize: 15 },
  reactionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  reactionCard: {
    width: "90%",
    backgroundColor: "#1c1e24",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  emojiBtn: {
    padding: 6,
  },
  reactionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 12,
  },
  reactionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  reactionMenuText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  callLogCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 27, 34, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    maxWidth: "88%",
  },
  callLogIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  callLogIconWrapMissed: {
    backgroundColor: "rgba(255, 82, 82, 0.15)",
  },
  callLogInfo: {
    flex: 1,
    marginRight: 10,
  },
  callLogTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  callLogTime: {
    color: "#888888",
    fontSize: 10.5,
    marginTop: 2,
  },
  callLogActionBtn: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.3)",
  },
  callLogActionText: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "700",
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
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
  downloadModalButton: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
});