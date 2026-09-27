import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const NOTIFICATION_CHANNEL_ID = "bunkmates-notifications";

// expo-notifications Android Push support was removed in Expo Go SDK 53+.
// Lazy-load to prevent crash in Expo Go; works fully in dev/prod builds.
let Notifications: typeof import("expo-notifications") | null = null;
let handlerConfigured = false;

async function getNotifications() {
  if (Notifications !== null) return Notifications;
  try {
    Notifications = await import("expo-notifications");

    // Configure notification handler once on first load
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }
  } catch (e) {
    console.warn(
      "[PushNotifications] expo-notifications not available (Expo Go). Notifications disabled."
    );
  }
  return Notifications;
}

/**
 * Create Android notification channel.
 */
export async function configureNotificationChannel() {
  if (Platform.OS !== "android") return;

  const N = await getNotifications();
  if (!N) return;

  await N.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "BunkMates Notifications",
    description: "Chat, friend requests, feedback and other alerts",
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: "default",
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Register the current device for push notifications.
 *
 * The returned Expo Push Token is saved to:
 *
 * users/{uid}
 *
 * field:
 * expoPushToken
 */
export async function registerForPushNotifications(
  uid: string
): Promise<string | null> {
  try {
    if (!uid) return null;

    /**
     * Push notifications require a physical device.
     */
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device.");
      return null;
    }

    const N = await getNotifications();
    if (!N) {
      console.log("[PushNotifications] Not available in this environment (Expo Go).");
      return null;
    }

    /**
     * Android channel must be created BEFORE requesting
     * notification permissions / obtaining token.
     */
    await configureNotificationChannel();

    /**
     * Check existing permissions.
     */
    const { status: existingStatus } = await N.getPermissionsAsync();

    let finalStatus = existingStatus;

    /**
     * Ask user if permission hasn't been granted.
     */
    if (existingStatus !== "granted") {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permission was not granted.");
      return null;
    }

    /**
     * Get EAS project ID.
     */
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error("EAS projectId was not found.");
      return null;
    }

    /**
     * Get Expo Push Token.
     */
    const token = await N.getExpoPushTokenAsync({ projectId });
    const expoPushToken = token.data;

    if (!expoPushToken) return null;

    /**
     * Save token in Firestore.
     */
    await updateDoc(doc(db, "users", uid), {
      expoPushToken,
      expoPushTokenUpdatedAt: new Date(),
      pushNotificationsEnabled: true,
      pushPlatform: Platform.OS,
    });

    console.log("Expo Push Token:", expoPushToken);
    return expoPushToken;
  } catch (error) {
    console.error("Push notification registration error:", error);
    return null;
  }
}

/**
 * Remove/disable push notifications for this device.
 */
export async function disablePushNotifications(uid: string) {
  if (!uid) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      expoPushToken: null,
      pushNotificationsEnabled: false,
    });
  } catch (error) {
    console.error("Failed to disable push notifications:", error);
  }
}