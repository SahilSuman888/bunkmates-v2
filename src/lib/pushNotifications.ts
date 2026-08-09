import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export const NOTIFICATION_CHANNEL_ID = "bunkmates-notifications";

/**
 * Configure how notifications behave while BunkMates
 * is currently open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Create Android notification channel.
 */
export async function configureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    NOTIFICATION_CHANNEL_ID,
    {
      name: "BunkMates Notifications",
      description: "Chat, friend requests, feedback and other alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      sound: "default",
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    }
  );
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
    if (!uid) {
      return null;
    }

    /**
     * Push notifications require a physical device.
     */
    if (!Device.isDevice) {
      console.log(
        "Push notifications require a physical device."
      );
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
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    /**
     * Ask user if permission hasn't been granted.
     */
    if (existingStatus !== "granted") {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log(
        "Notification permission was not granted."
      );

      return null;
    }

    /**
     * Get EAS project ID.
     */
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error(
        "EAS projectId was not found."
      );

      return null;
    }

    /**
     * Get Expo Push Token.
     */
    const token =
      await Notifications.getExpoPushTokenAsync({
        projectId,
      });

    const expoPushToken = token.data;

    if (!expoPushToken) {
      return null;
    }

    /**
     * Save token in Firestore.
     */
    await updateDoc(
      doc(db, "users", uid),
      {
        expoPushToken,
        expoPushTokenUpdatedAt:
          new Date(),
        pushNotificationsEnabled: true,
        pushPlatform: Platform.OS,
      }
    );

    console.log(
      "Expo Push Token:",
      expoPushToken
    );

    return expoPushToken;
  } catch (error) {
    console.error(
      "Push notification registration error:",
      error
    );

    return null;
  }
}

/**
 * Remove/disable push notifications for this device.
 */
export async function disablePushNotifications(
  uid: string
) {
  if (!uid) return;

  try {
    await updateDoc(
      doc(db, "users", uid),
      {
        expoPushToken: null,
        pushNotificationsEnabled: false,
      }
    );
  } catch (error) {
    console.error(
      "Failed to disable push notifications:",
      error
    );
  }
}