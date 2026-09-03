import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export const useGroupChat = (groupId: string | null) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      let webMsgs: any[] = [];
      let nativeMsgs: any[] = [];

      const mergeAndSet = () => {
        const map = new Map<string, any>();
        [...webMsgs, ...nativeMsgs].forEach((m) => {
          map.set(m.id, m);
        });

        const sorted = Array.from(map.values()).sort((a, b) => {
          const tA = a.timestamp?.seconds || a.timestamp?.toMillis?.() || a.createdAt?.seconds || 0;
          const tB = b.timestamp?.seconds || b.timestamp?.toMillis?.() || b.createdAt?.seconds || 0;
          return tA - tB;
        });

        setMessages(sorted);
        setLoading(false);
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