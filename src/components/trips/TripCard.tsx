import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
// ...existing code...
import AvatarGroup from "./AvatarGroup";

const { width } = Dimensions.get("window");

interface Props {
  trip: any;
  onPress: () => void;
}

export default function TripCard({ trip, onPress }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400 });
  }, []);

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const budgetPercent =
    trip.budget?.amount
      ? (trip.budget.used / trip.budget.amount) * 100
      : 0;

  const timelinePercent = trip.timelineProgress || 0;

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <ImageBackground
          source={{ uri: trip.iconURL }}
          style={styles.image}
          imageStyle={{ borderRadius: 24 }}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)"]}
            style={styles.overlay}
          >
            <BlurView intensity={30} tint="dark" style={styles.blurCard}>
              {/* Header */}
              <View style={styles.topRow}>
                <Text style={styles.name}>{trip.name}</Text>

                <AvatarGroup members={trip.memberProfiles || []} />
              </View>

              {/* Location */}
              <Text style={styles.location}>
                {trip.location}
              </Text>

              <Text style={styles.date}>
                {trip.startDate} → {trip.endDate}
              </Text>

              {/* Budget */}
              {trip.budget && (
                <View style={{ marginTop: 15 }}>
                  <Text style={styles.label}>
                    Budget ₹{trip.budget.used || 0} / ₹
                    {trip.budget.amount || 0}
                  </Text>

                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${budgetPercent}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Timeline */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>
                  Timeline {trip.timelineStats?.completed || 0} /{" "}
                  {trip.timelineStats?.total || 0}
                </Text>

                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.timelineFill,
                      { width: `${timelinePercent}%` },
                    ]}
                  />
                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 22,
  },
  image: {
    width: width - 40,
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
  },
  overlay: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  blurCard: {
    borderRadius: 20,
    padding: 18,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  location: {
    color: "#ddd",
    marginTop: 4,
  },
  date: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    color: "#ccc",
    fontSize: 12,
    marginBottom: 4,
  },
  progressBg: {
    width: "100%",
    height: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  timelineFill: {
    height: "100%",
    backgroundColor: "#4caf50",
  },
});