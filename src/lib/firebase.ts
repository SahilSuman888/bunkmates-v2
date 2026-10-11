import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence
} from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

try {
  setLogLevel("silent");
} catch {}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCP_l2uREbRMcV6aHhB8yZXK7NdGNltxpA",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "bunk-mates-beccc.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "bunk-mates-beccc",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "bunk-mates-beccc.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "37810808180",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:37810808180:web:94ca726e3c8f195a26f821",
  measurementId: "G-Y78WBDGF5Z",
};

export const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Note: For React Native, Firebase Messaging should be initialized using:
// import messaging from '@react-native-firebase/messaging';
// export const firebaseMessaging = messaging();