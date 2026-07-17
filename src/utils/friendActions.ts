// utils/friendActions.ts
import { db, auth } from '../lib/firebase';
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Send friend request
 */
export const sendFriendRequest = async (targetUserId: string) => {
  const user = auth.currentUser;
  if (!user || !targetUserId) return;

  try {
    const targetUserRef = doc(db, 'users', targetUserId);
    await updateDoc(targetUserRef, {
      friendRequests: arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (fromUserId: string) => {
  const user = auth.currentUser;
  if (!user || !fromUserId) return;

  try {
    const currentUserRef = doc(db, 'users', user.uid);
    const fromUserRef = doc(db, 'users', fromUserId);

    // Update current user
    await updateDoc(currentUserRef, {
      friends: arrayUnion(fromUserId),
      friendRequests: arrayRemove(fromUserId),
      updatedAt: serverTimestamp(),
    });

    // Update sender
    await updateDoc(fromUserRef, {
      friends: arrayUnion(user.uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Reject friend request
 */
export const rejectFriendRequest = async (fromUserId: string) => {
  const user = auth.currentUser;
  if (!user || !fromUserId) return;

  try {
    const currentUserRef = doc(db, 'users', user.uid);
    await updateDoc(currentUserRef, {
      friendRequests: arrayRemove(fromUserId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

/**
 * Remove friend
 */
export const removeFriend = async (friendId: string) => {
  const user = auth.currentUser;
  if (!user || !friendId) return;

  try {
    const currentUserRef = doc(db, 'users', user.uid);
    const friendRef = doc(db, 'users', friendId);

    await updateDoc(currentUserRef, {
      friends: arrayRemove(friendId),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(friendRef, {
      friends: arrayRemove(user.uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Block user
 */
export const blockUser = async (blockUserId: string) => {
  const user = auth.currentUser;
  if (!user || !blockUserId) return;

  try {
    const currentUserRef = doc(db, 'users', user.uid);
    await updateDoc(currentUserRef, {
      blockedUsers: arrayUnion(blockUserId),
      friends: arrayRemove(blockUserId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
};

/**
 * Unblock user
 */
export const unblockUser = async (blockUserId: string) => {
  const user = auth.currentUser;
  if (!user || !blockUserId) return;

  try {
    const currentUserRef = doc(db, 'users', user.uid);
    await updateDoc(currentUserRef, {
      blockedUsers: arrayRemove(blockUserId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
};
