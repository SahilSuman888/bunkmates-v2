import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { loginOneSignalUser, logoutOneSignalUser } from '../lib/onesignal';

interface UserContextType {
  user: any; // Firebase Auth user
  loading: boolean;
  // additional metadata stored in Firestore (e.g. display name, photoURL, etc.)
  userData?: any;
  updateUserData?: (newData: Partial<any>) => void;
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

import { recordDeviceSessionInFirestore, getPersistentDeviceId } from '../utils/sessionTracker';

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        recordDeviceSessionInFirestore(firebaseUser).catch(console.error);
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
      // Clean up legacy expoPushToken so Cloud Functions never double-push
      updateDoc(doc(db, 'users', user.uid), {
        expoPushToken: deleteField(),
      }).catch(() => {});
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
    let sessionInitDone = false;

    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        AsyncStorage.setItem(`@bunkmates_cached_profile_${user.uid}`, JSON.stringify(data)).catch(() => {});

        // 3. Remote Session Termination / Revocation Check
        try {
          const devId = await getPersistentDeviceId();
          if (Array.isArray(data.security?.loginActivity) && data.security.loginActivity.length > 0) {
            const hasMySession = data.security.loginActivity.some((s: any) => s.id === devId);
            if (sessionInitDone && !hasMySession) {
              console.log("[UserContext] Session terminated remotely, signing out.");
              auth.signOut().catch(() => {});
              return;
            }
            if (hasMySession) {
              sessionInitDone = true;
            }
          }
        } catch (e) {}

        // 4. Privacy: Activity Status enforcement
        const allowActivityStatus = data.privacy?.activityStatus ?? true;
        if (!allowActivityStatus) {
          updateDoc(ref, {
            online: false,
            isOnline: false,
          }).catch(() => {});
        }
      } else {
        setUserData(null);
      }
    });

    // Mark current user online in Firestore only if activity status is allowed
    AsyncStorage.getItem("activity_status_enabled").then((savedAct) => {
      if (savedAct === "false") return;
      updateDoc(ref, {
        online: true,
        isOnline: true,
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    });

    // Listen to AppState (active vs background)
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      const savedAct = await AsyncStorage.getItem("activity_status_enabled");
      if (savedAct === "false") return;
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

  const updateUserData = React.useCallback((newData: Partial<any>) => {
    setUserData((prev: any) => {
      const merged = { ...(prev || {}), ...newData };
      if (user?.uid) {
        AsyncStorage.setItem(`@bunkmates_cached_profile_${user.uid}`, JSON.stringify(merged)).catch(() => {});
      }
      return merged;
    });
  }, [user?.uid]);

  return (
    <UserContext.Provider value={{ user, loading, userData, updateUserData }}>
      {children}
    </UserContext.Provider>
  );
};
