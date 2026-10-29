import { useEffect, useState } from 'react';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';

import { onAuthStateChanged } from 'firebase/auth';

export default function useUnreadNotifications() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      if (!user) {
        setCount(0);
        return;
      }

      const q = query(
        collection(db, 'notifications'),
        where('uid', '==', user.uid),
        where('seen', '==', false)
      );

      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          setCount(snap.size);
        },
        (err) => {
          console.warn('[useUnreadNotifications] snapshot error:', err);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  return count;
}
