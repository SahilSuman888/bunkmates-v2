import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import safeNotifications, { isExpoGo } from "../lib/safeNotifications";

export default function NotificationsHandler() {
  useEffect(() => {
    // In Expo Go on Android (SDK 53+), expo-notifications native modules (ExpoTopicSubscriptionModule)
    // are absent. Guard here so the module is never loaded or registered.
    if (isExpoGo) {
      return;
    }

    let responseSubscription: { remove: () => void } | null = null;

    try {
      // Set foreground presentation options
      safeNotifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      // Configure default Android notification channel
      if (Platform.OS === "android") {
        safeNotifications.setNotificationChannelAsync("default", {
          name: "BunkMates Notifications",
          importance: safeNotifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF5A5F",
        });
      }

      // Listen for notification taps
      responseSubscription = safeNotifications.addNotificationResponseReceivedListener(
        (response: any) => {
          try {
            const data = response?.notification?.request?.content?.data;
            if (data?.route) {
              router.push(data.route as any);
            }
          } catch (err) {
            console.warn("NotificationsHandler routing error:", err);
          }
        }
      );
    } catch (e) {
      // Safe fallback if native notification layer is unavailable
    }

    return () => {
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, []);

  return null;
}