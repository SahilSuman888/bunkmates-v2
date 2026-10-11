import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../lib/firebase";

const memoryCachedGroups: Record<string, any[]> = {};

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

export const useUserGroups = (userId?: string | null) => {
  const [groups, setGroups] = useState<any[]>(
    () => (userId && memoryCachedGroups[userId]) || []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !(userId && memoryCachedGroups[userId]?.length)
  );

  const activeMsgUnsubs = useRef<Record<string, () => void>>({});
  // Persistent dictionary of latest messages & timestamps for each group
  const latestMetaRef = useRef<
    Record<string, { lastMessage: string; lastTimestamp: any; unreadCount: number }>
  >({});

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // 1. Immediately hydrate from cache for 0ms initial render
    AsyncStorage.getItem(`@bunkmates_cached_groups_${userId}`)
      .then((cached) => {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              memoryCachedGroups[userId] = parsed;
              parsed.forEach((grp) => {
                if (grp && grp.id) {
                  latestMetaRef.current[grp.id] = {
                    lastMessage: grp.lastMessage || "Group conversation",
                    lastTimestamp: grp.lastTimestamp || 0,
                    unreadCount: grp.unreadCounts?.current || grp.unreadCount || 0,
                  };
                }
              });
              setGroups(parsed);
              setLoading(false);
            }
          } catch (e) {}
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });

    // 2. Real-time Firestore sync across all group & trip collections
    let groupChatsMembers: any[] = [];
    let groupChatsCreatedBy: any[] = [];
    let groupsMembers: any[] = [];
    let groupsCreatedBy: any[] = [];
    let tripsMembers: any[] = [];
    let tripsCreatedBy: any[] = [];

    const attachMessageListener = (groupId: string) => {
      if (!groupId || activeMsgUnsubs.current[groupId]) return;

      const handleMsgSnap = (snap: any) => {
        if (!snap.empty) {
          const mData: any = snap.docs[0].data();
          const isSystem = mData.type === "system";
          const txt = isSystem
            ? mData.content || "System update"
            : mData.text || (mData.imageUrl ? "📷 Photo" : "Attachment");
          const ts = mData.timestamp || mData.createdAt;
          const isUnread =
            mData.senderId !== userId &&
            (!mData.read || !mData.readBy?.includes(userId));

          const currentTsMs = getTimestampMs(latestMetaRef.current[groupId]?.lastTimestamp);
          const newTsMs = getTimestampMs(ts);

          // Only update if newer or not yet recorded
          if (newTsMs >= currentTsMs || !latestMetaRef.current[groupId]) {
            latestMetaRef.current[groupId] = {
              lastMessage: txt,
              lastTimestamp: ts,
              unreadCount: isUnread ? 1 : 0,
            };

            setGroups((prev) => {
              const idx = prev.findIndex((p) => p.id === groupId);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                lastMessage: txt,
                lastTimestamp: ts,
                unreadCounts: { current: isUnread ? 1 : 0 },
                unreadCount: isUnread ? 1 : 0,
              };
              updated.sort(
                (a, b) => getTimestampMs(b.lastTimestamp) - getTimestampMs(a.lastTimestamp)
              );
              memoryCachedGroups[userId] = updated;
              AsyncStorage.setItem(
                `@bunkmates_cached_groups_${userId}`,
                JSON.stringify(updated)
              ).catch(() => {});
              return updated;
            });
          }
        }
      };

      try {
        // Primary Web collection: `groupChat/${groupId}/messages` (where React.js writes)
        const qWeb = query(
          collection(db, "groupChat", groupId, "messages"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const unsubWeb = onSnapshot(qWeb, handleMsgSnap, () => {});

        // Secondary collection: `groupChats/${groupId}/messages` (where Mobile writes)
        const qNative = query(
          collection(db, "groupChats", groupId, "messages"),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const unsubNative = onSnapshot(qNative, handleMsgSnap, () => {});

        activeMsgUnsubs.current[groupId] = () => {
          try {
            unsubWeb();
            unsubNative();
          } catch (e) {}
        };
      } catch (e) {}
    };

    const mergeAndSet = () => {
      const map = new Map<string, any>();

      // Order matters: groupChats first, then trips, then groups
      [
        ...groupChatsMembers,
        ...groupChatsCreatedBy,
        ...tripsMembers,
        ...tripsCreatedBy,
        ...groupsMembers,
        ...groupsCreatedBy,
      ].forEach((g) => {
        if (!g || !g.id) return;
        const existing = map.get(g.id) || {};
        const meta = latestMetaRef.current[g.id];

        const lastMsg =
          meta?.lastMessage ||
          (g.lastMessage && g.lastMessage !== "No messages yet" ? g.lastMessage : null) ||
          existing.lastMessage ||
          "Group conversation";

        const lastTs =
          meta?.lastTimestamp ||
          g.lastTimestamp ||
          g.updatedAt ||
          g.createdAt ||
          existing.lastTimestamp ||
          0;

        const unread =
          meta?.unreadCount ??
          (typeof g.unreadCount === "number" ? g.unreadCount : g.unreadCounts?.current || existing.unreadCount || 0);

        map.set(g.id, {
          ...existing,
          ...g,
          id: g.id,
          name: existing.name || g.name || g.tripName || "Group",
          iconURL:
            g.iconURL ||
            g.groupChatIcon ||
            g.coverImage ||
            g.image ||
            existing.iconURL ||
            null,
          description:
            g.description ||
            existing.description ||
            "Group conversation",
          lastMessage: lastMsg,
          lastTimestamp: lastTs,
          unreadCounts: { current: unread },
          unreadCount: unread,
        });
      });

      const list = Array.from(map.values()).sort((a, b) => {
        return getTimestampMs(b.lastTimestamp) - getTimestampMs(a.lastTimestamp);
      });

      // Synchronize latest message for each group
      list.forEach((grp) => {
        attachMessageListener(grp.id);
      });

      memoryCachedGroups[userId] = list;
      setGroups(list);
      setLoading(false);
      AsyncStorage.setItem(
        `@bunkmates_cached_groups_${userId}`,
        JSON.stringify(list)
      ).catch(() => {});
    };

    const unsubs: (() => void)[] = [];

    // Query 1: groupChats where members array-contains userId
    try {
      const q1 = query(
        collection(db, "groupChats"),
        where("members", "array-contains", userId)
      );
      unsubs.push(
        onSnapshot(
          q1,
          (snap) => {
            groupChatsMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("groupChats members fallback:", err.message)
        )
      );
    } catch (e) {}

    // Query 2: groupChats where createdBy == userId
    try {
      const q2 = query(
        collection(db, "groupChats"),
        where("createdBy", "==", userId)
      );
      unsubs.push(
        onSnapshot(
          q2,
          (snap) => {
            groupChatsCreatedBy = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("groupChats createdBy fallback:", err.message)
        )
      );
    } catch (e) {}

    // Query 3: trips collection where members array-contains userId
    try {
      const q3 = query(
        collection(db, "trips"),
        where("members", "array-contains", userId)
      );
      unsubs.push(
        onSnapshot(
          q3,
          (snap) => {
            tripsMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("trips members fallback:", err.message)
        )
      );
    } catch (e) {}

    // Query 4: trips collection where createdBy == userId
    try {
      const q4 = query(
        collection(db, "trips"),
        where("createdBy", "==", userId)
      );
      unsubs.push(
        onSnapshot(
          q4,
          (snap) => {
            tripsCreatedBy = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("trips createdBy fallback:", err.message)
        )
      );
    } catch (e) {}

    // Query 5: groups collection where members array-contains userId
    try {
      const q5 = query(
        collection(db, "groups"),
        where("members", "array-contains", userId)
      );
      unsubs.push(
        onSnapshot(
          q5,
          (snap) => {
            groupsMembers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("groups members fallback:", err.message)
        )
      );
    } catch (e) {}

    // Query 6: groups collection where createdBy == userId
    try {
      const q6 = query(
        collection(db, "groups"),
        where("createdBy", "==", userId)
      );
      unsubs.push(
        onSnapshot(
          q6,
          (snap) => {
            groupsCreatedBy = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            mergeAndSet();
          },
          (err) => console.log("groups createdBy fallback:", err.message)
        )
      );
    } catch (e) {}

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch (e) {}
      });
      Object.values(activeMsgUnsubs.current).forEach((u) => {
        try {
          u();
        } catch (e) {}
      });
      activeMsgUnsubs.current = {};
    };
  }, [userId]);

  return { groups, loading };
};