import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const CALL_CHANNEL_ID = "bunkmates-incoming-calls-v2";
export const ONGOING_CALL_CHANNEL_ID = "bunkmates-ongoing-calls-v2";
export const MISSED_CALL_CHANNEL_ID = "bunkmates-missed-calls-v2";

let activeIncomingNotificationId: string | null = null;
let activeOngoingNotificationId: string | null = null;

/**
 * Configure dedicated notification channels and action categories for Android & iOS
 */
export async function setupCallNotificationCategories() {
  try {
    // 1. Set notification categories with action buttons
    await Notifications.setNotificationCategoryAsync("incoming_call_category", [
      {
        identifier: "ACCEPT_ACTION",
        buttonTitle: "✅ Accept",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "DECLINE_ACTION",
        buttonTitle: "❌ Decline",
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync("ongoing_call_category", [
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

    await Notifications.setNotificationCategoryAsync("missed_call_category", [
      {
        identifier: "CALLBACK_ACTION",
        buttonTitle: "📞 Call Back",
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    // 2. Android Channels Configuration
    if (Platform.OS === "android") {
      // Incoming Calls: High-priority full-screen intent channel
      await Notifications.setNotificationChannelAsync(CALL_CHANNEL_ID, {
        name: "Incoming Calls",
        description: "Full-screen alerts and ringtones for incoming voice & video calls",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        sound: "default",
        enableVibrate: true,
        enableLights: true,
        lightColor: "#00e6b0",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: true,
      });

      // Ongoing Calls: Foreground sticky channel
      await Notifications.setNotificationChannelAsync(ONGOING_CALL_CHANNEL_ID, {
        name: "Ongoing Calls",
        description: "Active call status and quick control actions",
        importance: Notifications.AndroidImportance.HIGH,
        sound: undefined,
        vibrationPattern: [0],
        enableLights: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        showBadge: false,
      });

      // Missed Calls: Standard high priority alert channel
      await Notifications.setNotificationChannelAsync(MISSED_CALL_CHANNEL_ID, {
        name: "Missed Calls",
        description: "Notifications for missed incoming calls",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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
  try {
    await setupCallNotificationCategories();

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: callType === "video" ? "📹 Incoming HD Video Call" : "📞 Incoming Voice Call",
        body: `${callerName} is calling you on BunkMates...`,
        data: { type: "call", callId, callType, callerName },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
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
  try {
    await setupCallNotificationCategories();

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: `ongoing_${callId}`,
      content: {
        title: `Ongoing ${callType === "video" ? "Video" : "Voice"} Call (${formattedDuration})`,
        body: `Talking with ${callerName} • Tap to return`,
        data: { type: "ongoing_call", callId, callType },
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
  try {
    if (activeIncomingNotificationId) {
      await Notifications.dismissNotificationAsync(activeIncomingNotificationId);
      activeIncomingNotificationId = null;
    }
    if (activeOngoingNotificationId) {
      await Notifications.dismissNotificationAsync(activeOngoingNotificationId);
      activeOngoingNotificationId = null;
    }
    if (callId) {
      await Notifications.dismissNotificationAsync(`ongoing_${callId}`);
    }
  } catch (e) {}
}

/**
 * Show a missed call notification with a "Call Back" action button
 */
export async function showMissedCallNotification(
  callerName: string,
  callType: "audio" | "video",
  callerId?: string
) {
  try {
    await cancelCallNotification();
    await setupCallNotificationCategories();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: callType === "video" ? "📹 Missed Video Call" : "📞 Missed Voice Call",
        body: `You missed a ${callType} call from ${callerName}`,
        data: { type: "missed_call", callerId, callerName, callType },
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
 * Send Remote Push Notification to receiver's Expo Push Token
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
  if (!receiverId) return;

  try {
    const userDoc = await getDoc(doc(db, "users", receiverId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const pushToken = userData?.expoPushToken;

    if (!pushToken || typeof pushToken !== "string") {
      console.log(`[CallNotifications] No push token found for user ${receiverId}`);
      return;
    }

    const message = {
      to: pushToken,
      sound: "default",
      title: callType === "video" ? `📹 Incoming Video Call` : `📞 Incoming Voice Call`,
      body: `${callerName} is calling you on BunkMates...`,
      data: { type: "call", callId, callType, callerName },
      priority: "high",
      channelId: CALL_CHANNEL_ID,
      categoryIdentifier: "incoming_call_category",
      _displayInForeground: true,
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    console.log(`[CallNotifications] Remote call push sent successfully to ${receiverId}`);
  } catch (e) {
    console.error("[CallNotifications] Failed to send remote call push notification:", e);
  }
}
