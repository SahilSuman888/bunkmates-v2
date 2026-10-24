import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
  ImageBackground,
  Linking,
  BackHandler,
  Keyboard,
  Animated,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView as SafeAreaViewContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../contexts/UserContext";
import { useGroupChat } from "../../../hooks/useGroupChat";
import { useCall } from "../../../contexts/CallContext";
import {
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { saveImageToGallery, autoSaveIncomingMedia, shareOrExportImage } from "../../../lib/chatMediaService";
import GroupInfoDrawer from "../../../components/group_chat/GroupInfoDrawer";
import UserProfileModal from "../../../components/UserProfileModal";
import { BlurView } from "expo-blur";
import { sendGroupChatMessageNotification } from "../../../lib/sendAppNotification";
import { DEFAULT_WALLPAPER_ASSET, getWallpaperSource, useChatSettings } from "../../../contexts/ChatSettingsContext";
import LinkPreviewCard from "../../../components/chat/LinkPreviewCard";
import WallpaperThemePreviewModal from "../../../components/chat/WallpaperThemePreviewModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeToggle } from "../../../contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_GROUP_AVATAR = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=200";
const DARK_WAVE_WALLPAPER = DEFAULT_WALLPAPER_ASSET;

const DEFAULT_CHECKLIST_ITEMS = [
  "Travel Adapter",
  "Water Bottle",
  "Rain Gear",
  "Speaker",
  "Warm Clothing",
  "Government IDs & Tickets",
];

const DEFAULT_TIMELINE_EVENTS = [
  { text: "Day 3 - To Massoorie Exploration", time: "2026-04-05T06:10", completed: true },
  { text: "Day 1 - Arrival & Explore Dehradun local and famous places", time: "2026-04-03T13:10", completed: true },
  { text: "Day 0 - Towards Dehradun", time: "2026-04-02T17:30", completed: true },
  { text: "Visit Mall Road", time: "2026-04-02T10:00", completed: true },
  { text: "Day 4 - Explore rest in Mussoorie & Dehradun and Departure", time: "2026-04-06T06:10", completed: true },
  { text: "Day 3 - Camping in Tathyur... 🥳🏕️", time: "2026-04-05T13:10", completed: false, isHighlight: true },
  { text: "Day 2 - To Rishikesh", time: "2026-04-04T07:10", completed: true },
];

const QUICK_EMOJIS = ["❤️", "😂", "👍", "😁", "👌"];
const ALL_EMOJIS = ["❤️", "😂", "👍", "😁", "👌", "🔥", "🎉", "😮", "😢", "🙏", "👏", "✈️", "🏖️", "✨"];

export default function GroupChatroom() {
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams();
  const router = useRouter();
  const { user, userData } = useUser();
  const { startCall } = useCall();
  const { isDark, themeColors, accentColor, accent, scaleFont, fontScale } = useThemeToggle();
  const isBrightAccent =
    accentColor === "#FFFFFF" ||
    accentColor === "#ffffff" ||
    accentColor === "#f59e0b" ||
    accentColor === "#ffd700";
  const onAccentTextColor = isBrightAccent ? "#000000" : "#FFFFFF";

  const groupKey = (groupId as string) || "";
  const { messages, loading: messagesLoading } = useGroupChat(groupKey);

  const [groupData, setGroupData] = useState<any>(null);
  const [memberUsers, setMemberUsers] = useState<any[]>([]);
  const [createdByUser, setCreatedByUser] = useState<any>(null);

  const {
    wallpaper,
    enterIsSend,
    disappearingTimer,
    clearedAt,
    deletedAt,
    linkPreviews,
    autoDownloadMedia,
    saveToGallery,
    typingIndicator,
    fontSize,
  } = useChatSettings();

  const getDisappearingExpiresAt = () => {
    const nowMs = Date.now();
    if (disappearingTimer === "24h") return nowMs + 24 * 3600 * 1000;
    if (disappearingTimer === "7d") return nowMs + 7 * 24 * 3600 * 1000;
    if (disappearingTimer === "30d") return nowMs + 30 * 24 * 3600 * 1000;
    if (disappearingTimer === "90d") return nowMs + 90 * 24 * 60 * 60 * 1000;
    return null;
  };

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    const clearedMs = clearedAt ? new Date(clearedAt).getTime() : 0;
    const deletedMs = deletedAt ? new Date(deletedAt).getTime() : 0;
    const cutoffMs = Math.max(clearedMs, deletedMs);
    const nowMs = Date.now();
    return messages.filter((msg: any) => {
      let msgMs = 0;
      if (msg.timestamp) {
        if (typeof msg.timestamp === "number") msgMs = msg.timestamp;
        else if (typeof msg.timestamp.toMillis === "function") msgMs = msg.timestamp.toMillis();
        else if (msg.timestamp.seconds) msgMs = msg.timestamp.seconds * 1000;
        else if (typeof msg.timestamp === "string") msgMs = new Date(msg.timestamp).getTime() || 0;
      }
      if (cutoffMs > 0 && msgMs > 0 && msgMs <= cutoffMs) return false;
      if (msg.expiresAt && typeof msg.expiresAt === "number" && msg.expiresAt < nowMs) return false;
      return true;
    });
  }, [messages, clearedAt, deletedAt]);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [manuallyLoadedImages, setManuallyLoadedImages] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const typingTimeoutRef = useRef<any>(null);
  const saveToGalleryRef = useRef(saveToGallery);

  useEffect(() => {
    saveToGalleryRef.current = saveToGallery;
  }, [saveToGallery]);

  // Auto-save incoming group photos to device gallery if saveToGallery is enabled
  useEffect(() => {
    if (!saveToGalleryRef.current || !messages || messages.length === 0) return;
    messages.forEach((msg: any) => {
      if (msg.senderId !== user?.uid && msg.imageUrl && !msg.deleted) {
        autoSaveIncomingMedia(msg.imageUrl, msg.id, true).catch(() => {});
      }
    });
  }, [messages, user?.uid]);

  // Group typing listener
  useEffect(() => {
    if (!groupKey) return;
    const typingCol = collection(db, "groupChat", groupKey, "typing");
    const unsub = onSnapshot(
      typingCol,
      (snap) => {
        const active: { id: string; name: string }[] = [];
        const now = Date.now();
        snap.forEach((d) => {
          if (d.id === user?.uid) return;
          const data = d.data();
          if (data.isTyping && now - (data.updatedAt || 0) < 4000) {
            active.push({ id: d.id, name: data.name || "A member" });
          }
        });
        setTypingUsers(active);
      },
      () => setTypingUsers([])
    );
    return () => unsub();
  }, [groupKey, user?.uid]);

  // Clean typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (groupKey && user) {
        setDoc(
          doc(db, "groupChat", groupKey, "typing", user.uid),
          { isTyping: false, updatedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }
    };
  }, [groupKey, user?.uid]);

  const handleGroupInputChange = (text: string) => {
    setInput(text);
    if (!typingIndicator || !groupKey || !user) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!text.trim()) {
      setDoc(
        doc(db, "groupChat", groupKey, "typing", user.uid),
        { isTyping: false, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
      return;
    }

    setDoc(
      doc(db, "groupChat", groupKey, "typing", user.uid),
      {
        isTyping: true,
        name: userData?.displayName || userData?.name || user.displayName || "Member",
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch(() => {});

    typingTimeoutRef.current = setTimeout(() => {
      setDoc(
        doc(db, "groupChat", groupKey, "typing", user.uid),
        { isTyping: false, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }, 2500);
  };

  // Modals & Sheets
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Reaction & Context Menu Modal (Image 1)
  const [reactionMsg, setReactionMsg] = useState<any | null>(null);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

  // Call Selection Modal
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<"audio" | "video">("audio");

  // Group-specific Custom Wallpaper, Bubble Color & Dimming (Single Chat Feature!)
  const [localGroupWallpaper, setLocalGroupWallpaper] = useState<string | null>(null);
  const [localGroupBubbleColor, setLocalGroupBubbleColor] = useState<string | null>(null);
  const [localGroupWallpaperDim, setLocalGroupWallpaperDim] = useState<number>(0);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  useEffect(() => {
    if (!groupKey) return;
    AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_${groupKey}`).then((saved) => {
      if (saved) setLocalGroupWallpaper(saved);
    });
    AsyncStorage.getItem(`@bunkmates_custom_chat_bubble_color_${groupKey}`).then((c) => {
      if (c) setLocalGroupBubbleColor(c);
    });
    AsyncStorage.getItem(`@bunkmates_custom_chat_wallpaper_dim_${groupKey}`).then((d) => {
      if (d) setLocalGroupWallpaperDim(parseFloat(d) || 0);
    });
  }, [groupKey]);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isAtBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  // ── DUAL-DEVICE ADAPTIVE KEYBOARD DETECTION (WhatsApp-style) ──
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

  const isOsResized =
    Platform.OS === "android" &&
    initialRootHeight.current > 0 &&
    initialRootHeight.current - rootHeight > 100;

  const androidKeyboardPadding =
    Platform.OS === "android" && keyboardHeight > 0 && !isOsResized
      ? keyboardHeight
      : 0;

  // ═══════════════════════════════════════════════════════════════
  // 1. FETCH GROUP & MEMBERS DATA (with Offline Cache Support)
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!groupKey) return;

    // 1. Instantly hydrate from local offline cache
    AsyncStorage.getItem(`@bunkmates_group_meta_${groupKey}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.groupData) setGroupData((prev: any) => prev || parsed.groupData);
          if (Array.isArray(parsed?.memberUsers) && parsed.memberUsers.length > 0) {
            setMemberUsers((prev: any) => (prev.length > 0 ? prev : parsed.memberUsers));
          }
          if (parsed?.createdByUser) setCreatedByUser((prev: any) => prev || parsed.createdByUser);
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync with fallback to groups & trips collections
    const handleDocSnapshot = async (data: any) => {
      setGroupData(data);

      let fetchedCreator: any = null;
      let fetchedMembers: any[] = [];

      // Fetch Creator Profile
      if (data.createdBy) {
        try {
          const cSnap = await getDoc(doc(db, "users", data.createdBy));
          if (cSnap.exists()) {
            fetchedCreator = cSnap.data();
            setCreatedByUser(fetchedCreator);
          }
        } catch (e) {}
      }

      // Fetch Member Profiles
      if (Array.isArray(data.members) && data.members.length > 0) {
        try {
          const rawMemberUids = data.members
            .map((m: any) => (typeof m === "string" ? m : m?.uid || m?.id || ""))
            .filter(Boolean);

          const memberDocs = await Promise.all(
            rawMemberUids.slice(0, 25).map((uid: string) => getDoc(doc(db, "users", uid)))
          );
          fetchedMembers = memberDocs
            .map((d, i) => (d.exists() ? { uid: rawMemberUids[i], ...d.data() } : null))
            .filter(Boolean);
          setMemberUsers(fetchedMembers);
        } catch (e) {}
      }

      AsyncStorage.setItem(
        `@bunkmates_group_meta_${groupKey}`,
        JSON.stringify({
          groupData: data,
          memberUsers: fetchedMembers,
          createdByUser: fetchedCreator,
        })
      ).catch(() => {});
    };

    const groupDocRef = doc(db, "groupChats", groupKey);
    const unsub = onSnapshot(
      groupDocRef,
      async (snap) => {
        if (snap.exists()) {
          handleDocSnapshot({ id: snap.id, ...snap.data() });
        } else {
          // Check groups collection
          const gSnap = await getDoc(doc(db, "groups", groupKey)).catch(() => null);
          if (gSnap && gSnap.exists()) {
            handleDocSnapshot({ id: gSnap.id, ...gSnap.data() });
          } else {
            // Check trips collection
            const tSnap = await getDoc(doc(db, "trips", groupKey)).catch(() => null);
            if (tSnap && tSnap.exists()) {
              const tData = tSnap.data();
              handleDocSnapshot({
                id: tSnap.id,
                ...tData,
                name: tData.name || tData.tripName || "Trip Group",
                iconURL: tData.iconURL || tData.groupChatIcon || tData.coverImage || null,
              });
            }
          }
        }
      },
      (err) => {
        console.log("Group meta offline fallback:", err.message);
      }
    );

    return () => unsub();
  }, [groupKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: false });
      const t1 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 60);
      const t2 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [messages.length]);

  // Subtitle showing member names
  const memberNamesSubtitle = useMemo(() => {
    if (memberUsers.length > 0) {
      return memberUsers
        .map((m) => m.name || m.displayName || m.username || "Traveler")
        .slice(0, 4)
        .join(", ") + (memberUsers.length > 4 ? "..." : "");
    }
    return `${groupData?.members?.length || 1} Members`;
  }, [memberUsers, groupData?.members]);

  // Other companions (excluding current user)
  const otherMembers = useMemo(() => {
    return memberUsers.filter((m) => m.uid !== user?.uid);
  }, [memberUsers, user?.uid]);

  // Navigate back to chat page (never to home page)
  const handleBack = () => {
    router.replace("/(tabs)/chats" as any);
  };

  // Handle hardware back press on Android
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  // Total members count for Top Card (Image 1)
  const totalMembersCount = useMemo(() => {
    if (Array.isArray(groupData?.members) && groupData.members.length > 0) {
      return groupData.members.length;
    }
    if (memberUsers.length > 0) {
      return memberUsers.length;
    }
    return 5;
  }, [groupData?.members, memberUsers.length]);

  // Joined members summary string (Image 1: "Mohit Sharma, Sahil Suman, Raunak Bansal +2 more")
  const joinedMembersSummary = useMemo(() => {
    if (memberUsers.length > 0) {
      const names = memberUsers.map(
        (m) => m.displayName || m.name || m.username || "Traveler"
      );
      if (names.length <= 3) {
        return names.join(", ");
      }
      return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
    }
    return "Mohit Sharma, Sahil Suman, Raunak Bansal +2 more";
  }, [memberUsers]);

  // ═══════════════════════════════════════════════════════════════
  // 2. SEND MESSAGES & REACTIONS
  // ═══════════════════════════════════════════════════════════════
  const sendMessage = async (customPayload?: any) => {
    if (!input.trim() && !pendingImage && !customPayload) return;
    if (!groupKey || !user) return;

    if (uploading) return;

    const textToSend = input.trim();
    setInput("");
    setReplyTo(null);

    // Permission check
    const canSend =
      groupData?.sendAccess === "all" ||
      !groupData?.sendAccess ||
      groupData?.createdBy === user.uid ||
      (groupData?.admins || []).includes(user.uid);

    if (!canSend) {
      Alert.alert("Permission Denied", "Only admins can send messages in this group.");
      return;
    }

    setUploading(true);

    try {
      const expiresAt = getDisappearingExpiresAt();
      const msgObj = customPayload || {
        text: textToSend,
        imageUrl: pendingImage || null,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Mohit Sharma",
        senderAvatar: user.photoURL || null,
        timestamp: serverTimestamp(),
        type: pendingImage ? "image" : "text",
        expiresAt: expiresAt || null,
        replyTo: replyTo
          ? { text: replyTo.text, senderId: replyTo.senderId, senderName: replyTo.senderName }
          : null,
      };

      setPendingImage(null);

      // Clear typing indicator on message sent
      if (typingIndicator && groupKey && user) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setDoc(
          doc(db, "groupChat", groupKey, "typing", user.uid),
          { isTyping: false, updatedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }

      // Single deterministic write to primary groupChats, mirroring to groupChat with identical docId
      const newMsgDoc = await addDoc(collection(db, "groupChats", groupKey, "messages"), msgObj);
      await setDoc(doc(db, "groupChat", groupKey, "messages", newMsgDoc.id), msgObj).catch(() => {});

      // Update group doc metadata for immediate sync across devices and chats list
      const metaUpdate = {
        lastMessage: msgObj.text || (pendingImage ? "📷 Photo" : "Sent a message"),
        lastTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        date: serverTimestamp(),
      };
      updateDoc(doc(db, "groupChats", groupKey), metaUpdate).catch(() => {});
      updateDoc(doc(db, "groupChat", groupKey), metaUpdate).catch(() => {});
      updateDoc(doc(db, "trips", groupKey), metaUpdate).catch(() => {});
      updateDoc(doc(db, "groups", groupKey), metaUpdate).catch(() => {});

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Send group push notification & write to notifications collection
      const targetMemberUids = Array.isArray(groupData?.members)
        ? groupData.members.filter((uid: string) => uid && uid !== user.uid)
        : memberUsers.map((m: any) => m.uid).filter((uid: string) => uid && uid !== user.uid);

      if (targetMemberUids.length > 0) {
        sendGroupChatMessageNotification({
          memberIds: targetMemberUids,
          senderId: user.uid,
          senderName: user.displayName || user.email?.split("@")[0] || "Mohit Sharma",
          senderAvatar: user.photoURL || undefined,
          messageText: msgObj.text || (pendingImage ? "📷 Image" : "Sent a message"),
          groupId: groupKey,
          groupName: groupData?.name || "Group Chat",
        });
      }
    } catch (error) {
      console.error("Error sending group message:", error);
      Alert.alert("Error", "Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  // Handle reactions (Image 1)
  const handleSelectReaction = async (msgId: string, emoji: string) => {
    if (!groupKey || !user?.uid) return;
    try {
      const reactionPayload = {
        [`reactions.${user.uid}`]: emoji,
        latestReaction: emoji,
      };

      try {
        await updateDoc(doc(db, "groupChat", groupKey, "messages", msgId), reactionPayload);
      } catch (e) {}

      try {
        await updateDoc(doc(db, "groupChats", groupKey, "messages", msgId), reactionPayload);
      } catch (e) {}
    } catch (err) {
      console.log("Error adding reaction:", err);
    }
  };

  const handleDownloadGroupImage = async (url: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await saveImageToGallery(url, "bunkmates_group");
      if (res.success) {
        Alert.alert("Saved", "Photo saved to your device gallery!");
      } else if (res.error === "permission_denied") {
        const shared = await shareOrExportImage(url);
        if (!shared) {
          Alert.alert("Permission Required", "Please allow photo library access in device settings to save photos.");
        }
      } else {
        const shared = await shareOrExportImage(url);
        if (!shared) {
          Alert.alert("Save Photo", "Could not save photo: " + (res.error || "Unknown error"));
        }
      }
    } catch (e: any) {
      Alert.alert("Save Photo", "Could not save photo: " + e.message);
    }
  };

  // Send interactive Trip Checklist (Image 2)
  const handleSendChecklist = async () => {
    setAttachMenuOpen(false);
    const checklistPayload = {
      text: "Trip Checklist",
      type: "checklist",
      senderId: user?.uid,
      senderName: user?.displayName || "Jayendra Choudhary",
      senderAvatar: user?.photoURL || null,
      timestamp: serverTimestamp(),
      items: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
        text: item,
        completed: false,
        checkedBy: [],
      })),
    };
    await sendMessage(checklistPayload);
  };

  // Send Group Timeline Card (Image 1)
  const handleSendTimeline = async () => {
    setAttachMenuOpen(false);
    let eventsToSend = DEFAULT_TIMELINE_EVENTS;

    // If linked to a trip, try reading actual trip timeline
    if (groupData?.tripId) {
      try {
        const snap = await getDocs(collection(db, "trips", groupData.tripId, "timeline"));
        if (!snap.empty) {
          eventsToSend = snap.docs.map((d) => {
            const dt = d.data();
            return {
              text: dt.text || dt.title || "Timeline event",
              time: dt.time || dt.datetime || "Upcoming",
              completed: dt.completed === true,
              isHighlight: dt.isHighlight || false,
            };
          });
        }
      } catch (e) {}
    }

    const timelinePayload = {
      text: "Group Timeline",
      type: "timeline",
      senderId: user?.uid,
      senderName: user?.displayName || "Jayendra Choudhary",
      senderAvatar: user?.photoURL || null,
      timestamp: serverTimestamp(),
      events: eventsToSend,
    };
    await sendMessage(timelinePayload);
  };

  // Toggle item in Trip Checklist card
  const handleToggleChecklistItem = async (msgId: string, itemIdx: number, currentCompleted: boolean) => {
    try {
      const targetMsg = messages.find((m) => m.id === msgId);
      if (!targetMsg || !targetMsg.items) return;

      const updatedItems = [...targetMsg.items];
      updatedItems[itemIdx] = {
        ...updatedItems[itemIdx],
        completed: !currentCompleted,
        checkedBy: !currentCompleted ? arrayUnion(user?.uid) : arrayRemove(user?.uid),
      };

      try {
        await updateDoc(doc(db, "groupChat", groupKey, "messages", msgId), {
          items: updatedItems,
        });
      } catch (e) {}

      try {
        await updateDoc(doc(db, "groupChats", groupKey, "messages", msgId), {
          items: updatedItems,
        });
      } catch (e) {}
    } catch (err) {
      console.log("Error toggling checklist item:", err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 3. GROUP CALLING & VIDEO CALLING (Real WebRTC - same as single chat)
  // ═══════════════════════════════════════════════════════════════
  const handleInitiateGroupCall = async (callType: "audio" | "video") => {
    // Get other members (excluding current user)
    const companions = otherMembers;

    if (companions.length === 0) {
      Alert.alert("No Members", "There are no other members in this group to call.");
      return;
    }

    // Call the first available companion using real WebRTC (same as single chat)
    // Pass full group metadata so CallScreen can display all members in the grid
    const primaryMember = companions[0];
    await startCall({
      receiverId: primaryMember.uid,
      receiverName: groupData?.name || primaryMember.name || primaryMember.displayName || "Group",
      receiverAvatar: groupData?.iconURL || primaryMember.photoURL || DEFAULT_GROUP_AVATAR,
      receiverHandle: primaryMember.username || "traveler",
      callType,
      isGroupCall: true,
      groupName: groupData?.name || "Group Call",
      groupMembers: companions,
    });
  };

  const handleRingAllMembers = async (callType: "audio" | "video") => {
    setCallModalVisible(false);
    await handleInitiateGroupCall(callType);
  };

  const handleStartCallWithMember = async (member: any, callType: "audio" | "video") => {
    setCallModalVisible(false);
    await startCall({
      receiverId: member.uid,
      receiverName: member.name || member.displayName || member.username || "BunkMate",
      receiverAvatar: member.photoURL || DEFAULT_GROUP_AVATAR,
      receiverHandle: member.username || "traveler",
      callType,
      isGroupCall: false,
    });
  };

  // Camera capture directly from device camera (Inserted in Plus option)
  const takeCameraPhoto = async () => {
    setAttachMenuOpen(false);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please allow camera access to capture photos.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setPendingImage(res.assets[0].uri);
      }
    } catch (e) {
      console.log("Camera capture error:", e);
    }
  };

  // Gallery Image Picker
  const pickImage = async () => {
    setAttachMenuOpen(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow gallery access to send photos.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        setPendingImage(res.assets[0].uri);
      }
    } catch (e) {
      console.log("Image picker error:", e);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 4. MESSAGE & TIMELINE RENDERING
  // ═══════════════════════════════════════════════════════════════

  // ── GROUP TOP INTRO CARD (Image 1) & Date Divider ──
  const renderListHeader = () => {
    const creatorName =
      createdByUser?.displayName ||
      createdByUser?.name ||
      groupData?.createdByName ||
      "Mohit Sharma";

    return (
      <View style={{ marginBottom: 4 }}>
        {/* Top Group Intro Card (Exact match to Image 1) */}
        <Pressable
          style={s.topGroupCard}
          onPress={() => setShowGroupInfo(true)}
        >
          {/* Circular Group Avatar */}
          <ExpoImage
            source={{ uri: groupData?.iconURL || DEFAULT_GROUP_AVATAR }}
            style={s.topGroupCardAvatar}
            contentFit="cover"
          />

          {/* Group Name */}
          <Text style={s.topGroupCardName}>{groupData?.name || "Bunk1"}</Text>

          {/* Group Description */}
          <Text style={s.topGroupCardDesc}>
            {groupData?.description || "Group for Trip from Jaipur to Dehradun"}
          </Text>

          {/* Created By */}
          <Text style={s.topGroupCardCreatedBy}>
            <Text style={s.topGroupCardCreatedByBold}>Created by: </Text>
            <Text style={s.topGroupCardCreatedByName}>{creatorName}</Text>
          </Text>

          {/* Members Count */}
          <Text style={s.topGroupCardMembersCount}>
            {totalMembersCount} Members
          </Text>

          {/* Members Joined Label */}
          <Text style={s.topGroupCardMembersJoinedLabel}>Members Joined:</Text>

          {/* Members Joined Names List */}
          <Text style={s.topGroupCardMembersJoinedNames}>
            {joinedMembersSummary}
          </Text>
        </Pressable>

        {/* Date Divider (Image 1 & 2: 23/7/2026) */}
        <View style={s.dateDividerContainer}>
          <View style={s.dateDividerPill}>
            <Text style={s.dateDividerText}>
              {groupData?.createdAt?.seconds
                ? new Date(groupData.createdAt.seconds * 1000).toLocaleDateString("en-GB")
                : "23/7/2026"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Render Single Message
  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId === user?.uid;
    const reactionList = item.reactions ? Object.values(item.reactions) : [];
    const latestReaction = item.latestReaction || (reactionList.length > 0 ? reactionList[0] : null);

    // ── 1. GROUP TIMELINE CARD (Image 1) ──
    if (item.type === "timeline" || (item.events && item.events.length > 0)) {
      const events = item.events || DEFAULT_TIMELINE_EVENTS;
      return (
        <View style={s.timelineMessageContainer}>
          <Pressable
            onLongPress={() => {
              setReactionMsg(item);
              setShowMoreEmojis(false);
            }}
            style={s.timelineCard}
          >
            {/* Header */}
            <View style={s.timelineCardHeader}>
              <Text style={s.timelineCardTitle}>📅 Group Timeline</Text>
            </View>

            {/* Events List */}
            <View style={s.timelineEventsList}>
              {events.map((ev: any, idx: number) => {
                const isHighlight = ev.isHighlight === true;
                return (
                  <View
                    key={idx}
                    style={[s.timelineEventRow, isHighlight && s.timelineEventRowHighlight]}
                  >
                    <View style={s.timelineCheckIconBox}>
                      {ev.completed ? (
                        <Ionicons name="checkbox" size={19} color="#7cb342" />
                      ) : (
                        <Text style={{ fontSize: 16 }}>⏳</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.timelineEventTitle,
                          isHighlight && { fontWeight: "700", color: "#ffffff" },
                        ]}
                      >
                        {ev.text}
                      </Text>
                      {ev.time && <Text style={s.timelineEventTime}>{ev.time}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Reaction Badge on Timeline Card */}
            {latestReaction && (
              <View style={s.reactionBadge}>
                <Text style={{ fontSize: 13 }}>{latestReaction}</Text>
              </View>
            )}
          </Pressable>
        </View>
      );
    }

    // ── 2. TRIP CHECKLIST CARD (Image 2) ──
    if (item.type === "checklist" || (item.items && item.items.length > 0)) {
      const checklistItems =
        item.items || DEFAULT_CHECKLIST_ITEMS.map((t) => ({ text: t, completed: false }));
      return (
        <View style={s.checklistMessageContainer}>
          <Text style={s.checklistSenderName}>
            {item.senderName || "Jayendra Choudhary"}
          </Text>

          <Pressable
            onLongPress={() => {
              setReactionMsg(item);
              setShowMoreEmojis(false);
            }}
            style={s.checklistCard}
          >
            <View style={s.checklistCardHeader}>
              <Text style={s.checklistCardTitle}>📝 Trip Checklist</Text>
            </View>

            <View style={s.checklistItemsList}>
              {checklistItems.map((chk: any, idx: number) => {
                const isCompleted = chk.completed === true;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleToggleChecklistItem(item.id, idx, isCompleted)}
                    style={s.checklistItemRow}
                  >
                    <View
                      style={[
                        s.checkboxSquare,
                        isCompleted && [
                          s.checkboxSquareChecked,
                          { backgroundColor: accentColor, borderColor: accentColor },
                        ],
                      ]}
                    >
                      {isCompleted && (
                        <Ionicons name="checkmark" size={14} color={onAccentTextColor} />
                      )}
                    </View>
                    <Text style={[s.checklistItemText, isCompleted && s.checklistItemTextChecked]}>
                      {chk.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {latestReaction && (
              <View style={s.reactionBadge}>
                <Text style={{ fontSize: 13 }}>{latestReaction}</Text>
              </View>
            )}
          </Pressable>
        </View>
      );
    }

    // ── 3. GROUP CALL LOG / INVITE MESSAGE ──
    if (item.type === "call_log") {
      const isVideo = item.callType === "video";
      return (
        <View style={s.callLogMsgContainer}>
          <View style={s.callLogMsgCard}>
            <View style={s.callLogIconCircle}>
              <Ionicons
                name={isVideo ? "videocam" : "call"}
                size={18}
                color="#00e6b0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.callLogMsgTitle}>{item.text}</Text>
              <Text style={s.callLogMsgSub}>Started by {item.senderName}</Text>
            </View>
            {!isOwn && (
              <Pressable
                onPress={() => handleInitiateGroupCall(item.callType || "audio")}
                style={s.joinCallBtn}
              >
                <Text style={s.joinCallText}>Join Call</Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    // ── 4. SYSTEM NOTIFICATIONS (Image 3: e.g. "Jayendra Choudhary updated the group icon.") ──
    if (
      item.type === "system" ||
      item.text?.includes("updated the group icon") ||
      item.text?.includes("created the group") ||
      item.text?.includes("added to the group")
    ) {
      return (
        <View style={s.systemMsgContainer}>
          <Text style={s.systemMsgText}>{item.text}</Text>
        </View>
      );
    }

    // Guard against empty bubbles (Image 1 fix)
    if (!item.text && !item.imageUrl && !item.events && !item.items && item.type !== "call_log") {
      return null;
    }

    // ── 5. STANDARD TEXT, ITINERARY, & IMAGE MESSAGES (Image 1 & 2) ──
    return (
      <View style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}>
        {!isOwn && (
          <Pressable
            onPress={() => {
              setSelectedProfileId(item.senderId);
              setShowProfileModal(true);
            }}
          >
            <ExpoImage
              source={{ uri: item.senderAvatar || DEFAULT_GROUP_AVATAR }}
              style={s.msgSenderAvatar}
              contentFit="cover"
            />
          </Pressable>
        )}

        <Pressable
          onLongPress={() => {
            setReactionMsg(item);
            setShowMoreEmojis(false);
          }}
          style={[
            s.msgBubble,
            isOwn ? s.msgBubbleOwn : s.msgBubbleOther,
            isOwn && !!localGroupBubbleColor
              ? { backgroundColor: localGroupBubbleColor }
              : isOwn
              ? { backgroundColor: accentColor }
              : null,
          ]}
        >
          {/* Sender Name for incoming group messages (Image 2) */}
          {!isOwn && (
            <Text style={s.msgSenderName}>{item.senderName || "Traveler"}</Text>
          )}

          {/* Reply Preview */}
          {item.replyTo && (
            <View style={[s.replyBox, { borderLeftColor: themeColors.accentText }]}>
              <Text style={[s.replyBoxSender, { color: themeColors.accentText }]}>{item.replyTo.senderName}</Text>
              <Text style={s.replyBoxText} numberOfLines={1}>
                {item.replyTo.text}
              </Text>
            </View>
          )}

          {/* Attached Image (respects autoDownloadMedia preference) */}
          {item.imageUrl && (
            (!autoDownloadMedia && !manuallyLoadedImages[item.id] && !isOwn) ? (
              <Pressable
                style={[
                  s.msgAttachedImage,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  setManuallyLoadedImages((prev) => ({ ...prev, [item.id]: true }));
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0, 0, 0, 0.55)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="cloud-download-outline" size={24} color="#ffffff" />
                </View>
                <Text style={{ color: "#ffffff", fontSize: 12, marginTop: 8, fontWeight: "600" }}>
                  Tap to load photo
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setFullScreenImage(item.imageUrl)}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <ExpoImage
                  source={{ uri: item.imageUrl }}
                  style={s.msgAttachedImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              </Pressable>
            )
          )}

          {/* Message Text */}
          {item.text ? (
            <Text
              style={[
                s.msgText,
                { fontSize: scaleFont(14.5) },
                isOwn && !localGroupBubbleColor && { color: onAccentTextColor },
              ]}
            >
              {item.text}
            </Text>
          ) : null}

          {/* Link Preview Card when linkPreviews setting is enabled */}
          {linkPreviews && !item.deleted && !!item.text && (
            <LinkPreviewCard
              text={item.text}
              isOwn={isOwn}
              accentColor={accentColor}
              isDark={isDark}
            />
          )}

          {/* Timestamp Row (High-contrast micro pill) */}
          <View style={s.msgMetaRow}>
            <Text style={s.msgTimestamp}>
              {item.timestamp?.seconds
                ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "11:43 pm"}
            </Text>
            {isOwn && (
              <Ionicons
                name="checkmark-done"
                size={13}
                color="#ffffff"
                style={{ marginLeft: 3 }}
              />
            )}
          </View>

          {/* Reaction Badge on Message Bubble */}
          {latestReaction && (
            <View style={[s.reactionBadge, isOwn ? s.reactionBadgeOwn : s.reactionBadgeOther]}>
              <Text style={{ fontSize: 12 }}>{latestReaction}</Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  if (messagesLoading && !groupData) {
    return (
      <View style={s.centerScreen}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  const headerTopPad = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : insets.top + 6;
  const HEADER_TOTAL_HEIGHT = headerTopPad + 52;
  const backgroundSource = getWallpaperSource(localGroupWallpaper || wallpaper);

  return (
    <ImageBackground
      source={backgroundSource}
      style={s.safeContainer}
      resizeMode="cover"
      blurRadius={(showGroupInfo || showProfileModal) ? (Platform.OS === "android" ? 35 : 25) : 0}
    >
      {/* Dynamic Wallpaper Brightness Dimming Overlay */}
      {localGroupWallpaperDim > 0 && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `rgba(0, 0, 0, ${localGroupWallpaperDim})` },
          ]}
          pointerEvents="none"
        />
      )}

      <SafeAreaViewContext
        style={{ flex: 1 }}
        edges={["top", "left", "right"]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (initialRootHeight.current === 0 && h > 0) {
            initialRootHeight.current = h;
          }
          setRootHeight(h);
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        {/* TOP GRADIENT FADE: Single Chat Style */}
        {!showGroupInfo && !showProfileModal && (
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
              s.topGradientFade,
              { height: HEADER_TOTAL_HEIGHT + 36 },
            ]}
          />
        )}

        {/* ── TOP FLOATING HEADER (Single Chat Style: ONLY Video & Audio Call options) ── */}
        {!showGroupInfo && !showProfileModal && (
          <View style={[s.headerFloatingWrap, { paddingTop: headerTopPad }]}>
            <View style={s.headerInnerRow}>
              {/* Back Button */}
              <Pressable onPress={handleBack} style={s.circleBtn} hitSlop={10}>
                <Ionicons name="arrow-back" size={20} color="#ffffff" />
              </Pressable>

              {/* Group Pill (Avatar, Name, Subtitle) */}
              <Pressable onPress={() => setShowGroupInfo(true)} style={s.userPill}>
                <ExpoImage
                  source={{ uri: groupData?.iconURL || DEFAULT_GROUP_AVATAR }}
                  style={s.avatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.userName} numberOfLines={1}>
                    {groupData?.name || "Bunk1"}
                  </Text>
                  <Text
                    style={[
                      s.userHandle,
                      typingUsers.length > 0 && { color: "#34D399", fontStyle: "italic" },
                    ]}
                    numberOfLines={1}
                  >
                    {typingUsers.length > 0
                      ? typingUsers.length === 1
                        ? `${typingUsers[0].name} is typing...`
                        : `${typingUsers.map((u) => u.name).join(", ")} are typing...`
                      : memberNamesSubtitle}
                  </Text>
                </View>
              </Pressable>

              {/* ONLY TWO OPTIONS: Video Call & Audio Call */}
              <View style={s.headerActions}>
                <Pressable
                  style={s.circleBtn}
                  onPress={() => handleInitiateGroupCall("video")}
                  hitSlop={8}
                >
                  <Ionicons name="videocam" size={18} color="#ffffff" />
                </Pressable>

                <Pressable
                  style={s.circleBtn}
                  onPress={() => handleInitiateGroupCall("audio")}
                  hitSlop={8}
                >
                  <Ionicons name="call" size={17} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ── MESSAGES LIST ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            style={(showGroupInfo || showProfileModal) ? { opacity: 0 } : undefined}
            contentContainerStyle={[
              s.messagesScrollContent,
              { paddingTop: HEADER_TOTAL_HEIGHT + 10, paddingBottom: 28 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
              isAtBottomRef.current = distanceFromBottom < 80;
              setShowScrollDown(distanceFromBottom > 200);
            }}
            scrollEventThrottle={16}
            onLayout={() => {
              if (isInitialLoadRef.current && messages && messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onContentSizeChange={() => {
              if (isInitialLoadRef.current || isAtBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
                isInitialLoadRef.current = false;
              }
            }}
          />

          {/* Floating WhatsApp-Style Scroll to Bottom Button */}
          {showScrollDown && !showGroupInfo && !showProfileModal && (
            <Pressable
              style={[
                s.scrollToBottomBtn,
                androidKeyboardPadding > 0 && { bottom: 80 + androidKeyboardPadding },
              ]}
              onPress={() => {
                isAtBottomRef.current = true;
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <Ionicons name="chevron-down" size={20} color="#ffffff" />
            </Pressable>
          )}

          {/* BOTTOM GRADIENT FADE: Single Chat Style */}
          {!showGroupInfo && !showProfileModal && (
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
                s.bottomGradientFade,
                {
                  height:
                    115 +
                    Math.max(insets.bottom, 8) +
                    (androidKeyboardPadding > 0 ? androidKeyboardPadding : 0),
                },
              ]}
            />
          )}

          {/* ── BOTTOM FLOATING INPUT BAR (Single Chat Style: No camera icon) ── */}
          {!showGroupInfo && !showProfileModal && (
            <Animated.View style={{ marginBottom: androidKeyboardPadding }}>
              <View
                style={[
                  s.bottomBarFloatingWrap,
                  { paddingBottom: Math.max(insets.bottom, 8) + 6 },
                ]}
              >
                {/* Replying Preview Bar */}
                {replyTo && (
                  <View style={s.replyPreviewBar}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.replyPreviewSender}>
                        Replying to {replyTo.senderId === user?.uid ? "yourself" : replyTo.senderName || "Traveler"}
                      </Text>
                      <Text style={s.replyPreviewText} numberOfLines={1}>
                        {replyTo.text || (replyTo.imageUrl ? "📷 Photo" : "Attachment")}
                      </Text>
                    </View>
                    <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
                      <Ionicons name="close" size={20} color="#aaaaaa" />
                    </Pressable>
                  </View>
                )}

                {/* Pending Image Preview */}
                {pendingImage && (
                  <View style={s.pendingImageBar}>
                    <ExpoImage source={{ uri: pendingImage }} style={s.pendingThumb} cachePolicy="memory-disk" />
                    <Pressable onPress={() => setPendingImage(null)} style={s.cancelPendingBtn}>
                      <Ionicons name="close" size={16} color="#ffffff" />
                    </Pressable>
                  </View>
                )}

                {/* Input Row: Plus Circle + Pill Container + Send Circle */}
                <View style={s.inputArea}>
                  <Pressable
                    onPress={() => setAttachMenuOpen(true)}
                    style={s.circleBtn}
                    hitSlop={8}
                  >
                    <Feather name="plus" size={20} color="#ffffff" />
                  </Pressable>

                  <View style={s.inputContainer}>
                    <TextInput
                      placeholder="Type your message..."
                      placeholderTextColor="#777777"
                      value={input}
                      onChangeText={handleGroupInputChange}
                      style={s.textInput}
                      multiline={!enterIsSend}
                      returnKeyType={enterIsSend ? "send" : "default"}
                      blurOnSubmit={false}
                      onSubmitEditing={() => {
                        if (enterIsSend && (input.trim() || pendingImage)) {
                          sendMessage();
                        }
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={() => sendMessage()}
                    disabled={!input.trim() && !pendingImage}
                    style={[
                      s.sendButtonCircle,
                      (input.trim() || pendingImage)
                        ? { backgroundColor: accentColor }
                        : { backgroundColor: isDark ? "#3e444c" : "#e5e7eb", opacity: 0.65 },
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="send"
                      size={18}
                      color={(input.trim() || pendingImage) ? onAccentTextColor : isDark ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.4)"}
                      style={{ marginLeft: 2 }}
                    />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>

        {/* ═══════════════════════════════════════════════════════════
           IMAGE 1: REACTION & CONTEXT MENU MODAL
           ═══════════════════════════════════════════════════════════ */}
        <Modal
          visible={!!reactionMsg}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionMsg(null)}
        >
          <Pressable style={s.reactionModalOverlay} onPress={() => setReactionMsg(null)}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={s.reactionCard}>
              {/* Emojis Row (Image 1: ❤️ 😂 👍 😁 👌 +) */}
              <View style={s.reactionEmojiRow}>
                {(showMoreEmojis ? ALL_EMOJIS : QUICK_EMOJIS).map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      if (reactionMsg) handleSelectReaction(reactionMsg.id, emoji);
                      setReactionMsg(null);
                    }}
                    style={s.reactionEmojiBtn}
                  >
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </Pressable>
                ))}

                {!showMoreEmojis && (
                  <Pressable
                    onPress={() => setShowMoreEmojis(true)}
                    style={s.reactionPlusBtn}
                  >
                    <Ionicons name="add" size={22} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                )}
              </View>

              <View style={s.reactionMenuDivider} />

              {/* Menu Option 1: Reply */}
              <Pressable
                style={s.reactionMenuItem}
                onPress={() => {
                  setReplyTo(reactionMsg);
                  setReactionMsg(null);
                }}
              >
                <Ionicons name="chevron-forward" size={18} color="#ffffff" style={{ marginRight: 12 }} />
                <Text style={s.reactionMenuText}>Reply</Text>
              </Pressable>

              {/* Menu Option 2: Search on Google */}
              <Pressable
                style={s.reactionMenuItem}
                onPress={() => {
                  const queryText = reactionMsg?.text || "BunkMates travel";
                  setReactionMsg(null);
                  Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(queryText)}`);
                }}
              >
                <Ionicons name="search" size={18} color="#ffffff" style={{ marginRight: 12 }} />
                <Text style={s.reactionMenuText}>Search on Google</Text>
              </Pressable>

              {/* Menu Option 3: Copy Text */}
              {reactionMsg?.text && (
                <Pressable
                  style={s.reactionMenuItem}
                  onPress={async () => {
                    await Clipboard.setStringAsync(reactionMsg.text);
                    setReactionMsg(null);
                    Alert.alert("Copied", "Text copied to clipboard!");
                  }}
                >
                  <Ionicons name="copy-outline" size={18} color="#ffffff" style={{ marginRight: 12 }} />
                  <Text style={s.reactionMenuText}>Copy Text</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>

        {/* ═══════════════════════════════════════════════════════════
           GROUP CALL SELECTION MODAL
           ═══════════════════════════════════════════════════════════ */}
        <Modal
          visible={callModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCallModalVisible(false)}
        >
          <View style={s.callModalOverlay}>
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setCallModalVisible(false)} />

            <View style={[s.callModalSheet, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={s.callModalHeading}>
                Start Group {pendingCallType === "video" ? "Video" : "Voice"} Call
              </Text>
              <Text style={s.callModalSub}>
                Invite everyone to join or call a specific member
              </Text>

              {/* Ring All Members */}
              <Pressable
                onPress={() => handleRingAllMembers(pendingCallType)}
                style={[s.callAllBtn, { backgroundColor: accentColor }]}
              >
                <Ionicons
                  name={pendingCallType === "video" ? "videocam" : "call"}
                  size={20}
                  color={onAccentTextColor}
                  style={{ marginRight: 10 }}
                />
                <Text style={[s.callAllText, { color: onAccentTextColor }]}>Call Group (All Members)</Text>
              </Pressable>

              <Text style={s.orCallIndividualLabel}>Or call individual bunkmate:</Text>

              {otherMembers.map((m) => (
                <Pressable
                  key={m.uid}
                  onPress={() => handleStartCallWithMember(m, pendingCallType)}
                  style={s.callMemberRow}
                >
                  <ExpoImage
                    source={{ uri: m.photoURL || DEFAULT_GROUP_AVATAR }}
                    style={s.callMemberAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.callMemberName}>{m.name || m.displayName || m.username}</Text>
                    <Text style={s.callMemberHandle}>@{m.username || "traveler"}</Text>
                  </View>
                  <Ionicons
                    name={pendingCallType === "video" ? "videocam-outline" : "call-outline"}
                    size={20}
                    color="#00e6b0"
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

        {/* ── ATTACHMENT QUICK MENU ── */}
        <Modal
          visible={attachMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachMenuOpen(false)}
        >
          <View style={s.attachModalOverlay}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAttachMenuOpen(false)} />

            <View style={[s.attachMenuSheet, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={s.attachMenuHeading}>Share with Group</Text>

              {/* 1. Camera Option (Inserted in Plus Option as requested!) */}
              <Pressable onPress={takeCameraPhoto} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                  <Ionicons name="camera-outline" size={22} color="#ef4444" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Camera</Text>
                  <Text style={s.attachItemSub}>Take a photo with your camera</Text>
                </View>
              </Pressable>

              {/* 2. Photo / Gallery Option */}
              <Pressable onPress={pickImage} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <Ionicons name="image-outline" size={22} color="#38bdf8" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Photo / Gallery</Text>
                  <Text style={s.attachItemSub}>Share trip memories and pictures</Text>
                </View>
              </Pressable>

              {/* 3. Group Timeline */}
              <Pressable onPress={handleSendTimeline} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(255, 179, 0, 0.15)" }]}>
                  <Ionicons name="calendar-outline" size={22} color="#ffb300" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Group Timeline</Text>
                  <Text style={s.attachItemSub}>Share day-by-day trip itinerary card</Text>
                </View>
              </Pressable>

              {/* 4. Trip Checklist */}
              <Pressable onPress={handleSendChecklist} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(0, 230, 118, 0.15)" }]}>
                  <Ionicons name="checkbox-outline" size={22} color="#00e676" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Trip Checklist</Text>
                  <Text style={s.attachItemSub}>Send interactive checklist to coordinate items</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setAttachMenuOpen(false);
                  setShowWallpaperModal(true);
                }}
                style={s.attachMenuItem}
              >
                <View style={[s.attachIconBox, { backgroundColor: "rgba(255, 255, 255, 0.12)" }]}>
                  <Ionicons name="color-palette-outline" size={22} color="#ffffff" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Chat Wallpaper & Theme</Text>
                  <Text style={s.attachItemSub}>Customize background, brightness & bubbles</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ── GROUP INFO DRAWER ── */}
        <GroupInfoDrawer
          visible={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          groupId={groupKey}
          currentUser={user}
          memberInfo={memberUsers.reduce((acc, m) => ({ ...acc, [m.uid]: m }), {})}
          onOpenWallpaperTheme={() => setShowWallpaperModal(true)}
          wallpaperSource={backgroundSource}
        />

        {/* ── USER PROFILE MODAL ── */}
        <UserProfileModal
          userId={selectedProfileId}
          visible={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onStartChat={(id) => {
            setShowProfileModal(false);
            router.push(`/chat/${id}` as any);
          }}
        />

        {/* ── WALLPAPER & THEME CUSTOMIZER MODAL (Single Chat Feature!) ── */}
        <WallpaperThemePreviewModal
          visible={showWallpaperModal}
          onClose={() => setShowWallpaperModal(false)}
          chatId={groupKey}
          friendName={groupData?.name || "Group"}
          initialWallpaperUri={localGroupWallpaper}
          onApply={(newWp, bubbleColor, dimLevel) => {
            setLocalGroupWallpaper(newWp);
            setLocalGroupBubbleColor(bubbleColor);
            if (dimLevel !== undefined) setLocalGroupWallpaperDim(dimLevel);
          }}
        />

        {/* ── FULLSCREEN IMAGE VIEWER (WhatsApp Style) ── */}
        <Modal
          visible={!!fullScreenImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={{ flex: 1, backgroundColor: "#000000", justifyContent: "center", alignItems: "center" }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View
              style={{
                position: "absolute",
                top: Math.max(insets.top, 20) + 10,
                right: 20,
                zIndex: 50,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {fullScreenImage && (
                <Pressable
                  onPress={() => handleDownloadGroupImage(fullScreenImage)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(30, 30, 30, 0.8)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  hitSlop={12}
                >
                  <Ionicons name="arrow-down-circle" size={24} color="#ffffff" />
                </Pressable>
              )}
              <Pressable
                onPress={() => setFullScreenImage(null)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(30, 30, 30, 0.8)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                hitSlop={12}
              >
                <Ionicons name="close" size={26} color="#ffffff" />
              </Pressable>
            </View>
            {fullScreenImage && (
              <ExpoImage
                source={{ uri: fullScreenImage }}
                style={{ width: SCREEN_WIDTH, height: "85%" }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
          </View>
        </Modal>
      </SafeAreaViewContext>
    </ImageBackground>
  );
}

/* ──────── STYLES (Matching Image 1 & 2) ──────── */

const s = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },
  centerScreen: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
  },

  // Top & Bottom Gradient Fades (Single Chat Style)
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

  // Top Floating Header (Single Chat Style)
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
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userName: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13.5,
  },
  userHandle: {
    color: "#888888",
    fontSize: 11,
  },

  // ── Top Group Intro Card (Image 1) ──
  topGroupCard: {
    backgroundColor: "#12161c",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  topGroupCardAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#1c222b",
  },
  topGroupCardName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  topGroupCardDesc: {
    color: "#9ea3ae",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 6,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  topGroupCardCreatedBy: {
    textAlign: "center",
    marginBottom: 16,
  },
  topGroupCardCreatedByBold: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
  },
  topGroupCardCreatedByName: {
    color: "#cfd4dc",
    fontSize: 13.5,
    fontWeight: "400",
  },
  topGroupCardMembersCount: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  topGroupCardMembersJoinedLabel: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  topGroupCardMembersJoinedNames: {
    color: "#9ea3ae",
    fontSize: 12.5,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 10,
  },

  // Date Divider Pill (Image 1 & 2: 23/7/2026 - High Contrast Capsule Pill)
  dateDividerContainer: {
    alignItems: "center",
    marginVertical: 14,
  },
  dateDividerPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(14, 18, 26, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dateDividerText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // System Notification (Image 3)
  systemMsgContainer: {
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 24,
  },
  systemMsgText: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12.5,
    fontStyle: "italic",
    textAlign: "center",
  },

  // Messages List
  messagesScrollContent: {
    paddingHorizontal: 14,
  },
  msgRow: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowOwn: {
    justifyContent: "flex-end",
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgSenderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1c1c1e",
  },
  msgBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    position: "relative",
  },
  msgBubbleOwn: {
    backgroundColor: "#193530",
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: "#21252d",
    borderBottomLeftRadius: 4,
  },
  msgSenderName: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  msgText: {
    color: "#ffffff",
    fontSize: 14.5,
    lineHeight: 20,
  },
  msgAttachedImage: {
    width: 210,
    height: 210,
    borderRadius: 14,
    marginBottom: 6,
  },
  msgMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginTop: 4,
    backgroundColor: "rgba(10, 14, 22, 0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 3,
  },
  msgTimestamp: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Reply Box inside bubble
  replyBox: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#00e6b0",
    padding: 6,
    marginBottom: 6,
  },
  replyBoxSender: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "700",
  },
  replyBoxText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },

  // ── GROUP TIMELINE CARD (Exact match to Image 1) ──
  timelineMessageContainer: {
    marginVertical: 10,
    width: "100%",
  },
  timelineCard: {
    width: "86%",
    borderRadius: 24,
    backgroundColor: "#262932",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timelineCardHeader: {
    marginBottom: 16,
  },
  timelineCardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  timelineEventsList: {
    gap: 12,
  },
  timelineEventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  timelineEventRowHighlight: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: 10,
    borderRadius: 14,
  },
  timelineCheckIconBox: {
    marginTop: 2,
  },
  timelineEventTitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  timelineEventTime: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    marginTop: 2,
  },

  // ── TRIP CHECKLIST CARD (Image 2) ──
  checklistMessageContainer: {
    marginVertical: 10,
    width: "100%",
  },
  checklistSenderName: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 4,
  },
  checklistCard: {
    width: "86%",
    borderRadius: 24,
    backgroundColor: "#20232c",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  checklistCardHeader: {
    marginBottom: 16,
  },
  checklistCardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  checklistItemsList: {
    gap: 16,
  },
  checklistItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSquareChecked: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  checklistItemText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14.5,
    fontWeight: "500",
  },
  checklistItemTextChecked: {
    color: "rgba(255, 255, 255, 0.45)",
    textDecorationLine: "line-through",
  },

  // Reaction Badge on Bubbles
  reactionBadge: {
    position: "absolute",
    bottom: -10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#1e222b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 3,
  },
  reactionBadgeOwn: {
    right: 12,
  },
  reactionBadgeOther: {
    left: 12,
  },

  // Call Log message inside chat
  callLogMsgContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  callLogMsgCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a2228",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.2)",
    maxWidth: "90%",
  },
  callLogIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  callLogMsgTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  callLogMsgSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    marginTop: 2,
  },
  joinCallBtn: {
    backgroundColor: "#00e6b0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  joinCallText: {
    color: "#0b0f14",
    fontSize: 12.5,
    fontWeight: "800",
  },

  // Reply preview above input bar
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 26, 34, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: "#00e6b0",
  },
  replyPreviewSender: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "700",
  },
  replyPreviewText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    marginTop: 2,
  },

  // Floating Bottom Input Bar (Single Chat Style)
  bottomBarFloatingWrap: {
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    zIndex: 20,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingTop: 8,
    gap: 8,
    backgroundColor: "transparent",
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#1c2329",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minHeight: 44,
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
    paddingTop: Platform.OS === "android" ? 0 : 2,
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

  // Pending Image Bar
  pendingImageBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#16181f",
  },
  pendingThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  cancelPendingBtn: {
    marginLeft: 12,
    padding: 6,
  },

  // ═══════════════════════════════════════════════════════════
  // IMAGE 1: REACTION CARD & CONTEXT MENU
  // ═══════════════════════════════════════════════════════════
  reactionModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  reactionCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#161820",
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 8,
  },
  reactionEmojiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  reactionEmojiBtn: {
    padding: 4,
  },
  reactionPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  reactionMenuDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 10,
  },
  reactionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  reactionMenuText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  // ═══════════════════════════════════════════════════════════
  // GROUP CALL MODAL SHEET
  // ═══════════════════════════════════════════════════════════
  callModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  callModalSheet: {
    backgroundColor: "#14171f",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  callModalHeading: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
  },
  callModalSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  callAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00e6b0",
    paddingVertical: 14,
    borderRadius: 18,
    marginBottom: 18,
  },
  callAllText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
  },
  orCallIndividualLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  callMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  callMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#222",
  },
  callMemberName: {
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "700",
  },
  callMemberHandle: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
  },

  // Attachment Modal
  attachModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  attachMenuSheet: {
    backgroundColor: "#161822",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  attachMenuHeading: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
  },
  attachMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  attachIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  attachItemTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  attachItemSub: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 2,
  },
});
