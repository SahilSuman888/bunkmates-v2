import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import safeNotifications, { isExpoGo } from "../lib/safeNotifications";
import { triggerInAppNotificationBanner } from "../lib/NotificationService";

export default function NotificationsHandler() {
  const processedDocIdsRef = useRef<Set<string>>(new Set());

  // 1. Native Expo Notification listener (standalone build only)
  useEffect(() => {
    if (isExpoGo) {
      return;
    }

    let responseSubscription: { remove: () => void } | null = null;

    try {
      safeNotifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      if (Platform.OS === "android") {
        safeNotifications.setNotificationChannelAsync("default", {
          name: "BunkMates Notifications",
          importance: safeNotifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF5A5F",
        });
      }

      responseSubscription = safeNotifications.addNotificationResponseReceivedListener(
        (response: any) => {
          try {
            const data = response?.notification?.request?.content?.data;
            if (data?.route) {
              router.push(data.route as any);
            }
          } catch (err) {
            console.warn("NotificationsHandler routing error:", err);
          }
        }
      );
    } catch (e) {
      // Safe fallback if native notification layer is unavailable
    }

    return () => {
      if (responseSubscription) {
        responseSubscription.remove();
      }
    };
  }, []);

  // 2. Real-time In-App Notification Banner listener for all incoming Firestore notifications
  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    const sessionStartTime = Date.now() - 5000;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user) return;

      const q = query(
        collection(db, "notifications"),
        where("uid", "==", user.uid),
        where("seen", "==", false)
      );

      unsubSnapshot = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const docId = change.doc.id;
              if (processedDocIdsRef.current.has(docId)) return;
              processedDocIdsRef.current.add(docId);

              const data: any = change.doc.data();
              const docTime = data.timestamp?.toMillis
                ? data.timestamp.toMillis()
                : data.timestamp
                ? new Date(data.timestamp).getTime()
                : Date.now();

              // Only show banner for new notifications arriving during this app session
              if (docTime >= sessionStartTime) {
                // Determine destination route
                let route = data.route;
                if (!route) {
                  if (data.type === "chat" && data.senderId) {
                    route = `/chat/${data.senderId}`;
                  } else if (data.type === "group_chat" && data.groupId) {
                    route = `/(tabs)/group-chatroom/${data.groupId}`;
                  } else {
                    route = "/notifications";
                  }
                }

                triggerInAppNotificationBanner({
                  recipientUid: user.uid,
                  category: data.type || "general",
                  title: data.title || "New Notification",
                  message: data.content || data.message || "",
                  senderName: data.senderName,
                  senderPic: data.pic,
                  route,
                  data: { ...data, id: docId },
                });
              }
            }
          });
        },
        (err) => {
          console.warn("[NotificationsHandler] Realtime listener error:", err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  return null;
}