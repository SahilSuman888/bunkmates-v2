import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase"; 
import { useUser } from "../contexts/UserContext"; 

// ==========================================
// 1. LOGIC (HOOK)
// ==========================================
export interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
  online?: boolean;
}

export const useUserChats = (userId: string | null) => {
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setChats([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "chats"), async (snapshot) => {
      try {
        const results: ChatUser[] = [];

        for (const chatDoc of snapshot.docs) {
          if (!chatDoc.id.includes(userId)) continue;

          const data: any = chatDoc.data();
          const ids = chatDoc.id.split("_");
          const otherUserId = ids.find((id) => id !== userId);

          if (!otherUserId) continue;

          const userSnap = await getDoc(doc(db, "users", otherUserId));

          let name = "Unknown User";
          let avatar = `https://i.pravatar.cc/150?u=${otherUserId}`;
          let online = false;

          if (userSnap.exists()) {
            const userData = userSnap.data();
            name = userData.displayName || userData.name || userData.username || "Unknown User";
            avatar = userData.photoURL || userData.avatar || avatar;
            online = userData.online || false;
          }

          results.push({
            id: chatDoc.id,
            name,
            avatar,
            lastMessage: data.lastMessage?.text || data.lastMessage || "No messages yet",
            lastTimestamp: data.date?.seconds || data.lastTimestamp || 0,
            unreadCount: data.unreadCounts?.[userId] || 0,
            online,
          });
        }

        results.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
        setChats(results);
        setLoading(false);
      } catch (err) {
        console.error("Realtime chat error:", err);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return { chats, loading };
};

