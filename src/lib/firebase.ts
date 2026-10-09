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
  apiKey: "AIzaSyCP_l2uREbRMcV6aHhB8yZXK7NdGNltxpA",
  authDomain: "bunk-mates-beccc.firebaseapp.com",
  projectId: "bunk-mates-beccc",
  storageBucket: "bunk-mates-beccc.firebasestorage.app",
  messagingSenderId: "37810808180",
  appId: "1:37810808180:web:94ca726e3c8f195a26f821",
  measurementId: "G-Y78WBDGF5Z"
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