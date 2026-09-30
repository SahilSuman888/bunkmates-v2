import { useEffect } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  initOneSignal,
  registerNotificationHandler,
  unregisterNotificationHandler,
  PendingNotificationNav,
  getNativeCallAction,
} from "../lib/onesignal";
import { useCall } from "../contexts/CallContext";

/**
 * OneSignalHandler
 * Mounted at root layout to handle OneSignal initialization,
 * foreground push events, native incoming/accept call intents,
 * and deep-link navigation on notification tap.
 */
export default function OneSignalHandler() {
  const router = useRouter();
  const { loadAndShowCall, acceptCallById, startCall } = useCall();

  useEffect(() => {
    initOneSignal();

    // 1. Check Native Android Call Intent (e.g. user tapped "Answer" in notification while app was closed)
    const checkNativeCall = async () => {
      try {
        const nativeCall = await getNativeCallAction();
        if (nativeCall && nativeCall.callId) {
          console.log("[OneSignalHandler] Native call action detected:", nativeCall);
          if (nativeCall.action === "ACCEPT") {
            acceptCallById(nativeCall.callId);
          } else {
            loadAndShowCall(nativeCall.callId);
          }
        }
      } catch (e) {
        console.warn("[OneSignalHandler] Error checking native call action:", e);
      }
    };

    checkNativeCall();

    // 2. Check Linking URL (bunkmates://call?callId=...&action=ACCEPT)
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        if (url.includes("call?") || url.includes("call/")) {
          const parsed = new URL(url.replace("bunkmates://", "https://app.bunkmates.xyz/"));
          const callId = parsed.searchParams.get("callId");
          const action = parsed.searchParams.get("action");
          if (callId) {
            if (action === "ACCEPT") {
              console.log("[OneSignalHandler] Deep link accepting call:", callId);
              acceptCallById(callId);
            } else {
              console.log("[OneSignalHandler] Deep link showing call:", callId);
              loadAndShowCall(callId);
            }
          }
        }
      } catch (e) {
        console.warn("[OneSignalHandler] Error handling deep link URL:", e);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const linkingSub = Linking.addEventListener("url", (event) => handleUrl(event.url));

    // 3. AppState change listener (wakes up when user returns from lock screen or notification)
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkNativeCall();
      }
    });

    // 4. OneSignal notification tap & action buttons listener
    const handleNotification = (nav: PendingNotificationNav) => {
      console.log("[OneSignalHandler] Handling notification click:", nav);
      const { type, data } = nav;

      setTimeout(() => {
        try {
          // 1. Incoming Call (1:1 or Group Call)
          if (type === "call" || type === "group_call") {
            const callId = data?.callId;
            const actionId = nav.actionId;
            if (callId) {
              if (actionId === "ACCEPT_CALL" || actionId === "ACCEPT") {
                console.log("[OneSignalHandler] User accepted call from push action:", callId);
                acceptCallById(callId);
              } else {
                console.log("[OneSignalHandler] Loading call screen directly:", callId);
                loadAndShowCall(callId);
              }
            }
            return;
          }

          // 2. Single 1:1 Chat Message
          if (type === "chat") {
            const senderId = data?.senderId;
            if (senderId) {
              console.log("[OneSignalHandler] Navigating to user chat:", senderId);
              router.push({
                pathname: "/chat/[friendId]",
                params: {
                  friendId: senderId,
                  displayName: data?.displayName || "Chat",
                  photoURL: data?.photoURL || "",
                },
              });
            }
            return;
          }

          // 3. Group Chat Message
          if (type === "group_chat") {
            const groupId = data?.groupId;
            if (groupId) {
              console.log("[OneSignalHandler] Navigating to group chat:", groupId);
              router.push(`/(tabs)/group-chatroom/${groupId}` as any);
            }
            return;
          }

          // 4. Missed Call Card ("Call back" & "Message")
          if (type === "missed_call") {
            const callerId = data?.callerId;
            const callerName = data?.callerName || "BunkMate";
            const callerAvatar = data?.callerAvatar || "";
            const callType = data?.callType || "audio";
            const actionId = nav.actionId;

            if (actionId === "CALL_BACK" && callerId) {
              startCall({
                receiverId: callerId,
                receiverName: callerName,
                receiverAvatar: callerAvatar,
                callType,
              });
              return;
            }

            if ((actionId === "MESSAGE" || !actionId) && callerId) {
              router.push({
                pathname: "/chat/[friendId]",
                params: {
                  friendId: callerId,
                  displayName: callerName,
                  photoURL: callerAvatar,
                },
              });
              return;
            }

            router.push("/notifications" as any);
            return;
          }

          // 5. Friend Requests & General Notifications
          const notificationId = data?.notificationId;
          router.push({
            pathname: "/notifications" as any,
            ...(notificationId ? { params: { notificationId } } : {}),
          });
        } catch (e) {
          console.warn("[OneSignalHandler] Notification navigation error:", e);
        }
      }, 350);
    };

    registerNotificationHandler(handleNotification);

    return () => {
      unregisterNotificationHandler();
      linkingSub.remove();
      appStateSub.remove();
    };
  }, [router, loadAndShowCall, acceptCallById, startCall]);

  return null;
}