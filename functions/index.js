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
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const pexelsApiKey = defineSecret("PEXELS_API_KEY");


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

      // Skip duplicate Expo push for notifications already sent via OneSignal
      if (
        notification.skipExpoPush ||
        notification.viaOneSignal ||
        notification.pushSent ||
        notification.type === "chat" ||
        notification.type === "group_chat" ||
        notification.type === "call" ||
        notification.type === "group_call" ||
        notification.type === "missed_call"
      ) {
        console.log(
          "Notification handled via OneSignal, skipping duplicate Expo push:",
          event.params.notificationId
        );
        return;
      }

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

/**
 * Curated high-resolution fallback photos categorized by travel type
 */
function getFallbackTravelPhoto(category = "", query = "") {
  const lower = `${category} ${query}`.toLowerCase();
  if (
    lower.includes("food") ||
    lower.includes("cafe") ||
    lower.includes("restaurant") ||
    lower.includes("eat") ||
    lower.includes("dish")
  ) {
    return "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80";
  }
  if (
    lower.includes("fort") ||
    lower.includes("palace") ||
    lower.includes("heritage") ||
    lower.includes("monument")
  ) {
    return "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80";
  }
  if (
    lower.includes("lake") ||
    lower.includes("water") ||
    lower.includes("river") ||
    lower.includes("beach")
  ) {
    return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";
  }
  if (
    lower.includes("temple") ||
    lower.includes("religious") ||
    lower.includes("spiritual")
  ) {
    return "https://images.unsplash.com/photo-1609137144820-25e24b8109d9?auto=format&fit=crop&w=1200&q=80";
  }
  if (
    lower.includes("mountain") ||
    lower.includes("hill") ||
    lower.includes("trek") ||
    lower.includes("snow")
  ) {
    return "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80";
  }
  return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80";
}

/**
 * Fetch high-resolution image automatically (Wikimedia Commons -> Pexels -> Curated Fallback)
 * Zero API key needed for Wikimedia!
 */
async function fetchHighResTravelPhoto(name, photoQuery, category, pexelsKey) {
  // 1. Try Wikimedia Commons / Wikipedia API (100% Free, Zero API Key needed, authentic HD photos)
  const searchTerms = [name, photoQuery].filter(Boolean);
  for (const term of searchTerms) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        term
      )}&gsrlimit=1&prop=pageimages&pithumbsize=1000&format=json`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { "User-Agent": "BunkMatesApp/2.0 (travel@bunkmates.app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = wikiData.query?.pages;
        if (pages) {
          const firstPage = Object.values(pages)[0];
          if (firstPage?.thumbnail?.source) {
            return {
              imageUrl: firstPage.thumbnail.source,
              imageThumbnail: firstPage.thumbnail.source,
              photographer: "Wikimedia Commons",
              photographerUrl: null,
              imageSource: "wikimedia",
            };
          }
        }
      }
    } catch (wikiErr) {
      // Continue to next provider
    }
  }

  // 2. Try Pexels if key is available
  if (pexelsKey && photoQuery) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        photoQuery
      )}&per_page=1&orientation=landscape`;
      const res = await fetch(url, {
        headers: { Authorization: pexelsKey },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          const photo = data.photos[0];
          return {
            imageUrl:
              photo.src?.large2x ||
              photo.src?.large ||
              photo.src?.original ||
              photo.src?.medium,
            imageThumbnail: photo.src?.medium || photo.src?.small,
            photographer: photo.photographer || null,
            photographerUrl: photo.photographer_url || null,
            imageSource: "pexels",
          };
        }
      }
    } catch (err) {
      console.warn("Pexels fetch warning:", err.message);
    }
  }

  // 3. Curated High-Res Travel Fallback
  return {
    imageUrl: getFallbackTravelPhoto(category, photoQuery || name),
    imageThumbnail: getFallbackTravelPhoto(category, photoQuery || name),
    photographer: null,
    photographerUrl: null,
    imageSource: "curated",
  };
}

/**
 * Headless Google Travel Discovery Engine (Gemini 2.0 / 1.5 Flash + Pexels API + Firestore Cache)
 */
exports.searchTravelDiscovery = onCall(
  { secrets: [geminiApiKey, pexelsApiKey] },
  async (request) => {
    const data = request.data || {};
    const rawQuery = typeof data.query === "string" ? data.query.trim() : "";
    const category =
      typeof data.category === "string" ? data.category.trim() : "all";
    const requestedLimit = Math.max(1, Math.min(Number(data.limit) || 6, 12));

    if (!rawQuery || rawQuery.length < 2) {
      throw new HttpsError(
        "invalid-argument",
        "Search query must be at least 2 characters."
      );
    }

    // 1. Check Firestore Cache
    const normalizedKey = rawQuery
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 100);

    const cacheDocRef = db.collection("travel_search_cache").doc(normalizedKey);
    try {
      const cacheSnap = await cacheDocRef.get();
      if (cacheSnap.exists) {
        const cached = cacheSnap.data();
        const now = Date.now();
        if (
          cached.expiresAt &&
          cached.expiresAt > now &&
          Array.isArray(cached.results) &&
          cached.results.length > 0
        ) {
          return {
            results: cached.results,
            cached: true,
            source: "cache",
            query: rawQuery,
          };
        }
      }
    } catch (cacheErr) {
      console.warn("Cache read warning:", cacheErr.message);
    }

    // 2. Resolve API Keys
    const resolvedGeminiKey =
      (typeof geminiApiKey?.value === "function" ? geminiApiKey.value() : null) ||
      process.env.GEMINI_API_KEY ||
      process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    const resolvedPexelsKey =
      (typeof pexelsApiKey?.value === "function" ? pexelsApiKey.value() : null) ||
      process.env.PEXELS_API_KEY ||
      process.env.EXPO_PUBLIC_PEXELS_API_KEY;

    if (!resolvedGeminiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Gemini API key is not configured in backend secrets or environment."
      );
    }

    // 3. AI Structuring with Google Gemini
    const systemPrompt = `You are BunkMates Travel Engine, a high-precision travel, tourism, and food intelligence engine.
CRITICAL LOCATION RULE:
1. Identify the specific city, district, or region in the user query (e.g. if the user searches for "Chittorgarh" or "places in Chittorgarh to visit", the target location is strictly Chittorgarh, Rajasthan).
2. ALL ${requestedLimit} returned items MUST be real, famous attractions, heritage sites, lakes, viewpoints, or famous local foods located SPECIFICALLY in that targeted city!
   For example, if Chittorgarh is queried: return Chittorgarh Fort, Vijay Stambha, Kirti Stambh, Padmini's Palace, Gaumukh Reservoir, Rana Kumbha Palace.
3. NEVER return places from completely different cities or states (DO NOT return Agra, Leh Ladakh, Varanasi, Delhi, Darjeeling unless the user specifically searched for those cities).
4. If the query asks for street food or cafes, return famous dishes or cafes of that specific place.

Return STRICTLY a JSON array of ${requestedLimit} items with this exact schema:
[
  {
    "id": "slug-name",
    "name": "Exact Name of Place / Food / Cafe",
    "category": "Sightseeing" | "Street Food" | "Cafe" | "Heritage" | "Experience" | "Nature",
    "city": "Target City name",
    "state": "State name",
    "rating": 4.7,
    "reviewCount": 1420,
    "timing": "e.g. 9:00 AM - 6:00 PM or Open 24 Hours",
    "entryFee": "e.g. ₹40 per person or Free Entry",
    "approxCost": "e.g. ₹150 for two",
    "highlight": "One punchy, exciting sentence describing the highlight (under 20 words)",
    "bestTimeToVisit": "e.g. Morning / Sunset / October to March",
    "address": "Locality or landmark address",
    "imageSearchQuery": "Exact visual keyword for travel photography (e.g. Chittorgarh Fort Rajasthan)",
    "tags": ["Tag1", "Tag2", "Tag3"]
  }
]
Output strictly raw JSON without markdown code fences.`;

    let parsedItems = [];
    const modelsToTry = [
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3-flash-preview",
      "gemini-flash-latest",
      "gemini-3.8-flash",
    ];
    let lastAiError = null;


    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedGeminiKey}`;
        const aiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n\nSearch Query: "${rawQuery}" (Category filter: ${category})`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          throw new Error(`Gemini ${model} failed (${aiResponse.status}): ${errText}`);
        }

        const aiJson = await aiResponse.json();
        const rawContent =
          aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const cleaned = rawContent
          .replace(/^```json/im, "")
          .replace(/^```/im, "")
          .replace(/```$/im, "")
          .trim();

        parsedItems = JSON.parse(cleaned);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          break;
        }
      } catch (err) {
        lastAiError = err;
        console.warn(`Model ${model} attempt failed:`, err.message);
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      console.error("AI Generation failed:", lastAiError);
      throw new HttpsError(
        "internal",
        "Could not generate structured recommendations."
      );
    }

    // 4. Enrich with High-Quality Photos from Pexels API in Parallel
    const enrichedResults = await Promise.all(
      parsedItems.map(async (item, idx) => {
        const photoData = await fetchHighResTravelPhoto(
          item.name,
          item.imageSearchQuery || `${item.name} ${item.city || ""}`,
          item.category,
          resolvedPexelsKey
        );

        return {
          id: item.id || `item_${idx}_${Date.now()}`,
          name: item.name || "Unknown Place",
          category: item.category || "Sightseeing",
          city: item.city || "",
          state: item.state || "",
          rating: typeof item.rating === "number" ? item.rating : 4.6,
          reviewCount:
            typeof item.reviewCount === "number" ? item.reviewCount : 850,
          timing: item.timing || "Open daily",
          entryFee: item.entryFee || "Free Entry",
          approxCost: item.approxCost || "Varies",
          highlight:
            item.highlight || "Popular attraction in BunkMates discovery",
          bestTimeToVisit: item.bestTimeToVisit || "Year round",
          address: item.address || "",
          imageUrl: photoData.imageUrl,
          imageThumbnail: photoData.imageThumbnail,
          imageSource: photoData.imageSource,
          photographer: photoData.photographer,
          tags: Array.isArray(item.tags)
            ? item.tags
            : ["Travel", "Must Visit"],
        };
      })
    );

    // 5. Save in Firestore Cache (30 days TTL)
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    try {
      await cacheDocRef.set({
        query: rawQuery,
        category,
        results: enrichedResults,
        createdAt: Date.now(),
        expiresAt,
      });
    } catch (saveErr) {
      console.warn("Failed to write to cache:", saveErr.message);
    }

    return {
      results: enrichedResults,
      cached: false,
      source: "live_ai_pexels",
      query: rawQuery,
    };
  }
);