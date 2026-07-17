import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  doc as docRef,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

/**
 * Subscribes to pending friend requests sent to the user. Each request is
 * enriched with minimal sender info (name/avatar) by querying the users
 * collection.
 */
export const useFriendRequests = (userId: string | null) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const reqQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      reqQuery,
      async (snapshot) => {
        try {
          const fetched: FriendRequest[] = [];

          for (const docSnap of snapshot.docs) {
            const data: any = docSnap.data();
            let u: any = null;
            try {
              const userDocSnap = await getDoc(docRef(db, 'users', data.fromUserId));
              if (userDocSnap.exists()) u = userDocSnap.data();
            } catch (e) {
              // ignore and fallback
            }

            if (!u) {
              const userSnap = await getDocs(
                query(collection(db, 'users'), where('uid', '==', data.fromUserId))
              );
              if (!userSnap.empty) u = userSnap.docs[0].data();
            }

            if (u) {
              fetched.push({
                id: docSnap.id,
                fromUserId: data.fromUserId,
                fromUserName: u.name || 'Unknown',
                fromUserAvatar:
                  u.avatar || `https://i.pravatar.cc/150?u=${data.fromUserId}`,
                status: data.status,
                timestamp: data.timestamp || 0,
              });
            }
          }

          setRequests(fetched);
          setLoading(false);
        } catch (e) {
          console.error('useFriendRequests error', e);
          setError(e as Error);
          setLoading(false);
        }
      },
      (err) => {
        console.error('useFriendRequests snapshot error', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { requests, loading, error };
};