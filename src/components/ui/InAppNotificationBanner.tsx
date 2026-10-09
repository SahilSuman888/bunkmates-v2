import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "./AppBlurView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AppNotificationPayload,
  NotificationCategory,
  subscribeInAppNotification,
} from "../../lib/NotificationService";
import { useAppSettings } from "../../contexts/AppSettingsContext";

const { width } = Dimensions.get("window");

export function InAppNotificationBanner() {
  const router = useRouter();
  const { triggerHaptic } = useAppSettings();

  const [currentNotification, setCurrentNotification] = useState<AppNotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimeoutRef = useRef<any>(null);

  const dismissBanner = useCallback(() => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentNotification(null);
    });
  }, [opacity, translateY]);

  const showBanner = useCallback(
    (payload: AppNotificationPayload) => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }

      setCurrentNotification(payload);
      triggerHaptic("medium");

      translateY.setValue(-120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          stiffness: 200,
          damping: 20,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 4.5 seconds
      dismissTimeoutRef.current = setTimeout(() => {
        dismissBanner();
      }, 4500);
    },
    [dismissBanner, opacity, triggerHaptic, translateY]
  );

  useEffect(() => {
    const unsubscribe = subscribeInAppNotification((payload) => {
      showBanner(payload);
    });

    return () => {
      unsubscribe();
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [showBanner]);

  // Swipe up to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -4,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -20 || gesture.vy < -0.5) {
          dismissBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!currentNotification) return null;

  const getCategoryMeta = (cat: NotificationCategory) => {
    switch (cat) {
      case "tripUpdates":
        return { icon: "airplane", color: "#38bdf8", label: "Trip Update" };
      case "chatMessages":
        return { icon: "chatbubble-ellipses", color: "#10b981", label: "Chat" };
      case "reminders":
        return { icon: "alarm", color: "#f59e0b", label: "Reminder" };
      case "recommendations":
        return { icon: "sparkles", color: "#a855f7", label: "Discovery" };
      case "promotions":
        return { icon: "pricetag", color: "#f43f5e", label: "Special Deal" };
      default:
        return { icon: "notifications", color: "#ffffff", label: "Alert" };
    }
  };

  const meta = getCategoryMeta(currentNotification.category);

  const handlePress = () => {
    const route = currentNotification.route;
    dismissBanner();
    if (route) {
      setTimeout(() => {
        try {
          router.push(route as any);
        } catch (e) {
          console.warn("Notification route navigate error:", e);
        }
      }, 100);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeContainer} pointerEvents="box-none">
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.animatedWrapper,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Pressable style={styles.cardPressable} onPress={handlePress}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cardGlow} />

          {/* Left Icon Pill */}
          <View style={[styles.iconBox, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          </View>

          {/* Content */}
          <View style={styles.contentWrap}>
            <View style={styles.topRow}>
              <Text style={[styles.categoryPill, { color: meta.color }]}>
                {meta.label.toUpperCase()}
              </Text>
              <Text style={styles.timeNow}>Just now</Text>
            </View>
            <Text style={styles.titleText} numberOfLines={1}>
              {currentNotification.title}
            </Text>
            <Text style={styles.bodyText} numberOfLines={2}>
              {currentNotification.message}
            </Text>
          </View>

          {/* Close Action */}
          <Pressable
            style={styles.closeBtn}
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              dismissBanner();
            }}
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999999,
    alignItems: "center",
  },
  animatedWrapper: {
    width: width - 24,
    maxWidth: 440,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  cardPressable: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 24, 30, 0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentWrap: {
    flex: 1,
    paddingRight: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  categoryPill: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  timeNow: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "500",
  },
  titleText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 2,
  },
  bodyText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11.5,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: 4,
  },
});
