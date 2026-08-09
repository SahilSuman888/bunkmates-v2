import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function setupPreviewNotifications() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    "bunkmates-notifications",
    {
      name: "BunkMates Notifications",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
    }
  );

  const permissions =
    await Notifications.getPermissionsAsync();

  if (permissions.status !== "granted") {
    const requested =
      await Notifications.requestPermissionsAsync();

    if (requested.status !== "granted") {
      console.log(
        "Notification permission not granted"
      );

      return false;
    }
  }

  return true;
}

export async function sendPreviewNotification(
  type:
    | "chat"
    | "friend_request"
    | "feedback"
    | "like"
    | "general" = "general"
) {
  await setupPreviewNotifications();

  const notification = getPreviewNotification(type);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      sound: "default",
      data: {
        type,
        preview: true,
      },
    },

    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

function getPreviewNotification(
  type: string
) {
  switch (type) {
    case "chat":
      return {
        title: "New Message",
        body: "You have received a new message on BunkMates.",
      };

    case "friend_request":
      return {
        title: "New Friend Request",
        body: "Someone sent you a friend request.",
      };

    case "feedback":
      return {
        title: "Feedback Submitted",
        body: "Your feedback has been submitted successfully.",
      };

    case "like":
      return {
        title: "New Like",
        body: "Someone liked your activity.",
      };

    default:
      return {
        title: "BunkMates",
        body: "You have a new notification.",
      };
  }
}