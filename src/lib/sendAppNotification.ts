import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { sendOneSignalPush } from "./onesignal";
import { CALL_CHANNEL_ID, MISSED_CALL_CHANNEL_ID } from "./callNotifications";

/**
 * Send push notification and write Firestore in-app notification for 1:1 chat message
 */
export async function sendChatMessageNotification({
  receiverId,
  senderId,
  senderName,
  senderAvatar,
  messageText,
  chatId,
}: {
  receiverId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageText: string;
  chatId: string;
}) {
  if (!receiverId || receiverId === senderId) return;

  const displayMessage = messageText.length > 100 ? messageText.substring(0, 97) + "..." : messageText;

  // 1. OneSignal Push Notification (Mobile notification panel & heads-up)
  sendOneSignalPush({
    externalUserIds: [receiverId],
    headings: { en: senderName },
    contents: { en: displayMessage },
    data: {
      type: "chat",
      senderId,
      displayName: senderName,
      photoURL: senderAvatar || "",
      chatId,
    },
    priority: 10,
  }).catch((err) => console.warn("[Notification] OneSignal chat push error:", err));

  // 2. Firestore In-App Notification (Bell icon badge count & /notifications page)
  try {
    await addDoc(collection(db, "notifications"), {
      uid: receiverId,
      type: "chat",
      title: senderName,
      content: displayMessage,
      message: displayMessage,
      senderId,
      senderName,
      pic: senderAvatar || "https://i.pravatar.cc/150",
      seen: false,
      read: false,
      timestamp: serverTimestamp(),
      route: `/chat/${senderId}`,
      chatId,
      skipExpoPush: true,
      viaOneSignal: true,
      pushSent: true,
    });
  } catch (err) {
    console.warn("[Notification] Firestore notification error:", err);
  }
}

/**
 * Send push notification and write Firestore in-app notification for Group chat message
 */
export async function sendGroupChatMessageNotification({
  memberIds,
  senderId,
  senderName,
  senderAvatar,
  messageText,
  groupId,
  groupName,
}: {
  memberIds: string[];
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messageText: string;
  groupId: string;
  groupName: string;
}) {
  // Exclude the sender
  const targetMembers = memberIds.filter((id) => id && id !== senderId);
  if (targetMembers.length === 0) return;

  const displayMessage = messageText.length > 100 ? messageText.substring(0, 97) + "..." : messageText;

  // 1. OneSignal Push Notification to all group members
  sendOneSignalPush({
    externalUserIds: targetMembers,
    headings: { en: groupName },
    contents: { en: `${senderName}: ${displayMessage}` },
    data: {
      type: "group_chat",
      groupId,
      groupName,
      senderId,
      displayName: senderName,
    },
    priority: 10,
  }).catch((err) => console.warn("[Notification] OneSignal group push error:", err));

  // 2. Firestore In-App Notifications for each group member
  for (const memberId of targetMembers) {
    try {
      await addDoc(collection(db, "notifications"), {
        uid: memberId,
        type: "group_chat",
        title: groupName,
        content: `${senderName}: ${displayMessage}`,
        message: `${senderName}: ${displayMessage}`,
        senderId,
        senderName,
        pic: senderAvatar || "https://i.pravatar.cc/150",
        seen: false,
        read: false,
        timestamp: serverTimestamp(),
        route: `/group-chatroom/${groupId}`,
        groupId,
        skipExpoPush: true,
        viaOneSignal: true,
        pushSent: true,
      });
    } catch (err) {
      console.warn("[Notification] Firestore group notification error:", err);
    }
  }
}

/**
 * Send high-priority call push notification (with ringtone) and write in-app notification
 */
export async function sendCallPushAndFirestoreNotification({
  receiverIds,
  callerId,
  callerName,
  callerAvatar,
  callType,
  callId,
  isGroupCall = false,
  groupName,
}: {
  receiverIds: string[];
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "audio" | "video";
  callId: string;
  isGroupCall?: boolean;
  groupName?: string;
}) {
  const targetIds = receiverIds.filter((id) => id && id !== callerId);
  if (targetIds.length === 0) return;

  const isVideo = callType === "video";
  const callSubtitle = isGroupCall
    ? `Incoming group call (${groupName || "Group"})`
    : `Incoming ${isVideo ? "video" : "voice"} call`;

  // 1. OneSignal Call Push (Matches Screenshot 1: Heads-up card, contact avatar, Accept & Decline)
  sendOneSignalPush({
    externalUserIds: targetIds,
    headings: { en: callerName }, // Screenshot 1: "Mummy"
    contents: { en: callSubtitle }, // Screenshot 1: "Incoming voice call"
    largeIcon: callerAvatar || "https://i.pravatar.cc/150", // Screenshot 1: Large contact avatar
    androidChannelId: CALL_CHANNEL_ID,
    androidSound: "call_ringtone",
    androidAccentColor: "FF00E6B0",
    priority: 10,
    contentAvailable: true,
    ttl: 35,
    buttons: [
      { id: "DECLINE_CALL", text: "Decline", icon: "ic_menu_close_clear_cancel" },
      { id: "ACCEPT_CALL", text: "Answer", icon: "ic_menu_call" },
    ],
    data: {
      type: isGroupCall ? "group_call" : "call",
      callId,
      callType,
      callerName,
      callerAvatar,
      isGroupCall,
      groupName: groupName || null,
    },
  }).catch((err) => console.warn("[Notification] OneSignal call push error:", err));

  // 2. Firestore In-App Notifications
  for (const receiverId of targetIds) {
    try {
      await addDoc(collection(db, "notifications"), {
        uid: receiverId,
        type: "call",
        title: callerName,
        content: callSubtitle,
        message: callSubtitle,
        senderId: callerId,
        senderName: callerName,
        pic: callerAvatar || "https://i.pravatar.cc/150",
        seen: false,
        read: false,
        timestamp: serverTimestamp(),
        callId,
        callType,
        skipExpoPush: true,
        viaOneSignal: true,
        pushSent: true,
      });
    } catch (err) {
      console.warn("[Notification] Firestore call notification error:", err);
    }
  }
}

/**
 * Send high-priority missed call push notification (Matches Screenshot 2)
 */
export async function sendMissedCallPushAndFirestoreNotification({
  receiverId,
  callerId,
  callId,
  callerName,
  callerAvatar,
  callType,
}: {
  receiverId: string;
  callerId: string;
  callId: string;
  callerName: string;
  callerAvatar?: string;
  callType: "audio" | "video";
}) {
  if (!receiverId || receiverId === callerId) return;

  const title = callerName; // Screenshot 2: "Mummy"
  const body = `1 missed ${callType} call`; // Screenshot 2: "1 missed voice call"

  // 1. OneSignal Push (Matches Screenshot 2: "Call back" and "Message" buttons)
  sendOneSignalPush({
    externalUserIds: [receiverId],
    headings: { en: title },
    contents: { en: body },
    largeIcon: callerAvatar || "https://i.pravatar.cc/150",
    androidChannelId: MISSED_CALL_CHANNEL_ID,
    androidAccentColor: "FFFF5252",
    priority: 10,
    buttons: [
      { id: "CALL_BACK", text: "Call back" },
      { id: "MESSAGE", text: "Message" },
    ],
    data: {
      type: "missed_call",
      callId,
      callerId,
      callerName,
      callerAvatar,
      callType,
    },
  }).catch((err) => console.warn("[Notification] OneSignal missed call push error:", err));

  // 2. Firestore In-App Notification
  try {
    await addDoc(collection(db, "notifications"), {
      uid: receiverId,
      type: "missed_call",
      title: `${callerName}`,
      content: `1 missed ${callType} call`,
      message: `1 missed ${callType} call`,
      senderId: callerId,
      senderName: callerName,
      pic: callerAvatar || "https://i.pravatar.cc/150",
      seen: false,
      read: false,
      timestamp: serverTimestamp(),
      callType,
      skipExpoPush: true,
      viaOneSignal: true,
      pushSent: true,
    });
  } catch (err) {
    console.warn("[Notification] Firestore missed call notification error:", err);
  }
}
