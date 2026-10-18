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
  Keyboard,
  Animated,
  PanResponder,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "../../components/ui/AppBlurView";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useChatSettings, wallpaperList, DEFAULT_WALLPAPER_ASSET, getWallpaperSource } from "../../contexts/ChatSettingsContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { useCall } from "../../contexts/CallContext";
import { compressAndResizeImage } from "../../lib/imageCompressor";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../../lib/firebase";
import { useUser } from "../../contexts/UserContext";
import { MaterialCommunityIcons, Ionicons, Feather } from "@expo/vector-icons";
import UserProfileModal from "../../components/UserProfileModal";
import { sendChatMessageNotification } from "../../lib/sendAppNotification";

// Quick reactions & Extended emoji palette
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EXTENDED_EMOJIS = [
  "👍", "❤️", "😂", "😮", "😢", "🙏",
  "🔥", "🎉", "👏", "🥳", "🤩", "🚀",
  "✈️", "🏕️", "💯", "✨", "🤝", "🫶",
  "💔", "😴", "🤐", "🤯", "🥶", "🥵",
  "😎", "🤠", "😇", "🥺", "💡", "📍",
];

// Color palette for photo editor
const EDITOR_COLORS = [
  "#ffffff",
  "#00e6b0",
  "#ffd700",
  "#ff4d4d",
  "#38bdf8",
  "#c084fc",
  "#ff9800",
  "#f472b6",
  "#000000",
];

// BunkMates Travel Stickers
const TRAVEL_STICKERS = [
  { id: "s1", label: "🏕️ CAMPING VIBES" },
  { id: "s2", label: "✈️ ON TOUR" },
  { id: "s3", label: "🧭 WANDERLUST" },
  { id: "s4", label: "⛰️ SUMMIT BOUND" },
  { id: "s5", label: "🎒 BUNKED" },
  { id: "s6", label: "🔥 BONFIRE NIGHT" },
  { id: "s7", label: "📍 ROAD TRIP" },
  { id: "s8", label: "☕ ROAD COFFEE" },
  { id: "s9", label: "📸 MEMORIES" },
];

const EMOJI_STICKERS = [
  "😀", "😎", "🤩", "🥳", "🔥", "❤️", "🏕️", "✈️", "⛰️", "🧭", "🎒", "🌅", "🚗", "🏖️", "🍕", "☕",
];

// Helper: Convert local URI to native Blob
const uriToBlob = (uri: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response as Blob);
    };
    xhr.onerror = function () {
      reject(new TypeError("Network request failed: Could not load image blob"));
    };
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
};

// ─────────────────────────────────────────────────────────────
// WhatsApp-Style Swipe Right to Reply Wrapper
// ─────────────────────────────────────────────────────────────
const SwipeableMessageRow = ({
  children,
  onReply,
  isOwn,
}: {
  children: React.ReactNode;
  onReply: () => void;
  isOwn: boolean;
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const replyTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 16 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.6;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          const clamped = Math.min(gestureState.dx, 65);
          panX.setValue(clamped);
          if (clamped >= 44 && !replyTriggered.current) {
            replyTriggered.current = true;
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {}
          } else if (clamped < 44) {
            replyTriggered.current = false;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= 44) {
          onReply();
        }
        replyTriggered.current = false;
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        replyTriggered.current = false;
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 75,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const iconOpacity = panX.interpolate({
    inputRange: [0, 20, 44],
    outputRange: [0, 0.4, 1],
    extrapolate: "clamp",
  });

  const iconScale = panX.interpolate({
    inputRange: [0, 44],
    outputRange: [0.6, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width: "100%", position: "relative" }}>
      <Animated.View
        style={{
          position: "absolute",
          left: 10,
          top: "28%",
          opacity: iconOpacity,
          transform: [{ scale: iconScale }],
          zIndex: 0,
        }}
        pointerEvents="none"
      >
        <View style={styles.swipeReplyIconCircle}>
          <Ionicons name="arrow-undo" size={16} color="#00e6b0" />
        </View>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX: panX }],
          width: "100%",
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Module-level memory caches for 0ms offline rendering
// ─────────────────────────────────────────────────────────────
const memoryChatMsgs: Record<string, any[]> = {};
const memoryFriendData: Record<string, any> = {};

// ─────────────────────────────────────────────────────────────
// Main ChatRoom Component
// ─────────────────────────────────────────────────────────────
export default function ChatRoom() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;

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

  let friendId = (rawId as string) || "";
  if (friendId.includes("_") && user) {
    const ids = friendId.split("_");
    friendId = ids.find((id) => id !== user.uid) || friendId;
  }
  const chatId = user && friendId ? [user.uid, friendId].sort().join("_") : null;

  const [messages, setMessages] = useState<any[]>(
    () => (chatId && memoryChatMsgs[chatId]) || []
  );
  const [input, setInput] = useState("");
  const [friendData, setFriendData] = useState<any>(
    () => (friendId && memoryFriendData[friendId]) || null
  );
  const [replyTo, setReplyTo] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const getDisappearingExpiresAt = () => {
    const nowMs = Date.now();
    if (disappearingTimer === "24h") return nowMs + 24 * 3600 * 1000;
    if (disappearingTimer === "7d") return nowMs + 7 * 24 * 3600 * 1000;
    if (disappearingTimer === "30d") return nowMs + 30 * 24 * 3600 * 1000;
    if (disappearingTimer === "90d") return nowMs + 90 * 24 * 60 * 60 * 1000;
    return null;
  };

  // Full Screen Image Modal State (WhatsApp style)
  const [selectedImageItem, setSelectedImageItem] = useState<any | null>(null);
  const [imageReplyText, setImageReplyText] = useState("");

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Reaction Modal State
  const [reactionMsg, setReactionMsg] = useState<any | null>(null);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

  // Scroll to bottom floating button state
  const [showScrollDown, setShowScrollDown] = useState(false);

  // ── DUAL-DEVICE ADAPTIVE KEYBOARD DETECTION ──
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  const initialRootHeight = useRef(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Detect if the Android OS window already resized itself via adjustResize
  const isOsResized =
    Platform.OS === "android" &&
    initialRootHeight.current > 0 &&
    initialRootHeight.current - rootHeight > 100;

  // On phones where translucent status bar prevents adjustResize (e.g. OnePlus),
  // add keyboardHeight so the input bar moves cleanly above the keyboard.
  // On phones where adjustResize already worked, add 0 so there is no double jump.
  const androidKeyboardPadding =
    Platform.OS === "android" && keyboardHeight > 0 && !isOsResized
      ? keyboardHeight
      : 0;

  // ── MEDIA EDITOR STATE (WhatsApp-style) ──
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editorImageUri, setEditorImageUri] = useState<string | null>(null);
  const [editorCaption, setEditorCaption] = useState("");
  const [editorRotation, setEditorRotation] = useState<number>(0);
  const [editorTool, setEditorTool] = useState<"text" | "sticker" | "draw" | null>(null);

  // Text overlay state
  const [editorTextOverlays, setEditorTextOverlays] = useState<
    Array<{ id: string; text: string; color: string; fontStyle: string }>
  >([]);
  const [currentTextDraft, setCurrentTextDraft] = useState("");
  const [currentTextColor, setCurrentTextColor] = useState("#ffffff");
  const [currentFontStyle, setCurrentFontStyle] = useState("bold");

  // Sticker overlays
  const [editorStickers, setEditorStickers] = useState<
    Array<{ id: string; text: string }>
  >([]);
  const [stickerTab, setStickerTab] = useState<"stickers" | "emojis">("stickers");

  // Drawing state
  const [drawingStrokes, setDrawingStrokes] = useState<
    Array<{ color: string; width: number; points: Array<{ x: number; y: number }> }>
  >([]);
  const [drawColor, setDrawColor] = useState("#00e6b0");
  const currentPoints = useRef<Array<{ x: number; y: number }>>([]);

  const flatListRef = useRef<FlatList<any>>(null);
  const isAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  // Automatic reliable scroll to end
  const scrollToBottom = (animated = false) => {
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToEnd({ animated });
      } catch (e) {}
    }
  };

  const handleStartPhoneCall = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    startCall({
      receiverId: friendId,
      receiverName: friendData?.displayName || friendData?.name || "BunkMate",
      receiverAvatar:
        friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150",
      receiverHandle: friendData?.username || "traveler",
      callType: "video",
    });
  };

  // Friend-specific custom local chat wallpaper (WhatsApp style: local storage only!)
  const [localChatWallpaper, setLocalChatWallpaper] = useState<string | null>(null);
  const [localChatBubbleColor, setLocalChatBubbleColor] = useState<string | null>(null);
  const [localChatWallpaperDim, setLocalChatWallpaperDim] = useState<number>(0);

  useEffect(() => {
    if (!chatId) return;
    AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_${chatId}`).then((saved) => {
      setLocalChatWallpaper(saved || null);
    });
    AsyncStorage.getItem(`@bunkmates_custom_chat_bubble_color_${chatId}`).then((c) => {
      if (c) setLocalChatBubbleColor(c);
    });
    AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_dim_${chatId}`).then((d) => {
      if (d) setLocalChatWallpaperDim(parseFloat(d) || 0);
    });
  }, [chatId]);

  // Friend profile sync with offline disk cache
  useEffect(() => {
    if (!friendId) return;

    // 1. Immediately hydrate cached friend profile
    AsyncStorage.getItem(`@bunkmates_user_profile_${friendId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object") {
            memoryFriendData[friendId] = parsed;
            setFriendData((prev: any) => prev || parsed);
          }
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync
    const unsub = onSnapshot(
      doc(db, "users", friendId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          memoryFriendData[friendId] = data;
          setFriendData(data);
          AsyncStorage.setItem(
            `@bunkmates_user_profile_${friendId}`,
            JSON.stringify(data)
          ).catch(() => {});
        }
      },
      (err) => {
        console.log("[Chat] Friend profile offline fallback:", err.message);
      }
    );
    return () => unsub();
  }, [friendId]);

  // Messages listener with instant offline hydration
  useEffect(() => {
    if (!chatId || !user) return;

    // 1. Immediately hydrate from offline cache
    AsyncStorage.getItem(`@bunkmates_chat_msgs_${chatId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryChatMsgs[chatId] = parsed;
            setMessages((prev) => (prev.length > 0 ? prev : parsed));
            scrollToBottom(false);
          }
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync (auto-refreshes when net connects)
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc"),
      limit(300)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const msgs: any[] = [];
        snapshot.forEach((docSnap) =>
          msgs.push({ id: docSnap.id, ...docSnap.data() })
        );
        memoryChatMsgs[chatId] = msgs;
        setMessages(msgs);

        AsyncStorage.setItem(
          `@bunkmates_chat_msgs_${chatId}`,
          JSON.stringify(msgs)
        ).catch(() => {});

        msgs.forEach(async (msg) => {
          if (msg.senderId !== user.uid && !msg.isRead) {
            await updateDoc(
              doc(db, "chats", chatId, "messages", msg.id),
              { isRead: true }
            ).catch(() => {});
          }
        });
      },
      (err) => {
        console.log("[Chat] Messages offline fallback:", err.message);
      }
    );
    return () => unsub();
  }, [chatId, user?.uid]);

  // Automatically scroll to the last message on initial open or when near bottom
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoadRef.current || isAtBottomRef.current) {
        scrollToBottom(false);
        const t1 = setTimeout(() => {
          if (isInitialLoadRef.current || isAtBottomRef.current) scrollToBottom(false);
        }, 80);
        const t2 = setTimeout(() => {
          if (isInitialLoadRef.current || isAtBottomRef.current) scrollToBottom(false);
          isInitialLoadRef.current = false;
        }, 240);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    }
  }, [messages.length]);

  const sendMessage = async (overrideText?: string, overrideReply?: any) => {
    const textToSend = overrideText !== undefined ? overrideText : input;
    const replyTarget = overrideReply !== undefined ? overrideReply : replyTo;

    if (!textToSend.trim() && !replyTarget) return;
    if (!chatId || !user) return;

    const messageText = textToSend;
    if (overrideText === undefined) {
      setInput("");
      setReplyTo(null);
    }

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
        replyTo: replyTarget
          ? {
              id: replyTarget.id || null,
              text: replyTarget.text || (replyTarget.imageUrl ? "📷 Photo" : "Call"),
              imageUrl: replyTarget.imageUrl || null,
              senderId: replyTarget.senderId,
              senderName:
                replyTarget.senderId === user.uid
                  ? "You"
                  : friendData?.name || friendData?.displayName || "BunkMate",
            }
          : null,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: messageText || (replyTarget?.imageUrl ? "📷 Photo" : ""),
        lastTimestamp: serverTimestamp(),
        date: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        await setDoc(doc(db, "chats", chatId), {
          participants: [user.uid, friendId],
          lastMessage: messageText || (replyTarget?.imageUrl ? "📷 Photo" : ""),
          lastTimestamp: serverTimestamp(),
          date: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      sendChatMessageNotification({
        receiverId: friendId,
        senderId: user.uid,
        senderName: userData?.displayName || userData?.name || user.displayName || "BunkMate",
        senderAvatar: userData?.photoURL || userData?.avatar || user.photoURL,
        messageText,
        chatId,
      });

      isAtBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 60);
    } catch {
      Alert.alert("Error", "Message failed to send");
    }
  };

  const handleReaction = async (msgId: string, emoji: string) => {
    if (!chatId || !user) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateDoc(doc(db, "chats", chatId, "messages", msgId), {
        [`reactions.${user.uid}`]: emoji,
      });
    } catch (e) {
      console.error("Reaction error:", e);
    }
  };

  // ── PICK FULL IMAGE WITHOUT FORCED CROPPING ──
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission required", "Allow gallery access to share photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false, // FULL photo preserved, no forced cropping!
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setEditorImageUri(asset.uri);
      setEditorCaption("");
      setEditorRotation(0);
      setEditorTool(null);
      setEditorTextOverlays([]);
      setEditorStickers([]);
      setDrawingStrokes([]);
      setShowImageEditor(true);
    }
  };

  // ── UPLOAD/SHARE PHOTO SAFELY ON FREE FIREBASE SERVICE ──
  const handleSendEditedImage = async () => {
    if (!chatId || !user || !editorImageUri) return;

    const uri = editorImageUri;
    const caption = editorCaption.trim();

    setShowImageEditor(false);
    setUploading(true);

    const expiresAt = getDisappearingExpiresAt();

    try {
      // 1. Hardware/Skia compress & downscale to max 800px (< 80 KB) so it fits in Firestore easily
      const compressed = await compressAndResizeImage(uri, 800, 60);
      let downloadURL = compressed.dataUri;

      // 2. Try Firebase Storage if cloud bucket is active
      try {
        const blob = await uriToBlob(compressed.uri || uri);
        const storage = getStorage();
        const filename = `chat_images/${chatId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
        (blob as any).close?.();
        downloadURL = await getDownloadURL(storageRef);
      } catch (storageErr) {
        // Free Plan Safe Fallback: Uses the downscaled/compressed Base64 URI (~50-80 KB)
        // which never exceeds Firestore's 1,048,487 bytes document limit!
        console.log("Firebase Storage error on Free Plan, safely falling back to compressed base64 URI (size:", downloadURL.length, "bytes)");
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: caption,
        imageUrl: downloadURL,
        caption: caption || null,
        rotation: editorRotation,
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: replyTo
          ? {
              id: replyTo.id || null,
              text: replyTo.text || (replyTo.imageUrl ? "📷 Photo" : "Call"),
              imageUrl: replyTo.imageUrl || null,
              senderId: replyTo.senderId,
              senderName:
                replyTo.senderId === user.uid
                  ? "You"
                  : friendData?.name || friendData?.displayName || "BunkMate",
            }
          : null,
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: caption ? `📷 ${caption}` : "📷 Photo",
        lastTimestamp: serverTimestamp(),
        date: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      sendChatMessageNotification({
        receiverId: friendId,
        senderId: user.uid,
        senderName: userData?.displayName || userData?.name || user.displayName || "BunkMate",
        senderAvatar: userData?.photoURL || userData?.avatar || user.photoURL,
        messageText: caption ? `📷 ${caption}` : "📷 Sent a photo",
        chatId,
      });

      setReplyTo(null);
      isAtBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 80);
    } catch (error: any) {
      console.error("Upload Error:", error);
      Alert.alert("Upload Failed", error.message || "Failed to share photo");
    } finally {
      setUploading(false);
      setEditorImageUri(null);
    }
  };

  // WhatsApp-style Image Download (Handles both HTTP URLs & Base64 Data URIs)
  const handleDownloadImage = async (url: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const filename = `bunkmates_${Date.now()}.jpg`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      if (url.startsWith("data:image/")) {
        const base64Data = url.replace(/^data:image\/\w+;base64,/, "");
        await FileSystem.writeAsStringAsync(localUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.downloadAsync(url, localUri);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert("Saved", "Image downloaded successfully!");
      }
    } catch (e: any) {
      Alert.alert("Download", "Could not save photo: " + e.message);
    }
  };

  // WhatsApp-style Image Forward
  const handleForwardImage = async (item: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (item?.imageUrl && !item.imageUrl.startsWith("data:") && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(item.imageUrl);
      } else {
        setReplyTo(item);
        setSelectedImageItem(null);
      }
    } catch (e) {
      setReplyTo(item);
      setSelectedImageItem(null);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp?.toDate
      ? timestamp.toDate()
      : timestamp?.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const formatTimeStr = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp?.toDate
      ? timestamp.toDate()
      : timestamp?.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
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
      return { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 4 };
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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    setShowMoreEmojis(false);
    setReactionMsg(item);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const atBottom = distanceFromBottom < 80;
    isAtBottomRef.current = atBottom;

    if (distanceFromBottom > 160) {
      if (!showScrollDown) setShowScrollDown(true);
    } else {
      if (showScrollDown) setShowScrollDown(false);
    }
  };

  // Drawing PanResponder for Image Editor
  const drawPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editorTool === "draw",
      onMoveShouldSetPanResponder: () => editorTool === "draw",
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPoints.current = [{ x: locationX, y: locationY }];
        setDrawingStrokes((prev) => [
          ...prev,
          { color: drawColor, width: 4, points: [{ x: locationX, y: locationY }] },
        ]);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPoints.current.push({ x: locationX, y: locationY });
        setDrawingStrokes((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) {
            last.points = [...currentPoints.current];
          }
          return next;
        });
      },
      onPanResponderRelease: () => {
        currentPoints.current = [];
      },
    })
  ).current;

  const renderItem = ({ item, index }: any) => {
    const isOwn = item.senderId === user?.uid;
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const showDate = !prev || formatDate(prev.timestamp) !== formatDate(item.timestamp);
    const isNextFromSame =
      next &&
      next.senderId === item.senderId &&
      next.timestamp?.seconds &&
      item.timestamp?.seconds &&
      Math.abs(next.timestamp.seconds - item.timestamp.seconds) < 60;
    const showTime = !isNextFromSame;
    const dynamicCorners = getMessageBorderRadius(index, isOwn);

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
      const displayText = item.text || (isMissed ? `Missed\n${isVideo ? "video" : "voice"} call` : `${isVideo ? "Video" : "Voice"}\ncall`);

      return (
        <SwipeableMessageRow
          key={item.id}
          isOwn={isOwn}
          onReply={() => {
            setReplyTo(item);
          }}
        >
          <View style={{ width: "100%", marginVertical: 3 }}>
            {showDate && formatDate(item.timestamp) !== "" && (
              <View style={styles.dateSeparator}>
                <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
              </View>
            )}

            <View style={[styles.row, isOwn ? styles.right : styles.left]}>
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  isVideo ? handleStartVideoCall() : handleStartPhoneCall();
                }}
                onLongPress={() => handleMessageLongPress(item)}
              >
                <View
                  style={[
                    styles.bubble,
                    { maxWidth: isTablet ? 460 : "82%" },
                    dynamicCorners,
                    isOwn ? styles.bubbleOutgoing : styles.bubbleIncoming,
                    isOwn && !!localChatBubbleColor ? { backgroundColor: localChatBubbleColor } : null,
                  ]}
                >
                  <Text style={styles.bubbleText}>
                    {displayText.includes("\n") ? displayText : displayText.replace("Missed ", "Missed\n")}
                  </Text>
                </View>
              </Pressable>

              {showTime && (
                isOwn ? (
                  <View style={styles.timeRowOutsideRight}>
                    <Text style={styles.timeTextOutside}>
                      {formatTimeStr(item.timestamp)}
                    </Text>
                    <Ionicons
                      name="checkmark-done"
                      size={13}
                      color={item.isRead ? "#38bdf8" : "#ffffff"}
                      style={{ marginLeft: 3 }}
                    />
                  </View>
                ) : (
                  <Text style={styles.timeTextOutsideLeft}>
                    {formatTimeStr(item.timestamp)}
                  </Text>
                )
              )}
            </View>
          </View>
        </SwipeableMessageRow>
      );
    }

    // Regular Message / Image Bubble
    return (
      <SwipeableMessageRow
        key={item.id}
        isOwn={isOwn}
        onReply={() => {
          setReplyTo(item);
        }}
      >
        <View style={{ width: "100%", marginVertical: 3 }}>
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
                  { maxWidth: isTablet ? 480 : "82%" },
                  dynamicCorners,
                  isOwn ? styles.bubbleOutgoing : styles.bubbleIncoming,
                  isOwn && !!localChatBubbleColor ? { backgroundColor: localChatBubbleColor } : null,
                ]}
              >
                {/* Replied Content Preview inside Bubble */}
                {item.replyTo && (
                  <View style={styles.replyBox}>
                    <Text style={styles.replySenderName}>
                      {item.replyTo.senderName || (item.replyTo.senderId === user?.uid ? "You" : friendData?.name || "BunkMate")}
                    </Text>
                    {item.replyTo.imageUrl && (
                      <ExpoImage
                        source={{ uri: item.replyTo.imageUrl }}
                        style={styles.replyThumbImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    )}
                    <Text style={styles.replyText} numberOfLines={1}>
                      {typeof item.replyTo.text === "string"
                        ? item.replyTo.text
                        : typeof item.replyTo.text === "object"
                        ? item.replyTo.text?.text || "📷 Photo"
                        : "📷 Photo"}
                    </Text>
                  </View>
                )}

                {/* Full Photo in Bubble (Persisted on Disk for 0ms Offline Display) */}
                {item.imageUrl && !item.deleted && (
                  <Pressable
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch (e) {}
                      setSelectedImageItem(item);
                      setImageReplyText("");
                    }}
                  >
                    <ExpoImage
                      source={{ uri: item.imageUrl }}
                      style={[
                        styles.chatImage,
                        {
                          width: Math.min(windowWidth * 0.7, 280),
                          height: Math.min(windowWidth * 0.7, 280) * 1.15,
                        },
                        item.rotation ? { transform: [{ rotate: `${item.rotation}deg` }] } : null,
                      ]}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                    />
                  </Pressable>
                )}

                {/* Message Text or Photo Caption */}
                {item.text || item.deleted ? (
                  <Text style={[styles.bubbleText, item.imageUrl && { marginTop: 4 }]}>
                    {item.deleted ? "🚫 This message was deleted" : item.text}
                  </Text>
                ) : null}

                {/* Reaction Badge on Bubble */}
                {latestReaction && (
                  <View style={[styles.reactionBadge, isOwn ? styles.reactionOwn : styles.reactionOther]}>
                    <Text style={{ fontSize: 11 }}>{latestReaction}</Text>
                  </View>
                )}
              </View>
            </Pressable>

            {showTime && (
              isOwn ? (
                <View style={styles.timeRowOutsideRight}>
                  <Text style={styles.timeTextOutside}>
                    {formatTimeStr(item.timestamp)}
                  </Text>
                  <Ionicons
                    name="checkmark-done"
                    size={13}
                    color={item.isRead ? "#38bdf8" : "#ffffff"}
                    style={{ marginLeft: 3 }}
                  />
                </View>
              ) : (
                <Text style={styles.timeTextOutsideLeft}>
                  {formatTimeStr(item.timestamp)}
                </Text>
              )
            )}
          </View>
        </View>
      </SwipeableMessageRow>
    );
  };

  const defaultBgSource = DEFAULT_WALLPAPER_ASSET;
  const isCustomWallpaper = wallpaper && wallpaper !== "default";
  const customWallpaperItem = isCustomWallpaper
    ? wallpaperList.find((w) => w.id === wallpaper)
    : null;

  // Friend-specific custom wallpaper or global theme wallpaper (offline bundled + local storage safe)
  const backgroundSource = getWallpaperSource(localChatWallpaper || wallpaper);

  const isDarkChat =
    chatTheme === "dark" ||
    (chatTheme === "system" && Appearance.getColorScheme() === "dark") ||
    true;

  const headerTopPad = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : insets.top + 6;
  const HEADER_TOTAL_HEIGHT = headerTopPad + 52;

  return (
    <ImageBackground
      source={backgroundSource}
      style={[styles.container, { backgroundColor: isDarkChat ? "#0b141a" : "#f4f4f4" }]}
      resizeMode="cover"
      blurRadius={showProfileModal ? (Platform.OS === "android" ? 35 : 25) : 0}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (!initialRootHeight.current || (h > initialRootHeight.current && keyboardHeight === 0)) {
          initialRootHeight.current = h;
        }
        setRootHeight(h);
      }}
    >
      {/* Dynamic Wallpaper Dimming Layer (from local customizer) */}
      {localChatWallpaperDim > 0 && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `rgba(0, 0, 0, ${localChatWallpaperDim})` },
          ]}
          pointerEvents="none"
        />
      )}

      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/* TOP GRADIENT FADE: Messages & photos smoothly dissolve / blur into the background as they scroll up */}
        {!showProfileModal && (
          <LinearGradient
            colors={[
              "rgba(11, 20, 27, 0.98)",
              "rgba(11, 20, 27, 0.90)",
              "rgba(11, 20, 27, 0.65)",
              "rgba(11, 20, 27, 0.30)",
              "rgba(11, 20, 27, 0.08)",
              "transparent",
            ]}
            locations={[0, 0.38, 0.62, 0.80, 0.92, 1]}
            pointerEvents="none"
            style={[
              styles.topGradientFade,
              { height: HEADER_TOTAL_HEIGHT + 36 },
            ]}
          />
        )}

        {/* TOP FLOATING HEADER (Image 3 Style: Floating circle buttons & User pill without rectangular card) */}
        {!showProfileModal && (
          <View style={[styles.headerFloatingWrap, { paddingTop: headerTopPad }]}>
            <View style={styles.headerInnerRow}>
              <Pressable style={styles.circleBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={20} color="white" />
              </Pressable>

              <Pressable
                style={[styles.userPill, isTablet && { maxWidth: 360 }]}
                onPress={() => {
                  setSelectedProfileId(friendId);
                  setShowProfileModal(true);
                }}
              >
                <ExpoImage
                  source={{
                    uri: friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150",
                  }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {friendData?.displayName || friendData?.name || friendData?.username || "BunkMate"}
                  </Text>
                  <Text style={styles.userHandle} numberOfLines={1}>
                    @{friendData?.username || "traveler"}
                  </Text>
                </View>
              </Pressable>

              {/* Video & Voice Call Icons */}
              <View style={styles.headerActions}>
                <Pressable style={styles.circleBtn} onPress={handleStartVideoCall}>
                  <Ionicons name="videocam" size={18} color="white" />
                </Pressable>
                <Pressable style={styles.circleBtn} onPress={handleStartPhoneCall}>
                  <Ionicons name="call" size={17} color="white" />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* MESSAGE LIST: Auto scrolls and flows underneath floating top header and bottom bar */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={showProfileModal ? { opacity: 0 } : undefined}
          contentContainerStyle={{
            paddingTop: HEADER_TOTAL_HEIGHT + 10,
            paddingBottom: 28,
            paddingHorizontal: 14,
          }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            isAtBottomRef.current = false;
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={() => {
            if (isInitialLoadRef.current && messages.length > 0) {
              scrollToBottom(false);
            }
          }}
          onContentSizeChange={() => {
            if (isInitialLoadRef.current) {
              scrollToBottom(false);
              isInitialLoadRef.current = false;
            }
          }}
        />

        {/* Floating WhatsApp-Style Scroll to Bottom Button */}
        {showScrollDown && !showProfileModal && (
          <Pressable
            style={[styles.scrollToBottomBtn, { bottom: 85 + (androidKeyboardPadding > 0 ? 10 : 0) }]}
            onPress={() => {
              isAtBottomRef.current = true;
              scrollToBottom(true);
            }}
          >
            <Ionicons name="chevron-down" size={20} color="#00e6b0" />
          </Pressable>
        )}

        {/* BOTTOM GRADIENT FADE: Messages & photos smoothly dissolve / blur into the background as they scroll down */}
        {!showProfileModal && (
          <LinearGradient
            colors={[
              "transparent",
              "rgba(11, 20, 27, 0.08)",
              "rgba(11, 20, 27, 0.35)",
              "rgba(11, 20, 27, 0.70)",
              "rgba(11, 20, 27, 0.90)",
              "rgba(11, 20, 27, 0.98)",
            ]}
            locations={[0, 0.15, 0.35, 0.60, 0.82, 1]}
            pointerEvents="none"
            style={[
              styles.bottomGradientFade,
              {
                height:
                  115 +
                  Math.max(insets.bottom, 8) +
                  (androidKeyboardPadding > 0 ? androidKeyboardPadding : 0),
              },
            ]}
          />
        )}

        {/* BOTTOM FLOATING INPUT BAR (Image 3 Style: Floating buttons without rectangular card) */}
        {!showProfileModal && (
          <Animated.View style={{ marginBottom: androidKeyboardPadding }}>
            <View
              style={[
                styles.bottomBarFloatingWrap,
                { paddingBottom: Math.max(insets.bottom, 8) + 6 },
              ]}
            >
              {/* WhatsApp-Style Reply Preview Bar */}
              {replyTo && (
                <View style={styles.replyPreviewBar}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replyPreviewTitle}>
                      Replying to {replyTo.senderId === user?.uid ? "yourself" : friendData?.name || "BunkMate"}
                    </Text>
                    <Text style={styles.replyPreviewSubtitle} numberOfLines={1}>
                      {replyTo.text || (replyTo.imageUrl ? "📷 Photo" : "Call")}
                    </Text>
                  </View>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
                    <Ionicons name="close" size={20} color="#aaaaaa" />
                  </Pressable>
                </View>
              )}

              {/* Input Row */}
              <View style={styles.inputArea}>
                <Pressable style={styles.cameraCircleBtn} onPress={pickImage} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#00e6b0" />
                  ) : (
                    <Feather name="camera" size={20} color="white" />
                  )}
                </Pressable>

                <View style={styles.inputContainer}>
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your message..."
                    placeholderTextColor="#777777"
                    style={styles.textInput}
                    multiline
                  />
                </View>

                <Pressable
                  style={[
                    styles.sendButtonCircle,
                    input.trim()
                      ? { backgroundColor: "#00e6b0" }
                      : { backgroundColor: "#3e444c", opacity: 0.65 },
                  ]}
                  onPress={() => sendMessage()}
                  disabled={!input.trim()}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color={input.trim() ? "#000000" : "rgba(255,255,255,0.7)"}
                    style={{ marginLeft: 2 }}
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      {/* ─────────────────────────────────────────────────────────────
          BUNKMATES IN-APP MEDIA EDITOR MODAL (WhatsApp-style)
         ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showImageEditor}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowImageEditor(false)}
      >
        <View style={styles.editorModalRoot}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {/* Top Editing Tools Bar */}
          <View style={[styles.editorTopBar, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
            <Pressable
              style={styles.editorIconBtn}
              onPress={() => setShowImageEditor(false)}
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </Pressable>

            <View style={styles.editorToolsRow}>
              {/* Rotate Tool */}
              <Pressable
                style={styles.editorIconBtn}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  setEditorRotation((prev) => (prev + 90) % 360);
                }}
              >
                <Ionicons name="crop" size={22} color="#ffffff" />
              </Pressable>

              {/* Stickers & Emojis Tool */}
              <Pressable
                style={[styles.editorIconBtn, editorTool === "sticker" && styles.editorToolActive]}
                onPress={() => {
                  setEditorTool(editorTool === "sticker" ? null : "sticker");
                }}
              >
                <Ionicons name="happy-outline" size={23} color="#ffffff" />
              </Pressable>

              {/* Text Overlay Tool (Aa) */}
              <Pressable
                style={[styles.editorIconBtn, editorTool === "text" && styles.editorToolActive]}
                onPress={() => {
                  setEditorTool(editorTool === "text" ? null : "text");
                }}
              >
                <Text style={styles.aaTextIcon}>Aa</Text>
              </Pressable>

              {/* Pen / Draw Tool */}
              <Pressable
                style={[styles.editorIconBtn, editorTool === "draw" && styles.editorToolActive]}
                onPress={() => {
                  setEditorTool(editorTool === "draw" ? null : "draw");
                }}
              >
                <Ionicons name="pencil-outline" size={22} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          {/* Canvas Photo Display with Overlays */}
          <View style={styles.editorCanvasArea} {...(editorTool === "draw" ? drawPanResponder.panHandlers : {})}>
            {editorImageUri && (
              <Image
                source={{ uri: editorImageUri }}
                style={[
                  styles.editorFullImage,
                  { transform: [{ rotate: `${editorRotation}deg` }] },
                ]}
                resizeMode="contain"
              />
            )}

            {/* Rendered Text Overlays */}
            {editorTextOverlays.map((item) => (
              <View key={item.id} style={styles.textOverlayPill}>
                <Text
                  style={[
                    styles.textOverlayContent,
                    { color: item.color },
                    item.fontStyle === "bold" && { fontWeight: "900" },
                    item.fontStyle === "italic" && { fontStyle: "italic" },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            ))}

            {/* Rendered Sticker Overlays */}
            {editorStickers.map((item) => (
              <View key={item.id} style={styles.stickerOverlayPill}>
                <Text style={styles.stickerOverlayText}>{item.text}</Text>
              </View>
            ))}

            {/* Rendered Drawing Strokes */}
            {drawingStrokes.map((stroke, sIdx) => (
              <React.Fragment key={`stroke-${sIdx}`}>
                {stroke.points.map((pt, pIdx) => (
                  <View
                    key={`pt-${pIdx}`}
                    style={[
                      styles.drawDot,
                      {
                        left: pt.x - 3,
                        top: pt.y - 3,
                        backgroundColor: stroke.color,
                        width: stroke.width,
                        height: stroke.width,
                      },
                    ]}
                  />
                ))}
              </React.Fragment>
            ))}
          </View>

          {/* ── SUB-PANEL: TEXT TOOL EDITOR ── */}
          {editorTool === "text" && (
            <View style={styles.textToolPanel}>
              <View style={styles.textToolTopRow}>
                <Text style={styles.subToolTitle}>Add Text</Text>
                <Pressable
                  style={styles.doneBtn}
                  onPress={() => {
                    if (currentTextDraft.trim()) {
                      setEditorTextOverlays((prev) => [
                        ...prev,
                        {
                          id: String(Date.now()),
                          text: currentTextDraft.trim(),
                          color: currentTextColor,
                          fontStyle: currentFontStyle,
                        },
                      ]);
                      setCurrentTextDraft("");
                    }
                    setEditorTool(null);
                  }}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              </View>

              <TextInput
                value={currentTextDraft}
                onChangeText={setCurrentTextDraft}
                placeholder="Type text overlay..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.textOverlayInput, { color: currentTextColor }]}
                autoFocus
              />

              {/* Colors Row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorsScroll}>
                {EDITOR_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCurrentTextColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      currentTextColor === c && styles.colorDotActive,
                    ]}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── SUB-PANEL: DRAW TOOL CONTROLS ── */}
          {editorTool === "draw" && (
            <View style={styles.drawToolPanel}>
              <View style={styles.textToolTopRow}>
                <Pressable
                  style={styles.undoBtn}
                  onPress={() => {
                    setDrawingStrokes((prev) => prev.slice(0, -1));
                  }}
                >
                  <Ionicons name="arrow-undo" size={18} color="#ffffff" />
                  <Text style={styles.undoBtnText}>Undo</Text>
                </Pressable>

                <Pressable style={styles.doneBtn} onPress={() => setEditorTool(null)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorsScroll}>
                {EDITOR_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setDrawColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      drawColor === c && styles.colorDotActive,
                    ]}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── SUB-PANEL: STICKER & EMOJI TRAY ── */}
          {editorTool === "sticker" && (
            <View style={styles.stickerTrayPanel}>
              <View style={styles.stickerTabsRow}>
                <Pressable
                  style={[styles.stickerTabBtn, stickerTab === "stickers" && styles.stickerTabBtnActive]}
                  onPress={() => setStickerTab("stickers")}
                >
                  <Text style={[styles.stickerTabText, stickerTab === "stickers" && styles.stickerTabTextActive]}>
                    BunkMates Stickers
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.stickerTabBtn, stickerTab === "emojis" && styles.stickerTabBtnActive]}
                  onPress={() => setStickerTab("emojis")}
                >
                  <Text style={[styles.stickerTabText, stickerTab === "emojis" && styles.stickerTabTextActive]}>
                    Emojis
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.closeTrayBtn}
                  onPress={() => setEditorTool(null)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickersScroll}>
                {stickerTab === "stickers"
                  ? TRAVEL_STICKERS.map((st) => (
                      <Pressable
                        key={st.id}
                        style={styles.travelBadgeChip}
                        onPress={() => {
                          setEditorStickers((prev) => [...prev, { id: String(Date.now()), text: st.label }]);
                          setEditorTool(null);
                        }}
                      >
                        <Text style={styles.travelBadgeText}>{st.label}</Text>
                      </Pressable>
                    ))
                  : EMOJI_STICKERS.map((em, i) => (
                      <Pressable
                        key={`em-${i}`}
                        style={styles.emojiChip}
                        onPress={() => {
                          setEditorStickers((prev) => [...prev, { id: String(Date.now()), text: em }]);
                          setEditorTool(null);
                        }}
                      >
                        <Text style={{ fontSize: 30 }}>{em}</Text>
                      </Pressable>
                    ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Bar: Caption input & Send Button (WhatsApp-style) */}
          <View style={[styles.editorBottomBar, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
            {/* Recipient name indicator */}
            <View style={styles.recipientPill}>
              <ExpoImage
                source={{ uri: friendData?.photoURL || friendData?.avatar || "https://i.pravatar.cc/150" }}
                style={styles.recipientAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <Text style={styles.recipientNameText} numberOfLines={1}>
                {friendData?.displayName || friendData?.name || "BunkMate"}
              </Text>
            </View>

            {/* Caption Input */}
            <View style={styles.captionInputContainer}>
              <Ionicons name="image-outline" size={20} color="#00e6b0" style={{ marginRight: 8 }} />
              <TextInput
                value={editorCaption}
                onChangeText={setEditorCaption}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255, 255, 255, 0.45)"
                style={styles.captionTextInput}
              />
            </View>

            {/* Circular Send Button */}
            <Pressable style={styles.editorSendBtn} onPress={handleSendEditedImage}>
              <Ionicons name="send" size={19} color="#000000" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          WhatsApp-Style Long Press Floating Reaction & Options Modal
         ───────────────────────────────────────────────────────────── */}
      <Modal visible={!!reactionMsg} transparent animationType="fade" onRequestClose={() => setReactionMsg(null)}>
        <Pressable style={styles.reactionOverlay} onPress={() => setReactionMsg(null)}>
          <View style={styles.reactionCard}>
            {/* Emojis Row with '+' button */}
            <View style={styles.emojiRowWrap}>
              {(showMoreEmojis ? EXTENDED_EMOJIS : QUICK_EMOJIS).map((emoji) => (
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

              <Pressable
                style={styles.plusEmojiBtn}
                onPress={() => setShowMoreEmojis(!showMoreEmojis)}
              >
                <Ionicons name={showMoreEmojis ? "chevron-up" : "add"} size={20} color="#ffffff" />
              </Pressable>
            </View>

            <View style={styles.reactionDivider} />

            {/* Menu Options: Reply */}
            <Pressable
              style={styles.reactionMenuItem}
              onPress={() => {
                setReplyTo(reactionMsg);
                setReactionMsg(null);
              }}
            >
              <Ionicons name="arrow-undo-outline" size={18} color="#00e6b0" />
              <Text style={styles.reactionMenuText}>Reply</Text>
            </Pressable>

            {/* Menu Option: Copy */}
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

            {/* Menu Option: Forward / Share */}
            {reactionMsg?.imageUrl && (
              <Pressable
                style={styles.reactionMenuItem}
                onPress={() => {
                  handleForwardImage(reactionMsg);
                  setReactionMsg(null);
                }}
              >
                <Ionicons name="arrow-redo-outline" size={18} color="#ffffff" />
                <Text style={styles.reactionMenuText}>Forward</Text>
              </Pressable>
            )}

            {/* Menu Option: Delete */}
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

      {/* ─────────────────────────────────────────────────────────────
          WhatsApp-Style Full Screen Image Viewer Modal
         ───────────────────────────────────────────────────────────── */}
      <Modal visible={!!selectedImageItem} transparent animationType="fade" onRequestClose={() => setSelectedImageItem(null)}>
        <View style={styles.fullScreenImageContainer}>
          {/* Top WhatsApp-Style Bar */}
          <View style={[styles.fullScreenImageHeader, { paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : insets.top + 8 }]}>
            <Pressable style={styles.imageBackBtn} onPress={() => setSelectedImageItem(null)}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.imageHeaderTitle} numberOfLines={1}>
                {selectedImageItem?.senderId === user?.uid
                  ? "You"
                  : friendData?.displayName || friendData?.name || "BunkMate"}
              </Text>
              <Text style={styles.imageHeaderSubtitle}>
                {selectedImageItem ? `${formatDate(selectedImageItem.timestamp)} • ${formatTimeStr(selectedImageItem.timestamp)}` : ""}
              </Text>
            </View>

            {/* Actions: Forward and Download */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable
                onPress={() => handleForwardImage(selectedImageItem)}
                style={styles.imageTopActionBtn}
              >
                <Ionicons name="arrow-redo" size={20} color="white" />
              </Pressable>

              <Pressable
                onPress={() => selectedImageItem?.imageUrl && handleDownloadImage(selectedImageItem.imageUrl)}
                style={styles.imageTopActionBtn}
              >
                <Ionicons name="arrow-down-circle" size={22} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Full Screen Image */}
          {selectedImageItem?.imageUrl && (
            <ExpoImage
              source={{ uri: selectedImageItem.imageUrl }}
              style={[
                styles.fullScreenImage,
                selectedImageItem.rotation ? { transform: [{ rotate: `${selectedImageItem.rotation}deg` }] } : null,
              ]}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}

          {/* Bottom WhatsApp-Style Reaction & Message Bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.fullScreenBottomBar, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}
          >
            {/* Quick Reactions Bar */}
            <View style={styles.imageReactionsRow}>
              {QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    if (selectedImageItem) {
                      handleReaction(selectedImageItem.id, emoji);
                    }
                  }}
                  style={styles.imageEmojiPill}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Send Reply to this Photo */}
            <View style={styles.imageInputRow}>
              <View style={styles.imageInputContainer}>
                <TextInput
                  value={imageReplyText}
                  onChangeText={setImageReplyText}
                  placeholder="Reply to this photo..."
                  placeholderTextColor="#777777"
                  style={styles.imageTextInput}
                />
              </View>

              <Pressable
                style={[styles.imageSendBtn, !imageReplyText.trim() && { opacity: 0.5 }]}
                disabled={!imageReplyText.trim()}
                onPress={() => {
                  if (selectedImageItem && imageReplyText.trim()) {
                    sendMessage(imageReplyText, selectedImageItem);
                    setImageReplyText("");
                    setSelectedImageItem(null);
                  }
                }}
              >
                <Ionicons name="send" size={17} color="#000000" style={{ marginLeft: 2 }} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* IN-CHAT USER PROFILE MODAL */}
      <UserProfileModal
        userId={selectedProfileId || friendId}
        userData={selectedProfileId === friendId ? friendData : null}
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onWallpaperChange={(newWp, bubbleColor, dimLevel) => {
          setLocalChatWallpaper(newWp);
          if (bubbleColor) setLocalChatBubbleColor(bubbleColor);
          if (dimLevel !== undefined) setLocalChatWallpaperDim(dimLevel);
        }}
        onStartChat={(id) => {
          setShowProfileModal(false);
          if (id !== friendId) {
            router.push(`/chat/${id}` as any);
          }
        }}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  swipeReplyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 230, 176, 0.22)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.4)",
  },
  topGradientFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  bottomGradientFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  headerFloatingWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "transparent",
  },
  headerInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  bottomBarFloatingWrap: {
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    zIndex: 20,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1c2329",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c2329",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 25,
    flexShrink: 1,
    flex: 1,
    marginHorizontal: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  userName: { color: "white", fontWeight: "bold", fontSize: 13.5 },
  userHandle: { color: "#888888", fontSize: 11 },
  row: { marginVertical: 3, width: "100%" },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    position: "relative",
  },
  bubbleOutgoing: {
    backgroundColor: "#133e36", // Pine / Emerald Teal
  },
  bubbleIncoming: {
    backgroundColor: "#282a2d", // Dark Slate Grey
  },
  bubbleText: {
    color: "#ffffff",
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "400",
  },
  timeRowOutsideRight: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 3,
    marginRight: 4,
    backgroundColor: "rgba(10, 14, 22, 0.68)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
  },
  timeTextOutside: {
    fontSize: 10.5,
    color: "#ffffff",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timeTextOutsideLeft: {
    fontSize: 10.5,
    color: "#ffffff",
    fontWeight: "600",
    alignSelf: "flex-start",
    marginTop: 3,
    marginLeft: 4,
    backgroundColor: "rgba(10, 14, 22, 0.68)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  replyBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#00e6b0",
    paddingLeft: 6,
    marginBottom: 6,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingRight: 6,
  },
  replyThumbImage: {
    width: 36,
    height: 36,
    borderRadius: 4,
    marginVertical: 4,
  },
  replySenderName: {
    color: "#00e6b0",
    fontSize: 11.5,
    fontWeight: "bold",
    marginBottom: 2,
  },
  replyText: {
    color: "#cccccc",
    fontSize: 12,
  },
  chatImage: {
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: "center",
  },
  dateSeparator: {
    alignSelf: "center",
    marginVertical: 12,
    backgroundColor: "rgba(14, 18, 26, 0.78)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dateText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
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
  scrollToBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 80,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1c2329",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 99,
  },
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(28, 35, 41, 0.95)",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderLeftWidth: 4,
    borderLeftColor: "#00e6b0",
  },
  replyPreviewTitle: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "bold",
  },
  replyPreviewSubtitle: {
    color: "#ccc",
    fontSize: 13,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    backgroundColor: "transparent",
  },
  cameraCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1c2329",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#1c2329",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 46,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  textInput: {
    color: "#ffffff",
    fontSize: 14.5,
    maxHeight: 100,
  },
  sendButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3e444c",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  reactionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  reactionCard: {
    width: "90%",
    maxWidth: 420,
    backgroundColor: "#1c1e24",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  emojiRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  emojiBtn: {
    padding: 7,
  },
  plusEmojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
  },
  reactionDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 12,
  },
  reactionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 12,
  },
  reactionMenuText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "600",
  },
  // Full Screen Image Viewer Modal Styles
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.98)",
    justifyContent: "space-between",
  },
  fullScreenImageHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(11, 20, 26, 0.85)",
  },
  imageBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageHeaderTitle: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  imageHeaderSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11.5,
    marginTop: 1,
  },
  imageTopActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    flex: 1,
    width: "100%",
  },
  fullScreenBottomBar: {
    backgroundColor: "rgba(11, 20, 26, 0.9)",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  imageReactionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
  },
  imageEmojiPill: {
    padding: 6,
  },
  imageInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  imageInputContainer: {
    flex: 1,
    backgroundColor: "#1c2026",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  imageTextInput: {
    color: "#ffffff",
    fontSize: 14,
  },
  imageSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00e6b0",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── MEDIA EDITOR STYLES ──
  editorModalRoot: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  editorTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    zIndex: 20,
  },
  editorToolsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  editorIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  editorToolActive: {
    backgroundColor: "#00e6b0",
  },
  aaTextIcon: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },
  editorCanvasArea: {
    flex: 1,
    width: "100%",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  editorFullImage: {
    width: "100%",
    height: "100%",
  },
  textOverlayPill: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  textOverlayContent: {
    fontSize: 22,
    textAlign: "center",
  },
  stickerOverlayPill: {
    position: "absolute",
    backgroundColor: "rgba(0, 230, 176, 0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#00e6b0",
  },
  stickerOverlayText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  drawDot: {
    position: "absolute",
    borderRadius: 4,
  },
  textToolPanel: {
    position: "absolute",
    top: 90,
    left: 20,
    right: 20,
    backgroundColor: "rgba(20, 25, 32, 0.95)",
    borderRadius: 18,
    padding: 16,
    zIndex: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  textToolTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  subToolTitle: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  doneBtn: {
    backgroundColor: "#00e6b0",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  doneBtnText: {
    color: "#00140f",
    fontWeight: "bold",
    fontSize: 13,
  },
  textOverlayInput: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 10,
  },
  colorsScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  colorDotActive: {
    borderColor: "#ffffff",
    transform: [{ scale: 1.2 }],
  },
  drawToolPanel: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: "rgba(20, 25, 32, 0.95)",
    borderRadius: 18,
    padding: 14,
    zIndex: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  undoBtnText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "600",
  },
  stickerTrayPanel: {
    position: "absolute",
    bottom: 90,
    left: 12,
    right: 12,
    backgroundColor: "rgba(18, 22, 28, 0.97)",
    borderRadius: 20,
    padding: 14,
    zIndex: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  stickerTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  stickerTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  stickerTabBtnActive: {
    backgroundColor: "#00e6b0",
  },
  stickerTabText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "bold",
  },
  stickerTabTextActive: {
    color: "#00140f",
  },
  closeTrayBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  stickersScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  travelBadgeChip: {
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#00e6b0",
  },
  travelBadgeText: {
    color: "#00e6b0",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  emojiChip: {
    padding: 6,
  },
  editorBottomBar: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
    zIndex: 20,
  },
  recipientPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1c2329",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
    marginBottom: 4,
  },
  recipientAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  recipientNameText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  captionInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c2026",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  captionTextInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14.5,
  },
  editorSendBtn: {
    position: "absolute",
    right: 14,
    bottom: 20,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#00e6b0",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
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