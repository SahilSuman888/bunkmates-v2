import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../lib/firebase";

// In-memory cache for instant 0ms render when opening group chat
const memoryGroupMsgs: Record<string, any[]> = {};

export const useGroupChat = (groupId: string | null) => {
  const [messages, setMessages] = useState<any[]>(
    () => (groupId && memoryGroupMsgs[groupId]) || []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !(groupId && memoryGroupMsgs[groupId]?.length)
  );

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate cached group messages for offline viewing
    AsyncStorage.getItem(`@bunkmates_cached_group_msgs_${groupId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryGroupMsgs[groupId] = parsed;
            setMessages((prev) => (prev.length > 0 ? prev : parsed));
            setLoading(false);
          }
        } catch (e) {}
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    try {
      let webMsgs: any[] = [];
      let nativeMsgs: any[] = [];

      const mergeAndSet = () => {
        const idMap = new Map<string, any>();
        [...nativeMsgs, ...webMsgs].forEach((m) => {
          if (m && m.id) idMap.set(m.id, m);
        });

        // Content deduplication to eliminate past duplicate writes across collections
        const contentSeen = new Set<string>();
        const deduplicated: any[] = [];

        // Sort by timestamp
        const sortedAll = Array.from(idMap.values()).sort((a, b) => {
          const tA =
            a.timestamp?.seconds ||
            a.timestamp?.toMillis?.() ||
            a.createdAt?.seconds ||
            0;
          const tB =
            b.timestamp?.seconds ||
            b.timestamp?.toMillis?.() ||
            b.createdAt?.seconds ||
            0;
          return tA - tB;
        });

        for (const m of sortedAll) {
          const tSec =
            m.timestamp?.seconds ||
            Math.floor((m.timestamp?.toMillis?.() || 0) / 1000) ||
            m.createdAt?.seconds ||
            0;
          // 4-second time window for duplicate dual-collection writes
          const timeBucket = Math.floor(tSec / 4);
          const fingerprint = `${m.senderId || ""}_${(m.text || "").trim()}_${m.imageUrl || ""}_${timeBucket}`;

          if (contentSeen.has(fingerprint)) {
            continue; // Skip duplicate message
          }
          contentSeen.add(fingerprint);
          deduplicated.push(m);
        }

        memoryGroupMsgs[groupId] = deduplicated;
        setMessages(deduplicated);
        setLoading(false);
        AsyncStorage.setItem(
          `@bunkmates_cached_group_msgs_${groupId}`,
          JSON.stringify(deduplicated)
        ).catch(() => {});
      };

      // 1. Listen to `groupChat/${groupId}/messages` (React Web path)
      const qWeb = query(
        collection(db, "groupChat", groupId, "messages"),
        orderBy("timestamp", "asc"),
        limit(300)
      );

      const unsubWeb = onSnapshot(
        qWeb,
        (snap) => {
          webMsgs = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          mergeAndSet();
        },
        (err) => {
          console.log("groupChat listener fallback:", err.message);
          setLoading(false);
        }
      );

      // 2. Listen to `groupChats/${groupId}/messages` (Plural fallback)
      const qNative = query(
        collection(db, "groupChats", groupId, "messages"),
        orderBy("timestamp", "asc"),
        limit(300)
      );

      const unsubNative = onSnapshot(
        qNative,
        (snap) => {
          nativeMsgs = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          mergeAndSet();
        },
        (err) => {
          console.log("groupChats listener fallback:", err.message);
          setLoading(false);
        }
      );

      return () => {
        unsubWeb();
        unsubNative();
      };
    } catch (error) {
      console.error("Error setting up group chat listener:", error);
      setLoading(false);
    }
  }, [groupId]);

  return { messages, loading };
};