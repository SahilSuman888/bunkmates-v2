// contexts/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

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

  // fetch the Firestore document whenever an authenticated user is available
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      } else {
        setUserData(null);
      }
    });

    return () => unsub();
  }, [user]);

  return (
    <UserContext.Provider value={{ user, loading, userData }}>
      {children}
    </UserContext.Provider>
  );
};
