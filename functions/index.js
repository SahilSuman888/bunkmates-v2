const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

/**
 * Send push notification using Expo Push Service.
 */
async function sendExpoNotification({
  token,
  title,
  body,
  data,
}) {
  if (!token) {
    console.log("No Expo Push Token.");
    return;
  }

  if (
    !token.startsWith("ExponentPushToken[")
  ) {
    console.log(
      "Invalid Expo Push Token:",
      token
    );

    return;
  }

  const message = {
    to: token,

    sound: "default",

    title,

    body,

    priority: "high",

    channelId:
      "bunkmates-notifications",

    badge: 1,

    data: data || {},
  };

  try {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",

        headers: {
          Accept:
            "application/json",

          "Accept-encoding":
            "gzip, deflate",

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          message
        ),
      }
    );

    const result =
      await response.json();

    console.log(
      "Expo Push Response:",
      JSON.stringify(result)
    );

    return result;
  } catch (error) {
    console.error(
      "Expo Push Error:",
      error
    );
  }
}


/**
 * Trigger whenever a new document is created:
 *
 * notifications/{notificationId}
 */
exports.sendNotificationPush =
  onDocumentCreated(
    "notifications/{notificationId}",
    async (event) => {

      const snapshot =
        event.data;

      if (!snapshot) {
        console.log(
          "No notification document."
        );

        return;
      }

      const notification =
        snapshot.data();

      const notificationId =
        event.params.notificationId;

      console.log(
        "New notification:",
        notificationId
      );

      /**
       * Receiver UID
       */
      const uid =
        notification.uid;

      if (!uid) {
        console.log(
          "Notification has no uid."
        );

        return;
      }

      /**
       * Get receiver's user document.
       *
       * users/{uid}
       */
      const userSnapshot =
        await db
          .collection("users")
          .doc(uid)
          .get();

      if (
        !userSnapshot.exists
      ) {
        console.log(
          "User does not exist:",
          uid
        );

        return;
      }

      const user =
        userSnapshot.data();

      /**
       * Expo Push Token
       */
      const expoPushToken =
        user.expoPushToken;

      if (!expoPushToken) {
        console.log(
          "No Expo Push Token for user:",
          uid
        );

        return;
      }

      /**
       * Notification title
       */
      const title =
        notification.title ||
        getDefaultTitle(
          notification.type
        );

      /**
       * Notification body
       */
      const body =
        notification.content ||
        notification.message ||
        getDefaultBody(
          notification.type
        );

      /**
       * Send push notification
       */
      await sendExpoNotification({
        token:
          expoPushToken,

        title,

        body,

        data: {
          notificationId,

          type:
            notification.type ||
            "general",

          senderId:
            notification.senderId ||
            "",

          uid,
        },
      });

      console.log(
        "Push notification sent successfully:",
        notificationId
      );
    }
  );


/**
 * Default notification titles.
 */
function getDefaultTitle(type) {
  switch (type) {
    case "chat":
      return "New Message";

    case "friend_request":
      return "New Friend Request";

    case "friend_accepted":
      return "Friend Request Accepted";

    case "feedback":
      return "Feedback Update";

    case "like":
      return "New Like";

    default:
      return "BunkMates";
  }
}


/**
 * Default notification messages.
 */
function getDefaultBody(type) {
  switch (type) {
    case "chat":
      return "You have a new message.";

    case "friend_request":
      return "Someone sent you a friend request.";

    case "friend_accepted":
      return "Your friend request was accepted.";

    case "feedback":
      return "You have a new feedback update.";

    case "like":
      return "Someone liked your activity.";

    default:
      return "You have a new notification.";
  }
}