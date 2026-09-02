import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  Easing,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle, Rect, G } from "react-native-svg";
import { CameraView } from "expo-camera";
import { RTCView } from "../../lib/webrtcManager";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PIP_WIDTH = 118;
const PIP_HEIGHT = 168;
const PADDING = 16;

export interface WhatsAppStyleFloatingPreviewProps {
  localStream: any;
  hasLocalVideo: boolean;
  isVideoOff: boolean;
  isMuted: boolean;
  facing: "front" | "back";
  currentUserAvatar: string;
  isAccepted: boolean;
  onFlipCamera: () => void;
  onTapToSwap?: () => void;
  initialFiltersActive?: boolean;
}

/**
 * WhatsApp-Style Illustrative Background Pattern (Doodles & Geometric Accents)
 */
function WhatsAppDoodlePatternOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 120 170">
        <G stroke="#25D366" strokeWidth="1" strokeOpacity="0.32" fill="none">
          {/* Top Left Chat Bubble */}
          <Path d="M 12 18 C 12 12, 28 12, 28 18 C 28 24, 18 24, 14 28 L 12 28 Z" />
          <Circle cx="20" cy="18" r="1.5" fill="#25D366" fillOpacity="0.35" />

          {/* Top Right Cloud / Travel Doodle */}
          <Path d="M 94 16 C 90 12, 104 10, 108 16 C 112 20, 100 24, 94 22 Z" />
          <Circle cx="106" cy="15" r="1" fill="#25D366" fillOpacity="0.4" />

          {/* Side Wave Lines */}
          <Path d="M 6 50 Q 14 54 6 58 Q 14 62 6 66" />
          <Path d="M 114 52 Q 106 56 114 60 Q 106 64 114 68" />

          {/* Bottom Left Compass Star */}
          <Path d="M 16 142 L 20 134 L 24 142 L 32 146 L 24 150 L 20 158 L 16 150 L 8 146 Z" />

          {/* Bottom Right Travel Map Node */}
          <Circle cx="102" cy="144" r="5" strokeDasharray="2,2" />
          <Circle cx="102" cy="144" r="2" fill="#25D366" fillOpacity="0.5" />
          <Path d="M 97 154 L 107 154" />
        </G>
      </Svg>

      {/* Subtle green ambient vignette */}
      <LinearGradient
        colors={[
          "rgba(37, 211, 102, 0.16)",
          "transparent",
          "rgba(18, 140, 126, 0.22)",
        ]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/**
 * Soft Diffused Glowing Halo / Aura Outline Effect
 */
function SoftDiffusedGlowingHalo({ pulseAnim }: { pulseAnim: Animated.Value }) {
  const haloScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.08],
  });

  const haloOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.85],
  });

  return (
    <Animated.View
      style={[
        styles.diffusedHaloContainer,
        {
          transform: [{ scale: haloScale }],
          opacity: haloOpacity,
        },
      ]}
      pointerEvents="none"
    >
      {/* Inner Aura Core */}
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0.65)",
          "rgba(37, 211, 102, 0.45)",
          "rgba(0, 230, 176, 0.15)",
          "transparent",
        ]}
        style={styles.diffusedHaloGlow}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

export default function WhatsAppStyleFloatingPreview({
  localStream,
  hasLocalVideo,
  isVideoOff,
  isMuted,
  facing,
  currentUserAvatar,
  isAccepted,
  onFlipCamera,
  onTapToSwap,
  initialFiltersActive = true,
}: WhatsAppStyleFloatingPreviewProps) {
  const [filtersActive, setFiltersActive] = useState<boolean>(initialFiltersActive);

  // Position & Spring Physics
  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - PIP_WIDTH - PADDING,
      y: PADDING + (Platform.OS === "ios" ? 54 : 42),
    })
  ).current;

  // Breathing pulse for diffused halo
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Snap to 4 corners of screen
  const snapToClosestCorner = (x: number, y: number) => {
    const midX = SCREEN_WIDTH / 2;
    const midY = SCREEN_HEIGHT / 2;

    const snapX = x < midX ? PADDING : SCREEN_WIDTH - PIP_WIDTH - PADDING;
    const snapY =
      y < midY
        ? PADDING + (Platform.OS === "ios" ? 54 : 42)
        : SCREEN_HEIGHT - PIP_HEIGHT - 130;

    Animated.spring(pan, {
      toValue: { x: snapX, y: snapY },
      useNativeDriver: false,
      friction: 6,
      tension: 45,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // If tap (no drag movement), execute tap-to-swap
        if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          if (onTapToSwap) {
            onTapToSwap();
          }
          return;
        }

        snapToClosestCorner(currentX, currentY);
      },
    })
  ).current;

  const toggleFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFiltersActive((prev) => !prev);
  };

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFlipCamera();
  };

  return (
    <Animated.View
      style={[
        styles.pipContainer,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Outer Halo Glow when Filters Active */}
      {filtersActive && !isVideoOff && (
        <SoftDiffusedGlowingHalo pulseAnim={pulseAnim} />
      )}

      {/* Main Video View Box */}
      <View style={styles.pipContentBox}>
        {/* Local Stream Render */}
        {isVideoOff ? (
          <View style={styles.pipAvatarPlaceholder}>
            <Image
              source={{ uri: currentUserAvatar || "https://i.pravatar.cc/150" }}
              style={styles.pipAvatar}
            />
            <View style={styles.pipCamOffBadge}>
              <Ionicons name="videocam-off" size={11} color="#ff5252" />
              <Text style={styles.pipOffText}>Cam Off</Text>
            </View>
          </View>
        ) : hasLocalVideo && RTCView ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={facing === "front"}
            zOrder={1}
          />
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === "front"}
          />
        )}

        {/* WhatsApp-Style Illustrative Overlay Filter */}
        {filtersActive && !isVideoOff && <WhatsAppDoodlePatternOverlay />}

        {/* Top Floating Badges */}
        <View style={styles.pipTopBar}>
          {isMuted ? (
            <View style={styles.pipMuteBadge}>
              <Ionicons name="mic-off" size={9} color="#ff5252" />
            </View>
          ) : (
            <View style={styles.pipPreviewLabelBadge}>
              <Text style={styles.pipPreviewLabelText}>
                {!isAccepted ? "Preview" : "You"}
              </Text>
            </View>
          )}

          {filtersActive && (
            <View style={styles.pipActiveFilterBadge}>
              <Text style={styles.pipActiveFilterText}>WA-Glow</Text>
            </View>
          )}
        </View>

        {/* In-Preview Action Bar */}
        <View style={styles.pipBottomBar} pointerEvents="box-none">
          {/* Flip Camera Button */}
          <Pressable
            onPress={handleFlip}
            style={({ pressed }) => [
              styles.pipMiniBtn,
              pressed && styles.pipMiniBtnPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="camera-reverse" size={14} color="#ffffff" />
          </Pressable>

          {/* Magic Wand / Filter Toggle Button */}
          <Pressable
            onPress={toggleFilters}
            style={({ pressed }) => [
              styles.pipMiniBtn,
              filtersActive && styles.pipMiniBtnActive,
              pressed && styles.pipMiniBtnPressed,
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="wand"
              size={14}
              color={filtersActive ? "#25D366" : "#ffffff"}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pipContainer: {
    position: "absolute",
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    zIndex: 999,
  },
  pipContentBox: {
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0d1520",
    borderWidth: 1.8,
    borderColor: "rgba(0, 230, 176, 0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
  },
  diffusedHaloContainer: {
    position: "absolute",
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    zIndex: -1,
    justifyContent: "center",
    alignItems: "center",
  },
  diffusedHaloGlow: {
    width: PIP_WIDTH + 28,
    height: PIP_HEIGHT + 28,
    borderRadius: 28,
  },
  pipAvatarPlaceholder: {
    flex: 1,
    backgroundColor: "#161f2e",
    alignItems: "center",
    justifyContent: "center",
  },
  pipAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: "rgba(0, 230, 176, 0.4)",
  },
  pipCamOffBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  pipOffText: {
    color: "#ff5252",
    fontSize: 9,
    fontWeight: "700",
  },
  pipTopBar: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  pipMuteBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    padding: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(255, 82, 82, 0.4)",
  },
  pipPreviewLabelBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  pipPreviewLabelText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  pipActiveFilterBadge: {
    backgroundColor: "rgba(37, 211, 102, 0.85)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
  },
  pipActiveFilterText: {
    color: "#0a1018",
    fontSize: 7.5,
    fontWeight: "800",
  },
  pipBottomBar: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  pipMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(10, 16, 24, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  pipMiniBtnActive: {
    backgroundColor: "rgba(18, 140, 126, 0.88)",
    borderColor: "#25D366",
  },
  pipMiniBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});
