import { Platform, NativeModules } from "react-native";
import Notifications from "./safeNotifications";

export const CALL_CHANNEL_ID = "bunkmates-incoming-calls-v5";
export const ONGOING_CALL_CHANNEL_ID = "bunkmates-ongoing-calls-v5";
export const MISSED_CALL_CHANNEL_ID = "bunkmates-missed-calls-v5";

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

    // Screenshot 2: "Call back" and "Message"
    await Notifications.setNotificationCategoryAsync("missed_call_category", [
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
      // Incoming Calls: High-priority heads-up banner & ringtone channel (Screenshot 1)
      await Notifications.setNotificationChannelAsync(CALL_CHANNEL_ID, {
        name: "Incoming Calls",
        description: "Heads-up banner alerts and ringtone for incoming voice & video calls",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        audioAttributes: {
          usage: Notifications?.AndroidAudioUsage?.RINGTONE ?? 6,
          contentType: Notifications?.AndroidAudioContentType?.SONIFICATION ?? 4,
        },
        vibrationPattern: [0, 1000, 800, 1000, 800, 1000],
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

      // Missed Calls: Standard high priority alert channel (Screenshot 2)
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
    if (Platform.OS === "android" && NativeModules.BunkMatesRingtone) {
      NativeModules.BunkMatesRingtone.stop(callId || "");
    }

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
  callerId?: string,
  callerAvatar?: string
) {
  try {
    await cancelCallNotification();
    await setupCallNotificationCategories();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: callerName, // Matches Screenshot 2: "Mummy"
        body: `1 missed ${callType} call`, // Matches Screenshot 2: "1 missed voice call"
        data: { type: "missed_call", callerId, callerName, callerAvatar, callType },
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

// ─────────────────────────────────────────────────────────────────────────────
// OneSignal credentials
// ─────────────────────────────────────────────────────────────────────────────
const ONESIGNAL_APP_ID = "263ae218-7fa0-49cf-9503-d7d0fab26d60";

// OneSignal App API Key (Rich Authentication Token, scoped to BunkMates App)
const ONESIGNAL_REST_API_KEY =
  "[REMOVED]";

/**
 * Send a call push notification via OneSignal REST API.
 *
 * Targets the receiver by their Firebase UID (set as OneSignal External User ID
 * via OneSignal.login() in UserContext). No Firestore lookup needed.
 *
 * Works even when the receiver's app is fully closed (FCM/APNs delivery).
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

  if (!ONESIGNAL_REST_API_KEY || ONESIGNAL_REST_API_KEY.length < 10) {
    console.warn("[CallNotifications] OneSignal REST API Key is not configured.");
    return;
  }

  try {
    const isVideo = callType === "video";
    const callEmoji = isGroupCall ? "👥" : isVideo ? "📹" : "📞";
    const callLabel = isGroupCall
      ? "Incoming Group Call"
      : isVideo
      ? "Incoming Video Call"
      : "Incoming Voice Call";

    const body: any = {
      app_id: ONESIGNAL_APP_ID,

      // Target by Firebase UID (External User ID set via OneSignal.login)
      include_aliases: {
        external_id: [receiverId],
      },
      target_channel: "push",

      // Notification content
      headings: { en: `${callEmoji} ${callLabel}` },
      contents: { en: `${callerName} is calling you on BunkMates...` },

      // Custom data — used by OneSignalHandler.tsx onClick to open call screen
      data: {
        type: isGroupCall ? "group_call" : "call",
        callId,
        callType,
        callerName,
        isGroupCall,
        groupName: groupName || null,
      },

      existing_android_channel_id: CALL_CHANNEL_ID,
      android_sound: "default",
      android_visibility: 1, // PUBLIC — show on lock screen
      priority: 10,          // max urgency
      ttl: 35,               // expire after 35 s if not delivered (call timeout)

      // iOS: wake app in background for Firestore listener to pick up the call
      content_available: true,
      apns_push_type_background: "voip",

      // Action buttons (Android only — deep-link handled in OneSignalHandler)
      buttons: [
        { id: "ACCEPT_CALL",  text: "✅ Accept" },
        { id: "DECLINE_CALL", text: "❌ Decline" },
      ],
    };

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // v2 org keys use "Key" prefix (not "Basic")
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (json.errors) {
      console.error("[CallNotifications] OneSignal error:", json.errors);
    } else {
      console.log(
        `[CallNotifications] OneSignal call push sent → ${receiverId}`,
        json
      );
    }
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
