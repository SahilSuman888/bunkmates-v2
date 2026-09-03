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
import GroupInfoDrawer from "../../../components/group_chat/GroupInfoDrawer";
import UserProfileModal from "../../../components/UserProfileModal";
import { BlurView } from "expo-blur";
import { sendGroupChatMessageNotification } from "../../../lib/sendAppNotification";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_GROUP_AVATAR = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=200";
const DARK_WAVE_WALLPAPER = "https://i.ibb.co/C0f9vH9/dark-wave-bg.png";

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
  const { user } = useUser();
  const { startCall } = useCall();

  const groupKey = (groupId as string) || "";
  const { messages, loading: messagesLoading } = useGroupChat(groupKey);

  const [groupData, setGroupData] = useState<any>(null);
  const [memberUsers, setMemberUsers] = useState<any[]>([]);
  const [createdByUser, setCreatedByUser] = useState<any>(null);

  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  // Modals & Sheets
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  // Reaction & Context Menu Modal (Image 1)
  const [reactionMsg, setReactionMsg] = useState<any | null>(null);
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);

  // Call Selection Modal
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<"audio" | "video">("audio");

  const flatListRef = useRef<FlatList>(null);

  // ═══════════════════════════════════════════════════════════════
  // 1. FETCH GROUP & MEMBERS DATA
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!groupKey) return;

    const groupDocRef = doc(db, "groupChats", groupKey);
    const unsub = onSnapshot(groupDocRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGroupData(data);

        // Fetch Creator Profile
        if (data.createdBy) {
          try {
            const cSnap = await getDoc(doc(db, "users", data.createdBy));
            if (cSnap.exists()) {
              setCreatedByUser(cSnap.data());
            }
          } catch (e) {}
        }

        // Fetch Member Profiles
        if (Array.isArray(data.members) && data.members.length > 0) {
          try {
            const memberDocs = await Promise.all(
              data.members.slice(0, 20).map((uid: string) => getDoc(doc(db, "users", uid)))
            );
            const resolved = memberDocs
              .map((d, i) => (d.exists() ? { uid: data.members[i], ...d.data() } : null))
              .filter(Boolean);
            setMemberUsers(resolved);
          } catch (e) {}
        }
      }
    });

    return () => unsub();
  }, [groupKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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

    try {
      const msgObj = customPayload || {
        text: textToSend,
        imageUrl: pendingImage || null,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split("@")[0] || "Mohit Sharma",
        senderAvatar: user.photoURL || null,
        timestamp: serverTimestamp(),
        type: pendingImage ? "image" : "text",
        replyTo: replyTo
          ? { text: replyTo.text, senderId: replyTo.senderId, senderName: replyTo.senderName }
          : null,
      };

      setPendingImage(null);

      // Dual collection write for Web & Mobile synchronization
      await addDoc(collection(db, "groupChat", groupKey, "messages"), msgObj);
      await addDoc(collection(db, "groupChats", groupKey, "messages"), msgObj);

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

  // Camera / Gallery Image Picker
  const pickImage = async () => {
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
                    <View style={[s.checkboxSquare, isCompleted && s.checkboxSquareChecked]}>
                      {isCompleted && (
                        <Ionicons name="checkmark" size={14} color="#000000" />
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
          style={[s.msgBubble, isOwn ? s.msgBubbleOwn : s.msgBubbleOther]}
        >
          {/* Sender Name for incoming group messages (Image 2) */}
          {!isOwn && (
            <Text style={s.msgSenderName}>{item.senderName || "Traveler"}</Text>
          )}

          {/* Reply Preview */}
          {item.replyTo && (
            <View style={s.replyBox}>
              <Text style={s.replyBoxSender}>{item.replyTo.senderName}</Text>
              <Text style={s.replyBoxText} numberOfLines={1}>
                {item.replyTo.text}
              </Text>
            </View>
          )}

          {/* Attached Image */}
          {item.imageUrl && (
            <ExpoImage
              source={{ uri: item.imageUrl }}
              style={s.msgAttachedImage}
              contentFit="cover"
            />
          )}

          {/* Message Text */}
          {item.text ? <Text style={s.msgText}>{item.text}</Text> : null}

          {/* Timestamp Row */}
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
                size={14}
                color="#00e6b0"
                style={{ marginLeft: 4 }}
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

  return (
    <ImageBackground
      source={{ uri: DARK_WAVE_WALLPAPER }}
      style={s.safeContainer}
      resizeMode="cover"
    >
      <SafeAreaViewContext style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor="#0b0f14" translucent />

        {/* ── TOP HEADER (With Call & Video Call buttons) ── */}
        <View style={s.headerBar}>
          {/* Back Button -> Navigates to Chat Page */}
          <Pressable onPress={handleBack} style={s.headerCircleBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </Pressable>

          {/* Group Avatar & Titles -> Tapping opens Group Info Drawer */}
          <Pressable onPress={() => setShowGroupInfo(true)} style={s.headerCenterPressable}>
            <ExpoImage
              source={{ uri: groupData?.iconURL || DEFAULT_GROUP_AVATAR }}
              style={s.headerGroupAvatar}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={s.headerGroupTitle} numberOfLines={1}>
                {groupData?.name || "Bunk1"}
              </Text>
              <Text style={s.headerGroupSubtitle} numberOfLines={1}>
                {memberNamesSubtitle}
              </Text>
            </View>
          </Pressable>

          {/* Call & Video Call Buttons (Single Chat Concept) */}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              style={s.headerCircleBtn}
              onPress={() => handleInitiateGroupCall("audio")}
              hitSlop={8}
            >
              <Ionicons name="call" size={18} color="#ffffff" />
            </Pressable>

            <Pressable
              style={s.headerCircleBtn}
              onPress={() => handleInitiateGroupCall("video")}
              hitSlop={8}
            >
              <Ionicons name="videocam" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* ── MESSAGES LIST ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[s.messagesScrollContent, { paddingBottom: 20 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Replying Preview Bar */}
          {replyTo && (
            <View style={s.replyPreviewBar}>
              <View style={{ flex: 1 }}>
                <Text style={s.replyPreviewSender}>
                  Replying to {replyTo.senderName || "Traveler"}
                </Text>
                <Text style={s.replyPreviewText} numberOfLines={1}>
                  {replyTo.text || "📷 Attachment"}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
          )}

          {/* Pending Image Preview */}
          {pendingImage && (
            <View style={s.pendingImageBar}>
              <ExpoImage source={{ uri: pendingImage }} style={s.pendingThumb} />
              <Pressable onPress={() => setPendingImage(null)} style={s.cancelPendingBtn}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* ── BOTTOM CHAT BAR (Image 1 & 2) ── */}
          <View style={[s.bottomBarContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {/* Plus Actions Button */}
            <Pressable
              onPress={() => setAttachMenuOpen(true)}
              style={s.attachPlusBtn}
              hitSlop={8}
            >
              <Feather name="plus" size={20} color="#ffffff" />
            </Pressable>

            {/* Text Input */}
            <TextInput
              placeholder="Type a message..."
              placeholderTextColor="rgba(255, 255, 255, 0.45)"
              value={input}
              onChangeText={setInput}
              style={s.chatInput}
              multiline
            />

            {/* Camera Button */}
            <Pressable onPress={pickImage} style={s.cameraBtn} hitSlop={8}>
              <Ionicons name="camera-outline" size={24} color="rgba(255, 255, 255, 0.75)" />
            </Pressable>

            {/* Circular White Send Button with black arrow */}
            <Pressable
              onPress={() => sendMessage()}
              disabled={!input.trim() && !pendingImage}
              style={[
                s.whiteSendBtn,
                (!input.trim() && !pendingImage) && { opacity: 0.6 },
              ]}
              hitSlop={8}
            >
              <Ionicons name="send" size={18} color="#000000" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
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
                style={s.callAllBtn}
              >
                <Ionicons
                  name={pendingCallType === "video" ? "videocam" : "call"}
                  size={20}
                  color="#000000"
                  style={{ marginRight: 10 }}
                />
                <Text style={s.callAllText}>Call Group (All Members)</Text>
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

              <Pressable onPress={handleSendTimeline} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(255, 179, 0, 0.15)" }]}>
                  <Ionicons name="calendar-outline" size={22} color="#ffb300" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Group Timeline</Text>
                  <Text style={s.attachItemSub}>Share day-by-day trip itinerary card</Text>
                </View>
              </Pressable>

              <Pressable onPress={handleSendChecklist} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(0, 230, 118, 0.15)" }]}>
                  <Ionicons name="checkbox-outline" size={22} color="#00e676" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Trip Checklist</Text>
                  <Text style={s.attachItemSub}>Send interactive checklist to coordinate items</Text>
                </View>
              </Pressable>

              <Pressable onPress={pickImage} style={s.attachMenuItem}>
                <View style={[s.attachIconBox, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                  <Ionicons name="image-outline" size={22} color="#38bdf8" />
                </View>
                <View>
                  <Text style={s.attachItemTitle}>Photo / Gallery</Text>
                  <Text style={s.attachItemSub}>Share trip memories and pictures</Text>
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

  // Top Header (Images 1 & 2)
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(11, 15, 20, 0.92)",
    gap: 10,
  },
  headerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenterPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerGroupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1c1c1e",
  },
  headerGroupTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  headerGroupSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: 2,
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

  // Date Divider Pill (Image 1 & 2: 23/7/2026)
  dateDividerContainer: {
    alignItems: "center",
    marginVertical: 14,
  },
  dateDividerPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1e222b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  dateDividerText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "600",
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
    marginTop: 4,
  },
  msgTimestamp: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10,
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

  // Bottom Input Bar (Images 1 & 2)
  bottomBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "rgba(11, 15, 20, 0.95)",
    gap: 10,
  },
  attachPlusBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 14.5,
  },
  cameraBtn: {
    padding: 6,
  },
  whiteSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
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
