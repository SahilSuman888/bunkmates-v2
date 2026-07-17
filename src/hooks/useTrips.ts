// hooks/useTrips.ts
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: any;
  endDate: any;
  members: string[];
  budget?: number;
  spent?: number;
  places?: string[];
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  image?: string;
  description?: string;
}

export const useTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const tripsQuery = query(
      collection(db, 'trips'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => {
        const tripsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Trip[];
        setTrips(tripsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching trips:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const createTrip = async (tripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'trips'), {
        ...tripData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating trip:', error);
      throw error;
    }
  };

  const updateTrip = async (tripId: string, updates: Partial<Trip>) => {
    try {
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      await deleteDoc(doc(db, 'trips', tripId));
    } catch (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  };

  return {
    trips,
    loading,
    createTrip,
    updateTrip,
    deleteTrip,
  };
};
