import { Platform, NativeModules } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { sendOneSignalNotification } from "./oneSignalApi";

export const CALL_CHANNEL_ID = "bunkmates_call_ringtone_channel_v7";
export const ONGOING_CALL_CHANNEL_ID = "bunkmates-ongoing-calls-v5";
export const MISSED_CALL_CHANNEL_ID = "bunkmates-missed-calls-v5";

let activeIncomingNotificationId: string | null = null;
let activeOngoingNotificationId: string | null = null;

import safeNotifications, { isExpoGo } from "./safeNotifications";

let notificationsAvailable = !isExpoGo;

async function getNotifications() {
  return safeNotifications;
}

/**
 * Configure dedicated notification channels and action categories for Android & iOS
 */
export async function setupCallNotificationCategories() {
  const N = await getNotifications();
  if (!N) return;

  try {
    // 1. Set notification categories with action buttons
    await N.setNotificationCategoryAsync("incoming_call_category", [
      {
        identifier: "DECLINE_ACTION",
        buttonTitle: "Decline",
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
      {
        identifier: "ACCEPT_ACTION",
        buttonTitle: "Answer",
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    await N.setNotificationCategoryAsync("ongoing_call_category", [
      {
        identifier: "OPEN_CALL_ACTION",
        buttonTitle: "📱 Open Call",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "END_CALL_ACTION",
        buttonTitle: "🔴 End Call",
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    await N.setNotificationCategoryAsync("missed_call_category", [
      {
        identifier: "CALLBACK_ACTION",
        buttonTitle: "Call back",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "MESSAGE_ACTION",
        buttonTitle: "Message",
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    // 2. Android Channels Configuration
    if (Platform.OS === "android") {
      // Incoming Calls: High-priority full-screen intent channel
      await N.setNotificationChannelAsync(CALL_CHANNEL_ID, {
        name: "Incoming Calls",
        description: "Full-screen alerts and ringtones for incoming voice & video calls",
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        sound: "default",
        enableVibrate: true,
        enableLights: true,
        lightColor: "#00e6b0",
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });

      // Ongoing Calls: Foreground sticky channel
      await N.setNotificationChannelAsync(ONGOING_CALL_CHANNEL_ID, {
        name: "Ongoing Calls",
        description: "Active call status and quick control actions",
        importance: N.AndroidImportance.HIGH,
        sound: undefined,
        vibrationPattern: [0],
        enableLights: false,
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: false,
      });

      // Missed Calls: Standard high priority alert channel
      await N.setNotificationChannelAsync(MISSED_CALL_CHANNEL_ID, {
        name: "Missed Calls",
        description: "Notifications for missed incoming calls",
        importance: N.AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: true,
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });
    }
  } catch (e) {
    console.warn("[CallNotifications] Error setting up notification categories:", e);
  }
}

/**
 * Show a local incoming call notification on the device with Accept / Decline actions
 */
export async function showLocalIncomingCallNotification(
  callerName: string,
  callType: "audio" | "video",
  callId: string
) {
  const N = await getNotifications();
  if (!N) return null;

  try {
    await setupCallNotificationCategories();

    const notifId = await N.scheduleNotificationAsync({
      content: {
        title: callType === "video" ? "📹 Incoming HD Video Call" : "📞 Incoming Voice Call",
        body: `${callerName} is calling you on BunkMates...`,
        data: { type: "call", callId, callType, callerName },
        sound: "default",
        priority: N.AndroidNotificationPriority.MAX,
        autoDismiss: false,
        sticky: true,
        categoryIdentifier: "incoming_call_category",
        color: "#00e6b0",
      },
      trigger: null, // trigger immediately
    });

    activeIncomingNotificationId = notifId;
    return notifId;
  } catch (e) {
    console.warn("[CallNotifications] Error showing local incoming call notification:", e);
    return null;
  }
}

/**
 * Show/Update an ongoing call notification
 */
export async function showOngoingCallNotification(
  callerName: string,
  callType: "audio" | "video",
  callId: string,
  formattedDuration: string
) {
  const N = await getNotifications();
  if (!N) return null;

  try {
    await setupCallNotificationCategories();

    const notifId = await N.scheduleNotificationAsync({
      identifier: `ongoing_${callId}`,
      content: {
        title: `Ongoing ${callType === "video" ? "Video" : "Voice"} Call (${formattedDuration})`,
        body: `Talking with ${callerName} • Tap to return`,
        data: { type: "ongoing_call", callId, callType },
        sticky: true,
        autoDismiss: false,
        priority: N.AndroidNotificationPriority.HIGH,
        categoryIdentifier: "ongoing_call_category",
        color: "#00e6b0",
      },
      trigger: null,
    });

    activeOngoingNotificationId = notifId;
    return notifId;
  } catch (e) {
    console.warn("[CallNotifications] Error showing ongoing call notification:", e);
    return null;
  }
}

/**
 * Cancel the active incoming and ongoing call notifications
 */
export async function cancelCallNotification(callId?: string) {
  const N = await getNotifications();
  if (!N) return;

  try {
    if (Platform.OS === "android" && NativeModules.BunkMatesRingtone) {
      NativeModules.BunkMatesRingtone.stop(callId || "");
    }

    if (activeIncomingNotificationId) {
      await N.dismissNotificationAsync(activeIncomingNotificationId);
      activeIncomingNotificationId = null;
    }
    if (activeOngoingNotificationId) {
      await N.dismissNotificationAsync(activeOngoingNotificationId);
      activeOngoingNotificationId = null;
    }
    if (callId) {
      await N.dismissNotificationAsync(`ongoing_${callId}`);
    }
  } catch (e) {}
}

/**
 * Show a missed call notification with a "Call Back" action button
 */
export async function showMissedCallNotification(
  callerName: string,
  callType: "audio" | "video",
  callerId?: string,
  callerAvatar?: string
) {
  const N = await getNotifications();
  if (!N) return;

  try {
    await cancelCallNotification();
    await setupCallNotificationCategories();

    await N.scheduleNotificationAsync({
      content: {
        title: callerName, // Matches Screenshot 2: "Mummy"
        body: `1 missed ${callType} call`, // Matches Screenshot 2: "1 missed voice call"
        data: { type: "missed_call", callerId, callerName, callerAvatar, callType },
        sound: "default",
        priority: N.AndroidNotificationPriority.HIGH,
        categoryIdentifier: "missed_call_category",
        color: "#ff5252",
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[CallNotifications] Error showing missed call notification:", e);
  }
}

/**
 * Send a call push notification through the authenticated Cloud Function.
 */
export async function sendOneSignalCallNotification({
  receiverId,
  callerName,
  callType,
  callId,
  isGroupCall = false,
  groupName,
}: {
  receiverId: string;
  callerName: string;
  callType: "audio" | "video";
  callId: string;
  isGroupCall?: boolean;
  groupName?: string;
}) {
  if (!receiverId) return;

  try {
    const isVideo = callType === "video";
    const callEmoji = isGroupCall ? "👥" : isVideo ? "📹" : "📞";
    const callLabel = isGroupCall
      ? "Incoming Group Call"
      : isVideo
      ? "Incoming Video Call"
      : "Incoming Voice Call";

    const result = await sendOneSignalNotification({
      externalUserIds: [receiverId],
      headings: { en: `${callEmoji} ${callLabel}` },
      contents: { en: `${callerName} is calling you on BunkMates...` },
      data: {
        type: isGroupCall ? "group_call" : "call",
        callId,
        callType,
        callerName,
        isGroupCall,
        groupName: groupName || null,
      },
      androidChannelId: CALL_CHANNEL_ID,
      androidSound: "call_ringtone",
      priority: 10,
      ttl: 35,
      contentAvailable: true,
      buttons: [
        { id: "ACCEPT_CALL", text: "✅ Accept" },
        { id: "DECLINE_CALL", text: "❌ Decline" },
      ],
    });
    console.log("[CallNotifications] OneSignal call push sent:", result);
  } catch (e) {
    console.error("[CallNotifications] Failed to send OneSignal call notification:", e);
  }
}

/**
 * @deprecated Use sendOneSignalCallNotification instead.
 * Kept for backward-compatibility; internally calls the new function.
 */
export async function sendRemoteCallPushNotification({
  receiverId,
  callerName,
  callType,
  callId,
}: {
  receiverId: string;
  callerName: string;
  callType: "audio" | "video";
  callId: string;
}) {
  return sendOneSignalCallNotification({ receiverId, callerName, callType, callId });
}
