import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Camera } from "expo-camera";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUser } from "./UserContext";
import { WebRTCManager } from "../lib/webrtcManager";
import {
  showLocalIncomingCallNotification,
  cancelCallNotification,
  showMissedCallNotification,
  sendRemoteCallPushNotification,
  showOngoingCallNotification,
} from "../lib/callNotifications";
import AudioRouteManager from "../lib/incallManager";
import callForegroundService from "../lib/callForegroundService";

export type CallType = "audio" | "video";
export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "accepted"
  | "declined"
  | "ended"
  | "reconnecting";

export type AudioRoute = "earpiece" | "speaker" | "bluetooth";

export interface ActiveCallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  callerHandle: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  receiverHandle: string;
  callType: CallType;
  status: CallStatus;
  isIncoming: boolean;
  createdAt?: any;
  acceptedAt?: any;
}

export interface CallReactionEvent {
  id: string;
  emoji: string;
  senderId: string;
  timestamp: number;
}

interface CallContextType {
  activeCall: ActiveCallData | null;
  callSeconds: number;
  isMuted: boolean;
  isSpeaker: boolean;
  isVideoOff: boolean;
  facing: "front" | "back";
  isMinimized: boolean;
  audioRoute: AudioRoute;
  localStream: any;
  remoteStream: any;
  connectionQuality: "good" | "poor" | "connecting";
  latestReaction: CallReactionEvent | null;
  startCall: (params: {
    receiverId: string;
    receiverName?: string;
    receiverAvatar?: string;
    receiverHandle?: string;
    callType: CallType;
  }) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setAudioRoute: (route: AudioRoute) => void;
  toggleCamera: () => void;
  flipCamera: () => void;
  minimizeCall: () => void;
  expandCall: () => void;
  sendReaction: (emoji: string) => Promise<void>;
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { user, userData } = useUser();
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);
  const [callSeconds, setCallSeconds] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);
  const [audioRoute, setAudioRouteState] = useState<AudioRoute>("earpiece");
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [connectionQuality, setConnectionQuality] = useState<
    "good" | "poor" | "connecting"
  >("connecting");
  const [latestReaction, setLatestReaction] = useState<CallReactionEvent | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);

  const rtcRef = useRef<WebRTCManager | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const callDurationRef = useRef<number>(0);
  const activeCallRef = useRef<ActiveCallData | null>(null);

  useEffect(() => {
    callDurationRef.current = callSeconds;
  }, [callSeconds]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const triggerHaptic = useCallback(
    (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
      try {
        Haptics.impactAsync(style);
      } catch (e) {}
    },
    []
  );

  const requestPermissions = useCallback(async () => {
    try {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      const granted =
        (cam.granted || cam.status === "granted") &&
        (mic.granted || mic.status === "granted");
      setHasPermissions(granted);
      return granted;
    } catch (e) {
      console.log("[CallContext] Permission request error:", e);
      return false;
    }
  }, []);

  // Record Call History in Firestore & Chat messages
  const recordCallLog = useCallback(
    async (
      callData: ActiveCallData,
      status: "completed" | "missed" | "declined",
      duration: number
    ) => {
      if (!callData) return;

      const chatId = [callData.callerId, callData.receiverId].sort().join("_");
      const timestamp = new Date();

      const logPayload = {
        callId: callData.id,
        callerId: callData.callerId,
        callerName: callData.callerName,
        callerAvatar: callData.callerAvatar,
        callerHandle: callData.callerHandle,
        receiverId: callData.receiverId,
        receiverName: callData.receiverName,
        receiverAvatar: callData.receiverAvatar,
        receiverHandle: callData.receiverHandle,
        callType: callData.callType,
        status,
        duration,
        timestamp,
      };

      try {
        // 1. Write to caller callHistory
        await addDoc(
          collection(db, "users", callData.callerId, "callHistory"),
          logPayload
        ).catch(() => {});

        // 2. Write to receiver callHistory
        await addDoc(
          collection(db, "users", callData.receiverId, "callHistory"),
          logPayload
        ).catch(() => {});

        // 3. Write inline call log to chat conversation
        let displayText = "";
        if (status === "missed") {
          displayText = `Missed ${callData.callType === "video" ? "video" : "voice"} call`;
        } else if (status === "declined") {
          displayText = `Declined ${callData.callType === "video" ? "video" : "voice"} call`;
        } else {
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          displayText = `${callData.callType === "video" ? "Video" : "Voice"} call (${durStr})`;
        }

        await addDoc(collection(db, "chats", chatId, "messages"), {
          type: "call_log",
          text: displayText,
          callType: callData.callType,
          status,
          duration,
          senderId: callData.callerId,
          receiverId: callData.receiverId,
          timestamp: serverTimestamp(),
          isRead: false,
        }).catch(() => {});

        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: `${callData.callType === "video" ? "📹" : "📞"} ${displayText}`,
          lastTimestamp: serverTimestamp(),
        }).catch(async () => {
          await setDoc(doc(db, "chats", chatId), {
            participants: [callData.callerId, callData.receiverId],
            lastMessage: `${callData.callType === "video" ? "📹" : "📞"} ${displayText}`,
            lastTimestamp: serverTimestamp(),
          });
        });
      } catch (err) {
        console.warn("[CallContext] Error recording call log:", err);
      }
    },
    []
  );

  // 1. Listen for Incoming Calls where receiverId === user.uid
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let incomingData: ActiveCallData | null = null;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "calling" || data.status === "accepted") {
          if (
            !currentCallIdRef.current ||
            currentCallIdRef.current === docSnap.id
          ) {
            incomingData = {
              id: docSnap.id,
              callerId: data.callerId,
              callerName: data.callerName || "BunkMate",
              callerAvatar:
                data.callerAvatar || "https://i.pravatar.cc/150",
              callerHandle: data.callerHandle || "traveler",
              receiverId: data.receiverId,
              receiverName: data.receiverName || "BunkMate",
              receiverAvatar:
                data.receiverAvatar || "https://i.pravatar.cc/150",
              receiverHandle: data.receiverHandle || "traveler",
              callType: data.callType || "audio",
              status: data.status,
              isIncoming: true,
              createdAt: data.createdAt,
              acceptedAt: data.acceptedAt,
            };
          }
        }
      });

      if (incomingData) {
        currentCallIdRef.current = (incomingData as ActiveCallData).id;
        setActiveCall(incomingData);

        if ((incomingData as ActiveCallData).status === "calling") {
          showLocalIncomingCallNotification(
            (incomingData as ActiveCallData).callerName,
            (incomingData as ActiveCallData).callType,
            (incomingData as ActiveCallData).id
          );
        }
      } else if (activeCall?.isIncoming) {
        // Incoming call was cancelled or missed by caller
        cancelCallNotification();
        if (activeCall.status === "calling") {
          showMissedCallNotification(
            activeCall.callerName,
            activeCall.callType
          );
          recordCallLog(activeCall, "missed", 0);
        }

        if (rtcRef.current) {
          rtcRef.current.endCall();
          rtcRef.current = null;
        }
        AudioRouteManager.stop();
        callForegroundService.stop();
        currentCallIdRef.current = null;
        setActiveCall(null);
        setIsMinimized(false);
        setLocalStream(null);
        setRemoteStream(null);
      }
    });

    return () => unsub();
  }, [user?.uid, activeCall?.isIncoming, recordCallLog]);

  // 2. Listen to Active Outgoing Call doc status updates
  useEffect(() => {
    if (!activeCall?.id || activeCall?.isIncoming) return;

    const unsub = onSnapshot(doc(db, "calls", activeCall.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === "accepted") {
        setActiveCall((prev) =>
          prev
            ? {
                ...prev,
                status: "accepted",
                acceptedAt: data.acceptedAt,
              }
            : null
        );
        setConnectionQuality("good");
      } else if (data.status === "declined") {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
          "Call Declined",
          `${activeCall.receiverName || "User"} declined your call.`
        );
        recordCallLog(activeCall, "declined", 0);

        if (rtcRef.current) {
          rtcRef.current.endCall();
          rtcRef.current = null;
        }
        AudioRouteManager.stop();
        callForegroundService.stop();
        currentCallIdRef.current = null;
        setActiveCall(null);
        setIsMinimized(false);
        setLocalStream(null);
        setRemoteStream(null);
      } else if (data.status === "ended") {
        const finalSecs = callDurationRef.current;
        recordCallLog(
          activeCall,
          finalSecs > 0 ? "completed" : "missed",
          finalSecs
        );

        if (rtcRef.current) {
          rtcRef.current.endCall();
          rtcRef.current = null;
        }
        AudioRouteManager.stop();
        callForegroundService.stop();
        currentCallIdRef.current = null;
        setActiveCall(null);
        setIsMinimized(false);
        setLocalStream(null);
        setRemoteStream(null);
      }
    });

    return () => unsub();
  }, [activeCall?.id, activeCall?.isIncoming, triggerHaptic, recordCallLog]);

  // 3. Listen for Real-Time Synchronized Reactions between Caller & Callee
  useEffect(() => {
    if (!activeCall?.id) return;

    const q = query(
      collection(db, "calls", activeCall.id, "reactions"),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const rData = change.doc.data();
          if (rData?.emoji) {
            setLatestReaction({
              id: change.doc.id,
              emoji: rData.emoji,
              senderId: rData.senderId || "",
              timestamp: rData.timestamp?.toMillis ? rData.timestamp.toMillis() : Date.now(),
            });
          }
        }
      });
    });

    return () => unsub();
  }, [activeCall?.id]);

  // 4. Live Duration Timer when call status is 'accepted'
  useEffect(() => {
    let timer: any = null;
    if (activeCall?.status === "accepted") {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.status]);

  // 5. Send Real-Time Emoji Reaction
  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!activeCall?.id || !user?.uid) return;

      try {
        await addDoc(collection(db, "calls", activeCall.id, "reactions"), {
          emoji,
          senderId: user.uid,
          senderName: userData?.displayName || user.displayName || "Peer",
          timestamp: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[CallContext] Error sending call reaction:", e);
      }
    },
    [activeCall?.id, user, userData]
  );

  // 6. Audio Route Switcher
  const setAudioRoute = useCallback(
    (route: AudioRoute) => {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      setAudioRouteState(route);
      setIsSpeaker(route === "speaker");
      AudioRouteManager.setRoute(route);
    },
    [triggerHaptic]
  );

  // 7. Start Outgoing Call
  const startCall = useCallback(
    async ({
      receiverId,
      receiverName,
      receiverAvatar,
      receiverHandle,
      callType,
    }: {
      receiverId: string;
      receiverName?: string;
      receiverAvatar?: string;
      receiverHandle?: string;
      callType: CallType;
    }) => {
      if (!user?.uid || !receiverId) return;

      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      await requestPermissions();

      const callDocId = `call_${user.uid}_${receiverId}_${Date.now()}`;
      currentCallIdRef.current = callDocId;

      const callerName =
        userData?.displayName ||
        userData?.name ||
        user.displayName ||
        "BunkMate";
      const callerAvatar =
        userData?.photoURL ||
        userData?.avatar ||
        user.photoURL ||
        "https://i.pravatar.cc/150";
      const callerHandle = userData?.username || "traveler";

      const outgoingData: ActiveCallData = {
        id: callDocId,
        callerId: user.uid,
        callerName,
        callerAvatar,
        callerHandle,
        receiverId,
        receiverName: receiverName || "BunkMate",
        receiverAvatar: receiverAvatar || "https://i.pravatar.cc/150",
        receiverHandle: receiverHandle || "traveler",
        callType,
        status: "calling",
        isIncoming: false,
      };

      // Reset controls & initialize InCallManager hardware lifecycle
      const initialRoute: AudioRoute = callType === "video" ? "speaker" : "earpiece";
      setIsMuted(false);
      setIsSpeaker(callType === "video");
      setAudioRouteState(initialRoute);
      setIsVideoOff(false);
      setFacing("front");
      setIsMinimized(false);
      setCallSeconds(0);
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionQuality("connecting");
      setActiveCall(outgoingData);

      // Start Android InCallManager audio session & route
      AudioRouteManager.start(callType === "video" ? "video" : "audio");
      AudioRouteManager.setRoute(initialRoute);

      // Start Android Foreground Service for persistent audio/video
      callForegroundService.start(callDocId, receiverName || "BunkMate", callType);

      try {
        await setDoc(doc(db, "calls", callDocId), {
          callId: callDocId,
          callerId: user.uid,
          callerName,
          callerAvatar,
          callerHandle,
          receiverId,
          receiverName: receiverName || "BunkMate",
          receiverAvatar: receiverAvatar || "https://i.pravatar.cc/150",
          receiverHandle: receiverHandle || "traveler",
          callType,
          status: "calling",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Send Remote Push to Receiver
        sendRemoteCallPushNotification({
          receiverId,
          callerName,
          callType,
          callId: callDocId,
        });

        // Initialize WebRTC
        const rtc = new WebRTCManager(callDocId);
        rtcRef.current = rtc;

        rtc.setOnLocalStream((stream) => {
          console.log("[CallContext] Local stream set in caller");
          setLocalStream(stream);
        });

        rtc.setOnRemoteStream((stream) => {
          console.log("[CallContext] Remote stream received in caller");
          setRemoteStream(stream);
          setConnectionQuality("good");
        });

        rtc.setOnConnectionStateChange((state) => {
          console.log(`[CallContext] Connection state changed: ${state}`);
          if (state === "connected") setConnectionQuality("good");
          else if (state === "connecting") setConnectionQuality("connecting");
          else if (state === "disconnected" || state === "failed")
            setConnectionQuality("poor");
        });

        await rtc.startCaller(callType === "video");
      } catch (e) {
        console.error("[CallContext] startCall error:", e);
      }
    },
    [user, userData, requestPermissions, triggerHaptic]
  );

  // 8. Accept Incoming Call
  const acceptCall = useCallback(async () => {
    if (!activeCall?.id) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    cancelCallNotification();
    await requestPermissions();

    const isVideoCall = activeCall.callType === "video";
    const initialRoute: AudioRoute = isVideoCall ? "speaker" : "earpiece";
    setIsSpeaker(isVideoCall);
    setAudioRouteState(initialRoute);

    // Start InCallManager hardware session & route
    AudioRouteManager.start(isVideoCall ? "video" : "audio");
    AudioRouteManager.setRoute(initialRoute);

    // Start Android Foreground Service for persistent audio/video
    callForegroundService.start(
      activeCall.id,
      activeCall.callerName || "BunkMate",
      activeCall.callType
    );

    try {
      const rtc = new WebRTCManager(activeCall.id);
      rtcRef.current = rtc;

      rtc.setOnLocalStream((stream) => {
        console.log("[CallContext] Local stream set in callee");
        setLocalStream(stream);
      });

      rtc.setOnRemoteStream((stream) => {
        console.log("[CallContext] Remote stream received in callee");
        setRemoteStream(stream);
        setConnectionQuality("good");
      });

      rtc.setOnConnectionStateChange((state) => {
        console.log(`[CallContext] Callee connection state changed: ${state}`);
        if (state === "connected") setConnectionQuality("good");
        else if (state === "connecting") setConnectionQuality("connecting");
        else if (state === "disconnected" || state === "failed")
          setConnectionQuality("poor");
      });

      await rtc.startCallee(activeCall.callType === "video");

      await updateDoc(doc(db, "calls", activeCall.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActiveCall((prev) =>
        prev ? { ...prev, status: "accepted" } : null
      );
      setConnectionQuality("good");
    } catch (e) {
      console.error("[CallContext] Accept call error:", e);
    }
  }, [activeCall, requestPermissions, triggerHaptic]);

  // 9. Decline Incoming Call
  const declineCall = useCallback(
    async (reason?: string) => {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      cancelCallNotification();

      if (rtcRef.current) {
        rtcRef.current.endCall();
        rtcRef.current = null;
      }
      AudioRouteManager.stop();
      callForegroundService.stop();

      if (activeCall?.id) {
        try {
          await updateDoc(doc(db, "calls", activeCall.id), {
            status: "declined",
            declineReason: reason || "declined",
            duration: 0,
            endedAt: serverTimestamp(),
          });
        } catch (e) {
          console.error("[CallContext] Decline call error:", e);
        }
        recordCallLog(activeCall, "declined", 0);
      }

      currentCallIdRef.current = null;
      setActiveCall(null);
      setIsMinimized(false);
      setLocalStream(null);
      setRemoteStream(null);
    },
    [activeCall, triggerHaptic, recordCallLog]
  );

  // 10. End Active Call
  const endCall = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    cancelCallNotification();

    const currentActive = activeCallRef.current;
    const finalSecs = callDurationRef.current;

    if (currentActive) {
      recordCallLog(
        currentActive,
        finalSecs > 0 ? "completed" : "missed",
        finalSecs
      );
    }

    if (rtcRef.current) {
      rtcRef.current.endCall();
      rtcRef.current = null;
    }
    AudioRouteManager.stop();
    callForegroundService.stop();

    if (activeCall?.id) {
      try {
        await updateDoc(doc(db, "calls", activeCall.id), {
          status: "ended",
          duration: finalSecs,
          endedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("[CallContext] End call error:", e);
      }
    }

    currentCallIdRef.current = null;
    setActiveCall(null);
    setIsMinimized(false);
    setLocalStream(null);
    setRemoteStream(null);
    setCallSeconds(0);
  }, [activeCall?.id, triggerHaptic, recordCallLog]);

  // 11. Control Actions
  const toggleMute = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (rtcRef.current) {
        rtcRef.current.setMute(next);
      }
      AudioRouteManager.setMute(next);
      return next;
    });
  }, [triggerHaptic]);

  const toggleSpeaker = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAudioRouteState((prev) => {
      const next: AudioRoute = prev === "speaker" ? "earpiece" : "speaker";
      setIsSpeaker(next === "speaker");
      AudioRouteManager.setRoute(next);
      return next;
    });
  }, [triggerHaptic]);

  const toggleCamera = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setIsVideoOff((prev) => {
      const next = !prev;
      if (rtcRef.current) {
        rtcRef.current.setCameraEnabled(!next);
      }
      return next;
    });
  }, [triggerHaptic]);

  const flipCamera = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setFacing((prev) => (prev === "front" ? "back" : "front"));
    if (rtcRef.current) {
      rtcRef.current.switchCamera();
    }
  }, [triggerHaptic]);

  const minimizeCall = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setIsMinimized(true);
  }, [triggerHaptic]);

  const expandCall = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setIsMinimized(false);
  }, [triggerHaptic]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callSeconds,
        isMuted,
        isSpeaker,
        audioRoute,
        isVideoOff,
        facing,
        isMinimized,
        localStream,
        remoteStream,
        connectionQuality,
        latestReaction,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        setAudioRoute,
        toggleCamera,
        flipCamera,
        minimizeCall,
        expandCall,
        sendReaction,
        hasPermissions,
        requestPermissions,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
