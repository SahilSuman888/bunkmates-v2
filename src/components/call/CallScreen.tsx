import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
  PanResponder,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "../ui/AppBlurView";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CameraView } from "expo-camera";
import { useCall, AudioRoute } from "../../contexts/CallContext";
import { useUser } from "../../contexts/UserContext";
import { RTCView } from "../../lib/webrtcManager";
import WhatsAppStyleFloatingPreview from "./WhatsAppStyleFloatingPreview";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Quick Reply Presets for Incoming Call
const QUICK_DECLINE_PRESETS = [
  { id: "1", text: "Can't talk right now. What's up?", icon: "chatbubble-ellipses-outline" },
  { id: "2", text: "I'll call you right back in a bit!", icon: "time-outline" },
  { id: "3", text: "In a meeting / class right now.", icon: "briefcase-outline" },
  { id: "4", text: "Driving right now, talk later.", icon: "car-outline" },
];

const EMOJI_REACTIONS = ["❤️", "🔥", "👋", "👍", "🎉", "😂", "😜", "🥳", "🚀", "✨"];

const AUDIO_ROUTES: { id: AudioRoute; label: string; desc: string; icon: any }[] = [
  { id: "earpiece", label: "Phone Earpiece", desc: "Private ear speaker", icon: "phone-portrait-outline" },
  { id: "speaker", label: "Main Loudspeaker", desc: "High-output external speaker", icon: "volume-high-outline" },
  { id: "bluetooth", label: "Bluetooth / Headset", desc: "Connected wireless audio device", icon: "headset-outline" },
];

// ==========================================
// 1. ANIMATED PULSING RADAR HALO RINGS
// ==========================================
function PulsingRings({ isRinging }: { isRinging: boolean }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRingAnim = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2600,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createRingAnim(ring1, 0);
    const anim2 = createRingAnim(ring2, 850);
    const anim3 = createRingAnim(ring3, 1700);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [ring1, ring2, ring3]);

  const getStyle = (val: Animated.Value) => ({
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 2.5],
        }),
      },
    ],
    opacity: val.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0.7, 0.35, 0],
    }),
  });

  return (
    <View style={styles.pulseContainer} pointerEvents="none">
      <Animated.View style={[styles.pulseRing, getStyle(ring1)]} />
      <Animated.View style={[styles.pulseRing, getStyle(ring2)]} />
      <Animated.View style={[styles.pulseRing, getStyle(ring3)]} />
    </View>
  );
}

// ==========================================
// 2. LIVE DYNAMIC AUDIO WAVEFORM EQUALIZER
// ==========================================
function AudioEqualizer({ isMuted }: { isMuted: boolean }) {
  const bars = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.7),
    new Animated.Value(0.95),
    new Animated.Value(0.5),
    new Animated.Value(0.85),
    new Animated.Value(0.4),
    new Animated.Value(0.75),
    new Animated.Value(0.55),
    new Animated.Value(0.9),
  ]).current;

  useEffect(() => {
    if (isMuted) return;

    const anims = bars.map((bar, i) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 0.25 + ((i * 19) % 7) / 10,
            duration: 220 + (i % 4) * 110,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.95 - ((i * 13) % 5) / 10,
            duration: 260 + (i % 3) * 120,
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
    <View style={styles.equalizerRow}>
      {bars.map((bar, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.equalizerBar,
            {
              transform: [{ scaleY: isMuted ? 0.15 : bar }],
              backgroundColor: isMuted ? "#4a5568" : "#00e6b0",
              shadowColor: isMuted ? "transparent" : "#00e6b0",
              shadowOpacity: isMuted ? 0 : 0.6,
              shadowRadius: 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ==========================================
// 3. NETWORK QUALITY & ENCRYPTION BADGE
// ==========================================
function NetworkQualityBadge({
  quality,
  isVideo,
}: {
  quality: "good" | "poor" | "connecting";
  isVideo: boolean;
}) {
  const getQualityColor = () => {
    switch (quality) {
      case "good":
        return "#00e6b0";
      case "poor":
        return "#ff5252";
      case "connecting":
      default:
        return "#ffb300";
    }
  };

  const getQualityLabel = () => {
    switch (quality) {
      case "good":
        return isVideo ? "HD 1080p • Stable" : "HD Voice • 48kHz";
      case "poor":
        return "Weak Network";
      case "connecting":
      default:
        return "Optimizing Connection...";
    }
  };

  return (
    <View style={styles.networkBadgeContainer}>
      <View style={styles.signalBarsRow}>
        <View
          style={[
            styles.signalBar,
            { height: 5, backgroundColor: getQualityColor() },
          ]}
        />
        <View
          style={[
            styles.signalBar,
            {
              height: 8,
              backgroundColor:
                quality === "poor" ? "rgba(255,255,255,0.2)" : getQualityColor(),
            },
          ]}
        />
        <View
          style={[
            styles.signalBar,
            {
              height: 11,
              backgroundColor:
                quality === "good" ? getQualityColor() : "rgba(255,255,255,0.2)",
            },
          ]}
        />
      </View>
      <Text style={[styles.networkLabelText, { color: getQualityColor() }]}>
        {getQualityLabel()}
      </Text>
    </View>
  );
}

// ==========================================
// 4. FLOATING EMOJI REACTION BUBBLES
// ==========================================
interface ReactionItem {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
}

function FloatingReactionsOverlay({
  reactions,
}: {
  reactions: ReactionItem[];
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {reactions.map((item) => {
        const translateY = item.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -SCREEN_HEIGHT * 0.55],
        });
        const opacity = item.anim.interpolate({
          inputRange: [0, 0.1, 0.75, 1],
          outputRange: [0, 1, 0.9, 0],
        });
        const scale = item.anim.interpolate({
          inputRange: [0, 0.2, 0.8, 1],
          outputRange: [0.4, 1.3, 1.1, 0.8],
        });
        const rotate = item.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ["0deg", item.x > SCREEN_WIDTH / 2 ? "15deg" : "-15deg", "0deg"],
        });

        return (
          <Animated.View
            key={item.id}
            style={[
              styles.reactionBubble,
              {
                left: item.x,
                bottom: 140,
                opacity,
                transform: [{ translateY }, { scale }, { rotate }],
              },
            ]}
          >
            <Text style={styles.reactionEmoji}>{item.emoji}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ==========================================
// 5. MAIN CALL SCREEN COMPONENT
// ==========================================
export default function CallScreen() {
  const { user, userData } = useUser();
  const {
    activeCall,
    callSeconds,
    isMuted,
    audioRoute,
    setAudioRoute,
    isVideoOff,
    facing,
    isMinimized,
    localStream,
    remoteStream,
    connectionQuality,
    latestReaction,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    minimizeCall,
    sendReaction,
  } = useCall();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [showAudioRouteSheet, setShowAudioRouteSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [swappedFeeds, setSwappedFeeds] = useState(false);
  const hideTimerRef = useRef<any>(null);
  const lastProcessedReactionRef = useRef<string | null>(null);

  // Self Camera Preview Popup coordinates & spring animation
  const pipWidth = 118;
  const pipHeight = 168;
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 70 : 108;
  const bottomInset = Platform.OS === "ios" ? 175 : 155;

  const pipPan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - pipWidth - 18, y: topInset })).current;
  const pipScaleAnim = useRef(new Animated.Value(0)).current;

  // Spring animation when PiP popup appears
  useEffect(() => {
    if (activeCall?.callType === "video") {
      Animated.spring(pipScaleAnim, {
        toValue: 1,
        bounciness: 8,
        speed: 12,
        useNativeDriver: true,
      }).start();
    } else {
      pipScaleAnim.setValue(0);
    }
  }, [activeCall?.callType, pipScaleAnim]);

  // Snapping logic for Draggable PiP
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pipPan.setOffset({
            x: (pipPan.x as any)._value,
            y: (pipPan.y as any)._value,
          });
          pipPan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pipPan.x, dy: pipPan.y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: () => {
          pipPan.flattenOffset();
          const currentX = (pipPan.x as any)._value;
          const currentY = (pipPan.y as any)._value;

          const targetX =
            currentX < SCREEN_WIDTH / 2 - pipWidth / 2
              ? 18
              : SCREEN_WIDTH - pipWidth - 18;

          const clampedY = Math.max(
            topInset,
            Math.min(currentY, SCREEN_HEIGHT - bottomInset - pipHeight)
          );

          Animated.spring(pipPan, {
            toValue: { x: targetX, y: clampedY },
            bounciness: 8,
            speed: 14,
            useNativeDriver: false,
          }).start();
        },
      }),
    [pipPan, pipWidth, pipHeight, topInset, bottomInset]
  );

  // Auto-hide controls in video call after 5.5s of inactivity
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (activeCall?.callType === "video" && activeCall?.status === "accepted") {
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
        setShowEmojiPicker(false);
      }, 5500);
    }
  }, [activeCall?.callType, activeCall?.status]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetControlsTimer]);

  // Animate a floating reaction bubble on screen
  const animateReaction = useCallback((emoji: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    const newId = `${Date.now()}_${Math.random()}`;
    const anim = new Animated.Value(0);
    const randomX =
      SCREEN_WIDTH * 0.2 + Math.random() * (SCREEN_WIDTH * 0.6 - 40);

    const newReaction: ReactionItem = {
      id: newId,
      emoji,
      x: randomX,
      anim,
    };

    setReactions((prev) => [...prev.slice(-10), newReaction]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 2400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newId));
    });
  }, []);

  // Listen to synchronized incoming reaction from peer via Firestore
  useEffect(() => {
    if (latestReaction && latestReaction.id !== lastProcessedReactionRef.current) {
      lastProcessedReactionRef.current = latestReaction.id;
      animateReaction(latestReaction.emoji);
    }
  }, [latestReaction, animateReaction]);

  // Handle user tapping an emoji in reaction tray
  const handleSendReaction = (emoji: string) => {
    animateReaction(emoji);
    sendReaction(emoji);
  };

  if (!activeCall || isMinimized) return null;

  const isIncoming = activeCall.isIncoming && activeCall.status === "calling";
  const isOutgoingCalling =
    !activeCall.isIncoming && activeCall.status === "calling";
  const isAccepted = activeCall.status === "accepted";
  const isVideo = activeCall.callType === "video";

  const targetName = activeCall.isIncoming
    ? activeCall.callerName
    : activeCall.receiverName;
  const targetAvatar = activeCall.isIncoming
    ? activeCall.callerAvatar
    : activeCall.receiverAvatar;
  const targetHandle = activeCall.isIncoming
    ? activeCall.callerHandle
    : activeCall.receiverHandle;

  const currentUserAvatar =
    userData?.photoURL ||
    userData?.avatar ||
    user?.photoURL ||
    "https://i.pravatar.cc/150";

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const hasRemoteVideo =
    isVideo &&
    isAccepted &&
    remoteStream &&
    typeof remoteStream.toURL === "function";

  const hasLocalVideo =
    isVideo &&
    !isVideoOff &&
    localStream &&
    typeof localStream.toURL === "function";

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
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={minimizeCall}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* BACKGROUND CONTAINER */}
      <View style={styles.container}>
        {/* ======================================================== */}
        {/* VIDEO MODE: FULLSCREEN CAMERA / STREAM FEED */}
        {/* ======================================================== */}
        {isVideo && isAccepted ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (controlsVisible) {
                setControlsVisible(false);
                setShowEmojiPicker(false);
              } else {
                resetControlsTimer();
              }
            }}
          >
            {/* Primary Main Screen Feed (Remote Stream or Swapped Local) */}
            {swappedFeeds ? (
              hasLocalVideo && RTCView ? (
                <RTCView
                  streamURL={localStream.toURL()}
                  style={StyleSheet.absoluteFill}
                  objectFit="cover"
                  mirror={facing === "front"}
                  zOrder={0}
                />
              ) : isVideoOff ? (
                <View style={styles.videoOffFullscreen}>
                  <Image
                    source={{ uri: currentUserAvatar }}
                    style={styles.fullscreenAvatarOff}
                  />
                  <Text style={styles.fullscreenAvatarOffText}>
                    Your camera is off
                  </Text>
                </View>
              ) : (
                <CameraView style={StyleSheet.absoluteFill} facing={facing} mirror={facing === "front"} />
              )
            ) : hasRemoteVideo && RTCView ? (
              <RTCView
                streamURL={remoteStream.toURL()}
                style={StyleSheet.absoluteFill}
                objectFit="cover"
                mirror={false}
                zOrder={0}
              />
            ) : isVideoOff ? (
              <View style={styles.videoOffFullscreen}>
                <Image
                  source={{ uri: targetAvatar }}
                  style={styles.fullscreenAvatarOff}
                />
                <Text style={styles.fullscreenAvatarOffText}>
                  Waiting for peer video...
                </Text>
              </View>
            ) : (
              <View style={styles.videoOffFullscreen}>
                <Image
                  source={{ uri: targetAvatar }}
                  style={styles.fullscreenAvatarOff}
                />
                <Text style={styles.fullscreenAvatarOffText}>
                  Connecting peer video feed...
                </Text>
              </View>
            )}

            {/* Gradient Overlays for Readability */}
            <LinearGradient
              colors={["rgba(6, 10, 15, 0.82)", "transparent", "rgba(6, 10, 15, 0.94)"]}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Connecting Feed Overlay */}
            {!hasRemoteVideo && (
              <View style={styles.connectingOverlay} pointerEvents="none">
                <BlurView intensity={45} tint="dark" style={styles.connectingBadge}>
                  <ActivityIndicator size="small" color="#00e6b0" />
                  <Text style={styles.connectingBadgeText}>
                    Connecting HD Video Feed...
                  </Text>
                </BlurView>
              </View>
            )}
          </Pressable>
        ) : (
          /* AUDIO CALL & RINGING AMBIENT BACKGROUND */
          <LinearGradient
            colors={["#0d1520", "#080d13", "#04070a"]}
            style={StyleSheet.absoluteFill}
          >
            {/* Ambient Blurred Avatar Aura Glow */}
            {targetAvatar ? (
              <Image
                source={{ uri: targetAvatar }}
                style={styles.ambientAvatarBg}
                blurRadius={Platform.OS === "ios" ? 50 : 25}
              />
            ) : null}
            <LinearGradient
              colors={[
                "rgba(0, 230, 176, 0.06)",
                "rgba(6, 10, 15, 0.8)",
                "rgba(4, 7, 10, 0.96)",
              ]}
              style={StyleSheet.absoluteFill}
            />
          </LinearGradient>
        )}

        {/* ======================================================== */}
        {/* TOP BAR / HEADER NAVIGATION */}
        {/* ======================================================== */}
        <Animated.View
          style={[
            styles.topBar,
            isVideo && isAccepted && !controlsVisible && styles.hiddenBar,
          ]}
        >
          {/* Minimize / Down Arrow Button */}
          <Pressable
            style={styles.circleIconBtn}
            onPress={minimizeCall}
            hitSlop={14}
          >
            <Ionicons name="chevron-down" size={24} color="#ffffff" />
          </Pressable>

          {/* Center Call Meta Badge */}
          <View style={styles.callMetaBadge}>
            <View style={styles.securityRow}>
              <Ionicons name="shield-checkmark" size={12} color="#00e6b0" />
              <Text style={styles.securityText}>End-to-End Encrypted</Text>
            </View>

            <Text style={styles.callStatusText}>
              {isIncoming
                ? isVideo
                  ? "Incoming HD Video Call"
                  : "Incoming Voice Call"
                : isOutgoingCalling
                ? "Calling..."
                : isAccepted
                ? formatTimer(callSeconds)
                : "Connecting..."}
            </Text>

            {isAccepted && (
              <NetworkQualityBadge
                quality={connectionQuality}
                isVideo={isVideo}
              />
            )}
          </View>

          {/* Top Right: Flip Camera (if Video Call) or Audio Output Switcher */}
          {isVideo ? (
            <Pressable
              style={styles.circleIconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                flipCamera();
              }}
              hitSlop={14}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={22}
                color="#ffffff"
              />
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.circleIconBtn,
                audioRoute !== "earpiece" && styles.circleIconBtnActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAudioRouteSheet(true);
              }}
              hitSlop={14}
            >
              <Ionicons
                name={getAudioRouteIcon() as any}
                size={22}
                color={audioRoute !== "earpiece" ? "#00140f" : "#ffffff"}
              />
            </Pressable>
          )}
        </Animated.View>

        {/* ======================================================== */}
        {/* CENTER CONTENT */}
        {/* ======================================================== */}
        {/* 1. HERO SECTION (Voice Call OR Outgoing/Incoming Video Call) */}
        {(!isVideo || !isAccepted) && (
          <View style={styles.centerSection}>
            <View style={styles.avatarWrapper}>
              {(isOutgoingCalling || isIncoming || (!isMuted && isAccepted)) && (
                <PulsingRings isRinging={isOutgoingCalling || isIncoming} />
              )}
              <View style={styles.avatarGlowRing}>
                <Image
                  source={{ uri: targetAvatar || "https://i.pravatar.cc/150" }}
                  style={styles.avatarImg}
                />
              </View>

              {/* Live Pulsing Status Dot */}
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isAccepted
                      ? "#00e6b0"
                      : isOutgoingCalling
                      ? "#ffb300"
                      : "#00e676",
                  },
                ]}
              />
            </View>

            {/* Caller / Peer Identity */}
            <Text style={styles.targetNameText} numberOfLines={1}>
              {targetName}
            </Text>
            <Text style={styles.targetHandleText}>@{targetHandle}</Text>

            {/* Equalizer Sound Wave Visualizer (Active Audio Call) */}
            {isAccepted && !isVideo && (
              <View style={styles.soundWaveContainer}>
                <AudioEqualizer isMuted={isMuted} />
              </View>
            )}

            {/* Call State Pill */}
            <View style={styles.callTypePill}>
              <Ionicons
                name={isVideo ? "videocam" : "mic"}
                size={13}
                color="#00e6b0"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.callTypePillText}>
                {isIncoming
                  ? isVideo
                    ? "Incoming HD Video..."
                    : "Incoming Connection"
                  : isOutgoingCalling
                  ? isVideo
                    ? "Connecting HD Video..."
                    : "Ringing Peer..."
                  : isVideo
                  ? "High Definition Video"
                  : isMuted
                  ? "Microphone Muted"
                  : audioRoute === "speaker"
                  ? "Main Speaker Output"
                  : audioRoute === "bluetooth"
                  ? "Bluetooth Audio"
                  : "Private Earpiece"}
              </Text>
            </View>
          </View>
        )}

        {/* 2. DRAGGABLE WHATSAPP-STYLE SELF-CAMERA PREVIEW POPUP (PiP) */}
        {isVideo && (
          swappedFeeds && isAccepted ? (
            <Animated.View
              style={[
                styles.pipContainer,
                {
                  transform: [
                    ...pipPan.getTranslateTransform(),
                    { scale: pipScaleAnim },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSwappedFeeds(false);
                }}
              >
                {hasRemoteVideo && RTCView ? (
                  <RTCView
                    streamURL={remoteStream.toURL()}
                    style={StyleSheet.absoluteFill}
                    objectFit="cover"
                    mirror={false}
                    zOrder={1}
                  />
                ) : (
                  <View style={styles.pipAvatarPlaceholder}>
                    <Image
                      source={{ uri: targetAvatar }}
                      style={styles.pipAvatar}
                    />
                    <Text style={styles.pipOffText}>Peer Stream</Text>
                  </View>
                )}

                <View style={styles.pipTopBar}>
                  <View style={styles.pipPreviewLabelBadge}>
                    <Text style={styles.pipPreviewLabelText}>Peer</Text>
                  </View>
                  <View style={styles.pipSwapBadge}>
                    <Ionicons name="swap-horizontal" size={11} color="#ffffff" />
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ) : (
            <WhatsAppStyleFloatingPreview
              localStream={localStream}
              hasLocalVideo={hasLocalVideo}
              isVideoOff={isVideoOff}
              isMuted={isMuted}
              facing={facing}
              currentUserAvatar={currentUserAvatar}
              isAccepted={isAccepted}
              onFlipCamera={flipCamera}
              onTapToSwap={() => {
                if (isAccepted) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setSwappedFeeds(true);
                }
              }}
            />
          )
        )}

        {/* Floating Reactions Render Layer */}
        <FloatingReactionsOverlay reactions={reactions} />

        {/* ======================================================== */}
        {/* BOTTOM IN-CALL CONTROLS & ACTIONS DOCK */}
        {/* ======================================================== */}
        <Animated.View
          style={[
            styles.bottomControlsContainer,
            isVideo && isAccepted && !controlsVisible && styles.hiddenBar,
          ]}
        >
          {/* Quick Reaction Emojis Tray (Expandable) */}
          {showEmojiPicker && isAccepted && (
            <BlurView intensity={65} tint="dark" style={styles.emojiPickerTray}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.emojiPickerContent}
              >
                {EMOJI_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={styles.emojiOptionBtn}
                    onPress={() => handleSendReaction(emoji)}
                  >
                    <Text style={styles.emojiOptionText}>{emoji}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </BlurView>
          )}

          {isIncoming ? (
            /* ---------------------------------------------------- */
            /* INCOMING CALL ACTIONS (ACCEPT, DECLINE, QUICK REPLY)  */
            /* ---------------------------------------------------- */
            <View style={styles.incomingControlsWrapper}>
              {/* Quick Reply Trigger */}
              <Pressable
                style={styles.quickReplyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowQuickReply(true);
                }}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={16}
                  color="#ffffff"
                />
                <Text style={styles.quickReplyBtnText}>Message & Decline</Text>
              </Pressable>

              <View style={styles.incomingActionsRow}>
                {/* Decline Button */}
                <View style={styles.actionBtnWrapper}>
                  <Pressable
                    style={[styles.largeActionBtn, styles.declineBtn]}
                    onPress={() => declineCall()}
                  >
                    <Ionicons
                      name="call"
                      size={30}
                      color="#ffffff"
                      style={{ transform: [{ rotate: "135deg" }] }}
                    />
                  </Pressable>
                  <Text style={styles.actionBtnLabel}>Decline</Text>
                </View>

                {/* Accept Button */}
                <View style={styles.actionBtnWrapper}>
                  <Pressable
                    style={[styles.largeActionBtn, styles.acceptBtn]}
                    onPress={acceptCall}
                  >
                    <Ionicons
                      name={isVideo ? "videocam" : "call"}
                      size={30}
                      color="#ffffff"
                    />
                  </Pressable>
                  <Text style={styles.actionBtnLabel}>Accept</Text>
                </View>
              </View>
            </View>
          ) : (
            /* ---------------------------------------------------- */
            /* ACTIVE / OUTGOING GLASSMORPHIC IN-CALL DOCK          */
            /* ---------------------------------------------------- */
            <BlurView intensity={60} tint="dark" style={styles.activeGlassBar}>
              <View style={styles.activeControlsRow}>
                {/* 1. MUTE MIC TOGGLE */}
                <Pressable
                  style={[
                    styles.glassControlBtn,
                    isMuted && styles.glassControlActiveAlert,
                  ]}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={isMuted ? "mic-off" : "mic"}
                    size={24}
                    color={isMuted ? "#ff5252" : "#ffffff"}
                  />
                  <Text
                    style={[
                      styles.controlBtnSubText,
                      isMuted && { color: "#ff5252", fontWeight: "800" },
                    ]}
                  >
                    {isMuted ? "Unmute" : "Mute"}
                  </Text>
                </Pressable>

                {/* 2. CAMERA TOGGLE (Video) OR AUDIO SWITCHER (Voice) */}
                {isVideo ? (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      isVideoOff && styles.glassControlActiveAlert,
                    ]}
                    onPress={toggleCamera}
                  >
                    <Ionicons
                      name={isVideoOff ? "videocam-off" : "videocam"}
                      size={24}
                      color={isVideoOff ? "#ff5252" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        isVideoOff && { color: "#ff5252", fontWeight: "800" },
                      ]}
                    >
                      {isVideoOff ? "Cam Off" : "Cam On"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      audioRoute !== "earpiece" && styles.glassControlActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAudioRouteSheet(true);
                    }}
                  >
                    <Ionicons
                      name={getAudioRouteIcon() as any}
                      size={24}
                      color={audioRoute !== "earpiece" ? "#00140f" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        audioRoute !== "earpiece" && styles.controlBtnSubTextActive,
                      ]}
                    >
                      {audioRoute === "speaker"
                        ? "Speaker"
                        : audioRoute === "bluetooth"
                        ? "Bluetooth"
                        : "Ear"}
                    </Text>
                  </Pressable>
                )}

                {/* 3. AUDIO OUTPUT SWITCHER (Video Mode) OR REACTION EMOJIS */}
                {isVideo ? (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      audioRoute !== "speaker" && styles.glassControlActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAudioRouteSheet(true);
                    }}
                  >
                    <Ionicons
                      name={getAudioRouteIcon() as any}
                      size={24}
                      color={audioRoute !== "speaker" ? "#00140f" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        audioRoute !== "speaker" && styles.controlBtnSubTextActive,
                      ]}
                    >
                      Audio
                    </Text>
                  </Pressable>
                ) : isAccepted ? (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      showEmojiPicker && styles.glassControlActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowEmojiPicker((v) => !v);
                    }}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={24}
                      color={showEmojiPicker ? "#00140f" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        showEmojiPicker && styles.controlBtnSubTextActive,
                      ]}
                    >
                      React
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      audioRoute !== "earpiece" && styles.glassControlActive,
                    ]}
                    onPress={() => setShowAudioRouteSheet(true)}
                  >
                    <Ionicons
                      name={getAudioRouteIcon() as any}
                      size={24}
                      color={audioRoute !== "earpiece" ? "#00140f" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        audioRoute !== "earpiece" && styles.controlBtnSubTextActive,
                      ]}
                    >
                      Audio
                    </Text>
                  </Pressable>
                )}

                {/* 4. REACTION TRAY (Video Mode) OR MINIMIZE */}
                {isVideo && isAccepted ? (
                  <Pressable
                    style={[
                      styles.glassControlBtn,
                      showEmojiPicker && styles.glassControlActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowEmojiPicker((v) => !v);
                    }}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={24}
                      color={showEmojiPicker ? "#00140f" : "#ffffff"}
                    />
                    <Text
                      style={[
                        styles.controlBtnSubText,
                        showEmojiPicker && styles.controlBtnSubTextActive,
                      ]}
                    >
                      React
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.glassControlBtn}
                    onPress={minimizeCall}
                  >
                    <MaterialCommunityIcons
                      name="message-text-outline"
                      size={23}
                      color="#ffffff"
                    />
                    <Text style={styles.controlBtnSubText}>Chat</Text>
                  </Pressable>
                )}

                {/* 5. END CALL BUTTON */}
                <Pressable
                  style={[styles.glassControlBtn, styles.endCallBtn]}
                  onPress={endCall}
                >
                  <Ionicons
                    name="call"
                    size={26}
                    color="#ffffff"
                    style={{ transform: [{ rotate: "135deg" }] }}
                  />
                  <Text style={[styles.controlBtnSubText, { color: "#ffffff" }]}>
                    End
                  </Text>
                </Pressable>
              </View>
            </BlurView>
          )}
        </Animated.View>

        {/* ======================================================== */}
        {/* AUDIO OUTPUT ROUTING BOTTOM SHEET */}
        {/* ======================================================== */}
        <Modal
          visible={showAudioRouteSheet}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAudioRouteSheet(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAudioRouteSheet(false)}
          >
            <Pressable style={styles.quickReplySheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={85} tint="dark" style={styles.quickReplyGlass}>
                <View style={styles.sheetHandleBar} />

                <Text style={styles.quickReplyTitle}>Audio Output</Text>
                <Text style={styles.quickReplySubtitle}>
                  Select audio device for this call
                </Text>

                <View style={styles.presetsList}>
                  {AUDIO_ROUTES.map((route) => {
                    const isSelected = audioRoute === route.id;
                    return (
                      <Pressable
                        key={route.id}
                        style={[
                          styles.presetItem,
                          isSelected && styles.presetItemSelected,
                        ]}
                        onPress={() => {
                          setAudioRoute(route.id);
                          setShowAudioRouteSheet(false);
                        }}
                      >
                        <View
                          style={[
                            styles.presetIconWrap,
                            isSelected && styles.presetIconWrapSelected,
                          ]}
                        >
                          <Ionicons
                            name={route.icon}
                            size={20}
                            color={isSelected ? "#00140f" : "#00e6b0"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.presetText,
                              isSelected && { color: "#00e6b0", fontWeight: "800" },
                            ]}
                          >
                            {route.label}
                          </Text>
                          <Text style={styles.presetSubText}>{route.desc}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#00e6b0"
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.cancelPresetBtn}
                  onPress={() => setShowAudioRouteSheet(false)}
                >
                  <Text style={styles.cancelPresetText}>Done</Text>
                </Pressable>
              </BlurView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ======================================================== */}
        {/* QUICK REPLY / DECLINE BOTTOM SHEET MODAL */}
        {/* ======================================================== */}
        <Modal
          visible={showQuickReply}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowQuickReply(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowQuickReply(false)}
          >
            <Pressable style={styles.quickReplySheet} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={80} tint="dark" style={styles.quickReplyGlass}>
                <View style={styles.sheetHandleBar} />

                <Text style={styles.quickReplyTitle}>Quick Decline Message</Text>
                <Text style={styles.quickReplySubtitle}>
                  Choose a preset message to decline and notify {targetName}
                </Text>

                <View style={styles.presetsList}>
                  {QUICK_DECLINE_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.id}
                      style={styles.presetItem}
                      onPress={() => {
                        setShowQuickReply(false);
                        declineCall(preset.text);
                      }}
                    >
                      <View style={styles.presetIconWrap}>
                        <Ionicons
                          name={preset.icon as any}
                          size={18}
                          color="#00e6b0"
                        />
                      </View>
                      <Text style={styles.presetText}>{preset.text}</Text>
                      <Ionicons
                        name="send-outline"
                        size={16}
                        color="rgba(255, 255, 255, 0.4)"
                      />
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={styles.cancelPresetBtn}
                  onPress={() => setShowQuickReply(false)}
                >
                  <Text style={styles.cancelPresetText}>Cancel</Text>
                </Pressable>
              </BlurView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060a0f",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ambientAvatarBg: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    opacity: 0.22,
    transform: [{ scale: 1.25 }],
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 54,
    paddingBottom: 14,
    zIndex: 30,
  },
  hiddenBar: {
    opacity: 0,
    pointerEvents: "none",
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  circleIconBtnActive: {
    backgroundColor: "#00e6b0",
    borderColor: "#00e6b0",
  },
  callMetaBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  securityText: {
    color: "#00e6b0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  callStatusText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  networkBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  signalBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 12,
  },
  signalBar: {
    width: 2.5,
    borderRadius: 1,
  },
  networkLabelText: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  centerSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    marginTop: -20,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  avatarGlowRing: {
    padding: 4,
    borderRadius: 72,
    backgroundColor: "rgba(0, 230, 176, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.4)",
  },
  pulseContainer: {
    position: "absolute",
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#00e6b0",
  },
  avatarImg: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: "#161b22",
  },
  statusDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3.5,
    borderColor: "#060a0f",
  },
  targetNameText: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  targetHandleText: {
    color: "#8b949e",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  soundWaveContainer: {
    marginTop: 22,
    marginBottom: 6,
  },
  equalizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
  },
  equalizerBar: {
    width: 4,
    height: 32,
    borderRadius: 2.5,
  },
  callTypePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.35)",
    marginTop: 18,
  },
  callTypePillText: {
    color: "#00e6b0",
    fontSize: 12,
    fontWeight: "700",
  },
  pipContainer: {
    position: "absolute",
    width: 118,
    height: 168,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(0, 230, 176, 0.55)",
    backgroundColor: "rgba(10, 14, 20, 0.9)",
    zIndex: 35,
    elevation: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  pipAvatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111822",
    padding: 8,
  },
  pipAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.35)",
  },
  pipCamOffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 82, 82, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.4)",
  },
  pipOffText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "800",
  },
  pipTopBar: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  pipMuteBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  pipSwapBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  pipPreviewLabelBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: "rgba(0, 230, 176, 0.4)",
  },
  pipPreviewLabelText: {
    color: "#00e6b0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  pipLiveDotBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.8,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pipLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00e6b0",
  },
  pipFlipBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  videoOffFullscreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0d131a",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenAvatarOff: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(0, 230, 176, 0.3)",
  },
  fullscreenAvatarOffText: {
    color: "#8b949e",
    fontSize: 15,
    fontWeight: "700",
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  connectingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0, 230, 176, 0.35)",
    overflow: "hidden",
  },
  connectingBadgeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomControlsContainer: {
    width: "100%",
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 42 : 30,
    alignItems: "center",
    zIndex: 30,
  },
  incomingControlsWrapper: {
    width: "100%",
    alignItems: "center",
  },
  quickReplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    marginBottom: 28,
  },
  quickReplyBtnText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  incomingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 20,
  },
  actionBtnWrapper: {
    alignItems: "center",
  },
  largeActionBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  declineBtn: {
    backgroundColor: "#ff3b30",
  },
  acceptBtn: {
    backgroundColor: "#00e676",
  },
  actionBtnLabel: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "800",
    marginTop: 10,
    letterSpacing: 0.4,
  },
  activeGlassBar: {
    width: "100%",
    borderRadius: 34,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(14, 20, 28, 0.72)",
  },
  activeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassControlBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  glassControlActive: {
    backgroundColor: "#00e6b0",
  },
  glassControlActiveAlert: {
    backgroundColor: "rgba(255, 82, 82, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(255, 82, 82, 0.6)",
  },
  controlBtnSubText: {
    color: "#8e9aaf",
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 2,
  },
  controlBtnSubTextActive: {
    color: "#00140f",
    fontWeight: "800",
  },
  endCallBtn: {
    backgroundColor: "#ff3b30",
  },
  emojiPickerTray: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(14, 20, 28, 0.8)",
  },
  emojiPickerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emojiOptionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOptionText: {
    fontSize: 22,
  },
  reactionBubble: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  reactionEmoji: {
    fontSize: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  quickReplySheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  quickReplyGlass: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 38 : 24,
    backgroundColor: "rgba(14, 20, 28, 0.95)",
    borderTopWidth: 1.5,
    borderTopColor: "rgba(0, 230, 176, 0.3)",
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignSelf: "center",
    marginBottom: 16,
  },
  quickReplyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  quickReplySubtitle: {
    color: "#8e9aaf",
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 18,
  },
  presetsList: {
    gap: 10,
    marginBottom: 18,
  },
  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  presetItemSelected: {
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    borderColor: "#00e6b0",
  },
  presetIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 230, 176, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  presetIconWrapSelected: {
    backgroundColor: "#00e6b0",
  },
  presetText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  presetSubText: {
    color: "#8e9aaf",
    fontSize: 11.5,
    marginTop: 2,
  },
  cancelPresetBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelPresetText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
