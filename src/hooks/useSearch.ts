// hooks/useSearch.ts
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

interface SearchResults {
  users: any[];
  notes: any[];
  reminders: any[];
  trips: any[];
  places: any[];
}

export const useUniversalSearch = (
  searchQuery: string,
  options?: { maxPerCollection?: number }
) => {
  const [results, setResults] = useState<SearchResults>({
    users: [],
    notes: [],
    reminders: [],
    trips: [],
    places: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults({
        users: [],
        notes: [],
        reminders: [],
        trips: [],
        places: [],
      });
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      try {
        const maxResults = options?.maxPerCollection || 10;
        const lowerQuery = searchQuery.toLowerCase();

        // Search users by name or username
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(
          query(usersRef, limit(maxResults))
        );
        const usersData = usersSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(
            (user) =>
              user.name?.toLowerCase().includes(lowerQuery) ||
              user.username?.toLowerCase().includes(lowerQuery)
          );

        // Search notes
        const notesRef = collection(db, 'notes');
        const notesSnapshot = await getDocs(
          query(notesRef, limit(maxResults * 2))
        );
        const notesData = notesSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((note) =>
            note.title?.toLowerCase().includes(lowerQuery) ||
            note.content?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, maxResults);

        // Search reminders
        const remindersRef = collection(db, 'reminders');
        const remindersSnapshot = await getDocs(
          query(remindersRef, limit(maxResults * 2))
        );
        const remindersData = remindersSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((reminder) =>
            reminder.text?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, maxResults);

        // Search trips
        const tripsRef = collection(db, 'trips');
        const tripsSnapshot = await getDocs(
          query(tripsRef, limit(maxResults * 2))
        );
        const tripsData = tripsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((trip) =>
            trip.name?.toLowerCase().includes(lowerQuery) ||
            trip.destination?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, maxResults);

        setResults({
          users: usersData,
          notes: notesData,
          reminders: remindersData,
          trips: tripsData,
          places: [], // Placeholder for places search
        });
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [searchQuery]);

  return { results, loading };
};
