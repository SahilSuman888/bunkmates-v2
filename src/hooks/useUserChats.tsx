import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Pressable,
  StatusBar,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../lib/firebase"; 
import { useUser } from "../contexts/UserContext"; 

// ==========================================
// 1. LOGIC (HOOK)
// ==========================================
export interface ChatUser {
  id: string;
  uid?: string;
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

    // 1. Immediately hydrate cached chats for instant offline display (like WhatsApp)
    AsyncStorage.getItem(`@bunkmates_cached_chats_${userId}`).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed);
            setLoading(false);
          }
        } catch (e) {}
      }
    });

    // 2. Real-time Firestore listener (auto-refreshes when net connects)
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
            online = userData.online || userData.isOnline || false;
          }

          results.push({
            id: chatDoc.id,
            uid: otherUserId,
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

        // Persist to local cache for offline reading
        AsyncStorage.setItem(`@bunkmates_cached_chats_${userId}`, JSON.stringify(results)).catch(() => {});
      } catch (err) {
        console.error("Realtime chat error:", err);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return { chats, loading };
};

