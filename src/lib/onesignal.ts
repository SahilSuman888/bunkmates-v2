import { Platform, NativeModules } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { setupCallNotificationCategories } from "./callNotifications";
import { sendOneSignalNotification } from "./oneSignalApi";

export const ONESIGNAL_APP_ID =
  process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || "263ae218-7fa0-49cf-9503-d7d0fab26d60";

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
    isInitialized = true;
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
      try {
        const notif = event?.getNotification();
        console.log("[OneSignal] Foreground notification received:", notif?.notificationId);
        if (notif) {
          const additionalData = notif.additionalData || {};
          const { triggerInAppNotificationBanner } = require("./NotificationService");
          triggerInAppNotificationBanner({
            title: notif.title || "New Notification",
            message: notif.body || "",
            category: additionalData.type || "general",
            route:
              additionalData.route ||
              (additionalData.chatId ? `/chat/${additionalData.senderId}` : undefined),
            senderName: additionalData.displayName || additionalData.senderName,
            senderPic: additionalData.photoURL || additionalData.pic,
            data: additionalData,
          });
        }
      } catch (e) {
        console.warn("[OneSignal] Foreground banner dispatch error:", e);
      }
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
        const { cancelCallNotification } = require("./callNotifications");
        cancelCallNotification(data.callId);
        await updateDoc(doc(db, "calls", data.callId), { status: "declined" });
      } catch (e) {
        console.warn("[OneSignal] Decline call update failed:", e);
      }
      return;
    }

    if (data.callId) {
      try {
        const { cancelCallNotification } = require("./callNotifications");
        cancelCallNotification(data.callId);
      } catch (e) {}
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
    await sendOneSignalNotification({
      externalUserIds: targetIds,
      headings,
      contents,
      data,
      priority,
      androidChannelId,
      contentAvailable,
      ttl,
      largeIcon,
      androidSound,
      androidAccentColor,
      buttons,
    });
  } catch (err: any) {
    if (
      err?.code === "functions/not-found" ||
      err?.message?.includes("not-found") ||
      err?.toString()?.includes("not-found")
    ) {
      console.log(
        "[OneSignal REST] Cloud function 'sendOneSignalNotification' is not deployed yet. Skipping remote push."
      );
    } else {
      console.warn("[OneSignal REST] Push request failed:", err?.message || err);
    }
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
