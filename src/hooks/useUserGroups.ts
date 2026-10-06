import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../lib/firebase";

export const useUserGroups = (userId?: string | null) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate from cache
    AsyncStorage.getItem(`@bunkmates_cached_groups_${userId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGroups(parsed);
            setLoading(false);
          }
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync
    const q = query(
      collection(db, "groupChats"),
      where("members", "array-contains", userId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      setGroups(list);
      setLoading(false);
      AsyncStorage.setItem(`@bunkmates_cached_groups_${userId}`, JSON.stringify(list)).catch(() => {});
    }, () => {
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { groups, loading };
};