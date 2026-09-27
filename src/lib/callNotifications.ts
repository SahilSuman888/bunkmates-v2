import { Platform } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export const CALL_CHANNEL_ID = "bunkmates-incoming-calls-v2";
export const ONGOING_CALL_CHANNEL_ID = "bunkmates-ongoing-calls-v2";
export const MISSED_CALL_CHANNEL_ID = "bunkmates-missed-calls-v2";

let activeIncomingNotificationId: string | null = null;
let activeOngoingNotificationId: string | null = null;

// expo-notifications Android Push support was removed in Expo Go SDK 53+.
// We lazy-load it so the app doesn't crash in Expo Go; in a dev/prod build it works fully.
let Notifications: typeof import("expo-notifications") | null = null;
let notificationsAvailable = false;

async function getNotifications() {
  if (Notifications !== null) return Notifications;
  try {
    Notifications = await import("expo-notifications");
    notificationsAvailable = true;
  } catch (e) {
    console.warn(
      "[CallNotifications] expo-notifications not available in this environment (Expo Go). " +
        "Notifications will be silently disabled. Use a development build for full support."
    );
    notificationsAvailable = false;
  }
  return Notifications;
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
        buttonTitle: "📞 Call Back",
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
  callerId?: string
) {
  const N = await getNotifications();
  if (!N) return;

  try {
    await cancelCallNotification();
    await setupCallNotificationCategories();

    await N.scheduleNotificationAsync({
      content: {
        title: callType === "video" ? "📹 Missed Video Call" : "📞 Missed Voice Call",
        body: `You missed a ${callType} call from ${callerName}`,
        data: { type: "missed_call", callerId, callerName, callType },
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
