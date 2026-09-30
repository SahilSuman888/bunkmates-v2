import { Platform, NativeModules } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { setupCallNotificationCategories } from "./callNotifications";

export const ONESIGNAL_APP_ID = "263ae218-7fa0-49cf-9503-d7d0fab26d60";

// OneSignal App API Key (Rich Authentication Token, scoped to BunkMates App)
export const ONESIGNAL_APP_API_KEY =
  "[REMOVED]";

// Safe native module loader (prevents crash in Expo Go where custom native modules cannot run)
let OneSignal: any = null;
let LogLevel: any = null;

const isExpoGo = Constants.appOwnership === "expo";

if (!isExpoGo) {
  try {
    const rnos = require("react-native-onesignal");
    OneSignal = rnos.OneSignal || rnos.default || rnos;
    LogLevel = rnos.LogLevel;
  } catch (err) {
    console.log("[OneSignal] Native module not registered (normal in Expo Go):", err);
  }
} else {
  console.log("[OneSignal] Running in Expo Go — native push activates in development build / standalone APK.");
}

let isInitialized = false;

/**
 * Initialize OneSignal SDK, configure notification channels & notification listeners.
 * Safe to call multiple times and safe in Expo Go.
 */
export function initOneSignal() {
  if (isInitialized) return;

  // Always configure notification categories/channels if available
  try {
    setupCallNotificationCategories();
  } catch (e) {}

  if (!OneSignal) {
    console.log("[OneSignal] Skipped SDK initialization (running in Expo Go or native module missing).");
    return;
  }

  try {
    if (LogLevel?.Warn) {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
    }

    // Initialize with App ID
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Prompt user for push notification permission
    OneSignal.Notifications.requestPermission(true).then((granted: boolean) => {
      console.log("[OneSignal] Push permission status:", granted);
      try {
        if (OneSignal.User?.pushSubscription?.optIn) {
          OneSignal.User.pushSubscription.optIn();
        }
      } catch (e) {}
    });

    try {
      if (OneSignal.User?.pushSubscription?.optIn) {
        OneSignal.User.pushSubscription.optIn();
      }
    } catch (e) {}

    // 1. Foreground notification display listener
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
      console.log("[OneSignal] Foreground notification received:", event?.getNotification()?.notificationId);
    });

    // 2. Notification click & action button click listener
    OneSignal.Notifications.addEventListener("click", handleNotificationClick);

    isInitialized = true;
    console.log("[OneSignal] Initialized successfully in native binary");
  } catch (error) {
    console.error("[OneSignal] Initialization error:", error);
  }
}

export type PendingNotificationNav = {
  type: string;
  data: any;
  actionId?: string;
};

let pendingNav: PendingNotificationNav | null = null;
let activeNavHandler: ((nav: PendingNotificationNav) => void) | null = null;

export function registerNotificationHandler(handler: (nav: PendingNotificationNav) => void) {
  activeNavHandler = handler;
  if (pendingNav) {
    const nav = pendingNav;
    pendingNav = null;
    try {
      handler(nav);
    } catch (e) {
      console.warn("[OneSignal] Pending nav handler error:", e);
    }
  }
}

export function unregisterNotificationHandler() {
  activeNavHandler = null;
}

async function handleNotificationClick(event: any) {
  try {
    console.log("[OneSignal] Notification clicked:", JSON.stringify(event));

    const data: any = event?.notification?.additionalData || {};
    const type = typeof data.type === "string" ? data.type : "general";
    const actionId: string | undefined = (event as any)?.result?.actionId;

    if (actionId === "DECLINE_CALL" && data.callId) {
      try {
        await updateDoc(doc(db, "calls", data.callId), { status: "declined" });
      } catch (e) {
        console.warn("[OneSignal] Decline call update failed:", e);
      }
      return;
    }

    const navItem: PendingNotificationNav = { type, data, actionId };

    if (activeNavHandler) {
      activeNavHandler(navItem);
    } else {
      pendingNav = navItem;
    }
  } catch (err) {
    console.error("[OneSignal] Click handler error:", err);
  }
}

/**
 * Link the authenticated user's Firebase UID as OneSignal External User ID
 */
export function loginOneSignalUser(uid: string) {
  if (!uid || !OneSignal) return;
  try {
    initOneSignal();
    OneSignal.login(uid);
    console.log("[OneSignal] Logged in user:", uid);
  } catch (err) {
    console.warn("[OneSignal] Login error:", err);
  }
}

/**
 * Unlink the user on sign out
 */
export function logoutOneSignalUser() {
  if (!OneSignal) return;
  try {
    OneSignal.logout();
    console.log("[OneSignal] Logged out");
  } catch (err) {
    console.warn("[OneSignal] Logout error:", err);
  }
}

/**
 * Send a push notification via OneSignal REST API targeting external_id(s).
 * Uses standard fetch, so it works reliably everywhere.
 */
export async function sendOneSignalPush({
  externalUserIds,
  headings,
  contents,
  data,
  androidChannelId,
  priority = 10,
  buttons,
  contentAvailable = false,
  ttl,
  largeIcon,
  androidSound = "default",
  androidAccentColor = "FF00E6B0",
}: {
  externalUserIds: string[];
  headings: Record<string, string>;
  contents: Record<string, string>;
  data?: Record<string, any>;
  androidChannelId?: string;
  priority?: number;
  buttons?: Array<{ id: string; text: string; icon?: string }>;
  contentAvailable?: boolean;
  ttl?: number;
  largeIcon?: string;
  androidSound?: string;
  androidAccentColor?: string;
}) {
  const targetIds = externalUserIds.filter(Boolean);
  if (targetIds.length === 0) return;

  try {
    const isCallType = data?.type === "call" || data?.type === "group_call" || data?.type === "incoming_call";
    const resolvedSound = androidSound && androidSound !== "default"
      ? androidSound
      : isCallType
      ? "call_ringtone"
      : "default";

    const payload: any = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: targetIds,
      },
      target_channel: "push",
      headings,
      contents,
      data: data || {},
      priority,
      android_sound: resolvedSound,
      android_visibility: 1, // Show on lockscreen
      ios_sound: isCallType ? "call_ringtone.wav" : "default",
    };

    if (largeIcon) {
      payload.large_icon = largeIcon;
    }

    if (androidAccentColor) {
      payload.android_accent_color = androidAccentColor;
    }

    // Route to dedicated Android NotificationChannel configured in client code
    payload.existing_android_channel_id = androidChannelId || "bunkmates_default_channel_v1";

    if (typeof ttl === "number") {
      payload.ttl = ttl;
    }

    if (contentAvailable) {
      payload.content_available = true;
      payload.apns_push_type_background = "voip";
    }

    if (buttons && buttons.length > 0) {
      payload.buttons = buttons;
    }

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_APP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.errors) {
      console.warn("[OneSignal REST] Push response errors:", json.errors);
    } else {
      console.log(`[OneSignal REST] Notification sent to ${targetIds.length} user(s):`, json.id);
    }
    return json;
  } catch (err) {
    console.error("[OneSignal REST] Push request failed:", err);
  }
}

export async function getNativeCallAction(): Promise<{
  action?: string | null;
  callId?: string | null;
  callType?: string | null;
  callerName?: string | null;
} | null> {
  if (Platform.OS === "android" && NativeModules.BunkMatesRingtone?.getInitialCallAction) {
    try {
      const res = await NativeModules.BunkMatesRingtone.getInitialCallAction();
      if (res && res.action && res.callId) {
        return res;
      }
    } catch (e) {
      console.warn("[OneSignal] getNativeCallAction error:", e);
    }
  }
  return null;
}

export { OneSignal };
