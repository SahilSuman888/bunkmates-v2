import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";

export default function NotificationsHandler() {
  useEffect(() => {
    // Push notifications are intentionally disabled for now.
    // OneSignal / remote push will be enabled later
    // in a development/production build.

    if (Platform.OS !== "android") {
      return;
    }

    console.log(
      "Push notifications disabled temporarily."
    );

    return () => {};
  }, []);

  return null;
}