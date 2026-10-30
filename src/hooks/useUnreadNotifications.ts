import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Module-level shared store for instant 0ms cross-screen synchronization
const docStore = new Map<string, any>();
const locallyReadIds = new Set<string>();
const locallyDeletedIds = new Set<string>();
const listeners = new Set<() => void>();

function isUnreadDoc(data: any): boolean {
  if (!data) return false;
  // If explicitly marked read in any recognized schema
  if (
    data.isRead === true ||
    data.seen === true ||
    data.read === true ||
    data.status === "read" ||
    data.status === "seen"
  ) {
    return false;
  }
  return true;
}

export function computeUnreadCount(): number {
  let count = 0;
  for (const [id, data] of docStore.entries()) {
    if (locallyDeletedIds.has(id)) continue;
    if (locallyReadIds.has(id)) continue;
    if (isUnreadDoc(data)) {
      count++;
    }
  }
  return count;
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch { }
  });
}

/**
 * Optimistically mark notification IDs as read across all in-app badges and sync to Firestore
 */
export async function markNotificationIdsAsRead(
  ids: string[] | string,
): Promise<void> {
  const idList = Array.isArray(ids) ? ids : [ids];
  if (idList.length === 0) return;

  // 1. Optimistic memory update
  idList.forEach((id) => {
    locallyReadIds.add(id);
    const existing = docStore.get(id);
    if (existing) {
      docStore.set(id, {
        ...existing,
        isRead: true,
        seen: true,
        read: true,
        status: "read",
      });
    }
  });
  notifyListeners();

  // 2. Batch write to Firestore (up to 500 at once)
  try {
    const batch = writeBatch(db);
    idList.forEach((id) => {
      const ref = doc(db, "notifications", id);
      batch.set(
        ref,
        {
          isRead: true,
          seen: true,
          read: true,
          status: "read",
          readAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  } catch (err) {
    console.warn(
      "[useUnreadNotifications] Firestore mark read batch error:",
      err,
    );
  }
}

/**
 * Optimistically mark notification IDs as deleted across all in-app badges and sync to Firestore
 */
export async function markNotificationIdsAsDeleted(
  ids: string[] | string,
): Promise<void> {
  const idList = Array.isArray(ids) ? ids : [ids];
  if (idList.length === 0) return;

  // 1. Optimistic memory update
  idList.forEach((id) => {
    locallyDeletedIds.add(id);
    docStore.delete(id);
  });
  notifyListeners();

  // 2. Batch delete in Firestore
  try {
    const batch = writeBatch(db);
    idList.forEach((id) => {
      const ref = doc(db, "notifications", id);
      batch.delete(ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn(
      "[useUnreadNotifications] Firestore delete batch error:",
      err,
    );
  }
}

/**
 * Hook to retrieve real-time unread notification count, backed by Firestore and instant optimistic updates
 */
export default function useUnreadNotifications(): number {
  const [count, setCount] = useState<number>(computeUnreadCount);

  useEffect(() => {
    const update = () => setCount(computeUnreadCount());
    listeners.add(update);
    update();

    let unsubUid: (() => void) | null = null;
    let unsubRecipient: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubUid) {
        unsubUid();
        unsubUid = null;
      }
      if (unsubRecipient) {
        unsubRecipient();
        unsubRecipient = null;
      }

      if (!user) {
        docStore.clear();
        locallyReadIds.clear();
        locallyDeletedIds.clear();
        setCount(0);
        return;
      }

      const uid = user.uid;

      // Query 1: where uid == user.uid
      const qUid = query(
        collection(db, "notifications"),
        where("uid", "==", uid),
        limit(100),
      );
      unsubUid = onSnapshot(
        qUid,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "removed") {
              docStore.delete(change.doc.id);
            } else {
              docStore.set(change.doc.id, change.doc.data());
            }
          });
          notifyListeners();
        },
        (err) => {
          console.warn("[useUnreadNotifications] qUid error:", err);
        },
      );

      // Query 2: where recipientId == user.uid
      const qRecipient = query(
        collection(db, "notifications"),
        where("recipientId", "==", uid),
        limit(100),
      );
      unsubRecipient = onSnapshot(
        qRecipient,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === "removed") {
              docStore.delete(change.doc.id);
            } else {
              docStore.set(change.doc.id, change.doc.data());
            }
          });
          notifyListeners();
        },
        (err) => {
          console.warn("[useUnreadNotifications] qRecipient error:", err);
        },
      );
    });

    return () => {
      listeners.delete(update);
      unsubAuth();
      if (unsubUid) unsubUid();
      if (unsubRecipient) unsubRecipient();
    };
  }, []);

  return count;
}
