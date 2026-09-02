import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCall } from "../../contexts/CallContext";

// Live Mini Equalizer Bars for Minimized Pill
function MiniEqualizer({ isMuted }: { isMuted: boolean }) {
  const bars = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.9),
    new Animated.Value(0.6),
    new Animated.Value(0.85),
    new Animated.Value(0.5),
  ]).current;

  useEffect(() => {
    if (isMuted) return;

    const anims = bars.map((bar, i) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 0.2 + ((i * 13) % 7) / 10,
            duration: 200 + (i % 3) * 90,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.95 - ((i * 7) % 5) / 10,
            duration: 240 + (i % 2) * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    });

    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isMuted, bars]);

  return (
    <View style={styles.miniEqualizerRow}>
      {bars.map((bar, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.miniEqualizerBar,
            {
              transform: [{ scaleY: isMuted ? 0.2 : bar }],
              backgroundColor: isMuted ? "#718096" : "#00e6b0",
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function MinimizedCallPill() {
  const {
    activeCall,
    callSeconds,
    isMuted,
    audioRoute,
    isMinimized,
    expandCall,
    endCall,
    toggleMute,
  } = useCall();

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isMinimized && activeCall) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          bounciness: 6,
          speed: 12,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [isMinimized, activeCall, scaleAnim, opacityAnim]);

  if (!activeCall || !isMinimized) return null;

  const targetName = activeCall.isIncoming
    ? activeCall.callerName
    : activeCall.receiverName;
  const targetAvatar = activeCall.isIncoming
    ? activeCall.callerAvatar
    : activeCall.receiverAvatar;

  const isVideo = activeCall.callType === "video";
  const isAccepted = activeCall.status === "accepted";

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getAudioRouteIcon = () => {
    switch (audioRoute) {
      case "speaker":
        return "volume-high";
      case "bluetooth":
        return "headset";
      case "earpiece":
      default:
        return "phone-portrait-outline";
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.touchableCardWrapper,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Pressable
          style={styles.touchableCard}
          onPress={expandCall}
          android_ripple={{ color: "rgba(0, 230, 176, 0.15)" }}
        >
          <BlurView intensity={75} tint="dark" style={styles.pillGlass}>
            {/* Top Border Highlight */}
            <LinearGradient
              colors={["rgba(0, 230, 176, 0.5)", "rgba(0, 230, 176, 0.1)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topHighlightLine}
            />

            {/* Avatar with Live Indicator */}
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: targetAvatar || "https://i.pravatar.cc/150" }}
                style={styles.avatar}
              />
              <View
                style={[
                  styles.livePulseDot,
                  {
                    backgroundColor: isAccepted ? "#00e6b0" : "#ffb300",
                  },
                ]}
              />
            </View>

            {/* Peer Info & Timer */}
            <View style={styles.infoCol}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {targetName}
                </Text>
                <Ionicons
                  name={isVideo ? "videocam" : (getAudioRouteIcon() as any)}
                  size={11}
                  color="#00e6b0"
                  style={{ marginLeft: 4 }}
                />
              </View>

              <View style={styles.timerRow}>
                <Text style={styles.timerText}>
                  {isAccepted ? formatTimer(callSeconds) : "Calling..."}
                </Text>
                {isAccepted && !isVideo && (
                  <MiniEqualizer isMuted={isMuted} />
                )}
              </View>
            </View>

            {/* Quick Action Controls: Mute & Hangup */}
            <View style={styles.actionsRow}>
              {/* Quick Mute */}
              <Pressable
                style={[
                  styles.smallBtn,
                  isMuted && styles.smallBtnMuted,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                hitSlop={10}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={15}
                  color={isMuted ? "#ff5252" : "#ffffff"}
                />
              </Pressable>

              {/* End Call */}
              <Pressable
                style={[styles.smallBtn, styles.smallBtnEnd]}
                onPress={(e) => {
                  e.stopPropagation();
                  endCall();
                }}
                hitSlop={10}
              >
                <Ionicons
                  name="call"
                  size={15}
                  color="#ffffff"
                  style={{ transform: [{ rotate: "135deg" }] }}
                />
              </Pressable>

              {/* Tap to expand icon */}
              <View style={styles.expandIconWrap}>
                <Ionicons name="expand-outline" size={14} color="#00e6b0" />
              </View>
            </View>
          </BlurView>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 6 : 46,
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: "center",
  },
  touchableCardWrapper: {
    width: "100%",
    maxWidth: 390,
  },
  touchableCard: {
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  pillGlass: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 26,
    backgroundColor: "rgba(14, 20, 28, 0.85)",
    borderWidth: 1.2,
    borderColor: "rgba(0, 230, 176, 0.35)",
  },
  topHighlightLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1.5,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#00e6b0",
    backgroundColor: "#161b22",
  },
  livePulseDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
    borderColor: "#0a1017",
  },
  infoCol: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
    maxWidth: 130,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  timerText: {
    color: "#00e6b0",
    fontSize: 11.5,
    fontWeight: "700",
  },
  miniEqualizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2.5,
    height: 12,
    marginLeft: 4,
  },
  miniEqualizerBar: {
    width: 2.5,
    height: 12,
    borderRadius: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginLeft: 8,
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnMuted: {
    backgroundColor: "rgba(255, 82, 82, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.55)",
  },
  smallBtnEnd: {
    backgroundColor: "#ff3b30",
  },
  expandIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
