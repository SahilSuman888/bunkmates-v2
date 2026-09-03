import { useEffect } from "react";
import { useRouter } from "expo-router";
import {
  initOneSignal,
  registerNotificationHandler,
  unregisterNotificationHandler,
  PendingNotificationNav,
} from "../lib/onesignal";
import { useCall } from "../contexts/CallContext";

/**
 * OneSignalHandler
 * Mounted at root layout to handle OneSignal initialization,
 * foreground push events, and deep-link navigation on notification tap.
 */
export default function OneSignalHandler() {
  const router = useRouter();
  const { loadAndShowCall, startCall } = useCall();

  useEffect(() => {
    initOneSignal();

    const handleNotification = (nav: PendingNotificationNav) => {
      console.log("[OneSignalHandler] Handling notification click:", nav);
      const { type, data } = nav;

      // Ensure router is fully mounted and ready before dispatching transition
      setTimeout(() => {
        try {
          // 1. Incoming Call (1:1 or Group Call)
          if (type === "call" || type === "group_call") {
            const callId = data?.callId;
            if (callId) {
              console.log("[OneSignalHandler] Loading call screen directly:", callId);
              loadAndShowCall(callId);
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

          // 4. Missed Call Card (Screenshot 2: "Call back" & "Message")
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
    };
  }, [router, loadAndShowCall]);

  return null;
}