import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { loginOneSignalUser, logoutOneSignalUser } from '../lib/onesignal';

interface UserContextType {
  user: any; // Firebase Auth user
  loading: boolean;
  // additional metadata stored in Firestore (e.g. display name, photoURL, etc.)
  userData?: any;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Guarantee OneSignal is linked to user's Firebase UID whenever user exists
  useEffect(() => {
    if (user?.uid) {
      loginOneSignalUser(user.uid);
    } else if (!loading && !user) {
      logoutOneSignalUser();
    }
  }, [user?.uid, loading]);

  // fetch the Firestore document whenever an authenticated user is available
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    // 1. Immediately hydrate cached profile offline
    AsyncStorage.getItem(`@bunkmates_cached_profile_${user.uid}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setUserData((prev: any) => prev || parsed);
          }
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore sync
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        AsyncStorage.setItem(`@bunkmates_cached_profile_${user.uid}`, JSON.stringify(data)).catch(() => {});
      } else {
        setUserData(null);
      }
    });

    // Mark current user online in Firestore
    updateDoc(ref, {
      online: true,
      isOnline: true,
      lastSeen: serverTimestamp(),
    }).catch(() => {});

    // Listen to AppState (active vs background)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateDoc(ref, {
          online: true,
          isOnline: true,
          lastSeen: serverTimestamp(),
        }).catch(() => {});
      } else {
        updateDoc(ref, {
          online: false,
          isOnline: false,
          lastSeen: serverTimestamp(),
        }).catch(() => {});
      }
    });

    return () => {
      unsub();
      appStateSub.remove();
      updateDoc(ref, {
        online: false,
        isOnline: false,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    };
  }, [user]);

  return (
    <UserContext.Provider value={{ user, loading, userData }}>
      {children}
    </UserContext.Provider>
  );
};
