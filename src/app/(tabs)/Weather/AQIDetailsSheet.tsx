import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "../../../components/ui/AppBlurView";
import { Feather } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

export type AQIDetailsSheetProps = {
  visible: boolean;
  onClose: () => void;
  aqiValue?: number | null;
  aqiData?: any;
};

export function getAqiInfo(value: number) {
  if (value <= 50) {
    return {
      label: "Good",
      color: "#FFFFFF",
      advice: "Air quality is satisfactory. Enjoy outdoor activities.",
    };
  }
  if (value <= 100) {
    return {
      label: "Moderate",
      color: "#009E73",
      advice: "Sensitive individuals should consider reducing prolonged outdoor exertion.",
    };
  }
  if (value <= 150) {
    return {
      label: "Unhealthy",
      color: "#E69F00",
      advice: "People with respiratory conditions should limit outdoor activity.",
    };
  }
  if (value <= 200) {
    return {
      label: "Very Unhealthy",
      color: "#D55E00",
      advice: "Avoid prolonged outdoor exposure. Wear a mask if necessary.",
    };
  }
  if (value <= 300) {
    return {
      label: "Severe",
      color: "#F0300E",
      advice: "Health warnings of emergency conditions. Stay indoors.",
    };
  }
  return {
    label: "Hazardous",
    color: "#7F0000",
    advice: "Health warnings of emergency conditions. Stay indoors.",
  };
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value !== "string") return null;

  const match = value.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    let hour = Number(match[4]);
    const minute = Number(match[5]);
    const period = match[6].toUpperCase();

    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    return new Date(year, month, day, hour, minute);
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function formatUpdatedTime(value: any) {
  const date = parseDate(value);
  if (!date) return "Just now";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AQIDetailsSheet({
  visible,
  onClose,
  aqiValue,
  aqiData,
}: AQIDetailsSheetProps) {
  const [mounted, setMounted] = useState(visible);

  // Exact Framer Motion initial state: y = 80, scale = 0.98, opacity = 0
  const translateY = useRef(new Animated.Value(80)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const closingRef = useRef(false);

  // Framer Motion Spring physics matching: stiffness: 160, damping: 22, mass: 0.8
  const openSheet = useCallback(() => {
    closingRef.current = false;
    setMounted(true);

    translateY.setValue(80);
    scale.setValue(0.98);
    opacity.setValue(0);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        stiffness: 160,
        damping: 22,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 160,
        damping: 22,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, opacity, scale, translateY]);

  // Framer Motion exit animation matching: exit={{ y: 140, opacity: 0, scale: 0.96 }}
  const closeSheet = useCallback(
    (notifyParent = true) => {
      if (closingRef.current) return;
      closingRef.current = true;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 140,
          stiffness: 120,
          damping: 18,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 0.96,
          stiffness: 120,
          damping: 18,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
        closingRef.current = false;
        if (notifyParent) onClose();
      });
    },
    [backdropOpacity, opacity, onClose, scale, translateY]
  );

  useEffect(() => {
    if (visible) {
      openSheet();
    } else if (mounted) {
      closeSheet(false);
    }
  }, [visible, mounted, openSheet, closeSheet]);

  // Rubber physics pan responder matching framer-motion drag="y"
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_, gesture) => {
        let dy = gesture.dy;
        // Rubber physics curve matching: v < 0 ? v * 0.2 : v * (1 - Math.exp(-v * 0.35 / 100))
        const rubberY =
          dy < 0 ? dy * 0.2 : dy * (1 - Math.exp((-dy * 0.35) / 100));

        translateY.setValue(rubberY);

        // Progress mapping: [0, 300] -> scale: [1, 0.94], opacity: [1, 0.6]
        const progress = Math.min(Math.max(0, rubberY / 300), 1);
        scale.setValue(1 - progress * 0.06);
        opacity.setValue(1 - progress * 0.4);
      },
      onPanResponderRelease: (_, gesture) => {
        const offset = gesture.dy;
        const velocity = gesture.vy;

        // shouldClose matching: offset > 120 || velocity > 700 (0.7 in RN)
        if (offset > 120 || velocity > 0.7) {
          closeSheet();
        } else {
          // Smooth return matching stiffness: 100, damping: 20, mass: 0.7
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              stiffness: 100,
              damping: 20,
              mass: 0.7,
              useNativeDriver: true,
            }),
            Animated.spring(scale, {
              toValue: 1,
              stiffness: 100,
              damping: 20,
              mass: 0.7,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const currentAqi = Number(
    aqiValue ?? aqiData?.maxAqi ?? aqiData?.aqi ?? 17
  );
  const aqiInfo = getAqiInfo(currentAqi);
  const stationName = aqiData?.station || "Adarsh Nagar, Jaipur - RSPCB";
  const cityName = aqiData?.city || "Jaipur";
  const stateName = aqiData?.state || "Rajasthan";
  const lastUpdated = formatUpdatedTime(aqiData?.last_update);

  const pollutants = aqiData?.pollutants || {
    ozone: { value: 17, unit: "ppb" },
    "pm2.5": { value: 18, unit: "µg/m³" },
    pm10: { value: 42, unit: "µg/m³" },
    no2: { value: 12, unit: "ppb" },
    so2: { value: 5, unit: "ppb" },
    co: { value: 0.4, unit: "ppm" },
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => closeSheet()}
    >
      <View style={styles.overlay}>
        {/* BACKDROP */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable style={styles.backdropPress} onPress={() => closeSheet()}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={styles.darkOverlay} />
          </Pressable>
        </Animated.View>

        {/* BOTTOM DRAWER CONTAINER */}
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }, { scale }],
              opacity,
            },
          ]}
        >
          <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View pointerEvents="none" style={styles.glassBackground} />

          {/* DRAG HANDLE */}
          <View {...panResponder.panHandlers} style={styles.dragArea}>
            <View style={styles.dragHandle} />
          </View>

          {/* CONTENT */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={true}
            contentContainerStyle={styles.content}
          >
            {/* HEADER */}
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Air Quality Index</Text>
              <Text style={styles.station} numberOfLines={1}>
                Station: {stationName}
              </Text>
            </View>

            {/* MAIN AQI HERO */}
            <View style={styles.aqiBlock}>
              <Text style={[styles.aqiNumber, { color: aqiInfo.color }]}>
                {currentAqi}
              </Text>
              <Text style={[styles.aqiStatus, { color: aqiInfo.color }]}>
                {aqiInfo.label}
              </Text>
            </View>

            {/* LOCATION INFORMATION */}
            <Text style={styles.sectionLabel}>LOCATION INFORMATION</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>City & State</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {cityName}, {stateName}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>{lastUpdated}</Text>
            </View>

            <View style={styles.horizontalLine} />

            {/* REAL-TIME POLLUTANTS */}
            <Text style={styles.sectionLabel}>REAL-TIME POLLUTANTS</Text>

            <View style={styles.pollutantGrid}>
              {Object.entries(pollutants).map(([key, pollutant]: any) => (
                <View key={key} style={styles.pollutantCard}>
                  <Text style={styles.pollutantName}>{key.toUpperCase()}</Text>
                  <Text style={styles.pollutantValue}>{pollutant.value}</Text>
                  <Text style={styles.pollutantUnit}>{pollutant.unit}</Text>
                </View>
              ))}
            </View>

            {/* HEALTH ADVISORY */}
            <View style={styles.advisory}>
              <View style={styles.advisoryTitleRow}>
                <View
                  style={[
                    styles.sunIcon,
                    { backgroundColor: `${aqiInfo.color}16` },
                  ]}
                >
                  <Feather name="sun" size={13} color={aqiInfo.color} />
                </View>
                <Text style={styles.advisoryTitle}>Health Advisory</Text>
              </View>
              <Text style={styles.advisoryText}>{aqiInfo.advice}</Text>
            </View>

            {/* FOOTER */}
            <Text style={styles.footer}>Data source updated at {lastUpdated}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropPress: {
    flex: 1,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,6,18,0.60)",
  },
  sheet: {
    width: SCREEN_WIDTH - 24,
    maxHeight: SCREEN_HEIGHT * 0.72,
    alignSelf: "center",
    marginBottom: 12,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(20,24,36,0.92)",
    elevation: 24,
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(37,40,53,0.35)",
    borderRadius: 24,
  },
  dragArea: {
    height: 32,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  titleBlock: {
    marginBottom: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  station: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  aqiBlock: {
    alignItems: "center",
    marginVertical: 12,
  },
  aqiNumber: {
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: -1,
  },
  aqiStatus: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
  },
  infoValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  horizontalLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 12,
  },
  pollutantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pollutantCard: {
    width: "31%",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pollutantName: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 9,
    fontWeight: "800",
  },
  pollutantValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },
  pollutantUnit: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 8.5,
  },
  advisory: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    marginTop: 8,
  },
  advisoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sunIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  advisoryTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  advisoryText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11.5,
    lineHeight: 16,
  },
  footer: {
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginTop: 14,
    marginBottom: 4,
  },
});