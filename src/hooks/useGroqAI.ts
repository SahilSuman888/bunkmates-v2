/**
 * useGroqAI — Shared hook that reads the user's Groq API key and models
 * from Firestore (users/{uid}) in real-time, exactly like bunk-mates-master.
 *
 * Excludes non-chat models (audio, whisper, tts, guard) from defaultModel selection.
 */

import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../lib/firebase";

export type GroqKeyStatus = "idle" | "valid" | "invalid";

export interface GroqAIState {
  groqApiKey: string;
  groqKeyStatus: GroqKeyStatus;
  groqValidatedAt: string | null;
  groqModels: string[];
  /** Default chat completion model */
  defaultModel: string;
  /** True when key exists */
  isReady: boolean;
  /** Fetch key directly from Firestore if state is stale */
  fetchKeyDirectly: () => Promise<string | null>;
}

const FALLBACK_MODEL = "llama-3.3-70b-versatile";

const PREFERRED_CHAT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
  "qwen-2.5-coder-32b",
  "deepseek-r1-distill-llama-70b",
];

export function useGroqAI(): GroqAIState {
  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqKeyStatus, setGroqKeyStatus] = useState<GroqKeyStatus>("idle");
  const [groqValidatedAt, setGroqValidatedAt] = useState<string | null>(null);
  const [groqModels, setGroqModels] = useState<string[]>([]);

  // Listen to Auth State changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  // Real-time listener for user document in Firestore
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = onSnapshot(doc(db, "users", currentUid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.groqApiKey !== undefined) {
        setGroqApiKey(data.groqApiKey || "");
      }
      if (data.groqApiKeyStatus) {
        setGroqKeyStatus(data.groqApiKeyStatus as GroqKeyStatus);
      }
      if (data.groqApiKeyValidatedAt) {
        setGroqValidatedAt(data.groqApiKeyValidatedAt);
      }
      if (Array.isArray(data.groqModels)) {
        setGroqModels(data.groqModels);
      }
    });

    return () => unsubscribe();
  }, [currentUid]);

  const fetchKeyDirectly = useCallback(async (): Promise<string | null> => {
    const uid = auth.currentUser?.uid || currentUid;
    if (!uid) return null;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists() && snap.data().groqApiKey) {
        const key = snap.data().groqApiKey;
        setGroqApiKey(key);
        return key;
      }
    } catch (e) {
      console.warn("fetchKeyDirectly error:", e);
    }
    return null;
  }, [currentUid]);

  // Filter out non-chat models (TTS, whisper, audio, guard)
  const validChatModels = (groqModels || []).filter((m) => {
    const lower = m.toLowerCase();
    return (
      !lower.includes("whisper") &&
      !lower.includes("orpheus") &&
      !lower.includes("canopylabs") &&
      !lower.includes("guard") &&
      !lower.includes("vision") &&
      !lower.includes("playht") &&
      !lower.includes("elevenlabs")
    );
  });

  // Pick best chat model from preferred list or first valid chat model
  const defaultModel =
    PREFERRED_CHAT_MODELS.find((pm) => validChatModels.includes(pm)) ||
    validChatModels[0] ||
    FALLBACK_MODEL;

  const isReady = !!groqApiKey;

  return {
    groqApiKey,
    groqKeyStatus,
    groqValidatedAt,
    groqModels,
    defaultModel,
    isReady,
    fetchKeyDirectly,
  };
}
