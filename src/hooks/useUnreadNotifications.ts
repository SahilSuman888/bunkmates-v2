import { useEffect, useState } from 'react';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';

export default function useUnreadNotifications() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', user.uid),
      where('seen', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.size);
    });

    return () => unsub();
  }, []);

  return count;
}
