import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit
} from "firebase/firestore";
import { db } from "../lib/firebase";

export const useGroupChat = (groupId: string | null) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "groupChats", groupId, "messages"),
        orderBy("timestamp", "asc"),
        limit(300)
      );

      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(list);
        setLoading(false);
      });

      return () => unsub();
    } catch (error) {
      console.error("Error setting up group chat listener:", error);
      setLoading(false);
    }
  }, [groupId]);

  return { messages, loading };
};