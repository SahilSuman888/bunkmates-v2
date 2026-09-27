import { Platform } from "react-native";

// **@** Fixed for Expo Go SDK 53: expo-notifications Android Push support removed from Expo Go.
// Lazy-load to prevent crash in Expo Go; works fully in dev/prod builds.
let Notifications: typeof import("expo-notifications") | null = null;

async function getNotifications() {
  if (Notifications !== null) return Notifications;
  try {
    Notifications = await import("expo-notifications");
  } catch (e) {
    console.warn(
      "[PreviewNotification] expo-notifications not available (Expo Go). Notifications disabled."
    );
  }
  return Notifications;
}

export async function setupPreviewNotifications() {
  if (Platform.OS !== "android") return;

  const N = await getNotifications();
  if (!N) return false;

  await N.setNotificationChannelAsync("bunkmates-notifications", {
    name: "BunkMates Notifications",
    importance: N.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    enableLights: true,
  });

  const permissions = await N.getPermissionsAsync();

  if (permissions.status !== "granted") {
    const requested = await N.requestPermissionsAsync();

    if (requested.status !== "granted") {
      console.log("Notification permission not granted");
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
  const N = await getNotifications();
  if (!N) return;

  await setupPreviewNotifications();

  const notification = getPreviewNotification(type);

  await N.scheduleNotificationAsync({
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
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

function getPreviewNotification(type: string) {
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