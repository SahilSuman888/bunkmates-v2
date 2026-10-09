const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  defineSecret,
} = require("firebase-functions/params");

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const oneSignalApiKey = defineSecret("ONESIGNAL_REST_API_KEY");
const groqApiKey = defineSecret("GROQ_API_KEY");

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

exports.generateGroqChatCompletion = onCall(
  { secrets: [groqApiKey], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use trip suggestions.");
    }

    const { model, prompt } = request.data || {};
    if (
      typeof prompt !== "string" ||
      prompt.trim().length === 0 ||
      prompt.length > 15000 ||
      typeof model !== "string" ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(model)
    ) {
      throw new HttpsError("invalid-argument", "A valid model and prompt are required.");
    }

    const userSnapshot = await db.collection("users").doc(request.auth.uid).get();
    const userKey = userSnapshot.exists ? userSnapshot.data().groqApiKey : "";
    const apiKey =
      typeof userKey === "string" && userKey.trim()
        ? userKey.trim()
        : groqApiKey.value();

    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Configure a Groq API key in AI settings to use trip suggestions."
      );
    }

    let response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch (error) {
      console.error("Groq request failed:", error);
      throw new HttpsError("unavailable", "Unable to reach the AI service.");
    }

    const result = await response.json().catch(() => null);
    const content = result?.choices?.[0]?.message?.content;
    if (!response.ok || typeof content !== "string" || !content) {
      console.error("Groq returned an unsuccessful response:", response.status);
      throw new HttpsError("unavailable", "The AI service could not generate a response.");
    }

    return { content };
  }
);

function requireString(value, field, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new HttpsError("invalid-argument", `Invalid ${field}.`);
  }
  return value;
}

async function authorizeOneSignalTargets(uid, targetIds, data) {
  if (data.senderId && data.senderId !== uid) {
    throw new HttpsError("permission-denied", "Notification sender does not match caller.");
  }

  if (data.type === "chat") {
    const chatId = requireString(data.chatId, "chat ID", 200);
    const snapshot = await db.collection("chats").doc(chatId).get();
    const participants = snapshot.exists ? snapshot.data().participants : [];
    if (
      !Array.isArray(participants) ||
      !participants.includes(uid) ||
      !targetIds.every((targetId) => participants.includes(targetId))
    ) {
      throw new HttpsError("permission-denied", "Caller is not a participant in this chat.");
    }
    return;
  }

  if (data.type === "group_chat") {
    const groupId = requireString(data.groupId, "group ID", 200);
    const snapshot = await db.collection("groupChats").doc(groupId).get();
    const members = snapshot.exists ? snapshot.data().members : [];
    if (
      !Array.isArray(members) ||
      !members.includes(uid) ||
      !targetIds.every((targetId) => members.includes(targetId))
    ) {
      throw new HttpsError("permission-denied", "Caller is not a member of this group.");
    }
    return;
  }

  if (
    data.type === "call" ||
    data.type === "group_call" ||
    data.type === "incoming_call" ||
    data.type === "missed_call"
  ) {
    const callId = requireString(data.callId, "call ID", 200);
    const snapshot = await db.collection("calls").doc(callId).get();
    const call = snapshot.exists ? snapshot.data() : null;
    const callMembers = call
      ? [...new Set([call.receiverId, ...(Array.isArray(call.memberIds) ? call.memberIds : [])])]
      : [];
    if (
      !call ||
      call.callerId !== uid ||
      !targetIds.every((targetId) => callMembers.includes(targetId))
    ) {
      throw new HttpsError("permission-denied", "Caller cannot notify these call participants.");
    }
    return;
  }

  throw new HttpsError("invalid-argument", "Unsupported notification type.");
}

exports.sendOneSignalNotification = onCall(
  { secrets: [oneSignalApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to send notifications.");
    }

    const notification = request.data || {};
    const targetIds = notification.externalUserIds;
    const data = notification.data;
    if (
      !Array.isArray(targetIds) ||
      targetIds.length === 0 ||
      targetIds.length > 50 ||
      targetIds.some((id) => typeof id !== "string" || !id)
    ) {
      throw new HttpsError("invalid-argument", "One to 50 valid notification targets are required.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new HttpsError("invalid-argument", "Notification metadata is required.");
    }

    await authorizeOneSignalTargets(request.auth.uid, targetIds, data);

    const headings = notification.headings;
    const contents = notification.contents;
    if (
      !headings ||
      typeof headings.en !== "string" ||
      headings.en.length > 100 ||
      !contents ||
      typeof contents.en !== "string" ||
      contents.en.length > 300
    ) {
      throw new HttpsError("invalid-argument", "Valid English notification text is required.");
    }

    const isCallType = ["call", "group_call", "incoming_call"].includes(data.type);
    const payload = {
      app_id: "263ae218-7fa0-49cf-9503-d7d0fab26d60",
      include_aliases: { external_id: targetIds },
      target_channel: "push",
      headings,
      contents,
      data,
      priority: Math.max(1, Math.min(Number(notification.priority) || 10, 10)),
      android_sound:
        notification.androidSound && notification.androidSound !== "default"
          ? notification.androidSound
          : isCallType
          ? "call_ringtone"
          : "default",
      android_visibility: 1,
      ios_sound: isCallType ? "call_ringtone.wav" : "default",
      existing_android_channel_id:
        notification.androidChannelId || "bunkmates_default_channel_v1",
    };

    if (notification.largeIcon) payload.large_icon = notification.largeIcon;
    if (notification.androidAccentColor) {
      payload.android_accent_color = notification.androidAccentColor;
    }
    if (typeof notification.ttl === "number") {
      payload.ttl = Math.max(1, Math.min(notification.ttl, 2419200));
    }
    if (notification.contentAvailable) {
      payload.content_available = true;
      payload.apns_push_type_background = "voip";
    }
    if (Array.isArray(notification.buttons)) {
      payload.buttons = notification.buttons
        .filter(
          (button) =>
            button &&
            typeof button.id === "string" &&
            typeof button.text === "string"
        )
        .slice(0, 3)
        .map(({ id, text, icon }) => ({ id, text, ...(icon ? { icon } : {}) }));
    }

    let response;
    try {
      response = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${oneSignalApiKey.value()}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error("OneSignal request failed:", error);
      throw new HttpsError("unavailable", "Unable to reach the notification service.");
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.errors) {
      console.error("OneSignal returned an unsuccessful response:", response.status);
      throw new HttpsError("unavailable", "The notification service rejected the request.");
    }

    return { id: result?.id || null };
  }
);