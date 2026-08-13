import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  Pressable,
  Platform,
  StatusBar,
} from "react-native";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useUser } from "../contexts/UserContext";
import { Ionicons } from "@expo/vector-icons";

import { CameraView, Camera } from "expo-camera";
import { WebRTCManager } from "../lib/webrtcManager";

export default function IncomingCallHandler() {
  const { user, userData } = useUser();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let activeCallData: any = null;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "calling" || data.status === "accepted") {
          activeCallData = { id: docSnap.id, ...data };
        }
      });
      setIncomingCall(activeCallData);
    });

    return () => unsub();
  }, [user?.uid]);

  const rtcRef = useRef<WebRTCManager | null>(null);

  // Live Timer when Call is Accepted
  useEffect(() => {
    let timer: any;

    if (incomingCall?.status === "accepted") {
      timer = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [incomingCall?.status]);

  const requestCallPermissions = async () => {
    try {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      const granted = cam.granted && mic.granted;
      setHasPermissions(granted);
      return granted;
    } catch (e) {
      console.log("Permission request error:", e);
      return false;
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall?.id) return;
    await requestCallPermissions();
    try {
      const rtc = new WebRTCManager(incomingCall.id);
      rtcRef.current = rtc;
      await rtc.startCallee(incomingCall.callType === "video");

      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Accept call error:", e);
    }
  };

  const handleDeclineCall = async () => {
    if (rtcRef.current) {
      rtcRef.current.endCall();
      rtcRef.current = null;
    }
    if (!incomingCall?.id) return;
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "declined",
        endedAt: serverTimestamp(),
      });
      setIncomingCall(null);
    } catch (e) {
      console.error("Decline call error:", e);
    }
  };

  const handleEndCall = async () => {
    if (rtcRef.current) {
      rtcRef.current.endCall();
      rtcRef.current = null;
    }
    if (!incomingCall?.id) return;
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "ended",
        endedAt: serverTimestamp(),
      });
      setIncomingCall(null);
    } catch (e) {
      console.error("End call error:", e);
    }
  };

  if (!incomingCall) return null;

  const isRinging = incomingCall.status === "calling";

  return (
    <Modal visible={!!incomingCall} transparent animationType="slide" onRequestClose={handleDeclineCall}>
      <StatusBar barStyle="light-content" backgroundColor="#0b141a" />
      <View style={styles.container}>
        {/* HEADER TITLE */}
        <View style={styles.header}>
          <Text style={styles.callTypeTitle}>
            {incomingCall.callType === "video" ? "BunkMate Video Call" : "BunkMate Voice Call"}
          </Text>
          <Text style={styles.callStatusText}>
            {isRinging
              ? "Incoming Call..."
              : `${String(Math.floor(callSeconds / 60)).padStart(2, "0")}:${String(callSeconds % 60).padStart(2, "0")}`}
          </Text>
        </View>

        {/* LIVE CAMERA PREVIEW IF VIDEO CALL */}
        {incomingCall.callType === "video" && !isRinging ? (
          <View style={styles.cameraContainer}>
            <CameraView style={StyleSheet.absoluteFill} facing={facing} />
          </View>
        ) : (
          /* CALLER AVATAR & NAME */
          <View style={styles.callerSection}>
            <Image
              source={{ uri: incomingCall.callerAvatar || "https://i.pravatar.cc/150" }}
              style={styles.avatarImg}
            />
            <Text style={styles.callerName}>{incomingCall.callerName || "BunkMate"}</Text>
            <Text style={styles.callerHandle}>@{incomingCall.callerHandle || "traveler"}</Text>
          </View>
        )}

        {/* RINGING ACTION BUTTONS (ACCEPT / DECLINE) */}
        {isRinging ? (
          <View style={styles.ringingControlsRow}>
            <Pressable style={styles.declineBtn} onPress={handleDeclineCall}>
              <Ionicons name="call" size={26} color="#ffffff" style={{ transform: [{ rotate: "135deg" }] }} />
              <Text style={styles.btnLabel}>DECLINE</Text>
            </Pressable>

            <Pressable style={styles.acceptBtn} onPress={handleAcceptCall}>
              <Ionicons name="call" size={26} color="#ffffff" />
              <Text style={styles.btnLabel}>ACCEPT</Text>
            </Pressable>
          </View>
        ) : (
          /* ACTIVE CALL CONTROLS */
          <View style={styles.activeControlsRow}>
            <Pressable
              style={[styles.controlBtn, isMuted && styles.controlActive]}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color={isMuted ? "#00140f" : "#ffffff"} />
            </Pressable>

            <Pressable style={styles.declineBtn} onPress={handleEndCall}>
              <Ionicons name="call" size={26} color="#ffffff" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>

            <Pressable
              style={[styles.controlBtn, isSpeaker && styles.controlActive]}
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={22} color={isSpeaker ? "#00140f" : "#ffffff"} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b141a",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 20 : 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 20,
  },
  callTypeTitle: {
    color: "#00e6b0",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  callStatusText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
  },
  cameraContainer: {
    width: "100%",
    height: "60%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  callerSection: {
    alignItems: "center",
  },
  avatarImg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#00e6b0",
    backgroundColor: "#1e2329",
    marginBottom: 16,
  },
  callerName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "900",
  },
  callerHandle: {
    color: "#888888",
    fontSize: 13,
    marginTop: 4,
  },
  ringingControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 30,
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#25d366",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ff5252",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  btnLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
  activeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    marginBottom: 30,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlActive: {
    backgroundColor: "#00e6b0",
  },
});
