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
  getDoc,
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
  sendOneSignalCallNotification,
  showOngoingCallNotification,
} from "../lib/callNotifications";
import {
  sendCallPushAndFirestoreNotification,
  sendMissedCallPushAndFirestoreNotification,
} from "../lib/sendAppNotification";
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
  isGroupCall?: boolean;
  groupName?: string;
  groupMembers?: any[];
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
    isGroupCall?: boolean;
    groupName?: string;
    groupMembers?: any[];
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
  loadAndShowCall: (callId: string) => Promise<void>;
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
  const callTimeoutTimerRef = useRef<any>(null);

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

  // 1. Listen for Incoming Calls (both 1:1 calls where receiverId === user.uid and group calls where memberIds contains user.uid)
  useEffect(() => {
    if (!user?.uid) return;

    const q1 = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid)
    );
    const q2 = query(
      collection(db, "calls"),
      where("memberIds", "array-contains", user.uid)
    );

    const handleSnapshot = (snapshot: any) => {
      let incomingData: ActiveCallData | null = null;

      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data();
        // Ignore calls initiated by this user
        if (data.callerId === user.uid) return;

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
              isGroupCall: data.isGroupCall || false,
              groupName: data.groupName || undefined,
              groupMembers: data.groupMembers || [],
            };
          }
        }
      });

      if (incomingData) {
        currentCallIdRef.current = (incomingData as ActiveCallData).id;
        setActiveCall(incomingData);

        if ((incomingData as ActiveCallData).status === "calling") {
          // Play phone's native ringtone out of the loudspeaker and show local notification
          AudioRouteManager.startRingtone();
          showLocalIncomingCallNotification(
            (incomingData as ActiveCallData).callerName,
            (incomingData as ActiveCallData).callType,
            (incomingData as ActiveCallData).id
          );
        } else if ((incomingData as ActiveCallData).status === "accepted") {
          AudioRouteManager.stopRingtone();
          cancelCallNotification();
        }
      } else if (activeCall?.isIncoming) {
        // Incoming call was cancelled or missed by caller
        AudioRouteManager.stopRingtone();
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
    };

    const unsub1 = onSnapshot(q1, handleSnapshot);
    const unsub2 = onSnapshot(q2, handleSnapshot);

    return () => {
      unsub1();
      unsub2();
      AudioRouteManager.stopRingtone();
    };
  }, [user?.uid, activeCall?.isIncoming, recordCallLog]);

  // 2. Listen to Active Outgoing Call doc status updates
  useEffect(() => {
    if (!activeCall?.id || activeCall?.isIncoming) return;

    const unsub = onSnapshot(doc(db, "calls", activeCall.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === "accepted") {
        AudioRouteManager.stopRingtone();
        cancelCallNotification();
        if (callTimeoutTimerRef.current) {
          clearTimeout(callTimeoutTimerRef.current);
          callTimeoutTimerRef.current = null;
        }
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
        AudioRouteManager.stopRingtone();
        cancelCallNotification();
        if (callTimeoutTimerRef.current) {
          clearTimeout(callTimeoutTimerRef.current);
          callTimeoutTimerRef.current = null;
        }
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
        AudioRouteManager.stopRingtone();
        cancelCallNotification();
        if (callTimeoutTimerRef.current) {
          clearTimeout(callTimeoutTimerRef.current);
          callTimeoutTimerRef.current = null;
        }
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

  // 4. Global Ringtone & Call Timeout Safety Cleanup
  // Ensure ringtone is stopped immediately whenever status transitions away from 'calling'
  useEffect(() => {
    if (!activeCall || activeCall.status !== "calling") {
      AudioRouteManager.stopRingtone();
      cancelCallNotification();
      if (callTimeoutTimerRef.current) {
        clearTimeout(callTimeoutTimerRef.current);
        callTimeoutTimerRef.current = null;
      }
    }
  }, [activeCall?.status]);

  // 5. Load and Show Incoming Call (for deep-linking from OneSignal push clicks)
  const loadAndShowCall = useCallback(
    async (callId: string) => {
      if (!callId) return;
      try {
        console.log("[CallContext] loadAndShowCall fetching call:", callId);
        const snap = await getDoc(doc(db, "calls", callId));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === "calling" || data.status === "accepted") {
          currentCallIdRef.current = snap.id;
          const incomingObj: ActiveCallData = {
            id: snap.id,
            callerId: data.callerId,
            callerName: data.callerName || "BunkMate",
            callerAvatar: data.callerAvatar || "https://i.pravatar.cc/150",
            callerHandle: data.callerHandle || "traveler",
            receiverId: data.receiverId,
            receiverName: data.receiverName || "BunkMate",
            receiverAvatar: data.receiverAvatar || "https://i.pravatar.cc/150",
            receiverHandle: data.receiverHandle || "traveler",
            callType: data.callType || "audio",
            status: data.status,
            isIncoming: data.callerId !== user?.uid,
            createdAt: data.createdAt,
            acceptedAt: data.acceptedAt,
            isGroupCall: data.isGroupCall || false,
            groupName: data.groupName || undefined,
            groupMembers: data.groupMembers || [],
          };
          setActiveCall(incomingObj);
          setIsMinimized(false);
          if (data.status === "calling" && data.callerId !== user?.uid) {
            AudioRouteManager.startRingtone();
          }
        }
      } catch (e) {
        console.warn("[CallContext] loadAndShowCall error:", e);
      }
    },
    [user?.uid]
  );

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
      isGroupCall,
      groupName,
      groupMembers,
    }: {
      receiverId: string;
      receiverName?: string;
      receiverAvatar?: string;
      receiverHandle?: string;
      callType: CallType;
      isGroupCall?: boolean;
      groupName?: string;
      groupMembers?: any[];
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
        isGroupCall: isGroupCall || false,
        groupName: groupName || receiverName,
        groupMembers: groupMembers || [],
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

      const targetMemberIds =
        isGroupCall && groupMembers && groupMembers.length > 0
          ? groupMembers
              .map((m: any) => m.uid || m.id)
              .filter((id: string) => id && id !== user.uid)
          : [receiverId];

      try {
        await setDoc(doc(db, "calls", callDocId), {
          callId: callDocId,
          callerId: user.uid,
          callerName,
          callerAvatar,
          callerHandle,
          receiverId,
          memberIds: [user.uid, ...targetMemberIds],
          receiverName: receiverName || "BunkMate",
          receiverAvatar: receiverAvatar || "https://i.pravatar.cc/150",
          receiverHandle: receiverHandle || "traveler",
          callType,
          status: "calling",
          isGroupCall: isGroupCall || false,
          groupName: groupName || null,
          groupMembers: groupMembers || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Send high priority OneSignal call push (with ringtone) and write to Firestore notifications
        sendCallPushAndFirestoreNotification({
          receiverIds: targetMemberIds,
          callerId: user.uid,
          callerName,
          callerAvatar,
          callType,
          callId: callDocId,
          isGroupCall: isGroupCall || false,
          groupName: groupName || receiverName,
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

        // 35s Call Timeout: Auto end if receiver does not answer (like WhatsApp / Phone calls)
        if (callTimeoutTimerRef.current) {
          clearTimeout(callTimeoutTimerRef.current);
        }
        callTimeoutTimerRef.current = setTimeout(async () => {
          if (activeCallRef.current?.status === "calling") {
            console.log("[CallContext] Call timed out after 35s — no answer");
            AudioRouteManager.stopRingtone();
            cancelCallNotification();

            try {
              await updateDoc(doc(db, "calls", callDocId), {
                status: "missed",
                endedAt: serverTimestamp(),
              });
            } catch (e) {}

            // Send Missed Call Push (Screenshot 2) to callee
            sendMissedCallPushAndFirestoreNotification({
              receiverId,
              callerId: user.uid,
              callerName,
              callerAvatar,
              callType,
            });

            if (activeCallRef.current) {
              recordCallLog(activeCallRef.current, "missed", 0);
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

            Alert.alert("No Answer", `${receiverName || "User"} did not answer.`);
          }
        }, 35000);
      } catch (e) {
        console.error("[CallContext] startCall error:", e);
      }
    },
    [user, userData, requestPermissions, triggerHaptic, recordCallLog]
  );

  // 8. Accept Incoming Call
  const acceptCall = useCallback(async () => {
    if (!activeCall?.id) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    AudioRouteManager.stopRingtone();
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
      AudioRouteManager.stopRingtone();
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
    AudioRouteManager.stopRingtone();
    cancelCallNotification();

    const currentActive = activeCallRef.current;
    const finalSecs = callDurationRef.current;

    if (currentActive) {
      recordCallLog(
        currentActive,
        finalSecs > 0 ? "completed" : "missed",
        finalSecs
      );

      // If caller hangs up before receiver answers, send Missed Call notification to receiver
      if (currentActive.status === "calling" && !currentActive.isIncoming) {
        sendMissedCallPushAndFirestoreNotification({
          receiverId: currentActive.receiverId,
          callerId: user?.uid || currentActive.callerId,
          callerName: currentActive.callerName,
          callerAvatar: currentActive.callerAvatar,
          callType: currentActive.callType,
        });
      }
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
  }, [activeCall, triggerHaptic, recordCallLog]);

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
        loadAndShowCall,
        hasPermissions,
        requestPermissions,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
