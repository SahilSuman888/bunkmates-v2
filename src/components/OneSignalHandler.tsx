import { useEffect } from "react";
import {
  OneSignal,
  LogLevel,
} from "react-native-onesignal";
import { router } from "expo-router";

const ONESIGNAL_APP_ID =
  "263ae218-7fa0-49cf-9503-d7d0fab26d60";

export default function OneSignalHandler() {
  useEffect(() => {
    try {
      // Debug logs while testing
      OneSignal.Debug.setLogLevel(
        LogLevel.Verbose
      );

      // Initialize OneSignal
      OneSignal.initialize(
        ONESIGNAL_APP_ID
      );

      // Ask user for notification permission
      OneSignal.Notifications.requestPermission(
        true
      );

      // Notification clicked
      const clickListener = (
        event: any
      ) => {
        try {
          console.log(
            "OneSignal notification clicked:",
            event
          );

          const data =
            event?.notification
              ?.additionalData || {};

          const type =
            typeof data.type === "string"
              ? data.type
              : "general";

          const notificationId =
            typeof data.notificationId ===
            "string"
              ? data.notificationId
              : "";

          const senderId =
            typeof data.senderId === "string"
              ? data.senderId
              : "";

          // -----------------------------
          // CHAT
          // -----------------------------

          if (
            type === "chat" &&
            senderId
          ) {
            router.push({
              pathname:
                `/chat/${senderId}` as any,

              params: {
                displayName:
                  typeof data.displayName ===
                  "string"
                    ? data.displayName
                    : "Chat",

                photoURL:
                  typeof data.photoURL ===
                  "string"
                    ? data.photoURL
                    : "",
              },
            });

            return;
          }

          // -----------------------------
          // NOTIFICATION PAGE
          // -----------------------------

          if (notificationId) {
            router.push({
              pathname:
                "/notifications" as any,

              params: {
                notificationId,
              },
            });

            return;
          }

          router.push(
            "/notifications" as any
          );
        } catch (error) {
          console.error(
            "OneSignal click error:",
            error
          );
        }
      };

      OneSignal.Notifications.addEventListener(
        "click",
        clickListener
      );

      return () => {
        OneSignal.Notifications.removeEventListener(
          "click",
          clickListener
        );
      };
    } catch (error) {
      console.error(
        "OneSignal initialization error:",
        error
      );
    }
  }, []);

  return null;
}