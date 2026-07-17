import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Chatroom {
  id: string;
  name: string;
  members: string[];
  lastMessage?: string;
  updatedAt?: any;
}

export const useChatrooms = () => {
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const q = query(collection(db, 'chats'));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const rooms: Chatroom[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Chatroom));
          setChatrooms(rooms);
          setLoading(false);
        },
        (err) => {
          console.error('chatrooms subscription error', err);
          setError(err);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setError(e as Error);
      setLoading(false);
    }
  }, []);

  return { chatrooms, loading, error };
};
