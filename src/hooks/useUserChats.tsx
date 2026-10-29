import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Pressable,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../lib/firebase"; 
import { useUser } from "../contexts/UserContext"; 

// ==========================================
// 1. LOGIC (HOOK)
// ==========================================
export interface ChatUser {
  id: string;
  uid?: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  online?: boolean;
}

export const getTimestampMs = (t: any): number => {
  if (!t) return 0;
  if (typeof t === "number") return t < 10000000000 ? t * 1000 : t;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t?.toDate === "function") return t.toDate().getTime();
  if (typeof t?.seconds === "number") return t.seconds * 1000;
  if (typeof t === "string") {
    const parsed = new Date(t).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (t instanceof Date) return t.getTime();
  return 0;
};

// Module-level caches for 0ms initial render (WhatsApp style instant loading)
const memoryCachedChats: Record<string, ChatUser[]> = {};
const userProfileCache: Record<string, { name: string; avatar: string; online: boolean }> = {};

export const useUserChats = (userId: string | null) => {
  const [chats, setChats] = useState<ChatUser[]>(
    () => (userId && memoryCachedChats[userId]) || []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !(userId && memoryCachedChats[userId]?.length)
  );

  const activeMsgUnsubs = useRef<Record<string, () => void>>({});
  const latestMetaRef = useRef<
    Record<string, { lastMessage: string; lastTimestamp: number; unreadCount: number }>
  >({});

  useEffect(() => {
    if (!userId) {
      setChats([]);
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate cached chats for instant offline display (like WhatsApp)
    AsyncStorage.getItem(`@bunkmates_cached_chats_${userId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCachedChats[userId] = parsed;
            parsed.forEach((c) => {
              if (c && c.uid) {
                latestMetaRef.current[c.uid] = {
                  lastMessage: c.lastMessage || "",
                  lastTimestamp: getTimestampMs(c.lastTimestamp),
                  unreadCount: c.unreadCount || 0,
                };
              }
            });
            setChats(parsed);
            setLoading(false);
          }
        } catch (e) {}
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const attachMessageListener = (chatId: string, otherUserId: string) => {
      if (!chatId || activeMsgUnsubs.current[chatId]) return;

      try {
        const qMsg = query(
          collection(db, "chats", chatId, "messages"),
          orderBy("timestamp", "desc"),
          limit(1)
        );

        const unsub = onSnapshot(
          qMsg,
          (snap) => {
            if (!snap.empty) {
              const mData: any = snap.docs[0].data();
              const isExpired =
                mData.expiresAt &&
                typeof mData.expiresAt === "number" &&
                mData.expiresAt < Date.now();
              const txt = isExpired
                ? ""
                : mData.text ||
                  (mData.imageUrl || mData.dataUri ? "📷 Photo" : "Attachment");
              const ts = getTimestampMs(mData.timestamp || mData.createdAt || Date.now());
              const isUnread = !isExpired && mData.senderId !== userId && !mData.isRead;

              const currentTs = latestMetaRef.current[otherUserId]?.lastTimestamp || 0;
              if (ts >= currentTs || !latestMetaRef.current[otherUserId]) {
                latestMetaRef.current[otherUserId] = {
                  lastMessage: txt,
                  lastTimestamp: ts,
                  unreadCount: isUnread ? 1 : 0,
                };

                setChats((prev) => {
                  const idx = prev.findIndex((p) => p.uid === otherUserId || p.id === chatId);
                  if (idx === -1) return prev;
                  const updated = [...prev];
                  updated[idx] = {
                    ...updated[idx],
                    lastMessage: txt,
                    lastTimestamp: ts,
                    unreadCount: isUnread ? 1 : 0,
                  };
                  updated.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
                  memoryCachedChats[userId] = updated;
                  AsyncStorage.setItem(
                    `@bunkmates_cached_chats_${userId}`,
                    JSON.stringify(updated)
                  ).catch(() => {});
                  return updated;
                });
              }
            }
          },
          () => {}
        );

        activeMsgUnsubs.current[chatId] = unsub;
      } catch (e) {}
    };

    // 2. Real-time Firestore listener (auto-refreshes when net connects)
    const unsubscribe = onSnapshot(
      collection(db, "chats"),
      async (snapshot) => {
        try {
          const userChatMap = new Map<string, ChatUser>();
          const uidsToFetch = new Set<string>();

          for (const chatDoc of snapshot.docs) {
            if (!chatDoc.id.includes(userId)) continue;

            const data: any = chatDoc.data();
            const ids = chatDoc.id.split("_");
            const otherUserId = ids.find((id) => id !== userId);

            if (!otherUserId) continue;

            // Attach active message subcollection listener so incoming messages immediately bubble to the top
            attachMessageListener(chatDoc.id, otherUserId);

            const docTs = getTimestampMs(data.lastTimestamp || data.date || data.timestamp || 0);
            const meta = latestMetaRef.current[otherUserId];
            const timestamp = meta && meta.lastTimestamp > docTs ? meta.lastTimestamp : docTs;
            const lastMessage =
              meta?.lastMessage ||
              data.lastMessage?.text ||
              data.lastMessage ||
              "No messages yet";
            const unreadCount =
              typeof meta?.unreadCount === "number"
                ? meta.unreadCount
                : data.unreadCounts?.[userId] || 0;

            // If we already saw this otherUserId, only overwrite if current doc is more recent
            const existing = userChatMap.get(otherUserId);
            if (existing && existing.lastTimestamp >= timestamp) {
              continue;
            }

            // Check cached profile first
            const cachedProfile = userProfileCache[otherUserId];
            let name = cachedProfile?.name || existing?.name || "Unknown User";
            let avatar = cachedProfile?.avatar || existing?.avatar || `https://i.pravatar.cc/150?u=${otherUserId}`;
            let online = cachedProfile?.online || existing?.online || false;

            if (!cachedProfile) {
              uidsToFetch.add(otherUserId);
            }

            userChatMap.set(otherUserId, {
              id: chatDoc.id,
              uid: otherUserId,
              name,
              avatar,
              lastMessage,
              lastTimestamp: timestamp,
              unreadCount,
              online,
            });
          }

          // Initial immediate render with available data sorted by recency
          const results = Array.from(userChatMap.values());
          results.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
          memoryCachedChats[userId] = results;
          setChats(results);
          setLoading(false);

          AsyncStorage.setItem(
            `@bunkmates_cached_chats_${userId}`,
            JSON.stringify(results)
          ).catch(() => {});

          // Fetch any missing user profiles in parallel with a fast timeout
          if (uidsToFetch.size > 0) {
            const fetchPromises = Array.from(uidsToFetch).map(async (ouid) => {
              try {
                const userSnap = await getDoc(doc(db, "users", ouid));
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const p = {
                    name: userData.displayName || userData.name || userData.username || "Unknown User",
                    avatar: userData.photoURL || userData.avatar || `https://i.pravatar.cc/150?u=${ouid}`,
                    online: userData.online || userData.isOnline || false,
                  };
                  userProfileCache[ouid] = p;

                  const c = userChatMap.get(ouid);
                  if (c) {
                    c.name = p.name;
                    c.avatar = p.avatar;
                    c.online = p.online;
                  }
                } else {
                  userChatMap.delete(ouid);
                }
              } catch (e) {}
            });

            await Promise.race([
              Promise.all(fetchPromises),
              new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);

            const updatedResults = Array.from(userChatMap.values());
            updatedResults.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
            memoryCachedChats[userId] = updatedResults;
            setChats(updatedResults);
            AsyncStorage.setItem(
              `@bunkmates_cached_chats_${userId}`,
              JSON.stringify(updatedResults)
            ).catch(() => {});
          }
        } catch (err) {
          console.log("Realtime chat sync fallback:", err);
          setLoading(false);
        }
      },
      (err) => {
        console.log("Chats collection offline:", err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      Object.values(activeMsgUnsubs.current).forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
      activeMsgUnsubs.current = {};
    };
  }, [userId]);

  return { chats, loading };
};

