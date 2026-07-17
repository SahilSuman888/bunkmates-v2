// utils/placeActions.ts
import { db, auth } from '../lib/firebase';
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Toggle like on a place - atomic operation
 */
export const toggleLikePlace = async (placeId: string, isCurrentlyLiked: boolean) => {
  const user = auth.currentUser;
  if (!user || !placeId) return;

  const uid = user.uid;
  const userRef = doc(db, 'users', uid);
  const placeRef = doc(db, 'places', placeId);

  const batch = writeBatch(db);

  try {
    // Update global like counter
    batch.set(
      placeRef,
      {
        likesCount: increment(isCurrentlyLiked ? -1 : 1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update user's liked trips
    batch.set(
      userRef,
      {
        likedTrips: isCurrentlyLiked
          ? arrayRemove(placeId)
          : arrayUnion(placeId),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    console.error('toggleLikePlace failed:', {
      placeId,
      uid,
      error,
    });
  }
};

/**
 * Toggle save on a place
 */
export const toggleSavePlace = async (placeId: string, isCurrentlySaved: boolean) => {
  const uid = auth.currentUser?.uid;
  if (!uid || !placeId) return;

  const userRef = doc(db, 'users', uid);

  try {
    await updateDoc(userRef, {
      savedTrips: isCurrentlySaved
        ? arrayRemove(placeId)
        : arrayUnion(placeId),
    });
  } catch (error) {
    console.error('Save update failed:', error);
  }
};

/**
 * Add place to a trip
 */
export const addPlaceToTrip = async (tripId: string, placeId: string) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      places: arrayUnion(placeId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding place to trip:', error);
  }
};

/**
 * Remove place from a trip
 */
export const removePlaceFromTrip = async (tripId: string, placeId: string) => {
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      places: arrayRemove(placeId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error removing place from trip:', error);
  }
};
