import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";

export default function NotificationsHandler() {
  useEffect(() => {
    let responseSubscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import("expo-notifications");

        // Set foreground presentation options
        Notifications.setNotificationHandler({
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
          await Notifications.setNotificationChannelAsync("default", {
            name: "BunkMates Notifications",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF5A5F",
          });
        }

        // Listen for notification taps
        responseSubscription = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            try {
              const data = response.notification.request.content.data;
              if (data?.route) {
                router.push(data.route as any);
              }
            } catch (err) {
              console.warn("NotificationsHandler routing error:", err);
            }
          }
        );
      } catch (e) {
        // Safe fallback if expo-notifications native layer is unavailable
      }
    })();

    return () => {
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, []);

  return null;
}