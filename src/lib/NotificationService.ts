import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type NotificationCategory =
  | "tripUpdates"
  | "chatMessages"
  | "reminders"
  | "recommendations"
  | "promotions";

export interface NotificationPreferences {
  allPushEnabled: boolean;
  tripUpdates: boolean;
  chatMessages: boolean;
  reminders: boolean;
  recommendations: boolean;
  promotions: boolean;
  doNotDisturb: boolean;
  silenceFrom: string;
  silenceUntil: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  allPushEnabled: true,
  tripUpdates: true,
  chatMessages: true,
  reminders: true,
  recommendations: false,
  promotions: false,
  doNotDisturb: true,
  silenceFrom: "10:00 PM",
  silenceUntil: "07:00 AM",
};

export interface AppNotificationPayload {
  recipientUid?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  senderName?: string;
  senderPic?: string;
  route?: string;
  isPriority?: boolean;
  data?: Record<string, any>;
}

// -------------------------------------------------------------
// Time & Quiet Hours Calculation
// -------------------------------------------------------------

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return hour * 60 + min;
}

export function isQuietHoursActiveNow(silenceFrom: string, silenceUntil: string): boolean {
  if (!silenceFrom || !silenceUntil) return false;
  const fromMin = parseTimeToMinutes(silenceFrom);
  const untilMin = parseTimeToMinutes(silenceUntil);
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (fromMin === untilMin) return false;

  if (fromMin > untilMin) {
    // Crosses midnight (e.g. 10:00 PM (1320) to 07:00 AM (420))
    return currentMin >= fromMin || currentMin < untilMin;
  } else {
    // Same calendar day
    return currentMin >= fromMin && currentMin < untilMin;
  }
}

/**
 * Gatekeeper checking if a notification should trigger sounds / in-app banners
 */
export function shouldDeliverNotification(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  isPriority = false
): { deliver: boolean; reason?: string } {
  // 1. Master toggle check
  if (!prefs.allPushEnabled) {
    return { deliver: false, reason: "All notifications are muted by master switch." };
  }

  // 2. Category check
  const categoryAllowed = Boolean(prefs[category]);
  if (!categoryAllowed) {
    return { deliver: false, reason: `Category '${category}' alerts are disabled in settings.` };
  }

  // 3. Quiet Hours check
  if (prefs.doNotDisturb && !isPriority) {
    const isQuiet = isQuietHoursActiveNow(prefs.silenceFrom, prefs.silenceUntil);
    if (isQuiet) {
      return {
        deliver: false,
        reason: `Silenced by Quiet Hours (${prefs.silenceFrom} – ${prefs.silenceUntil}).`,
      };
    }
  }

  return { deliver: true };
}

// -------------------------------------------------------------
// In-App Notification Banner Pub/Sub
// -------------------------------------------------------------

type InAppListener = (payload: AppNotificationPayload) => void;
const inAppListeners = new Set<InAppListener>();

export function subscribeInAppNotification(listener: InAppListener): () => void {
  inAppListeners.add(listener);
  return () => {
    inAppListeners.delete(listener);
  };
}

export function triggerInAppNotificationBanner(payload: AppNotificationPayload) {
  inAppListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn("InAppNotification listener error:", e);
    }
  });
}

// -------------------------------------------------------------
// Local Expo-Notifications Dispatcher (safe lazy load)
// -------------------------------------------------------------

let ExpoNotifications: typeof import("expo-notifications") | null = null;
async function getExpoNotifications() {
  if (ExpoNotifications !== null) return ExpoNotifications;
  try {
    ExpoNotifications = await import("expo-notifications");
  } catch {
    ExpoNotifications = null;
  }
  return ExpoNotifications;
}

// -------------------------------------------------------------
// Unified Dispatcher
// -------------------------------------------------------------

export async function dispatchAppNotification(
  payload: AppNotificationPayload,
  prefsOverride?: NotificationPreferences
): Promise<{ success: boolean; delivered: boolean; reason?: string }> {
  try {
    const user = auth.currentUser;
    const recipientUid = payload.recipientUid || user?.uid;

    // Load active preferences (from override or cached storage)
    let prefs = prefsOverride;
    if (!prefs) {
      try {
        const cached = await AsyncStorage.getItem("@bunkmates_notification_preferences");
        prefs = cached ? JSON.parse(cached) : DEFAULT_NOTIFICATION_PREFERENCES;
      } catch {
        prefs = DEFAULT_NOTIFICATION_PREFERENCES;
      }
    }

    // Check gatekeeper
    const gate = shouldDeliverNotification(prefs!, payload.category, payload.isPriority);

    // Save to Firestore inbox collection if recipient exists
    if (recipientUid) {
      try {
        await addDoc(collection(db, "notifications"), {
          uid: recipientUid,
          type: payload.category,
          title: payload.title,
          content: payload.message,
          message: payload.message,
          senderName: payload.senderName || "BunkMates",
          senderPic: payload.senderPic || "",
          route: payload.route || "",
          seen: false,
          read: false,
          timestamp: serverTimestamp(),
          metadata: payload.data || {},
        });
      } catch (err) {
        console.log("Firestore notification add error:", err);
      }
    }

    // If gatekeeper permits delivery:
    if (gate.deliver) {
      // 1. Show interactive in-app banner for current session
      triggerInAppNotificationBanner(payload);

      // 2. Schedule local system notification if possible
      const N = await getExpoNotifications();
      if (N) {
        try {
          await N.scheduleNotificationAsync({
            content: {
              title: payload.title,
              body: payload.message,
              sound: "default",
              data: {
                route: payload.route,
                category: payload.category,
                ...payload.data,
              },
            },
            trigger: null, // Send immediately
          });
        } catch (e) {
          // Native push schedule error fallback
        }
      }

      return { success: true, delivered: true };
    }

    return { success: true, delivered: false, reason: gate.reason };
  } catch (error: any) {
    console.error("dispatchAppNotification error:", error);
    return { success: false, delivered: false, reason: error?.message };
  }
}

// -------------------------------------------------------------
// Test Notification Trigger
// -------------------------------------------------------------

export async function sendTestNotification(
  category: NotificationCategory,
  prefsOverride?: NotificationPreferences
) {
  const meta: Record<NotificationCategory, { title: string; message: string; route: string }> = {
    tripUpdates: {
      title: "✈️ Flight Gate Changed",
      message: "Flight BM-308 to Goa has moved to Gate 4B. Boarding starts at 10:15 AM.",
      route: "/(tabs)/trips",
    },
    chatMessages: {
      title: "💬 Goa Roadtrip Squad",
      message: "Mohit: Don't forget to pack raincoats, forecast says heavy rain ahead!",
      route: "/(tabs)/chats",
    },
    reminders: {
      title: "⏰ Trip Packing Checklist",
      message: "3 pending items on your checklist: Portable Charger, Sunscreen & ID Card.",
      route: "/(tabs)/reminders",
    },
    recommendations: {
      title: "✨ Curated Cafe Nearby",
      message: "Cafe Bodega is 800m from your stay • 4.8★ rated for artisanal breakfast.",
      route: "/(tabs)/home",
    },
    promotions: {
      title: "🏷️ Exclusive Bunk Deal",
      message: "Get 25% off seaside hostel stays in North Goa with code BUNKER25.",
      route: "/(tabs)/home",
    },
  };

  const item = meta[category];
  return await dispatchAppNotification(
    {
      category,
      title: item.title,
      message: item.message,
      senderName: "BunkMates Travel",
      route: item.route,
    },
    prefsOverride
  );
}
